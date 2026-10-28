import type { DoodlePose } from './DoodleMotion';

// The same restrained pixel materials as the collector. Each figure is drawn in
// the collector's body/head coordinates so it inherits the shared animation rig.
const INK = '#252923', DEEP = '#343b32', CLOTH = '#535e4c', LIGHT = '#75816a';
const TRIM = '#a1aa8c', SKIN = '#c7b99b', SHADE = '#988d74', LEATHER = '#716d56';

function block(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function drawVariantCBody(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    if (id !== 'calligrapher' && id !== 'ink') return false;
    const breathe = Math.round(Math.max(0, pose?.idleBreath ?? 0));
    const hem = Math.round(Math.sin((pose?.gaitPhase ?? 0) - .55) * (pose?.moving ?? 0));
    if (id === 'calligrapher') {
        // Crossed robe, a tied waist and a brush tucked behind the shoulder.
        block(ctx, INK, -17, -12, 5, 22); block(ctx, LEATHER, -16, -11, 2, 16);
        block(ctx, TRIM, -16, -14, 2, 3);
        block(ctx, INK, -11, -11-breathe, 22, 7+breathe);
        block(ctx, INK, -13, -6, 26, 20); block(ctx, INK, -12+hem, 12, 24, 5);
        block(ctx, DEEP, -11, -5, 21, 17); block(ctx, CLOTH, -8, -7, 17, 19);
        for (let i = 0; i < 5; i++) block(ctx, LIGHT, -7+i*3, -8+i*3, 4, 3);
        block(ctx, TRIM, 5, 2, 3, 3);
        block(ctx, INK, -11, 8, 22, 4); block(ctx, LEATHER, -9, 9, 18, 2);
        block(ctx, TRIM, -1, 9, 4, 3); block(ctx, DEEP, -11+hem, 12, 9, 4);
    } else {
        // Ink painter: a soft layered travelling coat, a slim scroll at the back.
        block(ctx, INK, -18, -8, 7, 22); block(ctx, SHADE, -17, -7, 5, 19);
        block(ctx, DEEP, -17, -6, 1, 16); block(ctx, LEATHER, -18, 1, 7, 2);
        block(ctx, INK, -10, -11-breathe, 21, 6+breathe);
        block(ctx, INK, -12, -6, 25, 20); block(ctx, INK, -11+hem, 12, 22, 5);
        block(ctx, CLOTH, -10, -5, 20, 17); block(ctx, DEEP, -10, -5, 8, 18);
        block(ctx, LIGHT, -4, -7, 12, 3); block(ctx, TRIM, -3, -5, 3, 12);
        block(ctx, DEEP, 5, -2, 3, 13); block(ctx, INK, -10, 8, 20, 3);
        block(ctx, SHADE, -8, 9, 16, 2); block(ctx, DEEP, 3+hem, 12, 7, 4);
    }
    return true;
}

export function drawVariantCHead(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    if (id !== 'calligrapher' && id !== 'ink') return false;
    ctx.save();
    ctx.translate(0, Math.round((pose?.idleBreath ?? 0) * 1.6) / 4 + Math.round((pose?.hit ?? 0) * .6));
    if (id === 'calligrapher') {
        // High tied bun and a long nape give the calligrapher a tall silhouette.
        block(ctx, INK, -7, -38, 11, 7); block(ctx, DEEP, -5, -39, 7, 4);
        block(ctx, LEATHER, -7, -32, 11, 2); block(ctx, TRIM, -3, -32, 4, 2);
        block(ctx, INK, -10, -31, 19, 6); block(ctx, INK, -11, -25, 22, 11);
        block(ctx, INK, -11, -15, 7, 6); block(ctx, DEEP, -9, -26, 8, 13);
        block(ctx, LIGHT, -9, -29, 9, 2);
        block(ctx, SHADE, -1, -22, 11, 9); block(ctx, SKIN, 2, -22, 8, 7);
        block(ctx, SKIN, 10, -19, 3, 3); block(ctx, INK, 0, -24, 11, 3);
        block(ctx, DEEP, -2, -21, 4, 3);
    } else {
        // A broad, light conical hat differs in both silhouette and value.
        block(ctx, INK, -3, -38, 7, 3); block(ctx, INK, -7, -35, 15, 3);
        block(ctx, INK, -11, -32, 23, 4); block(ctx, INK, -15, -28, 31, 4);
        block(ctx, INK, -19, -24, 39, 3);
        block(ctx, SHADE, -5, -34, 11, 3); block(ctx, SHADE, -9, -31, 19, 3);
        block(ctx, '#b5ad96', -13, -28, 27, 3); block(ctx, '#d0c7ae', -14, -25, 29, 2);
        block(ctx, DEEP, -12, -22, 23, 10); block(ctx, INK, -11, -17, 7, 6);
        block(ctx, SHADE, -1, -22, 11, 9); block(ctx, SKIN, 2, -21, 8, 6);
        block(ctx, SKIN, 10, -18, 3, 3); block(ctx, INK, -1, -23, 11, 3);
    }
    ctx.restore();
    return true;
}
