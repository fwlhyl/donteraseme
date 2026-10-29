import { drawArtwork, prepareArtwork } from './DefenseArtwork';
import type { DefenseArtwork } from './DefenseArtwork';
import { ArtworkStore } from './ArtworkStore';
import { convertToStrokes, decodeImage } from './ImageToStrokes';
import './defenseArtworkPicker.css';

type Crop = { x: number; y: number; width: number; height: number };

/** Offline artwork library. The live game only consumes a validated stroke document. */
export class DefenseArtworkPicker {
    public selected: DefenseArtwork | null = null;
    public readonly ready: Promise<void>;
    private readonly host: HTMLElement;
    private readonly cards: HTMLDivElement;
    private readonly status: HTMLParagraphElement;
    private artworks: DefenseArtwork[] = [];
    private selectionVersion = 0;
    private selectionWrite: Promise<void> = Promise.resolve();
    private modal: HTMLDivElement | null = null;
    private returnFocus: HTMLElement | null = null;
    private source: HTMLCanvasElement | null = null;
    private preview: DefenseArtwork | null = null;
    private crop: Crop | undefined;
    private dragStart: { x: number; y: number } | null = null;
    private decodeVersion = 0;
    private conversionVersion = 0;
    private previewTimer = 0;
    private saving = false;

    constructor(host: HTMLElement) {
        this.host = host;
        this.host.classList.add('defense-artwork-picker');
        this.host.innerHTML = `
            <div class="defense-art-library-heading">
                <div><h3>选择要守卫的画作</h3><p>守护保存的画作，也可以将自己的图片转成彩色线稿。全程离线。</p></div>
                <button id="defense-art-import" type="button">＋ 导入自己的图片</button>
            </div>
            <div class="defense-art-cards" role="group" aria-label="守卫画作"></div>
            <p class="defense-art-library-status" role="status" aria-live="polite"></p>`;
        this.cards = this.host.querySelector<HTMLDivElement>('.defense-art-cards')!;
        this.status = this.host.querySelector<HTMLParagraphElement>('.defense-art-library-status')!;
        this.host.querySelector<HTMLButtonElement>('#defense-art-import')!.addEventListener('click', () => this.openImport());
        this.renderCards();
        this.ready = this.loadLibrary();
    }

    public show(visible: boolean): void {
        this.host.hidden = !visible;
        if (!visible) this.closeImport(true);
    }

    public async loadLibrary(): Promise<void> {
        const version = this.selectionVersion;
        try {
            const [artworks, selectedId, drawingId] = await Promise.all([
                ArtworkStore.listArtworks(), ArtworkStore.getSelectedArtworkId(), ArtworkStore.getDrawingArtworkId(),
            ]);
            await Promise.all(artworks.map(artwork => prepareArtwork(artwork).catch(() => undefined)));
            this.artworks = artworks;
            // A slow disk read must not undo a selection made while the menu was opening.
            if (version === this.selectionVersion) {
                this.selected = artworks.find(artwork => artwork.id === selectedId) ?? artworks.find(artwork => artwork.id === drawingId) ?? null;
            }
            this.renderCards();
        } catch (error) {
            this.setStatus(`无法读取本地画作：${this.errorMessage(error)}。`, true);
        }
    }

    private renderCards(): void {
        this.cards.replaceChildren();
        for (const artwork of this.artworks) {
            const card = document.createElement('div');
            card.className = 'defense-art-card';
            const selected = this.selected?.id === artwork.id;
            card.classList.toggle('is-selected', selected);
            const select = document.createElement('button');
            select.type = 'button';
            select.className = 'defense-art-select';
            select.dataset.artworkId = artwork.id;
            select.setAttribute('aria-pressed', String(selected));
            select.setAttribute('aria-label', `${selected ? '已选择：' : '选择：'}${artwork.name}`);
            const thumbnail = document.createElement('canvas');
            thumbnail.width = 234;
            thumbnail.height = 174;
            thumbnail.setAttribute('aria-hidden', 'true');
            this.paintPreview(thumbnail, artwork);
            const name = document.createElement('span');
            name.className = 'defense-art-name';
            name.textContent = artwork.name;
            const caption = document.createElement('span');
            caption.className = 'defense-art-caption';
            caption.textContent = selected ? '本局守卫这幅画' : '已保存在本机';
            select.append(thumbnail, name, caption);
            select.addEventListener('click', () => this.selectArtwork(artwork));
            card.append(select);
            {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'defense-art-delete';
                remove.textContent = '删除';
                remove.setAttribute('aria-label', `删除画作：${artwork.name}`);
                remove.addEventListener('click', () => void this.deleteArtwork(artwork, remove));
                card.append(remove);
            }
            this.cards.append(card);
        }
    }

