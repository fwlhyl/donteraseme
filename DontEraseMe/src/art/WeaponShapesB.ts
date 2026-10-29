import type { WeaponType } from '../components/Weapon';

// The caller establishes the grip origin, aiming rotation and pixel scale.
// Silhouettes are built from large stepped blocks, readable on the 52px figure.
const INK = '#272c28', MID = '#4e584e', LIGHT = '#7c8775';
const PAPER = '#b8b7a0', METAL = '#929b83', WOOD = '#77735c';

export function drawWeaponShapeB(ctx: CanvasRenderingContext2D, type: WeaponType, reloading: boolean, magazineShift: number): boolean {
    if (type !== 'ruler' && type !== 'ribbon' && type !== 'gravity' && type !== 'rocket') return false;
    const r = (x: number, y: number, w: number, h: number, color = INK) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    // The small moving insert stays in the shared off-hand's reach during reload.
    const magazine = () => {
        const dy = reloading ? Math.round(magazineShift) : 0;
        r(6, 6 + dy, 6, 8); r(7, 7 + dy, 3, 5, MID); r(7, 7 + dy, 3, 1, LIGHT);
    };
    if (type === 'ruler') {
        // Drafting ruler: wide light face, etched measured notches, clamp and sight.
        r(-8, -6, 36, 12); r(-6, -4, 31, 8, PAPER);
        r(-5, -4, 29, 2, LIGHT); r(0, -3, 1, 5, INK); r(5, -3, 1, 3, INK);
        r(10, -3, 1, 5, INK); r(15, -3, 1, 3, INK); r(20, -3, 1, 5, INK);
        r(25, -5, 4, 10, MID); r(27, -3, 6, 6); r(31, -2, 2, 3, METAL);
        r(-9, -3, 5, 8, MID); r(-4, 4, 8, 3); r(-2, 5, 5, 7); r(-1, 6, 3, 5, WOOD);
        r(10, -8, 6, 2); r(11, -7, 4, 1, METAL); magazine();
    } else if (type === 'ribbon') {
        // Ribbon dispenser: raised circular reel and a flat trailing spool, with
        // one stepped fabric strip across the frame instead of a generic gun.
        r(-8, -4, 28, 10); r(-6, -2, 24, 5, MID); r(-4, -1, 18, 2, LIGHT);
        r(5, -10, 11, 2); r(3, -8, 15, 10); r(5, 2, 11, 2);
        r(6, -7, 9, 9, WOOD); r(8, -9, 5, 13, METAL); r(9, -5, 4, 5, INK);
        r(10, -4, 2, 3, PAPER); r(18, -4, 6, 8, LIGHT); r(23, -3, 5, 5);
        r(25, -1, 4, 2, PAPER); r(-3, 5, 6, 8); r(-2, 6, 3, 6, WOOD);
        magazine();
    } else if (type === 'gravity') {
        // Palette blender: a broad drum, four vanes and a front mixing nozzle.
        r(-8, -4, 31, 10); r(-6, -2, 27, 5, MID); r(-8, -2, 4, 8, WOOD);
        r(4, -10, 15, 2); r(2, -8, 19, 14); r(4, 6, 15, 2);
        r(4, -7, 15, 12, MID); r(6, -9, 11, 16, LIGHT);
        r(8, -6, 7, 10, INK); r(10, -8, 3, 14, METAL); r(6, -3, 11, 3, METAL);
        r(9, -3, 4, 3, PAPER); r(21, -6, 4, 13); r(24, -4, 5, 8, LIGHT);
        r(27, -2, 3, 4); r(-3, 5, 6, 8); r(-2, 6, 4, 6, WOOD); magazine();
    } else {
        // Paint-bucket launcher: a prominent bucket held above the tube; the
        // stepped handle and paint band identify it independently of colour.
        r(-9, -6, 32, 12); r(-7, -4, 28, 8, MID); r(-5, -3, 23, 2, LIGHT);
        r(9, -12, 16, 15); r(11, -11, 12, 12, WOOD); r(12, -10, 10, 3, PAPER);
        r(12, -7, 10, 2, LIGHT); r(13, -5, 8, 5, MID); r(11, 0, 12, 2, INK);
        r(11, -15, 2, 4); r(21, -15, 2, 4); r(13, -16, 8, 2, LIGHT);
        r(23, -5, 7, 10); r(28, -3, 5, 6, MID); r(32, -2, 2, 4, LIGHT);
        r(-3, 5, 6, 8); r(-2, 6, 4, 6, WOOD); magazine();
    }
    return true;
}
