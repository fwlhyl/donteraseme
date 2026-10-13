import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Health } from '../components/Health';
import { Projectile } from '../components/Projectile';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { MagicManifestation, type MagicManifestationType, type MagicPenGrade } from '../components/MagicManifestation';
import { WEAPONS } from '../components/Weapon';
import { BulletFactory } from '../entities/BulletFactory';
import { ParticleFactory } from '../entities/ParticleFactory';
import { getLang } from '../i18n/index';
import { emitGameSound } from '../audio/AudioEvents';

interface Point {
    x: number;
    y: number;
}

interface MagicTarget {
    type: MagicManifestationType;
    label: string;
    accent: string;
    paths: Point[][];
}

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 360;
const MAX_INSPIRATION = 45;
const MANIFEST_DURATION_FRAMES = 60 * 10;

const TARGETS: Record<MagicManifestationType, MagicTarget> = {
    tank: {
        type: 'tank',
        label: '坦克',
        accent: '#4ade80',
        paths: [
            [{ x: 170, y: 230 }, { x: 440, y: 230 }, { x: 440, y: 278 }, { x: 170, y: 278 }, { x: 170, y: 230 }],
            [{ x: 235, y: 230 }, { x: 235, y: 185 }, { x: 350, y: 185 }, { x: 350, y: 230 }],
            [{ x: 350, y: 205 }, { x: 475, y: 205 }],
            [{ x: 210, y: 292 }, { x: 400, y: 292 }]
        ]
    },
    robot: {
        type: 'robot',
        label: '机器人',
        accent: '#60a5fa',
        paths: [
            [{ x: 265, y: 95 }, { x: 375, y: 95 }, { x: 375, y: 175 }, { x: 265, y: 175 }, { x: 265, y: 95 }],
            [{ x: 245, y: 185 }, { x: 395, y: 185 }, { x: 395, y: 260 }, { x: 245, y: 260 }, { x: 245, y: 185 }],
            [{ x: 245, y: 205 }, { x: 195, y: 250 }, { x: 215, y: 275 }],
            [{ x: 395, y: 205 }, { x: 445, y: 250 }, { x: 425, y: 275 }],
            [{ x: 275, y: 260 }, { x: 260, y: 310 }],
            [{ x: 365, y: 260 }, { x: 380, y: 310 }]
        ]
    },
    bomber: {
        type: 'bomber',
        label: '轰炸机',
        accent: '#f472b6',
        paths: [
            [{ x: 125, y: 210 }, { x: 275, y: 175 }, { x: 320, y: 105 }, { x: 365, y: 175 }, { x: 515, y: 210 }, { x: 365, y: 235 }, { x: 320, y: 285 }, { x: 275, y: 235 }, { x: 125, y: 210 }],
            [{ x: 320, y: 105 }, { x: 320, y: 285 }]
        ]
    }
};

export class MagicPenSystem extends System {
    private readonly progressByPlayer = new Map<string, number>();
    private readonly accountedKillIds = new Set<string>();
    private readonly playerVisibilityBeforePiloting = new Map<string, boolean>();
    private activePlayerId: string | null = null;
    private readyAnnouncedFor = new Set<string>();

    private readonly hud: HTMLElement;
    private readonly overlay: HTMLElement;
    private readonly board: HTMLCanvasElement;
    private readonly boardCtx: CanvasRenderingContext2D;
    private readonly targetLabel: HTMLElement;
    private readonly hint: HTMLElement;
    private readonly targetButtons = new Map<MagicManifestationType, HTMLButtonElement>();

    private boardOpen = false;
    private boardPlayerId: string | null = null;
    private selectedType: MagicManifestationType = 'tank';
    private strokes: Point[][] = [];
    private isDrawing = false;

    constructor(
        private readonly addEntityCallback: (entity: Entity) => void,
        private readonly isGameplayActive: () => boolean
    ) {
        super();
        this.hud = this.createHud();
        const boardUi = this.createBoard();
        this.overlay = boardUi.overlay;
        this.board = boardUi.canvas;
        this.boardCtx = boardUi.ctx;
        this.targetLabel = boardUi.targetLabel;
        this.hint = boardUi.hint;

        // Capture phase prevents Escape/G from leaking to other gameplay modals while drawing.
        window.addEventListener('keydown', (event: KeyboardEvent) => this.handleKeyDown(event), true);
        window.addEventListener('game-over', () => {
            this.closeBoard(false);
            this.stopAllPiloting();
        });
        window.addEventListener('exit-run', () => {
            this.closeBoard(false);
            this.stopAllPiloting();
        });
    }

