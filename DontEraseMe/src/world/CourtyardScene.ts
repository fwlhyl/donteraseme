import { COURTYARD_OUTLINE } from './CourtyardGeometry';
import type { CourtyardTheme } from './SceneLayout';

/** Temporary neutral stage after retiring the illustrated scenery.
 * Uses the existing playable boundary; decoration never changes collisions or ink. */
export class CourtyardScene {
    private canvas = document.createElement('canvas');
    private ctx: CanvasRenderingContext2D;
    private lastFrame = '';

    constructor(_enable3d = false) {
        this.canvas.id = 'courtyardCanvas';
        this.canvas.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;display:none';
        document.body.insertBefore(this.canvas, document.getElementById('paintingCanvas'));
        this.ctx = this.canvas.getContext('2d')!;
    }

    /** No obsolete foreground plate is painted over the combat layer. */
    drawForeground(_ctx: CanvasRenderingContext2D, _width: number, _height: number): void {}

    hide(): void {
        this.canvas.style.display = 'none';
        this.lastFrame = '';
    }

    draw(camera: {x: number; y: number}, worldWidth: number, worldHeight: number,
        enabled: boolean, theme: CourtyardTheme = 'atelier', _timeSeconds = 0): void {
        if (!enabled) { this.hide(); return; }
        const width = window.innerWidth, height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const ownsCanvas = this.canvas.dataset.scene === theme;
        this.canvas.style.display = 'block';
        this.canvas.dataset.scene = theme;
        this.canvas.dataset.renderer = 'neutral-line';
        const key = [camera.x, camera.y, width, height, dpr, worldWidth, worldHeight, theme].join(':');
        if (key === this.lastFrame && ownsCanvas) return;
        this.lastFrame = key;
        if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
            this.canvas.width = Math.round(width * dpr);
            this.canvas.height = Math.round(height * dpr);
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        }
        const ctx = this.ctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#deddd5';
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.beginPath();
        if (theme === 'ruins') ctx.rect(0, 0, worldWidth, worldHeight);
        else COURTYARD_OUTLINE.forEach(([x, y], index) => {
            const px = x / 1536 * worldWidth, py = y / 1024 * worldHeight;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = '#f3f1e9';
        ctx.fill();
        ctx.strokeStyle = '#77786f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }
}