    private selectArtwork(artwork: DefenseArtwork): void {
        this.selected = artwork;
        const version = ++this.selectionVersion;
        this.renderCards();
        this.setStatus(`本局将守卫「${artwork.name}」。`);
        // Serialize persistence so rapidly selecting two cards cannot reverse the saved choice.
        this.selectionWrite = this.selectionWrite.then(async () => {
            if (version !== this.selectionVersion) return;
            await ArtworkStore.setSelectedArtworkId(artwork.id);
        }).catch(error => {
            if (version === this.selectionVersion) this.setStatus(`本局已选中，但未能记住下次选择：${this.errorMessage(error)}`, true);
        });
    }

    private async deleteArtwork(artwork: DefenseArtwork, button: HTMLButtonElement): Promise<void> {
        if (!window.confirm(`删除本机保存的画作「${artwork.name}」？原始图片文件和已经保存的战斗画作不会被删除。`)) return;
        button.disabled = true;
        try {
            await ArtworkStore.deleteArtwork(artwork.id);
            this.artworks = this.artworks.filter(item => item.id !== artwork.id);
            if (this.selected?.id === artwork.id) this.selected = null;
            await this.loadLibrary();
            window.dispatchEvent(new Event('guard-unlock-changed'));
            this.setStatus(`已删除本机线稿「${artwork.name}」；原始图片文件未改动。`);
        } catch (error) {
            button.disabled = false;
            this.setStatus(`删除失败：${this.errorMessage(error)}`, true);
        }
    }

