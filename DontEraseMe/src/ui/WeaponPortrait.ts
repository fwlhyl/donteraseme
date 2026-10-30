import type { WeaponType } from '../components/Weapon';
import { drawWeaponShapeA } from '../art/WeaponShapesA';
import { drawWeaponShapeB } from '../art/WeaponShapesB';
import { drawWeaponShapeC } from '../art/WeaponShapesC';

/** Render the actual held weapon, without hands, into a transparent icon.
 * Measure painted pixels so every weapon is centered and fits the same frame. */
export function createWeaponPortrait(type: WeaponType): HTMLCanvasElement {
    const source = document.createElement('canvas');
    source.width = source.height = 128;
    const sourceCtx = source.getContext('2d');
    const result = document.createElement('canvas');
    result.width = result.height = 96;
    result.className = 'selection-portrait';
    result.setAttribute('aria-hidden', 'true');
    const ctx = result.getContext('2d');
    if (!ctx || !sourceCtx) return result;

    sourceCtx.translate(48, 64);
    const drawn = drawWeaponShapeA(sourceCtx, type, false, 0)
        || drawWeaponShapeB(sourceCtx, type, false, 0)
        || drawWeaponShapeC(sourceCtx, type, false, 0);
    if (!drawn) return result;

    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
    let left = source.width, top = source.height, right = -1, bottom = -1;
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
        if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left || bottom < top) return result;
    const width = right - left + 1, height = bottom - top + 1;
    const scale = Math.min(72 / width, 72 / height);
    const w = width * scale, h = height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, left, top, width, height, (96 - w) / 2, (96 - h) / 2, w, h);
    return result;
}
