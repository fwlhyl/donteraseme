import * as THREE from 'three';
import { GalleryStore } from '../core/GalleryStore';
import type { GalleryArtwork, GalleryMode } from '../core/GalleryStore';
import './artGallery.css';

const PAGE_SIZE = 10;
const ROOM_WIDTH = 20;
const ROOM_DEPTH = 18;
const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4;
const MODES: Record<GalleryMode, string> = {
    endless: '创造模式', defense: '守卫模式', drawing: '纯画画模式', legacy: '旧画框作品'
};
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

interface WallSlot { x: number; z: number; rotation: number; }
interface WallArtwork { mesh: THREE.Mesh; artwork: GalleryArtwork; }

function message(error: unknown): string {
    return error instanceof Error ? error.message : '画作暂时无法读取，请返回主菜单后重试。';
}

function artworkDate(timestamp: number): string {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
}

function releaseTree(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            const map = (material as THREE.MeshBasicMaterial).map;
            if (map) textures.add(map);
        }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    root.clear();
}

/** A self-contained, local-only gallery. Combat never renders while this view is open. */
export class ArtGallery {
    private root: HTMLElement | null = null;
    private stage: HTMLElement | null = null;
    private list: HTMLElement | null = null;
    private notice: HTMLElement | null = null;
    private hint: HTMLElement | null = null;
    private pageLabel: HTMLElement | null = null;
    private previousButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private walkButton: HTMLButtonElement | null = null;
    private detail: HTMLElement | null = null;
    private detailReturnFocus: HTMLElement | null = null;
    private returnFocus: HTMLElement | null = null;
    private closeCallback: (() => void) | null = null;
    private events: AbortController | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private pageGroup: THREE.Group | null = null;
    private raycaster = new THREE.Raycaster();
    private walls: WallArtwork[] = [];
    private keys = new Set<string>();
    private yaw = 0;
    private pitch = 0;
    private frame = 0;
    private lastFrameTime = 0;
    private session = 0;
    private pageGeneration = 0;
    private detailGeneration = 0;
    private page = 0;
    private artworks: GalleryArtwork[] = [];
    private displayUrls = new Map<string, string>();
    private detailUrls = new Set<string>();
    private downloadUrls = new Map<string, ReturnType<typeof setTimeout>>();
    private hovered: GalleryArtwork | null = null;
    private fallbackReason = '';

    public async open(onClose: () => void): Promise<void> {
        if (this.root) this.close();
        const session = ++this.session;
        this.closeCallback = onClose;
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.events = new AbortController();
        this.mount();
        this.createRoom();
        this.bindEvents();
        this.root!.focus();
        this.startRendering();

        let migrationWarning = '';
        try {
            await GalleryStore.migrateLegacyFrames();
        } catch (error) {
            migrationWarning = `旧画框迁移未完成，原存档已保留。${message(error)}`;
        }
        if (session !== this.session || !this.root) return;
        try {
            this.artworks = await GalleryStore.list();
            if (session !== this.session || !this.root) return;
            await this.showPage(0);
            if (session === this.session && migrationWarning) this.setNotice(migrationWarning, true);
        } catch (error) {
            if (session === this.session) this.setNotice(message(error), true);
        }
    }

    public close(): void {
        if (!this.root) return;
        ++this.session;
        ++this.pageGeneration;
        this.events?.abort();
        this.events = null;
        this.releasePointer();
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.keys.clear();
        this.closeDetail(false);
        this.releasePage();
        this.disposeRenderer();
        for (const [url, timer] of this.downloadUrls) {
            clearTimeout(timer);
            URL.revokeObjectURL(url);
        }
        this.downloadUrls.clear();
        this.root.remove();
        this.root = null;
        this.stage = this.list = this.notice = this.hint = this.pageLabel = null;
        this.previousButton = this.nextButton = this.walkButton = null;
        this.artworks = [];
        const callback = this.closeCallback;
        this.closeCallback = null;
        const focus = this.returnFocus;
        this.returnFocus = null;
        callback?.();
        if (focus?.isConnected) focus.focus();
    }

