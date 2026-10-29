/** Isolated chaser concept. Origin at creature center; size is display edge. */
const INK = '#1d211f', DARK = '#373b35', SHADE = '#64675d';
const PAPER = '#d2d0c2', LIGHT = '#ece9dc';

function pixel(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

/**
 * A torn, ink-soaked sketch pursuing the player. A single narrow eye and
 * jagged, lopsided silhouette are readable over both paper and colored paint.
 * phase is the animation angle; moving is a normalized 0..1 weight.
 */
export function drawChaserDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const walk = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const t = Number.isFinite(phase) ? phase : 0;
    // A low, forward-pulling motion: the ink mass glides over one broad
    // grounded underside while a single raking forelimb reaches and pulls.
    const pull = (1 - Math.cos(t)) * .5 * walk;
    const reach = Math.round(4 * pull);
    const bodyX = Math.round(-2 * pull);
    const heave = Math.round(walk * Math.sin(t) * .55 + (1 - walk) * Math.sin(t * .5) * .35);
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;

    // Wide smudged underside remains on the paper throughout the movement.
    pixel(ctx, INK, -13, 17, 26, 6);
    pixel(ctx, INK, -17, 22, 32, 5);
    pixel(ctx, DARK, -13, 23, 22, 2);
    pixel(ctx, INK, 10, 20, 9, 5);

    ctx.translate(bodyX, heave);
    // A long front claw carries the body forward, rather than two small feet
    // shuffling. Its tip moves only a few pixels and settles as movement stops.
    pixel(ctx, INK, -21, -7, 6, 17);
    pixel(ctx, INK, -25 - reach, 4, 6, 12);
    pixel(ctx, INK, -29 - reach, 14, 6, 8);
    pixel(ctx, INK, -31 - reach, 20, 9, 4);
    pixel(ctx, DARK, -27 - reach, 9, 2, 10);
    // Shorter trailing shard and dark paper torn along the flank.
    pixel(ctx, INK, 14, -10, 6, 19);
    pixel(ctx, INK, 18, 5, 5, 11);
    pixel(ctx, INK, 20, 14, 5, 4);
    pixel(ctx, DARK, 18, 5, 2, 8);

    // Oblique torn mass, with a long black wedge rising from one shoulder.
    pixel(ctx, INK, -17, -17, 33, 31);
    pixel(ctx, INK, -13, -24, 27, 9);
    pixel(ctx, INK, -9, -29, 18, 6);
    pixel(ctx, INK, -6, -33, 7, 5);
    pixel(ctx, INK, 8, -27, 4, 7);
    pixel(ctx, INK, -20, -11, 6, 20);
    pixel(ctx, INK, 14, -12, 5, 23);
    pixel(ctx, INK, -14, 12, 25, 7);
    pixel(ctx, DARK, -14, -14, 25, 24);
    pixel(ctx, SHADE, -12, -16, 9, 22);
    pixel(ctx, SHADE, -4, -20, 8, 4);
    pixel(ctx, PAPER, -10, -14, 7, 12);
    pixel(ctx, PAPER, -7, -3, 6, 8);
    // One narrow pale eye underneath a heavy diagonal brow; no pupils or smile.
    pixel(ctx, INK, 0, -11, 13, 5);
    pixel(ctx, LIGHT, 3, -10, 8, 2);
    pixel(ctx, INK, 0, -12, 7, 2);
    // Cut marks on the lower body evoke torn paper and dried ink.
    pixel(ctx, SHADE, 5, 2, 3, 7);
    pixel(ctx, SHADE, 9, 5, 3, 6);
    pixel(ctx, DARK, -7, 6, 9, 3);
    ctx.restore();
}
