import { COURTYARD_OUTLINE } from './CourtyardGeometry';
import type { CourtyardTheme } from './SceneLayout';
import floorTextureUrl from '../assets/paper-scenes/floor-clarity-v1.webp';

// Shared with the scene's overscan / missing-image fallback. Keep the historical
// export name because rendering and geometry regression tests use this module.
export const DOODLE_FLOOR = '#242019';
let floorTexture: HTMLImageElement | undefined;

/** Load only when a scene is shown, not on the menu or artwork export path. */
export function isDoodleFloorTextureReady(): boolean {
    if (!floorTexture && typeof Image !== 'undefined') {
        floorTexture = new Image();
        floorTexture.src = floorTextureUrl;
    }
    return !!floorTexture?.complete && floorTexture.naturalWidth > 0;
}

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
    // Exactly the gameplay boundary: texture/scuffs never cross the wall and
    // this scenery layer is never included in saved strokes or artwork.
    ctx.clip();
    if (isDoodleFloorTextureReady()) {
        // A single world-aligned texture avoids obvious repeated tile seams.
        // Its low contrast leaves the player's colored ink as the focal point.
        ctx.save();
        ctx.globalAlpha = .62;
        ctx.drawImage(floorTexture!, 0, 0, width, height);
        ctx.restore();
    }
    // A few deterministic dry-brush scuffs instead of the old regular T seams.
    // All of these are constructed once in the cached floor, never animated.
    ctx.strokeStyle = '#9b92751c'; ctx.lineWidth = 1.1;
    for (let i = 0; i < 14; i++) {
        const x = ((i * 317 + 97) % 997) / 997 * width;
        const y = ((i * 193 + 71) % 991) / 991 * height;
        const length = 13 + i % 4 * 5, rise = i % 2 ? 4 : -3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + length, y + rise);
        ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + length - 5, y + rise + 2); ctx.stroke();
    }
    ctx.restore();
}

const floorCache = new Map<string, HTMLCanvasElement>();
/** Cache the quiet floor once; feather only its inner rim into the original art.
 * Collision and artwork clipping still use the exact unmodified polygon above. */
export function drawBlendedDoodleFloor(ctx: CanvasRenderingContext2D, width: number, height: number, theme: CourtyardTheme): void {
    // Graceful fallback for Canvas implementations without filter support.
    if (typeof ctx.filter !== 'string') { drawDoodleFloor(ctx, width, height, theme); return; }
    // A loaded texture gets its own one-time cache. Failed/unfinished assets
    // retain the quiet charcoal fallback without rebuilding every frame.
    const key = `${theme}:${width}:${height}:${isDoodleFloorTextureReady()}`;
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
