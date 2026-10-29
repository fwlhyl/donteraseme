import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Health } from '../components/Health';
import { PlayerStats } from '../components/PlayerStats';
import { Projectile } from '../components/Projectile';
import { MagicManifestation, type MagicManifestationType, type MagicPenGrade } from '../components/MagicManifestation';
import { WEAPONS } from '../components/Weapon';
import { BulletFactory } from '../entities/BulletFactory';
import { ParticleFactory } from '../entities/ParticleFactory';
import { getLang } from '../i18n/index';
import { emitGameSound } from '../audio/AudioEvents';
import { MagicHud } from '../ui/CombatHud';

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
const MAX_INSPIRATION = 100;
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
    private readonly hudView: MagicHud;
    private readonly overlay: HTMLElement;
    private readonly board: HTMLCanvasElement;
    private readonly boardCtx: CanvasRenderingContext2D;
    private readonly targetLabel: HTMLElement;
    private readonly hint: HTMLElement;

    private boardOpen = false;
    private boardPlayerId: string | null = null;
    private selectedType: MagicManifestationType = 'tank';
    // One random result per charge; closing the board cannot reroll it.
    private pendingType: MagicManifestationType | null = null;
    private strokes: Point[][] = [];
    private isDrawing = false;

    constructor(
        private readonly addEntityCallback: (entity: Entity) => void,
        private readonly isGameplayActive: () => boolean
    ) {
        super();
        this.hud = this.createHud();
        this.hudView = new MagicHud(this.hud);
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
            this.pendingType = null;
            this.readyAnnouncedFor.delete(player.id);
            this.accountedKillIds.clear();
            this.closeBoard(false);
        }

        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) return;

        this.updateManifestations(player, playerTransform, dt * 60);
        this.collectInactiveEnemyKills(player);
        this.updateHud(player);
    }

    private createHud(): HTMLElement {
        const hud = document.createElement('div');
        hud.id = 'magic-pen-hud';
        hud.className = 'hud-note hud-magic';
        hud.hidden = true;
        document.getElementById('ui')?.appendChild(hud);
        return hud;
    }

    private createBoard(): { overlay: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; targetLabel: HTMLElement; hint: HTMLElement } {
        const overlay = document.createElement('div');
        overlay.id = 'magic-pen-board';
        overlay.className = 'sketch-board-overlay';
        overlay.style.display = 'none';

        const panel = document.createElement('section');
        panel.className = 'sketch-board-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'magic-pen-board-title');

        const title = document.createElement('h2');
        title.className = 'sketch-board-title';
        title.id = 'magic-pen-board-title';
        title.textContent = '画笔成真 · 描绘具现';
        panel.appendChild(title);

        const hint = document.createElement('p');
        hint.className = 'sketch-board-hint';
        panel.appendChild(hint);

        const targetLabel = document.createElement('div');
        targetLabel.className = 'sketch-board-target';
        panel.appendChild(targetLabel);

        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'sketch-board-canvas-wrap';
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
        const clear = document.createElement('button');
        clear.className = 'btn';
        clear.type = 'button';
        clear.textContent = '重画';
        clear.onclick = () => {
            this.strokes = [];
            this.hint.textContent = '沿着半透明轮廓作画；越贴近、覆盖越完整，具现越强。';
            this.redrawBoard();
        };
        const cancel = document.createElement('button');
        cancel.className = 'btn';
        cancel.type = 'button';
        cancel.textContent = '取消';
        cancel.onclick = () => this.closeBoard(true);
        const manifest = document.createElement('button');
        manifest.className = 'btn btn-primary sketch-board-manifest';
        manifest.type = 'button';
        manifest.textContent = '画笔成真';
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
        const player = Array.from(this.entities).find(entity => entity.active && entity.tags.has('player'));
        if (!player?.getComponent(PlayerStats)?.hasSkill('magic_pen')) return;
        event.preventDefault();
        this.openBoard();
    }

    private addInspiration(playerId: string, amount: number): void {
        const previous = this.progressByPlayer.get(playerId) || 0;
        const next = Math.min(MAX_INSPIRATION, previous + Math.max(0, Math.floor(amount)));
        this.progressByPlayer.set(playerId, next);
        if (previous < MAX_INSPIRATION && next >= MAX_INSPIRATION) {
            this.readyAnnouncedFor.add(playerId);
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: '画笔成真已充能！按 G 键描绘具现。' } }));
        }
    }

    private openBoard(): void {
        const player = Array.from(this.entities).find(entity => entity.active && entity.tags.has('player'));
        if (!player || !player.getComponent(PlayerStats)?.hasSkill('magic_pen')) return;
        const progress = this.progressByPlayer.get(player.id) || 0;
        if (progress < MAX_INSPIRATION) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `画笔成真充能不足：${progress}/${MAX_INSPIRATION}` } }));
            return;
        }
        if (this.hasActiveManifestation(player.id)) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: '正在驾驶画笔成真载具，等它消散后再召唤。' } }));
            return;
        }

        this.boardOpen = true;
        this.boardPlayerId = player.id;
        if (!this.pendingType) {
            const types: MagicManifestationType[] = ['tank', 'robot', 'bomber'];
            this.pendingType = types[Math.floor(Math.random() * types.length)];
        }
        this.selectedType = this.pendingType;
        this.strokes = [];
        this.overlay.style.display = 'flex';
        this.hint.textContent = '沿着半透明轮廓作画；越贴近、覆盖越完整，具现越强。';
        this.targetLabel.textContent = `本次随机描绘：${TARGETS[this.selectedType].label}`;
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

    private redrawBoard(): void {
        const target = TARGETS[this.selectedType];
        const ctx = this.boardCtx;
        ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        ctx.fillStyle = '#252621';
        ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        ctx.strokeStyle = 'rgba(238,228,200,0.08)';
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
        ctx.strokeStyle = '#b0aa95';
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 13;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([8, 12]);
        for (const path of target.paths) this.strokePath(ctx, path);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#eee4c8';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const stroke of this.strokes) {
            if (stroke.length === 1) {
                ctx.beginPath();
                ctx.arc(stroke[0].x, stroke[0].y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#eee4c8';
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
        this.hint.textContent = `当前覆盖度 ${Math.round(coverage * 100)}%，预计 ${grade} 级。可继续优化，完成后点击“画笔成真”具现。`;
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
        this.pendingType = null;
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
        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `画笔成真：${TARGETS[this.selectedType].label} · ${grade} 级（持续 10 秒）` } }));
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

            const distance = Math.hypot(playerTransform.x - transform.x, playerTransform.y - transform.y);
            const targetMoving = frameDelta > 0 && distance < 80 ? Math.min(1, distance / frameDelta / 3) : 0;
            manifestation.visualMoving += (targetMoving - manifestation.visualMoving) * (1 - Math.exp(-0.28 * frameDelta));
            manifestation.visualAttackFrames = Math.max(0, manifestation.visualAttackFrames - frameDelta);
            transform.x = playerTransform.x;
            transform.y = playerTransform.y;
            transform.rotation = playerTransform.rotation;

            manifestation.remainingFrames -= frameDelta;
            if (manifestation.remainingFrames <= 0) {
                entity.active = false;
                this.stopPiloting(player);
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: '画笔成真载具消散了，主武器已恢复。' } }));
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
        const target = this.aimGroundVehicle(manifestation, transform, 800);
        manifestation.attackCooldown -= frameDelta;
        if (target && manifestation.attackCooldown <= 0) {
            manifestation.attackCooldown = 42;
            manifestation.visualAttackFrames = 12;
            this.fireRocket(transform, target, player.id, manifestation.damageMultiplier * 1.1, '#86efac', transform.rotation);
        }
    }

    private updateRobot(manifestation: MagicManifestation, player: Entity, transform: Transform, frameDelta: number): void {
        // The piloted robot uses a short-range energy fist.  It remains a
        // close-range vehicle, but has a visible projectile instead of needing
        // the player to collide with an enemy before anything happens.
        const target = this.aimGroundVehicle(manifestation, transform, 150);
        if (target) {
            manifestation.attackCooldown -= frameDelta;
            if (manifestation.attackCooldown <= 0) {
                manifestation.attackCooldown = 18;
                manifestation.visualAttackFrames = 12;
                this.fireRobotPulse(transform, target, player.id, manifestation.damageMultiplier, transform.rotation);
            }
        } else {
            manifestation.attackCooldown = Math.max(0, manifestation.attackCooldown - frameDelta);
        }
        manifestation.phase += 0.12 * frameDelta;
    }

    /** Ground vehicles face the mouse horizontally, with a limited vertical arc.
     * Target gating and projectile direction use the same world-space arc. */
    private aimGroundVehicle(manifestation: MagicManifestation, transform: Transform, range: number): Entity | null {
        const angle = transform.rotation;
        const horizontal = Math.cos(angle);
        if (horizontal > .12) manifestation.visualFacing = 1;
        else if (horizontal < -.12) manifestation.visualFacing = -1;
        const facing = manifestation.visualFacing;
        const limit = Math.PI * 35 / 180;
        const local = Math.atan2(Math.sin(angle), Math.abs(horizontal));
        manifestation.visualAim = Math.max(-limit, Math.min(limit, local));
        transform.rotation = Math.atan2(Math.sin(manifestation.visualAim), facing * Math.cos(manifestation.visualAim));
        let closest: Entity | null = null, best = range;
        for (const entity of this.entities) {
            if (!entity.active || !entity.tags.has('enemy') || !entity.hasComponent(Health)) continue;
            const target = entity.getComponent(Transform);
            if (!target) continue;
            const dx = target.x - transform.x, dy = target.y - transform.y;
            const distance = Math.hypot(dx, dy);
            if (distance >= best || dx * facing <= 0 || Math.abs(Math.atan2(dy, Math.abs(dx))) > limit) continue;
            closest = entity; best = distance;
        }
        return closest;
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
            manifestation.visualAttackFrames = 12;
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

    private fireRocket(origin: Transform, target: Entity, ownerId: string, multiplier: number, color: string, aim?: number): void {
        const targetTransform = target.getComponent(Transform);
        const rocketConfig = WEAPONS.find(weapon => weapon.type === 'rocket');
        if (!targetTransform || !rocketConfig) return;
        const angle = aim ?? Math.atan2(targetTransform.y - origin.y, targetTransform.x - origin.x);
        const rocket = BulletFactory.create({ ...rocketConfig, speed: 6 }, origin.x, origin.y, angle, color, ownerId, 1.25, 1.1);
        const projectile = rocket.getComponent(Projectile);
        if (projectile) {
            projectile.damage = Math.round(45 * multiplier);
            projectile.explosionRadiusScale = 1.05 * multiplier;
        }
        rocket.tags.add('magic-pen-projectile');
        this.addEntityCallback(rocket);
        emitGameSound('shot-bucket', { x: origin.x, y: origin.y, gain: 0.85 });
    }

    private fireRobotPulse(origin: Transform, target: Entity, ownerId: string, multiplier: number, aim?: number): void {
        const targetTransform = target.getComponent(Transform);
        const pulseConfig = WEAPONS.find(weapon => weapon.type === 'standard');
        if (!targetTransform || !pulseConfig) return;

        const angle = aim ?? Math.atan2(targetTransform.y - origin.y, targetTransform.x - origin.x);
        const pulse = BulletFactory.create({ ...pulseConfig, speed: 9 }, origin.x, origin.y, angle, '#93c5fd', ownerId, 1.65, 1.8);
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
            const health = entity.getComponent(Health);
            if (health && health.current <= 0 && player.getComponent(PlayerStats)?.hasSkill('magic_pen')) {
                this.addInspiration(player.id, 1);
            }
        }
    }

    private updateHud(player: Entity): void {
        const playerId = player.id;
        const progress = this.progressByPlayer.get(playerId) || 0;
        const active = Array.from(this.entities).find(entity => {
            const manifestation = entity.getComponent(MagicManifestation);
            return entity.active && manifestation?.ownerId === playerId;
        })?.getComponent(MagicManifestation);
        this.hudView.update(progress, MAX_INSPIRATION, !!active, getLang() === 'zh', !!player.getComponent(PlayerStats)?.hasSkill('magic_pen'));
        this.hud.style.display = 'flex';
    }
}