    private openImport(): void {
        if (this.modal) return;
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.source = null;
        this.preview = null;
        this.crop = undefined;
        this.saving = false;
        const modal = document.createElement('div');
        modal.id = 'defense-art-import-modal';
        modal.className = 'defense-art-import-modal';
        modal.innerHTML = `
            <section class="defense-art-dialog" role="dialog" aria-modal="true" aria-labelledby="defense-art-dialog-title" aria-describedby="defense-art-import-help">
                <div class="defense-art-dialog-heading"><h2 id="defense-art-dialog-title">导入守卫画作</h2><button id="defense-art-close" type="button" aria-label="关闭导入">关闭</button></div>
                <p id="defense-art-import-help">PNG / JPG / WebP，最多 20 MB。只在本机处理，不上传图片；保存的是可擦除、可修复的彩色线稿，不是照片或整块颜色填充。</p>
                <div class="defense-art-file-row"><label for="defense-image-file">选择图片</label><input id="defense-image-file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"></div>
                <div class="defense-art-preview-columns">
                    <section><h3>原图与裁剪</h3><div class="defense-art-canvas-wrap defense-art-source-wrap"><canvas id="defense-art-source" width="780" height="580" aria-label="原图裁剪区域，拖动鼠标框选；也可使用下方自动裁剪"></canvas><span class="defense-art-source-empty">先选择一张图片</span></div>
                        <p>拖动框选保留的区域。留空表示使用整张图。</p>
                        <div class="defense-art-crop-actions"><button id="defense-art-crop-reset" type="button" disabled>重置裁剪</button><label><input id="defense-art-auto-crop" type="checkbox" checked disabled> 自动去掉空白边缘</label></div>
                    </section>
                    <section><h3>实际线稿预览</h3><div class="defense-art-canvas-wrap"><canvas id="defense-art-preview" width="780" height="580" aria-label="转换后的线稿预览"></canvas></div><p>按原图对应位置给轮廓上色；暗色会适当提亮，黑白线条转为浅色以便看清。以此预览为准。</p></section>
                </div>
                <div class="defense-art-settings">
                    <label class="defense-art-title-input">画作名称<input id="defense-art-name" type="text" maxlength="40" placeholder="我的守卫画作" autocomplete="off"></label>
                    <label>保留细节 <output id="defense-art-detail-value">50%</output><input id="defense-art-detail" type="range" min="0" max="100" step="5" value="50" disabled></label>
                    <label>线条粗细 <output id="defense-art-width-value">4</output><input id="defense-art-width" type="range" min="3" max="6" step="1" value="4" disabled></label>
                </div>
                <label class="defense-art-colour-setting"><input id="defense-art-preserve-color" type="checkbox" checked disabled> 保留原图颜色 <span>取消勾选使用浅色单色线稿</span></label>
                <p id="defense-art-import-status" role="status" aria-live="polite">选择图片后可以调整裁剪、细节、线宽和颜色。</p>
                <div class="defense-art-dialog-actions"><span>最多保存 12 幅自定义画作</span><button id="defense-art-cancel" type="button">取消</button><button id="defense-art-save" type="button" disabled>保存并用于本局</button></div>
            </section>`;
        this.modal = modal;
        document.body.append(modal);
        document.addEventListener('keydown', this.onModalKeyDown, true);
        document.addEventListener('keyup', this.onModalKeyUp, true);
        this.element<HTMLButtonElement>('#defense-art-close').addEventListener('click', () => this.closeImport());
        this.element<HTMLButtonElement>('#defense-art-cancel').addEventListener('click', () => this.closeImport());
        this.element<HTMLInputElement>('#defense-image-file').addEventListener('change', event => {
            const file = (event.currentTarget as HTMLInputElement).files?.[0];
            if (file) void this.loadImage(file);
        });
        this.element<HTMLInputElement>('#defense-art-detail').addEventListener('input', event => {
            this.element<HTMLOutputElement>('#defense-art-detail-value').value = `${(event.currentTarget as HTMLInputElement).value}%`;
            this.queuePreview();
        });
        this.element<HTMLInputElement>('#defense-art-width').addEventListener('input', event => {
            this.element<HTMLOutputElement>('#defense-art-width-value').value = (event.currentTarget as HTMLInputElement).value;
            this.queuePreview();
        });
        this.element<HTMLInputElement>('#defense-art-auto-crop').addEventListener('change', () => this.queuePreview());
        this.element<HTMLInputElement>('#defense-art-preserve-color').addEventListener('change', () => this.queuePreview());
        this.element<HTMLButtonElement>('#defense-art-crop-reset').addEventListener('click', () => {
            this.crop = undefined;
            this.element<HTMLInputElement>('#defense-art-auto-crop').checked = true;
            this.drawSource();
            this.queuePreview();
        });
        this.element<HTMLButtonElement>('#defense-art-save').addEventListener('click', () => void this.savePreview());
        const sourceCanvas = this.element<HTMLCanvasElement>('#defense-art-source');
        sourceCanvas.addEventListener('pointerdown', event => this.beginCrop(event));
        sourceCanvas.addEventListener('pointermove', event => this.moveCrop(event));
        sourceCanvas.addEventListener('pointerup', event => this.endCrop(event));
        sourceCanvas.addEventListener('pointercancel', event => this.endCrop(event));
        this.element<HTMLInputElement>('#defense-image-file').focus();
    }

    private closeImport(force = false): void {
        if (!this.modal || (this.saving && !force)) return;
        ++this.decodeVersion;
        ++this.conversionVersion;
        window.clearTimeout(this.previewTimer);
        document.removeEventListener('keydown', this.onModalKeyDown, true);
        document.removeEventListener('keyup', this.onModalKeyUp, true);
        this.modal.remove();
        this.modal = null;
        this.source = null;
        this.preview = null;
        this.dragStart = null;
        this.returnFocus?.focus();
        this.returnFocus = null;
    }