    private button(label: string, action: () => void, className = ''): HTMLButtonElement {
        const button = element('button', `gallery-button ${className}`, label);
        button.type = 'button';
        // These listeners belong to the removable button, not a long-lived signal;
        // a room change can collect its cards and decoded images immediately.
        button.addEventListener('click', action);
        return button;
    }

    private mount(): void {
        const root = element('section', 'art-gallery');
        root.id = 'art-gallery';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', '我的画廊');
        root.tabIndex = -1;
        this.root = root;
        const header = element('header', 'gallery-header');
        const heading = element('div', 'gallery-heading');
        heading.append(element('h1', '', '我的画廊'), element('span', '', '只收藏在这台设备 · 无敌人，无时间限制'));
        const controls = element('div', 'gallery-header-actions');
        this.walkButton = this.button('进入漫游', () => { void this.requestPointer(); }, 'gallery-primary');
        this.walkButton.id = 'gallery-walk-btn';
        const exit = this.button('返回主菜单', () => this.close());
        exit.id = 'gallery-exit-btn';
        controls.append(this.walkButton, exit);
        header.append(heading, controls);
        this.stage = element('div', 'gallery-stage');
        this.stage.setAttribute('aria-label', '3D 画廊场景');
        const sidebar = element('aside', 'gallery-sidebar');
        sidebar.append(element('h2', '', '本展厅作品'));
        this.list = element('div', 'gallery-list');
        this.list.id = 'gallery-artwork-list';
        sidebar.append(this.list);
        const crosshair = element('div', 'gallery-crosshair', '+');
        crosshair.setAttribute('aria-hidden', 'true');
        this.hint = element('div', 'gallery-look-hint', '点击「进入漫游」：WASD 移动，鼠标转头，靠近作品按 E 或点击查看。');
        const footer = element('footer', 'gallery-footer');
        const pager = element('div', 'gallery-pager');
        this.previousButton = this.button('上一展厅', () => { void this.showPage(this.page - 1); });
        this.previousButton.id = 'gallery-previous-btn';
        this.pageLabel = element('span', 'gallery-page-label', '正在读取作品…');
        this.pageLabel.id = 'gallery-page-label';
        this.nextButton = this.button('下一展厅', () => { void this.showPage(this.page + 1); });
        this.nextButton.id = 'gallery-next-btn';
        this.previousButton.disabled = this.nextButton.disabled = true;
        pager.append(this.previousButton, this.pageLabel, this.nextButton);
        footer.append(pager, element('span', 'gallery-key-hint', 'Esc 释放鼠标 · 列表可直接查看 · ↑↓移动 / ←→转头'));
        this.notice = element('div', 'gallery-notice');
        this.notice.id = 'gallery-notice';
        this.notice.setAttribute('role', 'status');
        this.notice.hidden = true;
        root.append(this.stage, header, sidebar, crosshair, this.hint, this.notice, footer);
        document.body.append(root);
    }

