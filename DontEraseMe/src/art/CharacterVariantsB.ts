import type { DoodlePose } from './DoodleMotion';

// These shapes live in the same local body/head coordinates as the collector.
// The shared rig supplies walking, breathing, turning, hit and held-weapon motion.
const ink = '#252923', shade = '#343b32', skin = '#c7b99b', skinShade = '#988d74';
function block(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function drawVariantBBody(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    if (id !== 'watercolor' && id !== 'digital') return false;
    const breath = Math.round(Math.max(0, pose?.idleBreath ?? 0));
    const hem = Math.round(Math.sin((pose?.gaitPhase ?? 0) - .55) * (pose?.moving ?? 0));
    if (id === 'watercolor') {
        // Light artist's smock with a water jar and an apron pocket.
        block(ctx, ink, -18, -2, 7, 16);
        block(ctx, '#72847f', -17, 0, 5, 11);
        block(ctx, '#abb9a8', -16, 1, 2, 7);
        block(ctx, ink, -11, -11-breath, 22, 5+breath);
        block(ctx, ink, -13, -7, 26, 19);
        block(ctx, ink, -12+hem, 10, 24, 7);
        block(ctx, '#7f948b', -11, -6, 22, 18);
        block(ctx, '#adbdaf', -8, -6, 13, 17);
        block(ctx, '#71867e', 5, -5, 5, 16);
        block(ctx, '#d0c9ad', -8, 1, 15, 11);
        block(ctx, '#a7ae98', -7, 3, 12, 8);
        block(ctx, ink, -1, 5, 6, 5);
        block(ctx, '#bec6b4', 0, 6, 4, 3);
        block(ctx, ink, -10, -11-breath, 20, 4);
        block(ctx, '#c4cbb8', -5, -10-breath, 10, 2);
    } else {
        // Short technical jacket and a compact tablet carried on the back.
        block(ctx, ink, -19, -9, 10, 22);
        block(ctx, '#465963', -18, -8, 7, 19);
        block(ctx, '#8a9c9c', -17, -7, 5, 11);
        block(ctx, '#647b82', -17, 6, 5, 3);
        block(ctx, ink, -11, -11-breath, 22, 5+breath);
        block(ctx, ink, -13, -7, 26, 19);
        block(ctx, ink, -11+hem, 10, 22, 6);
        block(ctx, '#40515a', -11, -6, 21, 18);
        block(ctx, '#607580', -7, -6, 14, 17);
        block(ctx, '#839698', -7, -5, 4, 4);
        block(ctx, shade, 2, -5, 2, 17);
        block(ctx, '#a8b6ae', -8, 7, 16, 2);
        block(ctx, ink, -9, 10, 19, 3);
        block(ctx, '#8a9c9c', -1, 10, 3, 2);
        block(ctx, ink, -10, -11-breath, 20, 4);
        block(ctx, '#80959a', -8, -10-breath, 16, 2);
    }
    return true;
}

export function drawVariantBHead(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    if (id !== 'watercolor' && id !== 'digital') return false;
    ctx.save();
    ctx.translate(0, Math.round((pose?.idleBreath ?? 0) * 1.6) / 4 + Math.round((pose?.hit ?? 0) * .6));
    if (id === 'watercolor') {
        // Long side braid: stepped plaits hang outside the shoulder and jar, so
        // their silhouette remains distinct while a weapon is held across the chest.
        // Real gait/idle input fades to rest when movement or breathing is suppressed.
        const moving = Math.max(0, Math.min(1, pose?.moving ?? 0));
        const sway = Math.round(Math.sin((pose?.gaitPhase ?? 0) - .8) * moving * 2
            + (pose?.idleBreath ?? 0) * .8);
        block(ctx, ink, -17, -25, 9, 10);
        block(ctx, '#59655b', -16, -23, 5, 7);
        block(ctx, '#c5d0bc', -17, -19, 6, 3);
        // The upper section is anchored; each lower link follows with more travel.
        block(ctx, ink, -19, -16, 8, 7);
        block(ctx, '#59655b', -18, -15, 5, 4);
        block(ctx, '#819187', -17, -14, 3, 2);
        block(ctx, ink, -20 + sway * .5, -10, 8, 7);
        block(ctx, '#59655b', -19 + sway * .5, -9, 5, 4);
        block(ctx, '#819187', -18 + sway * .5, -8, 3, 2);
        block(ctx, ink, -20 + sway, -4, 8, 7);
        block(ctx, '#59655b', -19 + sway, -3, 5, 4);
        block(ctx, '#819187', -18 + sway, -2, 3, 2);
        block(ctx, '#c5d0bc', -19 + sway, 2, 6, 2);
        block(ctx, ink, -18 + sway, 4, 4, 3);
        block(ctx, ink, -11, -28, 22, 15);
        block(ctx, '#4f5b52', -10, -26, 9, 11);
        block(ctx, skinShade, -1, -22, 12, 9);
        block(ctx, skin, 2, -21, 9, 7);
        block(ctx, skin, 10, -18, 3, 3);
        block(ctx, ink, -9, -32, 18, 5);
        block(ctx, '#687c70', -8, -31, 16, 4);
        block(ctx, '#c5d0bc', -10, -27, 22, 3);
        block(ctx, '#96b0a1', -9, -26, 18, 2);
        block(ctx, ink, -1, -24, 12, 3);
        block(ctx, shade, -1, -23, 4, 4);
        block(ctx, '#c5d0bc', -15, -23, 4, 4);
    } else {
        // Boxy headset, raised antenna and large one-piece visor produce a
        // different outline from both the collector and the painter's hair.
        block(ctx, ink, -12, -33, 21, 6);
        block(ctx, '#536c75', -10, -31, 17, 3);
        block(ctx, ink, -13, -27, 25, 13);
        block(ctx, shade, -10, -26, 19, 5);
        block(ctx, skinShade, -1, -22, 12, 9);
        block(ctx, skin, 2, -20, 9, 6);
        block(ctx, ink, -3, -24, 17, 7);
        block(ctx, '#789ca2', -1, -23, 13, 4);
        block(ctx, '#b5cfca', 1, -23, 8, 1);
        block(ctx, ink, -16, -26, 7, 13);
        block(ctx, '#607e87', -15, -24, 5, 9);
        block(ctx, '#b0c5bd', -14, -23, 2, 5);
        block(ctx, ink, -13, -39, 3, 7);
        block(ctx, '#a5c0ba', -14, -40, 5, 2);
        block(ctx, ink, 8, -30, 5, 4);
    }
    ctx.restore();
    return true;
}
