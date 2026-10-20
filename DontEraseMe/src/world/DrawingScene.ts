import drawingStudioUrl from '../assets/paper-scenes/drawing-studio-clarity-v1.webp';

/** Presentation overscan only. The playable / exported paper stays 1800×1200.
 * The 1536×1024 source reserves its central 2/3 for the real artwork canvas. */
export function drawingSceneBounds(width: number, height: number) {
    return { x: -width * .25, y: -height * .25, width: width * 1.5, height: height * 1.5 };
}

/** Reuses the independent scenery canvas below painting/trails, so the normal
 * Game lifecycle also hides the drawing desk on menu / gallery transitions.
 * Never paints onto artwork, never records strokes, and has no animated grain. */
export class DrawingScene {
    private image?: HTMLImageElement;
    private lastFrame = '';

    draw(camera: { x: number; y: number }, width: number, height: number, enabled: boolean): void {
        if (!enabled) { this.lastFrame = ''; return; }
        const canvas = document.getElementById('courtyardCanvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (!this.image) { this.image = new Image(); this.image.src = drawingStudioUrl; }
        const ready = this.image.complete && this.image.naturalWidth > 0;
        const dpr = window.devicePixelRatio || 1, vw = window.innerWidth, vh = window.innerHeight;
        const ownsCanvas = canvas.dataset.scene === 'drawing';
        canvas.style.display = 'block';
        canvas.dataset.scene = 'drawing';
        const key = [camera.x, camera.y, width, height, vw, vh, dpr, ready].join(':');
        if (key === this.lastFrame && ownsCanvas) return;
        this.lastFrame = key;
        if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
            canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
            canvas.style.width = `${vw}px`; canvas.style.height = `${vh}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#242019'; ctx.fillRect(0, 0, vw, vh);
        if (ready) {
            const b = drawingSceneBounds(width, height);
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(this.image, b.x - camera.x, b.y - camera.y, b.width, b.height);
        }
        ctx.save(); ctx.translate(-camera.x, -camera.y);
        // A subdued physical backing outside the exact white-paper edge. The
        // real trail bitmap covers the entire interior; no tint touches pigment.
        ctx.fillStyle = '#141410'; ctx.fillRect(-24, -17, width + 52, height + 48);
        ctx.fillStyle = '#857c62'; ctx.fillRect(-11, -11, width + 22, height + 22);
        ctx.strokeStyle = '#b0a58a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-8, 30); ctx.lineTo(-9, -8); ctx.lineTo(width * .39, -10);
        ctx.moveTo(width * .41, -9); ctx.lineTo(width + 8, -8); ctx.lineTo(width + 10, height * .63);
        ctx.moveTo(width + 9, height * .65); ctx.lineTo(width + 8, height + 9); ctx.lineTo(width * .57, height + 10);
        ctx.moveTo(width * .55, height + 8); ctx.lineTo(-9, height + 8); ctx.lineTo(-10, 32); ctx.stroke();
        // Tiny registration ticks belong to the desk, not to the drawing.
        ctx.strokeStyle = '#a64635'; ctx.lineWidth = 2;
        for (const [x, y, dx, dy] of [[-26, -26, 16, 16], [width + 26, -26, -16, 16],
            [-26, height + 26, 16, -16], [width + 26, height + 26, -16, -16]]) {
            ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x, y); ctx.lineTo(x + dx, y); ctx.stroke();
        }
        ctx.restore();
    }
}