    private readonly onModalKeyDown = (event: KeyboardEvent): void => {
        if (!this.modal) return;
        // Keep shortcuts (including game pause and movement) outside this editor.
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeImport();
        } else if (event.key === 'Tab') {
            const controls = [...this.modal.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        }
    };

    private readonly onModalKeyUp = (event: KeyboardEvent): void => { if (this.modal) event.stopPropagation(); };

    private async loadImage(file: File): Promise<void> {
        const version = ++this.decodeVersion;
        ++this.conversionVersion;
        window.clearTimeout(this.previewTimer);
        this.preview = null;
        this.source = null;
        this.crop = undefined;
        this.dragStart = null;
        // Set the suggestion before decoding: typing a title while a large image
        // loads must not be overwritten by the later asynchronous result.
        this.element<HTMLInputElement>('#defense-art-name').value = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || '我的守卫画作';
        this.setEditorEnabled(false);
        this.clearPreview();
        this.element<HTMLCanvasElement>('#defense-art-source').getContext('2d')!.clearRect(0, 0, 2000, 2000);
        this.element<HTMLElement>('.defense-art-source-empty').hidden = false;
        this.setImportStatus('正在读取图片…');
        try {
            if (file.size > 20 * 1024 * 1024) throw new Error('图片超过 20 MB，请先缩小图片后重试');
            const source = await decodeImage(file);
            if (!this.modal || version !== this.decodeVersion) return;
            this.source = source;
            this.element<HTMLInputElement>('#defense-art-auto-crop').checked = true;
            this.element<HTMLElement>('.defense-art-source-empty').hidden = true;
            this.setEditorEnabled(true);
            this.drawSource();
            this.queuePreview(0);
        } catch (error) {
            if (this.modal && version === this.decodeVersion) this.setImportStatus(this.errorMessage(error), true);
        }
    }

    private setEditorEnabled(enabled: boolean): void {
        if (!this.modal) return;
        for (const id of ['#defense-art-detail', '#defense-art-width', '#defense-art-auto-crop', '#defense-art-crop-reset', '#defense-art-preserve-color']) {
            this.element<HTMLInputElement | HTMLButtonElement>(id).disabled = !enabled;
        }
        this.element<HTMLButtonElement>('#defense-art-save').disabled = true;
    }

    private queuePreview(delay = 220): void {
        if (!this.modal || !this.source || this.saving) return;
        const version = ++this.conversionVersion;
        this.preview = null;
        window.clearTimeout(this.previewTimer);
        this.element<HTMLButtonElement>('#defense-art-save').disabled = true;
        this.setImportStatus('正在生成线稿…');
        this.previewTimer = window.setTimeout(() => void this.convertPreview(version), delay);
    }

    private async convertPreview(version: number): Promise<void> {
        if (!this.source || !this.modal || version !== this.conversionVersion) return;
        const source = this.source;
        const options = {
            detail: Number(this.element<HTMLInputElement>('#defense-art-detail').value) / 100,
            lineWidth: Number(this.element<HTMLInputElement>('#defense-art-width').value),
            autoCrop: this.element<HTMLInputElement>('#defense-art-auto-crop').checked,
            preserveColor: this.element<HTMLInputElement>('#defense-art-preserve-color').checked,
            crop: this.crop ? { ...this.crop } : undefined,
            name: this.element<HTMLInputElement>('#defense-art-name').value.trim() || '我的守卫画作',
        };
        try {
            const artwork = await convertToStrokes(source, options);
            if (!this.modal || version !== this.conversionVersion) return;
            this.preview = artwork;
            this.paintPreview(this.element<HTMLCanvasElement>('#defense-art-preview'), artwork);
            this.element<HTMLButtonElement>('#defense-art-save').disabled = false;
            this.setImportStatus(`${options.preserveColor ? '彩色' : '单色'}线稿已生成，共 ${artwork.strokes.length} 条笔迹。确认预览后，点击「保存并用于本局」。`);
        } catch (error) {
            if (this.modal && version === this.conversionVersion) {
                this.clearPreview();
                this.setImportStatus(this.errorMessage(error), true);
            }
        }
    }

