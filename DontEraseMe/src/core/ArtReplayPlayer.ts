import { ArtReplayRecording } from './ArtReplayRecording';
import { DefensePainting } from './DefensePainting';
import type { StrokeCursor } from './StrokeLog';
import { getLang } from '../i18n/index';
import './artReplay.css';

/** Presentation only: neither the live canvases nor gameplay systems are touched. */
export class ArtReplayPlayer {
    private overlay: HTMLDivElement | null = null;
    private frame = 0;
    private generation = 0;
    private lastFrame = 0;
    private time = 0;
    private targetTime = 0;
    private speed = 30;
    private paused = false;
    private completed = false;
    private cursor: StrokeCursor | null = null;
    private canvas!: HTMLCanvasElement;
    private trail!: HTMLCanvasElement;
    private painting!: DefensePainting;
    private clock!: HTMLElement;
    private progress!: HTMLProgressElement;
    private pauseButton!: HTMLButtonElement;
    private magicCanvas!: HTMLCanvasElement;
    private magicCaption!: HTMLElement;
    private lastMagic = -1;
    private currentSnapshot = -1;
    private bitmap: ImageBitmap | null = null;
    private bitmapPending = false;
    private focusBeforeOpen: HTMLElement | null = null;
    private source: ArtReplayRecording | null = null;
    private onClose: (() => void) | null = null;

    public get isOpen(): boolean { return this.overlay !== null; }