    private createRoom(): void {
        try {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.shadowMap.enabled = false;
            this.renderer.domElement.className = 'gallery-canvas';
            this.renderer.domElement.setAttribute('aria-hidden', 'true');
            this.stage!.append(this.renderer.domElement);
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color('#efe8d5');
            this.camera = new THREE.PerspectiveCamera(65, 1, 0.08, 60);
            this.scene.add(new THREE.HemisphereLight('#ffffff', '#8b806c', 2.2));
            const light = new THREE.DirectionalLight('#fff7e5', 1.8);
            light.position.set(4, 6, 5);
            this.scene.add(light);
            this.box(ROOM_WIDTH, 0.2, ROOM_DEPTH, 0, -0.1, 0, '#d1c5aa');
            this.box(ROOM_WIDTH + 0.4, 5, 0.2, 0, 2.5, -ROOM_DEPTH / 2, '#f8f3e5');
            this.box(ROOM_WIDTH + 0.4, 5, 0.2, 0, 2.5, ROOM_DEPTH / 2, '#e5dfce');
            this.box(0.2, 5, ROOM_DEPTH, -ROOM_WIDTH / 2, 2.5, 0, '#ece6d9');
            this.box(0.2, 5, ROOM_DEPTH, ROOM_WIDTH / 2, 2.5, 0, '#ece6d9');
            this.box(ROOM_WIDTH, 0.17, 0.12, 0, 0.09, -ROOM_DEPTH / 2 + 0.12, '#9e998d');
            this.box(0.12, 0.17, ROOM_DEPTH, -ROOM_WIDTH / 2 + 0.12, 0.09, 0, '#9e998d');
            this.box(0.12, 0.17, ROOM_DEPTH, ROOM_WIDTH / 2 - 0.12, 0.09, 0, '#9e998d');
            const floorLines = new THREE.GridHelper(20, 10, '#b6aa90', '#b6aa90');
            floorLines.scale.z = 0.9;
            floorLines.position.y = 0.005;
            this.scene.add(floorLines);
            const title = this.label('DONT ERASE ME  /  我的画廊', 6.5, 0.72, '#f4ead2');
            title.rotation.y = Math.PI;
            title.position.set(0, 3.0, ROOM_DEPTH / 2 - 0.14);
            this.scene.add(title);
            this.pageGroup = new THREE.Group();
            this.scene.add(this.pageGroup);
            this.fallbackReason = '';
            this.root!.dataset.renderer = 'webgl';
            this.resize();
            this.resetCamera();
        } catch {
            this.activateFallback('这台设备暂时无法启动 3D 渲染，已切换为作品列表。查看和导出仍可正常使用。');
        }
    }

    private box(w: number, h: number, d: number, x: number, y: number, z: number, color: string): void {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        mesh.position.set(x, y, z);
        this.scene!.add(mesh);
    }