    private async savePreview(): Promise<void> {
        if (!this.modal || !this.preview || this.saving) return;
        const modal = this.modal;
        const artwork: DefenseArtwork = {
            ...this.preview,
            name: this.element<HTMLInputElement>('#defense-art-name').value.trim().slice(0, 40) || '我的守卫画作',
        };
        this.saving = true;
        for (const control of this.modal.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')) control.disabled = true;
        this.setImportStatus('正在保存到本机…');
        try {
            await ArtworkStore.saveArtwork(artwork);
            this.artworks = [...this.artworks.filter(item => item.id !== artwork.id), artwork];
            this.selectArtwork(artwork);
            await this.selectionWrite;
            if (this.modal === modal) {
                this.saving = false;
                this.closeImport();
            }
        } catch (error) {
            if (this.modal === modal) {
                this.saving = false;
                for (const control of this.modal.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')) control.disabled = false;
                this.setImportStatus(`保存失败，画作尚未保存：${this.errorMessage(error)}。可以重试。`, true);
            }
        }
    }

    private canvasPoint(event: PointerEvent): { x: number; y: number } {
        const canvas = this.element<HTMLCanvasElement>('#defense-art-source');
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
            y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)),
        };
    }

    private beginCrop(event: PointerEvent): void {
        if (!this.source || this.saving || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        this.dragStart = this.canvasPoint(event);
        this.crop = undefined;
        const canvas = event.currentTarget as HTMLCanvasElement;
        canvas.setPointerCapture(event.pointerId);
        this.drawSource();
    }

    private moveCrop(event: PointerEvent): void {
        if (!this.dragStart || !this.source) return;
        const end = this.canvasPoint(event);
        this.crop = {
            x: Math.min(this.dragStart.x, end.x), y: Math.min(this.dragStart.y, end.y),
            width: Math.abs(this.dragStart.x - end.x), height: Math.abs(this.dragStart.y - end.y),
        };
        this.drawSource();
    }

    private endCrop(event: PointerEvent): void {
        if (!this.dragStart || !this.source) return;
        this.moveCrop(event);
        this.dragStart = null;
        const canvas = event.currentTarget as HTMLCanvasElement;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (!this.crop || this.crop.width < 8 || this.crop.height < 8) this.crop = undefined;
        if (this.crop) this.element<HTMLInputElement>('#defense-art-auto-crop').checked = false;
        this.drawSource();
        this.queuePreview(0);
    }

    private drawSource(): void {
        if (!this.source || !this.modal) return;
        const canvas = this.element<HTMLCanvasElement>('#defense-art-source');
        if (canvas.width !== this.source.width || canvas.height !== this.source.height) {
            canvas.width = this.source.width;
            canvas.height = this.source.height;
        }
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.source, 0, 0);
        if (!this.crop) return;
        const { x, y, width, height } = this.crop;
        ctx.fillStyle = 'rgba(0, 0, 0, .48)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(x, y, width, height);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#eee4c8';
        ctx.lineWidth = Math.max(2, canvas.width / 260);
        ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
    }

    private paintPreview(canvas: HTMLCanvasElement, artwork: DefenseArtwork): void {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(canvas.width / artwork.width, canvas.height / artwork.height);
        drawArtwork(ctx, artwork);
        ctx.restore();
    }

    private clearPreview(): void {
        if (!this.modal) return;
        const canvas = this.element<HTMLCanvasElement>('#defense-art-preview');
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    }

    private setStatus(message: string, error = false): void {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', error);
    }

    private setImportStatus(message: string, error = false): void {
        if (!this.modal) return;
        const status = this.element<HTMLParagraphElement>('#defense-art-import-status');
        status.textContent = message;
        status.classList.toggle('is-error', error);
    }

    private element<T extends HTMLElement>(selector: string): T { return this.modal!.querySelector<T>(selector)!; }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : '本地存储不可用，请检查磁盘空间或浏览器权限';
    }
}