    public open(source: ArtReplayRecording, onClose: () => void): void {
        this.close(false);
        this.source = source;
        this.onClose = onClose;
        this.focusBeforeOpen = document.activeElement as HTMLElement | null;
        this.speed = 30;
        const tr = (zh: string, en: string) => getLang() === 'zh' ? zh : en;
        const overlay = document.createElement('div');
        overlay.id = 'art-replay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'art-replay-title');
        overlay.innerHTML = `
            <div class="art-replay-header">
                <div><h2 id="art-replay-title">${tr('这幅画，是这样诞生的', 'How your artwork came to life')}</h2>
                <p>${source.isDrawing ? tr('纯画画 · 本次创作过程', 'Drawing mode · your creative process') : source.isDefense ? tr('守卫模式 · 原画、擦除与修复', 'Guard mode · painting, erasure and repair') : tr('创造模式 · 本局作画过程', 'Create mode · this run’s artwork')}</p></div>
                <button id="replay-close" type="button">${tr('返回结算', 'Back to results')} · Esc</button>
            </div>
            <div class="art-replay-stage"><canvas id="replay-canvas" aria-label="${tr('作画回放画布', 'Artwork replay canvas')}"></canvas>
                <aside id="replay-magic" hidden><span id="replay-magic-caption"></span><canvas id="replay-magic-canvas"></canvas></aside>
            </div>
            <div class="art-replay-footer">
                <div class="art-replay-timeline"><progress id="replay-progress" max="1" value="0" aria-label="${tr('回放进度', 'Replay progress')}"></progress><span id="replay-clock"></span></div>
                <div class="art-replay-controls">
                    <button id="replay-pause" type="button">${tr('暂停', 'Pause')}</button>
                    <div class="art-replay-speeds" aria-label="${tr('播放速度', 'Playback speed')}">${[10, 30, 60].map(speed => `<button type="button" data-speed="${speed}" aria-pressed="${speed === 30}">${speed}×</button>`).join('')}</div>
                    <button id="replay-restart" type="button">${tr('从头回放', 'Replay again')}</button>
                    <button id="replay-skip" type="button">${tr('跳过 · 查看成品', 'Skip to finished art')}</button>
                </div>
                <p id="replay-note">${source.log.overflowAt !== null ? tr('高负载片段按间隔画面播放，结尾展示完整作品。', 'Dense passages use interval snapshots; the ending shows the complete artwork.') : tr('全画布视角 · 仅保留本局回放 · 结尾可返回结算保存作品', 'Full canvas · replay kept for this run · save the artwork from results')}</p>
            </div>`;
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.canvas = overlay.querySelector('#replay-canvas')!;
        this.canvas.width = source.log.width;
        this.canvas.height = source.log.height;
        this.trail = document.createElement('canvas');
        this.trail.width = source.log.width;
        this.trail.height = source.log.height;
        this.painting = new DefensePainting(document.createElement('canvas'), source.log.width, source.log.height);
        this.clock = overlay.querySelector('#replay-clock')!;
        this.progress = overlay.querySelector('#replay-progress')!;
        this.pauseButton = overlay.querySelector('#replay-pause')!;
        this.magicCanvas = overlay.querySelector('#replay-magic-canvas')!;
        this.magicCanvas.width = 640;
        this.magicCanvas.height = 360;
        this.magicCaption = overlay.querySelector('#replay-magic-caption')!;
        this.cursor = source.log.createCursor({
            trail: this.trail.getContext('2d')!,
            erase: (...args) => this.painting.eraseAt(...args),
            repair: (...args) => this.painting.repairStroke(...args),
        });
        overlay.querySelector('#replay-close')!.addEventListener('click', () => this.close());
        this.pauseButton.addEventListener('click', () => this.togglePause());
        overlay.querySelector('#replay-restart')!.addEventListener('click', () => this.restart());
        overlay.querySelector('#replay-skip')!.addEventListener('click', () => this.showFinal());
        overlay.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => {
            button.addEventListener('click', () => {
                this.speed = Number(button.dataset.speed);
                overlay.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            });
        });
        window.addEventListener('keydown', this.handleKeyDown, true);
        this.restart();
        (overlay.querySelector('#replay-close') as HTMLButtonElement).focus();
    }

    public close(notify = true): void {
        this.generation++;
        cancelAnimationFrame(this.frame);
        window.removeEventListener('keydown', this.handleKeyDown, true);
        this.overlay?.remove();
        this.overlay = null;
        this.bitmap?.close();
        this.bitmap = null;
        this.bitmapPending = false;
        this.cursor = null;
        this.source = null;
        // Releasing these references also releases the replay's full-size layers.
        this.painting = null as unknown as DefensePainting;
        if (this.trail) this.trail.width = this.trail.height = 0;
        if (this.canvas) this.canvas.width = this.canvas.height = 0;
        const onClose = this.onClose;
        this.onClose = null;
        if (notify) {
            onClose?.();
            this.focusBeforeOpen?.focus();
        }
    }

    private restart(): void {
        if (!this.source) return;
        this.generation++;
        cancelAnimationFrame(this.frame);
        this.bitmap?.close();
        this.bitmap = null;
        this.bitmapPending = false;
        this.currentSnapshot = -1;
        this.time = this.targetTime = 0;
        this.paused = this.completed = false;
        this.lastMagic = -1;
        this.magicCaption.parentElement!.hidden = true;
        this.trail.width = this.source.log.width;
        if (this.source.isDefense && this.source.initialArtwork) this.painting.beginArtwork(this.source.initialArtwork);
        else this.painting.reset();
        this.cursor!.reset();
        this.renderComposite();
        this.updateControls();
        this.lastFrame = performance.now();
        this.frame = requestAnimationFrame(this.tick);
    }

    private tick = (now: number): void => {
        if (!this.source || !this.cursor || !this.overlay) return;
        const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
        this.lastFrame = now;
        if (!this.paused && !this.completed) {
            // Finish a dense batch before advancing the requested time again.
            if (this.targetTime <= this.time + 0.0001) this.targetTime = Math.min(this.source.log.duration, this.time + dt * this.speed);
            const caughtUp = this.cursor.renderUntil(this.targetTime);
            this.time = caughtUp ? this.targetTime : this.cursor.time;
            this.renderComposite();
            this.renderMagicDrawing();
            if (caughtUp && this.time >= this.source.log.duration) this.showFinal();
            else this.updateControls();
        }
        if (!this.completed) this.frame = requestAnimationFrame(this.tick);
    };

    private renderComposite(): void {
        if (!this.source) return;
        let snapshotIndex = -1;
        for (let i = this.source.snapshots.length - 1; i >= 0; i--) {
            if (this.source.snapshots[i].time <= this.time) { snapshotIndex = i; break; }
        }
        if (snapshotIndex >= 0 && snapshotIndex !== this.currentSnapshot && !this.bitmapPending) {
            this.bitmapPending = true;
            const generation = this.generation;
            createImageBitmap(this.source.snapshots[snapshotIndex].blob).then(bitmap => {
                if (generation !== this.generation || this.completed) { bitmap.close(); return; }
                this.bitmap?.close();
                this.bitmap = bitmap;
                this.currentSnapshot = snapshotIndex;
                this.bitmapPending = false;
                this.renderComposite();
            }).catch(() => { if (generation === this.generation) this.bitmapPending = false; });
        }
        const ctx = this.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.bitmap && this.currentSnapshot >= 0) {
            ctx.drawImage(this.bitmap, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            if (this.source.isDefense) ctx.drawImage(this.painting.canvas, 0, 0);
            ctx.drawImage(this.trail, 0, 0);
        }
    }

    private renderMagicDrawing(): void {
        if (!this.source) return;
        const drawings = this.source.log.magicDrawings;
        let index = -1;
        for (let i = drawings.length - 1; i >= 0; i--) {
            if (drawings[i].time <= this.time) { index = i; break; }
        }
        const visible = index >= 0 && this.time - drawings[index].time <= 60;
        this.magicCaption.parentElement!.hidden = !visible;
        if (!visible || index === this.lastMagic) return;
        this.lastMagic = index;
        const drawing = drawings[index];
        const names: Record<string, string> = getLang() === 'zh' ? { tank: '坦克', robot: '机器人', bomber: '轰炸机' } : { tank: 'Tank', robot: 'Robot', bomber: 'Bomber' };
        this.magicCaption.textContent = `${getLang() === 'zh' ? '神笔马良' : 'Magic Pen'} · ${names[drawing.type] || drawing.type} · ${drawing.grade}`;
        const ctx = this.magicCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, 640, 360);
        ctx.save();
        ctx.scale(640 / drawing.width, 360 / drawing.height);
        ctx.strokeStyle = '#f6d67a'; ctx.lineWidth = 5; ctx.lineCap = ctx.lineJoin = 'round';
        for (const stroke of drawing.strokes) {
            ctx.beginPath();
            stroke.forEach((point, i) => i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
            ctx.stroke();
        }
        ctx.restore();
    }

    private showFinal(): void {
        if (!this.source) return;
        this.completed = true;
        this.paused = false;
        this.time = this.targetTime = this.source.log.duration;
        cancelAnimationFrame(this.frame);
        const ctx = this.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.source.finalArtwork) ctx.drawImage(this.source.finalArtwork, 0, 0);
        this.magicCaption.parentElement!.hidden = true;
        this.updateControls();
    }

    private togglePause(): void {
        if (this.completed) return;
        this.paused = !this.paused;
        this.updateControls();
    }

    private updateControls(): void {
        if (!this.source) return;
        const tr = (zh: string, en: string) => getLang() === 'zh' ? zh : en;
        this.clock.textContent = `${formatTime(this.time)} / ${formatTime(this.source.log.duration)}${this.completed ? tr(' · 回放完成', ' · Finished') : ''}`;
        this.progress.value = this.completed ? 1 : this.source.log.duration > 0 ? this.time / this.source.log.duration : 0;
        this.pauseButton.disabled = this.completed;
        this.pauseButton.textContent = this.paused ? tr('继续', 'Resume') : tr('暂停', 'Pause');
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        if (!this.overlay) return;
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopImmediatePropagation(); this.close();
        } else if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault(); event.stopImmediatePropagation(); this.togglePause();
        } else if (event.key === 'Tab') {
            const buttons = Array.from(this.overlay.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.shiftKey ? (index - 1 + buttons.length) % buttons.length : (index + 1) % buttons.length;
            event.preventDefault(); event.stopImmediatePropagation(); buttons[next]?.focus();
        }
    };
}

function formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
