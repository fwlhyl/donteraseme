import { COURTYARD_OUTLINE } from './CourtyardGeometry';
import type { CourtyardTheme } from './SceneLayout';

export const DOODLE_FLOOR = '#2c3747';

/** The painted floor uses the SAME boundary as gameplay.
 * This covers any generated decoration that drifts inside the play area.
 * It belongs to the scenery layer, never to exported artwork or stroke logs. */
export function traceDoodleFloor(ctx: CanvasRenderingContext2D, width: number, height: number, theme: CourtyardTheme): void {
    ctx.beginPath();
    if (theme === 'ruins') ctx.rect(0, 0, width, height);
    else COURTYARD_OUTLINE.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x / 1536 * width, y / 1024 * height);
        else ctx.lineTo(x / 1536 * width, y / 1024 * height);
    });
    ctx.closePath();
}

export function drawDoodleFloor(ctx: CanvasRenderingContext2D, width: number, height: number, theme: CourtyardTheme): void {
    ctx.save();
    traceDoodleFloor(ctx, width, height, theme);
    ctx.fillStyle = DOODLE_FLOOR;
    ctx.fill();
    // No ruler-straight dashed box or double curb across the illustration.
    ctx.clip();
    // Sparse, deterministic broken pencil seams. Never randomize every frame.
    ctx.strokeStyle = '#8995a018'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 36; i++) {
        const x = ((i * 317 + 97) % 997) / 997 * width;
        const y = ((i * 193 + 71) % 991) / 991 * height;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 32, y + 2);
        ctx.moveTo(x + 16, y + 1); ctx.lineTo(x + 20, y - 14); ctx.stroke();
    }
    ctx.restore();
}

const floorCache = new Map<string, HTMLCanvasElement>();
/** Cache the quiet floor once; feather only its inner rim into the original art.
 * Collision and artwork clipping still use the exact unmodified polygon above. */
export function drawBlendedDoodleFloor(ctx: CanvasRenderingContext2D, width: number, height: number, theme: CourtyardTheme): void {
    // Graceful fallback for Canvas implementations without filter support.
    if (typeof ctx.filter !== 'string') { drawDoodleFloor(ctx, width, height, theme); return; }
    const key = `${theme}:${width}:${height}`;
    let floor = floorCache.get(key);
    if (!floor) {
        floor = document.createElement('canvas');
        floor.width = 1536; floor.height = Math.round(1536 * height / width);
        const layer = floor.getContext('2d');
        if (!layer) { drawDoodleFloor(ctx, width, height, theme); return; }
        layer.scale(floor.width / width, floor.height / height);
        drawDoodleFloor(layer, width, height, theme);
        layer.save();
        layer.globalCompositeOperation = 'destination-out';
        traceDoodleFloor(layer, width, height, theme);
        layer.lineJoin = 'round'; layer.strokeStyle = '#000';
        layer.filter = 'blur(10px)'; layer.lineWidth = 66; layer.stroke();
        layer.filter = 'none'; layer.lineWidth = 2; layer.stroke();
        layer.restore();
        if (floorCache.size >= 4) floorCache.delete(floorCache.keys().next().value!);
        floorCache.set(key, floor);
    }
    ctx.drawImage(floor, 0, 0, width, height);
}
