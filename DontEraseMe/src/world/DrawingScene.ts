/** Overscan is kept for camera compatibility; the exported paper is unchanged. */
export function drawingSceneBounds(width: number, height: number) {
    return { x: -width * .25, y: -height * .25, width: width * 1.5, height: height * 1.5 };
}

/** Neutral backing for the functional drawing canvas. No retired studio image,
 * texture, color filter, or scenery is baked into the user's saved artwork. */
export class DrawingScene {
    private lastFrame = '';

    draw(camera: { x: number; y: number }, width: number, height: number, enabled: boolean): void {
        if (!enabled) { this.lastFrame = ''; return; }
        const canvas = document.getElementById('courtyardCanvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const vw = window.innerWidth, vh = window.innerHeight;
        const ownsCanvas = canvas.dataset.scene === 'drawing';
        canvas.style.display = 'block';
        canvas.dataset.scene = 'drawing';
        canvas.dataset.renderer = 'neutral-line';
        const key = [camera.x, camera.y, width, height, vw, vh, dpr].join(':');
        if (key === this.lastFrame && ownsCanvas) return;
        this.lastFrame = key;
        if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
            canvas.width = Math.round(vw * dpr);
            canvas.height = Math.round(vh * dpr);
            canvas.style.width = `${vw}px`;
            canvas.style.height = `${vh}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#deddd5';
        ctx.fillRect(0, 0, vw, vh);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.fillStyle = '#f3f1e9';
        ctx.fillRect(-3, -3, width + 6, height + 6);
        ctx.strokeStyle = '#77786f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-3, -3, width + 6, height + 6);
        ctx.restore();
    }
}