    private label(text: string, width: number, height: number, background = '#faf5e9'): THREE.Mesh {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 128;
        const context = canvas.getContext('2d')!;
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#35332f';
        context.font = '36px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 512, 64, 968);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    }

    private slots(): WallSlot[] {
        return [
            ...[-7.2, -2.4, 2.4, 7.2].map(x => ({ x, z: -ROOM_DEPTH / 2 + 0.16, rotation: 0 })),
            ...[-5, 0, 5].map(z => ({ x: -ROOM_WIDTH / 2 + 0.16, z, rotation: Math.PI / 2 })),
            ...[-5, 0, 5].map(z => ({ x: ROOM_WIDTH / 2 - 0.16, z, rotation: -Math.PI / 2 })),
        ];
    }

    private async showPage(requested: number): Promise<void> {
        if (!this.root) return;
        const pageCount = Math.max(1, Math.ceil(this.artworks.length / PAGE_SIZE));
        this.page = Math.max(0, Math.min(pageCount - 1, requested));
        const generation = ++this.pageGeneration;
        const session = this.session;
        this.releasePointer();
        this.closeDetail(false);
        this.releasePage();
        this.resetCamera();
        this.setNotice(this.fallbackReason, Boolean(this.fallbackReason));
        this.pageLabel!.textContent = `展厅 ${this.page + 1} / ${pageCount} · 共 ${this.artworks.length} 幅`;
        this.previousButton!.disabled = this.page === 0;
        this.nextButton!.disabled = this.page === pageCount - 1;
        this.list!.replaceChildren();
        const items = this.artworks.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
        if (!items.length) {
            this.list!.append(element('p', 'gallery-empty', '这里还没有作品。完成任意一局或纯画画后，点击「保存到画廊」就能挂到墙上。'));
        }
        const slots = this.slots();
        const pending: { artwork: GalleryArtwork; card: HTMLButtonElement; mesh: THREE.Mesh | null }[] = [];
        for (let index = 0; index < PAGE_SIZE; index++) {
            const artwork = items[index];
            const mesh = this.mountWall(slots[index], artwork, this.page * PAGE_SIZE + index + 1);
            if (!artwork) continue;
            const card = this.button('', () => { void this.showDetail(artwork); }, 'gallery-artwork-card');
            card.dataset.artworkId = artwork.id;
            card.setAttribute('aria-label', `查看 ${artwork.name}，${MODES[artwork.mode]}`);
            const text = element('span', 'gallery-artwork-caption');
            text.append(element('strong', '', artwork.name), element('small', '', MODES[artwork.mode]));
            card.append(text);
            this.list!.append(card);
            pending.push({ artwork, card, mesh });
        }
        // Only this room's display-sized images are decoded, at most two concurrently.
        let next = 0;
        const worker = async () => {
            while (next < pending.length) {
                const item = pending[next++];
                try {
                    const blob = await GalleryStore.getDisplay(item.artwork.id);
                    if (session !== this.session || generation !== this.pageGeneration || !this.root) return;
                    if (!blob) throw new Error(`「${item.artwork.name}」的图片未找到，原记录已保留。`);
                    const url = URL.createObjectURL(blob);
                    this.displayUrls.set(item.artwork.id, url);
                    const image = await this.loadImage(url);
                    if (session !== this.session || generation !== this.pageGeneration || !this.root) return;
                    // Keep the GPU source detached at its natural dimensions.
                    // Thumbnail CSS can otherwise change HTMLImageElement.width,
                    // which Three uses to choose mip levels (small works go black).
                    const thumbnail = image.cloneNode(false) as HTMLImageElement;
                    thumbnail.alt = '';
                    thumbnail.className = 'gallery-thumbnail';
                    item.card.prepend(thumbnail);
                    if (item.mesh && this.renderer) {
                        const texture = new THREE.Texture(image);
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                        texture.needsUpdate = true;
                        const material = item.mesh.material as THREE.MeshBasicMaterial;
                        material.map = texture;
                        material.needsUpdate = true;
                    }
                } catch (error) {
                    if (session === this.session && generation === this.pageGeneration && this.root) {
                        this.setNotice(message(error), true);
                        item.card.classList.add('gallery-image-missing');
                    }
                }
            }
        };
        await Promise.all([worker(), worker()]);
    }

    private mountWall(slot: WallSlot, artwork: GalleryArtwork | undefined, number: number): THREE.Mesh | null {
        if (!this.pageGroup) return null;
        const aspect = artwork ? artwork.width / artwork.height : 1.5;
        const width = Math.min(3.4, 2.25 * aspect);
        const height = width / aspect;
        const group = new THREE.Group();
        group.position.set(slot.x, 2.25, slot.z);
        group.rotation.y = slot.rotation;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, height + 0.18, 0.1), new THREE.MeshLambertMaterial({ color: artwork ? '#453e34' : '#c5bda9' }));
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: '#fffdf5' }));
        paper.position.z = 0.057;
        group.add(frame, paper);
        const title = this.label(artwork ? `${number}. ${artwork.name}` : '留给下一幅作品', 3.5, 0.32);
        title.position.set(0, -height / 2 - 0.3, 0.06);
        group.add(title);
        this.pageGroup.add(group);
        if (artwork) this.walls.push({ mesh: paper, artwork });
        return paper;
    }

    private bindEvents(): void {
        const options = { signal: this.events!.signal };
        window.addEventListener('resize', () => this.resize(), options);
        window.addEventListener('blur', () => { this.keys.clear(); this.releasePointer(); }, options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { this.keys.clear(); this.releasePointer(); }
            this.lastFrameTime = 0;
        }, options);
        window.addEventListener('keydown', event => this.keyDown(event), { ...options, capture: true });
        window.addEventListener('keyup', event => {
            this.keys.delete(event.code);
            if (MOVEMENT_KEYS.has(event.code)) event.stopImmediatePropagation();
        }, { ...options, capture: true });
        document.addEventListener('pointerlockchange', () => {
            const locked = this.isLocked();
            this.root?.classList.toggle('gallery-is-walking', locked);
            this.keys.clear();
            this.hovered = null;
            if (this.walkButton) this.walkButton.textContent = locked ? 'Esc 释放鼠标' : '进入漫游';
            this.updateHint();
        }, options);
        document.addEventListener('pointerlockerror', () => {
            this.setNotice('浏览器未允许鼠标锁定。仍可用方向键逛展，或点击左侧作品直接查看。', true);
        }, options);
        document.addEventListener('mousemove', event => {
            if (!this.isLocked() || this.detail || !this.camera) return;
            this.yaw -= event.movementX * 0.002;
            this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.002, -1.2, 1.2);
            this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        }, options);
        this.stage!.addEventListener('click', event => {
            if (this.detail || !this.renderer || !this.camera) return;
            if (this.isLocked()) {
                if (this.hovered) void this.showDetail(this.hovered);
                return;
            }
            const bounds = this.stage!.getBoundingClientRect();
            this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), this.camera);
            const hit = this.raycaster.intersectObjects(this.walls.map(wall => wall.mesh), false)[0];
            const artwork = hit && this.walls.find(wall => wall.mesh === hit.object)?.artwork;
            if (artwork) void this.showDetail(artwork);
            else void this.requestPointer();
        }, options);
        this.renderer?.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            this.activateFallback('3D 渲染连接已中断，已切换为作品列表。你的画作没有丢失。');
        }, options);
    }

    private keyDown(event: KeyboardEvent): void {
        if (!this.root) return;
        if (event.code === 'Tab') {
            const container = this.detail || this.root;
            const focusable = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'))
                .filter(node => node.getClientRects().length > 0);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first) return;
            if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) {
                event.preventDefault(); first.focus();
            }
            return;
        }
        if (event.code === 'Escape') {
            event.stopImmediatePropagation();
            if (this.detail) { event.preventDefault(); this.closeDetail(); }
            else if (this.isLocked()) this.releasePointer();
            else this.walkButton?.focus();
            return;
        }
        if (this.detail) return;
        if (MOVEMENT_KEYS.has(event.code)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.keys.add(event.code);
        } else if (event.code === 'KeyE' && this.hovered && !event.repeat) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void this.showDetail(this.hovered);
        }
    }

    private isLocked(): boolean {
        return Boolean(this.renderer && document.pointerLockElement === this.renderer.domElement);
    }

    private async requestPointer(): Promise<void> {
        const canvas = this.renderer?.domElement;
        if (!canvas || this.detail || this.isLocked()) return;
        const session = this.session;
        try {
            await canvas.requestPointerLock();
            // A browser may resolve a request after the player already left.
            if ((session !== this.session || canvas !== this.renderer?.domElement) && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
        } catch {
            if (session === this.session) this.setNotice('浏览器未允许鼠标锁定。仍可用方向键逛展，或点击左侧作品直接查看。', true);
        }
    }

    private releasePointer(): void {
        if (this.isLocked()) document.exitPointerLock();
        this.keys.clear();
        this.root?.classList.remove('gallery-is-walking');
    }

    private resetCamera(): void {
        if (!this.camera) return;
        this.yaw = this.pitch = 0;
        this.camera.position.set(0, EYE_HEIGHT, 6.8);
        this.camera.rotation.set(0, 0, 0, 'YXZ');
        this.hovered = null;
        this.updateHint();
    }

    private resize(): void {
        if (!this.renderer || !this.camera || !this.stage) return;
        const { width, height } = this.stage.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    private startRendering(): void {
        if (!this.renderer || this.frame) return;
        this.lastFrameTime = 0;
        const animate = (now: number) => {
            if (!this.root || !this.renderer || !this.camera || !this.scene) { this.frame = 0; return; }
            const dt = this.lastFrameTime ? Math.min((now - this.lastFrameTime) / 1000, 0.05) : 0;
            this.lastFrameTime = now;
            if (!document.hidden) {
                if (!this.detail) {
                    let forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
                    let side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
                    const turn = Number(this.keys.has('ArrowLeft')) - Number(this.keys.has('ArrowRight'));
                    this.yaw += turn * 1.5 * dt;
                    if (forward && side) { forward *= Math.SQRT1_2; side *= Math.SQRT1_2; }
                    const speed = WALK_SPEED * dt;
                    this.camera.position.x += (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) * speed;
                    this.camera.position.z += (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) * speed;
                    // The room is convex; clamping a player-radius inset prevents wall clipping.
                    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -ROOM_WIDTH / 2 + 0.5, ROOM_WIDTH / 2 - 0.5);
                    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -ROOM_DEPTH / 2 + 0.5, ROOM_DEPTH / 2 - 0.5);
                    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
                    this.camera.updateMatrixWorld();
                    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
                    const hit = this.raycaster.intersectObjects(this.walls.map(wall => wall.mesh), false)[0];
                    const hovered = hit && hit.distance <= 4.5 ? this.walls.find(wall => wall.mesh === hit.object)?.artwork ?? null : null;
                    if (hovered !== this.hovered) { this.hovered = hovered; this.updateHint(); }
                }
                try { this.renderer.render(this.scene, this.camera); }
                catch {
                    this.activateFallback('3D 渲染暂时不可用，已切换为作品列表。查看和导出仍可正常使用。');
                    this.frame = 0;
                    return;
                }
            }
            this.frame = requestAnimationFrame(animate);
        };
        this.frame = requestAnimationFrame(animate);
    }

    private updateHint(): void {
        if (!this.hint) return;
        this.hint.textContent = this.hovered ? `「${this.hovered.name}」 · 按 E 或点击查看`
            : this.isLocked() ? 'WASD 移动 · 靠近作品按 E / 点击 · Esc 释放鼠标'
                : '点击「进入漫游」：WASD 移动，鼠标转头；也可直接点击作品或使用左侧列表。';
    }

    private async showDetail(artwork: GalleryArtwork): Promise<void> {
        if (!this.root) return;
        this.releasePointer();
        this.closeDetail(false);
        const session = this.session;
        const generation = ++this.detailGeneration;
        this.detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overlay = element('section', 'gallery-detail');
        overlay.id = 'gallery-detail';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', artwork.name);
        overlay.tabIndex = -1;
        const panel = element('div', 'gallery-detail-panel');
        const imageArea = element('div', 'gallery-detail-image-area');
        const loading = element('p', 'gallery-detail-loading', '正在读取作品…');
        imageArea.append(loading);
        const info = element('div', 'gallery-detail-info');
        info.append(element('h2', '', artwork.name), element('p', '', `${MODES[artwork.mode]} · ${artworkDate(artwork.createdAt)} · ${artwork.width} × ${artwork.height}`));
        const actions = element('div', 'gallery-detail-actions');
        const exportButton = this.button('导出原图 PNG', () => { void this.exportArtwork(artwork, exportButton, status); }, 'gallery-primary');
        exportButton.id = 'gallery-export-btn';
        const closeButton = this.button('返回画廊', () => this.closeDetail());
        closeButton.id = 'gallery-detail-close-btn';
        const status = element('p', 'gallery-detail-status');
        status.setAttribute('role', 'status');
        actions.append(exportButton, closeButton);
        info.append(actions, status);
        panel.append(imageArea, info);
        overlay.append(panel);
        this.detail = overlay;
        this.root.append(overlay);
        closeButton.focus();
        try {
            let url = this.displayUrls.get(artwork.id);
            if (!url) {
                const blob = await GalleryStore.getDisplay(artwork.id);
                if (!blob) throw new Error('此作品的图片未找到，原记录已保留。');
                if (session !== this.session || generation !== this.detailGeneration) return;
                url = URL.createObjectURL(blob);
                this.detailUrls.add(url);
            }
            const image = await this.loadImage(url);
            if (session !== this.session || generation !== this.detailGeneration) return;
            image.alt = artwork.name;
            image.id = 'gallery-detail-image';
            imageArea.replaceChildren(image);
        } catch (error) {
            if (session === this.session && generation === this.detailGeneration) loading.textContent = message(error);
        }
    }

    private closeDetail(restoreFocus = true): void {
        ++this.detailGeneration;
        this.detail?.remove();
        this.detail = null;
        for (const url of this.detailUrls) URL.revokeObjectURL(url);
        this.detailUrls.clear();
        if (restoreFocus && this.detailReturnFocus?.isConnected) this.detailReturnFocus.focus();
        this.detailReturnFocus = null;
        this.keys.clear();
    }

    private async exportArtwork(artwork: GalleryArtwork, button: HTMLButtonElement, status: HTMLElement): Promise<void> {
        const session = this.session;
        const generation = this.detailGeneration;
        button.disabled = true;
        status.textContent = '正在准备原图…';
        try {
            const original = await GalleryStore.get(artwork.id);
            if (!original) throw new Error('此作品的原图未找到，原记录已保留。');
            if (session !== this.session || generation !== this.detailGeneration) return;
            let blob = original.blob;
            // Legacy frames may be JPEG or WebP; export actual PNG bytes, not a renamed file.
            if (blob.type !== 'image/png') {
                const inputUrl = URL.createObjectURL(blob);
                this.detailUrls.add(inputUrl);
                try {
                    const image = await this.loadImage(inputUrl);
                    if (session !== this.session || generation !== this.detailGeneration) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('当前设备无法准备 PNG，请重试。');
                    context.drawImage(image, 0, 0);
                    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG 导出失败，请重试。')), 'image/png'));
                    canvas.width = canvas.height = 0;
                } finally {
                    URL.revokeObjectURL(inputUrl);
                    this.detailUrls.delete(inputUrl);
                }
            }
            if (session !== this.session || generation !== this.detailGeneration) return;
            const url = URL.createObjectURL(blob);
            const link = element('a');
            link.href = url;
            const filename = artwork.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80) || 'DontEraseMe';
            link.download = `${filename}.png`;
            document.body.append(link);
            link.click();
            link.remove();
            const timer = setTimeout(() => { URL.revokeObjectURL(url); this.downloadUrls.delete(url); }, 30_000);
            this.downloadUrls.set(url, timer);
            status.textContent = '已交给浏览器保存原图。';
        } catch (error) {
            if (session === this.session && generation === this.detailGeneration) status.textContent = message(error);
        } finally {
            if (button.isConnected) button.disabled = false;
        }
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => { image.onload = image.onerror = null; resolve(image); };
            image.onerror = () => { image.onload = image.onerror = null; reject(new Error('图片无法解码，原存档已保留。')); };
            image.src = url;
        });
    }

    private releasePage(): void {
        if (this.pageGroup) releaseTree(this.pageGroup);
        this.walls = [];
        this.hovered = null;
        for (const url of this.displayUrls.values()) URL.revokeObjectURL(url);
        this.displayUrls.clear();
    }

    private disposeRenderer(): void {
        if (this.scene) releaseTree(this.scene);
        this.pageGroup = null;
        this.scene = null;
        this.camera = null;
        const renderer = this.renderer;
        this.renderer = null;
        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        }
    }

    private activateFallback(reason: string): void {
        this.releasePointer();
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.disposeRenderer();
        this.walls = [];
        this.fallbackReason = reason;
        if (this.root) this.root.dataset.renderer = 'list';
        if (this.walkButton) this.walkButton.hidden = true;
        this.setNotice(reason, true);
    }

    private setNotice(text: string, warning = false): void {
        if (!this.notice) return;
        this.notice.textContent = text;
        this.notice.hidden = !text;
        this.notice.classList.toggle('gallery-notice-warning', warning);
    }
}
