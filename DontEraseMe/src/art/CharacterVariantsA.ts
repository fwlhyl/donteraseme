import type { DoodlePose } from './DoodleMotion';

// These figures use the collector's local coordinates and share its animation rig.
// Their distinctive shapes remain readable at the game's small display size.
const ink = '#252923', shadow = '#343b32', skin = '#c7b99b', shade = '#988d74';
function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function face(ctx: CanvasRenderingContext2D): void {
    rect(ctx, shade, -1, -22, 12, 9); rect(ctx, skin, 3, -22, 8, 7);
    rect(ctx, skin, 10, -18, 3, 3); rect(ctx, shade, 2, -14, 7, 2);
}

/** Called in the collector's torso space; legs and hands are drawn by the shared rig. */
export function drawVariantABody(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    const breathe = Math.round(Math.max(0, pose?.idleBreath ?? 0));
    const hem = Math.round(Math.sin((pose?.gaitPhase ?? 0) - .55) * (pose?.moving ?? 0));
    switch (id) {
        case 'graffiti':
            // Biker vest, angular lapels and a paint can slung behind the shoulder.
            rect(ctx, ink, -18, -8, 7, 20); rect(ctx, '#766e64', -17, -6, 5, 15);
            rect(ctx, '#b6a78e', -16, -8, 3, 2);
            rect(ctx, ink, -13, -9-breathe, 26, 22+breathe);
            rect(ctx, '#3c413e', -11, -7, 22, 18); rect(ctx, '#697169', -10, -5, 5, 11);
            rect(ctx, '#a9aa96', -9, -8, 4, 4); rect(ctx, '#a9aa96', 7, -8, 4, 4);
            rect(ctx, '#a9aa96', -6, -4, 4, 3); rect(ctx, '#a9aa96', 4, -4, 4, 3);
            rect(ctx, '#95816d', -2, -3, 3, 14); rect(ctx, '#b3a58e', -2, 2, 3, 2);
            rect(ctx, ink, -12+hem, 11, 24, 5); rect(ctx, '#a69c86', -10+hem, 12, 20, 2);
            rect(ctx, '#8b5d4e', -11, 2, 5, 6); rect(ctx, ink, -10, -12-breathe, 21, 5);
            return true;
        case 'classical':
            // High-collared painter's coat with apron and a paint-box silhouette.
            rect(ctx, ink, -19, -3, 9, 18); rect(ctx, '#786e59', -18, -2, 7, 15);
            rect(ctx, '#ad9d7d', -17, 0, 5, 2); rect(ctx, ink, -16, 4, 2, 8);
            rect(ctx, ink, -14, -9-breathe, 28, 23+breathe);
            rect(ctx, '#554b41', -12, -7, 24, 18); rect(ctx, '#817365', -10, -6, 8, 15);
            rect(ctx, '#b0a184', -5, -7, 12, 20); rect(ctx, '#8d806e', -4, -4, 10, 16);
            rect(ctx, ink, -12+hem, 11, 24, 6); rect(ctx, '#a69a80', -7+hem, 12, 13, 3);
            rect(ctx, ink, -10, -12-breathe, 20, 5); rect(ctx, '#c1b69d', -6, -11-breathe, 12, 3);
            return true;
        case 'sketcher':
            // Short artist jacket, scarf and slim sketchbook behind the shoulder.
            rect(ctx, ink, -19, -7, 8, 19); rect(ctx, '#b5ac95', -18, -6, 6, 16);
            rect(ctx, '#6f7368', -17, -4, 3, 12); rect(ctx, ink, -13, -9-breathe, 26, 23+breathe);
            rect(ctx, '#46504d', -11, -6, 22, 17); rect(ctx, '#71817b', -9, -5, 6, 14);
            rect(ctx, ink, -12+hem, 11, 24, 5); rect(ctx, '#8c9585', -9+hem, 12, 18, 2);
            rect(ctx, '#b3ac9a', -10, -11-breathe, 21, 5); rect(ctx, '#d1c8b0', -7, -10-breathe, 13, 2);
            rect(ctx, '#b3ac9a', -3, -7, 5, 9); rect(ctx, '#ded3bc', -3, -6, 2, 6);
            return true;
        default: return false;
    }
}

/** Called in the collector's head space, after its body animation transform. */
export function drawVariantAHead(ctx: CanvasRenderingContext2D, id: string, pose?: DoodlePose): boolean {
    if (!['graffiti', 'classical', 'sketcher'].includes(id)) return false;
    ctx.save(); ctx.translate(0, Math.round((pose?.idleBreath ?? 0) * 1.6) / 4 + Math.round((pose?.hit ?? 0) * .6));
    if (id === 'graffiti') {
        // Stepped mohawk silhouette and shaved temple: identifiable without color.
        rect(ctx, ink, -11, -26, 22, 12); rect(ctx, '#5e5e53', -9, -24, 9, 8); face(ctx);
        rect(ctx, ink, -10, -30, 20, 7); rect(ctx, ink, -9, -35, 5, 7);
        rect(ctx, ink, -3, -40, 5, 12); rect(ctx, ink, 3, -37, 5, 10);
        rect(ctx, '#80675b', -7, -32, 4, 3); rect(ctx, '#a37460', -2, -37, 3, 7);
        rect(ctx, '#a37460', 4, -34, 3, 5); rect(ctx, shadow, -3, -25, 12, 3);
        rect(ctx, '#b3a58e', 0, -17, 3, 2); // ear stud
    } else if (id === 'classical') {
        // Beret, swept hair and light face; warm neutral painter's palette.
        rect(ctx, ink, -12, -28, 23, 14); rect(ctx, '#594b40', -10, -26, 12, 10); face(ctx);
        rect(ctx, ink, -16, -29, 31, 5); rect(ctx, '#6f5d4b', -14, -33, 26, 5);
        rect(ctx, '#998873', -10, -35, 17, 3); rect(ctx, ink, -3, -37, 4, 3);
        rect(ctx, ink, -14, -19, 5, 8); rect(ctx, '#806b56', -13, -18, 3, 6);
        rect(ctx, ink, -3, -24, 11, 3);
    } else {
        // Angular hair, pencil tucked above the ear, and compact square glasses.
        rect(ctx, ink, -11, -29, 22, 15); rect(ctx, '#53605a', -9, -27, 11, 7); face(ctx);
        rect(ctx, ink, -12, -27, 7, 10); rect(ctx, ink, -3, -25, 13, 4);
        // Pencil and glasses use larger, distinct groups that survive 52px display.
        rect(ctx, ink, -12, -36, 6, 14); rect(ctx, '#d0c4a7', -11, -34, 4, 10);
        rect(ctx, '#879185', -11, -33, 4, 2); rect(ctx, ink, -11, -37, 4, 2);
        rect(ctx, ink, 1, -22, 11, 5); rect(ctx, '#c3cbbd', 3, -21, 7, 3);
        rect(ctx, ink, 0, -21, 3, 2);
    }
    ctx.restore(); return true;
}