    public update(dt: number): void {
        const player = Array.from(this.entities).find(entity => entity.active && entity.tags.has('player'));
        if (!player) {
            this.stopAllPiloting();
            this.hud.style.display = 'none';
            return;
        }

        if (this.activePlayerId !== player.id) {
            if (this.activePlayerId) {
                const previousPlayer = Array.from(this.entities).find(entity => entity.id === this.activePlayerId);
                if (previousPlayer) this.stopPiloting(previousPlayer);
            }
            this.activePlayerId = player.id;
            this.progressByPlayer.set(player.id, 0);
            this.readyAnnouncedFor.delete(player.id);
            this.accountedKillIds.clear();
            this.closeBoard(false);
        }

        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) return;

        this.updateManifestations(player, playerTransform, dt * 60);
        this.collectInactiveEnemyKills(player);
        this.updateHud(player.id);
    }

    private createHud(): HTMLElement {
        const hud = document.createElement('div');
        hud.id = 'magic-pen-hud';
        hud.className = 'hud-note hud-magic';
        hud.style.marginTop = '10px';
        hud.style.color = '#fef08a';
        hud.style.fontSize = '15px';
        hud.style.fontWeight = 'bold';
        hud.style.textShadow = '1px 1px 2px #000';
        document.getElementById('ui')?.appendChild(hud);
        return hud;
    }

    private createBoard(): { overlay: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; targetLabel: HTMLElement; hint: HTMLElement } {
        const overlay = document.createElement('div');
        overlay.id = 'magic-pen-board';
        overlay.className = 'sketch-board-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:12000; display:none; align-items:center; justify-content:center; background:rgba(3,7,18,0.88); padding:20px; box-sizing:border-box;';

        const panel = document.createElement('section');
        panel.className = 'sketch-board-panel';
        panel.style.cssText = 'width:min(760px, 96vw); max-height:calc(100vh - 40px); overflow-y:auto; background:linear-gradient(135deg,#172033,#0f172a); border:2px solid #facc15; border-radius:16px; box-shadow:0 0 42px rgba(250,204,21,.35); padding:18px; box-sizing:border-box; color:#f8fafc;';

        const title = document.createElement('h2');
        title.className = 'sketch-board-title';
        title.textContent = '神笔马良 · 描绘具现';
        title.style.cssText = 'margin:0 0 6px; color:#facc15; text-align:center; letter-spacing:2px;';
        panel.appendChild(title);

        const hint = document.createElement('p');
        hint.className = 'sketch-board-hint';
        hint.style.cssText = 'margin:0 0 14px; color:#cbd5e1; text-align:center; font-size:14px;';
        panel.appendChild(hint);

        const choices = document.createElement('div');
        choices.className = 'sketch-board-choices';
        choices.style.cssText = 'display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:12px;';
        for (const target of Object.values(TARGETS)) {
            const button = document.createElement('button');
            button.className = 'sketch-board-choice';
            button.type = 'button';
            button.textContent = target.label;
            button.style.cssText = 'padding:8px 18px; border:2px solid #475569; border-radius:999px; background:#1e293b; color:#e2e8f0; cursor:pointer; font-weight:bold;';
            button.onclick = () => {
                this.selectedType = target.type;
                this.strokes = [];
                this.hint.textContent = '沿着半透明轮廓作画；越贴近、覆盖越完整，具现越强。';
                this.updateTargetButtons();
                this.redrawBoard();
            };
            this.targetButtons.set(target.type, button);
            choices.appendChild(button);
        }
        panel.appendChild(choices);

        const targetLabel = document.createElement('div');
        targetLabel.className = 'sketch-board-target';
        targetLabel.style.cssText = 'margin:0 0 8px; text-align:center; color:#f8fafc; font-weight:bold;';
        panel.appendChild(targetLabel);

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'sketch-board-canvas-wrap';
        canvasWrap.style.cssText = 'border:2px dashed #64748b; border-radius:12px; overflow:hidden; background:#020617; touch-action:none;';
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_WIDTH;
        canvas.height = BOARD_HEIGHT;
        // The game has a global `canvas { position:absolute }` rule.  Explicitly
        // return this UI canvas to normal document flow, otherwise it covers the
        // controls below it and makes the activation button impossible to click.
        canvas.style.cssText = 'display:block; position:static; top:auto; left:auto; z-index:auto; width:100%; height:auto; cursor:crosshair; touch-action:none;';
        canvasWrap.appendChild(canvas);
        panel.appendChild(canvasWrap);

        const controls = document.createElement('div');
        controls.className = 'sketch-board-controls';
        controls.style.cssText = 'display:flex; justify-content:center; gap:12px; margin-top:14px;';
        const clear = document.createElement('button');
        clear.className = 'btn';
        clear.type = 'button';
        clear.textContent = '重画';
        clear.style.cssText = 'padding:9px 18px; border:1px solid #64748b; border-radius:8px; background:#334155; color:#fff; cursor:pointer;';
        clear.onclick = () => {
            this.strokes = [];
            this.hint.textContent = '沿着半透明轮廓作画；越贴近、覆盖越完整，具现越强。';
            this.redrawBoard();
        };
        const cancel = document.createElement('button');
        cancel.className = 'btn';
        cancel.type = 'button';
        cancel.textContent = '取消';
        cancel.style.cssText = 'padding:9px 18px; border:1px solid #64748b; border-radius:8px; background:#334155; color:#fff; cursor:pointer;';
        cancel.onclick = () => this.closeBoard(true);
        const manifest = document.createElement('button');
        manifest.className = 'btn sketch-board-manifest';
        manifest.type = 'button';
        manifest.textContent = '神笔马良';
        manifest.style.cssText = 'padding:9px 22px; border:2px solid #fde047; border-radius:8px; background:#a16207; color:#fff; cursor:pointer; font-weight:bold;';
        manifest.onclick = () => this.completeDrawing();
        controls.append(clear, cancel, manifest);
        panel.appendChild(controls);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Magic pen canvas context is unavailable');

        const toPoint = (event: PointerEvent): Point => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(BOARD_WIDTH, (event.clientX - rect.left) * BOARD_WIDTH / rect.width)),
                y: Math.max(0, Math.min(BOARD_HEIGHT, (event.clientY - rect.top) * BOARD_HEIGHT / rect.height))
            };
        };

        canvas.addEventListener('pointerdown', event => {
            event.preventDefault();
            canvas.setPointerCapture(event.pointerId);
            this.isDrawing = true;
            this.strokes.push([toPoint(event)]);
            this.redrawBoard();
        });
        canvas.addEventListener('pointermove', event => {
            if (!this.isDrawing) return;
            event.preventDefault();
            const stroke = this.strokes[this.strokes.length - 1];
            const point = toPoint(event);
            const previous = stroke[stroke.length - 1];
            if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
                stroke.push(point);
                this.redrawBoard();
            }
        });
        const stopDrawing = (event: PointerEvent) => {
            if (!this.isDrawing) return;
            this.isDrawing = false;
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
            this.updateDrawingHint();
        };
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointercancel', stopDrawing);

        return { overlay, canvas, ctx, targetLabel, hint };
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (this.boardOpen) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.closeBoard(true);
            }
            return;
        }

        if (event.repeat || event.key.toLowerCase() !== 'g' || !this.isGameplayActive()) return;
        event.preventDefault();
        this.openBoard();
    }

    private addInspiration(playerId: string, amount: number): void {
        const previous = this.progressByPlayer.get(playerId) || 0;
        const next = Math.min(MAX_INSPIRATION, previous + Math.max(0, Math.floor(amount)));
        this.progressByPlayer.set(playerId, next);
        if (previous < MAX_INSPIRATION && next >= MAX_INSPIRATION) {
            this.readyAnnouncedFor.add(playerId);
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: '神笔灵感已满！按 G 键描绘具现。' } }));
        }
    }

    private openBoard(): void {
        const player = Array.from(this.entities).find(entity => entity.active && entity.tags.has('player'));
        if (!player) return;
        const progress = this.progressByPlayer.get(player.id) || 0;
        if (progress < MAX_INSPIRATION) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `神笔灵感不足：${progress}/${MAX_INSPIRATION}` } }));
            return;
        }
        if (this.hasActiveManifestation(player.id)) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: '正在驾驶神笔载具，等它消散后再召唤。' } }));
            return;
        }

        this.boardOpen = true;
        this.boardPlayerId = player.id;
        this.selectedType = 'tank';
        this.strokes = [];
        this.overlay.style.display = 'flex';
        this.hint.textContent = '沿着半透明轮廓作画；越贴近、覆盖越完整，具现越强。';
        this.updateTargetButtons();
        this.redrawBoard();
        window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: true } }));
    }

    private closeBoard(resumeGame: boolean): void {
        if (!this.boardOpen && this.overlay.style.display === 'none') return;
        this.boardOpen = false;
        this.boardPlayerId = null;
        this.isDrawing = false;
        this.overlay.style.display = 'none';
        const game = (window as any).gameInstance;
        if (game?.inputManager) game.inputManager.mouse.down = false;
        if (resumeGame) {
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
        }
    }

    private updateTargetButtons(): void {
        const target = TARGETS[this.selectedType];
        this.targetLabel.textContent = `当前描绘：${target.label}`;
        for (const [type, button] of this.targetButtons) {
            const selected = type === this.selectedType;
            button.style.borderColor = selected ? TARGETS[type].accent : '#475569';
            button.style.background = selected ? '#334155' : '#1e293b';
            button.style.color = selected ? '#ffffff' : '#cbd5e1';
        }
    }

    private redrawBoard(): void {
        const target = TARGETS[this.selectedType];
        const ctx = this.boardCtx;
        ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        ctx.strokeStyle = 'rgba(148,163,184,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= BOARD_WIDTH; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, BOARD_HEIGHT);
            ctx.stroke();
        }
        for (let y = 0; y <= BOARD_HEIGHT; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(BOARD_WIDTH, y);
            ctx.stroke();
        }

        ctx.save();
        ctx.strokeStyle = target.accent;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 13;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([8, 12]);
        for (const path of target.paths) this.strokePath(ctx, path);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const stroke of this.strokes) {
            if (stroke.length === 1) {
                ctx.beginPath();
                ctx.arc(stroke[0].x, stroke[0].y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fef08a';
                ctx.fill();
            } else {
                this.strokePath(ctx, stroke);
            }
        }
        ctx.restore();
    }

    private updateDrawingHint(): void {
        const totalLength = this.getStrokeLength();
        if (totalLength < 80) {
            this.hint.textContent = '继续沿轮廓绘制；完成一笔足够长的线条后即可具现。';
            return;
        }

        const coverage = this.getCoverage(TARGETS[this.selectedType]);
        const grade: MagicPenGrade = coverage >= 0.72 ? 'A' : coverage >= 0.40 ? 'B' : 'C';
        this.hint.textContent = `当前覆盖度 ${Math.round(coverage * 100)}%，预计 ${grade} 级。可继续优化，完成后点击“神笔马良”具现。`;
    }

    private strokePath(ctx: CanvasRenderingContext2D, points: Point[]): void {
        if (points.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index++) {
            ctx.lineTo(points[index].x, points[index].y);
        }
        ctx.stroke();
    }

    private completeDrawing(): void {
        if (!this.boardOpen || !this.boardPlayerId) return;
        const totalLength = this.getStrokeLength();
        if (totalLength < 80) {
            this.hint.textContent = '至少画出一笔完整的轮廓后才能具现；灵感不会被消耗。';
            return;
        }

        const coverage = this.getCoverage(TARGETS[this.selectedType]);
        const grade: MagicPenGrade = coverage >= 0.72 ? 'A' : coverage >= 0.40 ? 'B' : 'C';
        const multipliers: Record<MagicPenGrade, number> = { A: 1.35, B: 1, C: 0.68 };
        const player = Array.from(this.entities).find(entity => entity.id === this.boardPlayerId && entity.active && entity.tags.has('player'));
        if (!player) {
            this.closeBoard(false);
            return;
        }

        const manifestation = this.createManifestation(player, this.selectedType, grade, multipliers[grade]);
        this.addEntityCallback(manifestation);
        const transform = manifestation.getComponent(Transform)!;
        for (const particle of ParticleFactory.createExplosion(transform.x, transform.y, TARGETS[this.selectedType].accent, 18)) {
            this.addEntityCallback(particle);
        }

        this.progressByPlayer.set(player.id, 0);
        this.readyAnnouncedFor.delete(player.id);
        window.dispatchEvent(new CustomEvent('magic-pen-drawn', {
            detail: {
                type: this.selectedType,
                grade,
                coverage,
                width: BOARD_WIDTH,
                height: BOARD_HEIGHT,
                strokes: this.strokes.map(stroke => stroke.map(point => ({ ...point })))
            }
        }));
        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `神笔驾驶：${TARGETS[this.selectedType].label} · ${grade} 级（持续 10 秒）` } }));
        this.closeBoard(true);
        emitGameSound('magic', { x: transform.x, y: transform.y });
    }

    private getStrokeLength(): number {
        let total = 0;
        for (const stroke of this.strokes) {
            for (let index = 1; index < stroke.length; index++) {
                total += Math.hypot(stroke[index].x - stroke[index - 1].x, stroke[index].y - stroke[index - 1].y);
            }
        }
        return total;
    }

    private getCoverage(target: MagicTarget): number {
        const segments: Array<[Point, Point]> = [];
        for (const stroke of this.strokes) {
            for (let index = 1; index < stroke.length; index++) {
                segments.push([stroke[index - 1], stroke[index]]);
            }
        }
        if (segments.length === 0) return 0;

        const samples: Point[] = [];
        for (const path of target.paths) {
            for (let index = 1; index < path.length; index++) {
                const from = path[index - 1];
                const to = path[index];
                const length = Math.hypot(to.x - from.x, to.y - from.y);
                const steps = Math.max(1, Math.ceil(length / 9));
                for (let step = 0; step <= steps; step++) {
                    const ratio = step / steps;
                    samples.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
                }
            }
        }

        const covered = samples.filter(sample => segments.some(([from, to]) => this.pointToSegmentDistance(sample, from, to) <= 28)).length;
        return samples.length === 0 ? 0 : covered / samples.length;
    }

    private pointToSegmentDistance(point: Point, from: Point, to: Point): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y);
        const ratio = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
        return Math.hypot(point.x - (from.x + dx * ratio), point.y - (from.y + dy * ratio));
    }

    private createManifestation(player: Entity, type: MagicManifestationType, grade: MagicPenGrade, damageMultiplier: number): Entity {
        const playerTransform = player.getComponent(Transform)!;
        const entity = new Entity();
        entity.tags.add('magic_manifestation');
        entity.addComponent(new Transform(playerTransform.x, playerTransform.y));
        this.startPiloting(player, type);

        if (type === 'tank') {
            entity.addComponent(new Renderable('#4ade80', 24, 58, 38, 'magic_tank', 50));
        } else if (type === 'robot') {
            entity.addComponent(new Renderable('#60a5fa', 26, 44, 56, 'magic_robot', 50));
        } else {
            entity.addComponent(new Renderable('#f472b6', 30, 70, 42, 'magic_bomber', 50));
        }

        entity.addComponent(new MagicManifestation(type, player.id, grade, damageMultiplier, MANIFEST_DURATION_FRAMES));
        return entity;
    }

    /**
     * The manifestation is a temporary vehicle, not a companion. Player
     * movement/collision remain authoritative while the vehicle takes the
     * player's exact position and replaces the player avatar visually.
     */
    private startPiloting(player: Entity, type: MagicManifestationType): void {
        const playerRenderable = player.getComponent(Renderable);
        if (playerRenderable && !this.playerVisibilityBeforePiloting.has(player.id)) {
            this.playerVisibilityBeforePiloting.set(player.id, playerRenderable.visible);
            playerRenderable.visible = false;
        }
        player.tags.add('magic_piloting');
        player.tags.add(`magic_piloting_${type}`);
        player.attacking = false;
    }

    private stopPiloting(player: Entity): void {
        const playerRenderable = player.getComponent(Renderable);
        const previousVisibility = this.playerVisibilityBeforePiloting.get(player.id);
        if (playerRenderable && previousVisibility !== undefined) {
            playerRenderable.visible = previousVisibility;
        }
        this.playerVisibilityBeforePiloting.delete(player.id);
        player.tags.delete('magic_piloting');
        player.tags.delete('magic_piloting_tank');
        player.tags.delete('magic_piloting_robot');
        player.tags.delete('magic_piloting_bomber');
        player.attacking = false;
    }

    private stopAllPiloting(): void {
        for (const entity of this.entities) {
            if (entity.tags.has('player')) this.stopPiloting(entity);
            if (entity.active && entity.hasComponent(MagicManifestation)) entity.active = false;
        }
    }

    private updateManifestations(player: Entity, playerTransform: Transform, frameDelta: number): void {
        const manifestations = Array.from(this.entities).filter(entity => entity.active && entity.hasComponent(MagicManifestation));
        for (const entity of manifestations) {
            const manifestation = entity.getComponent(MagicManifestation)!;
            if (manifestation.ownerId !== player.id) continue;
            const transform = entity.getComponent(Transform);
            if (!transform) continue;

            transform.x = playerTransform.x;
            transform.y = playerTransform.y;
            transform.rotation = playerTransform.rotation;

            manifestation.remainingFrames -= frameDelta;
            if (manifestation.remainingFrames <= 0) {
                entity.active = false;
                this.stopPiloting(player);
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: '神笔载具消散了，主武器已恢复。' } }));
                continue;
            }

            if (manifestation.type === 'tank') {
                this.updateTank(manifestation, player, transform, frameDelta);
            } else if (manifestation.type === 'robot') {
                this.updateRobot(manifestation, player, transform, frameDelta);
            } else {
                this.updateBomber(manifestation, player, transform, frameDelta);
            }
        }
    }

    private updateTank(manifestation: MagicManifestation, player: Entity, transform: Transform, frameDelta: number): void {
        const target = this.findNearestEnemy(transform, 800);
        if (target) {
            const targetTransform = target.getComponent(Transform)!;
            transform.rotation = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
        }
        manifestation.attackCooldown -= frameDelta;
        if (target && manifestation.attackCooldown <= 0) {
            manifestation.attackCooldown = 42;
            this.fireRocket(transform, target, player.id, manifestation.damageMultiplier * 1.1, '#86efac');
        }
    }

    private updateRobot(manifestation: MagicManifestation, player: Entity, transform: Transform, frameDelta: number): void {
        // The piloted robot uses a short-range energy fist.  It remains a
        // close-range vehicle, but has a visible projectile instead of needing
        // the player to collide with an enemy before anything happens.
        const target = this.findNearestEnemy(transform, 150);
        if (target) {
            const targetTransform = target.getComponent(Transform)!;
            transform.rotation = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
            manifestation.attackCooldown -= frameDelta;
            if (manifestation.attackCooldown <= 0) {
                manifestation.attackCooldown = 18;
                this.fireRobotPulse(transform, target, player.id, manifestation.damageMultiplier);
            }
        } else {
            manifestation.attackCooldown = Math.max(0, manifestation.attackCooldown - frameDelta);
        }
        manifestation.phase += 0.12 * frameDelta;
    }

    private updateBomber(manifestation: MagicManifestation, player: Entity, transform: Transform, frameDelta: number): void {
        manifestation.phase += 0.045 * frameDelta;
        const target = this.findNearestEnemy(transform, 700);
        if (target) {
            const targetTransform = target.getComponent(Transform)!;
            transform.rotation = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x);
        }
        manifestation.attackCooldown -= frameDelta;
        if (target && manifestation.attackCooldown <= 0) {
            manifestation.attackCooldown = 58;
            this.fireRocket(transform, target, player.id, manifestation.damageMultiplier * 0.95, '#f9a8d4');
        }
    }

    private findNearestEnemy(origin: Transform, maxDistance: number): Entity | null {
        let closest: Entity | null = null;
        let closestDistance = maxDistance;
        for (const entity of this.entities) {
            if (!entity.active || !entity.tags.has('enemy') || !entity.hasComponent(Health)) continue;
            const transform = entity.getComponent(Transform);
            if (!transform) continue;
            const distance = Math.hypot(transform.x - origin.x, transform.y - origin.y);
            if (distance < closestDistance) {
                closest = entity;
                closestDistance = distance;
            }
        }
        return closest;
    }

    private fireRocket(origin: Transform, target: Entity, ownerId: string, multiplier: number, color: string): void {
        const targetTransform = target.getComponent(Transform);
        const rocketConfig = WEAPONS.find(weapon => weapon.type === 'rocket');
        if (!targetTransform || !rocketConfig) return;
        const angle = Math.atan2(targetTransform.y - origin.y, targetTransform.x - origin.x);
        const rocket = BulletFactory.create(rocketConfig, origin.x, origin.y, angle, color, ownerId, 1.25, 1.1);
        const projectile = rocket.getComponent(Projectile);
        if (projectile) {
            projectile.damage = Math.round(45 * multiplier);
            projectile.explosionRadiusScale = 1.05 * multiplier;
        }
        rocket.tags.add('magic-pen-projectile');
        this.addEntityCallback(rocket);
        emitGameSound('shot-bucket', { x: origin.x, y: origin.y, gain: 0.85 });
    }

    private fireRobotPulse(origin: Transform, target: Entity, ownerId: string, multiplier: number): void {
        const targetTransform = target.getComponent(Transform);
        const pulseConfig = WEAPONS.find(weapon => weapon.type === 'standard');
        if (!targetTransform || !pulseConfig) return;

        const angle = Math.atan2(targetTransform.y - origin.y, targetTransform.x - origin.x);
        const pulse = BulletFactory.create(pulseConfig, origin.x, origin.y, angle, '#93c5fd', ownerId, 1.65, 1.8);
        const projectile = pulse.getComponent(Projectile);
        if (projectile) {
            projectile.damage = Math.round(42 * multiplier);
            projectile.life = 26;
        }
        pulse.tags.add('magic-pen-projectile');
        pulse.tags.add('magic-robot-pulse');
        this.addEntityCallback(pulse);
        emitGameSound('shot-pen', { x: origin.x, y: origin.y, gain: 0.8 });
    }

    private hasActiveManifestation(ownerId: string): boolean {
        return Array.from(this.entities).some(entity => {
            const manifestation = entity.getComponent(MagicManifestation);
            return entity.active && manifestation?.ownerId === ownerId;
        });
    }

    /**
     * This runs after combat systems and before Game removes inactive entities,
     * so every normal kill path contributes to the meter—not only projectile kills.
     */
    private collectInactiveEnemyKills(player: Entity): void {
        for (const entity of this.entities) {
            if (entity.active || !entity.tags.has('enemy') || entity.tags.has('ink_dummy') || this.accountedKillIds.has(entity.id)) continue;
            this.accountedKillIds.add(entity.id);
            const behavior = entity.getComponent(EnemyBehavior);
            const type = behavior?.type || '';
            const amount = type.startsWith('boss') || entity.tags.has('boss')
                ? 12
                : type === 'chaser' || type === 'paper_plane'
                    ? 1
                    : 4;
            this.addInspiration(player.id, amount);
        }
    }

    private updateHud(playerId: string): void {
        const progress = this.progressByPlayer.get(playerId) || 0;
        const active = Array.from(this.entities).find(entity => {
            const manifestation = entity.getComponent(MagicManifestation);
            return entity.active && manifestation?.ownerId === playerId;
        })?.getComponent(MagicManifestation);
        const isZh = getLang() === 'zh';
        const activeText = active
            ? (isZh ? '驾驶中' : 'Piloting')
            : progress >= MAX_INSPIRATION
                ? (isZh ? '就绪' : 'Ready')
                : '';
        this.hud.textContent = `G · ${isZh ? '神笔' : 'Magic Ink'} ${progress}/${MAX_INSPIRATION}${activeText ? ` · ${activeText}` : ''}`;
        this.hud.dataset.ready = `${!active && progress >= MAX_INSPIRATION}`;
        this.hud.style.color = progress >= MAX_INSPIRATION ? '#fef08a' : '#cbd5e1';
        this.hud.style.display = 'block';
    }
}
