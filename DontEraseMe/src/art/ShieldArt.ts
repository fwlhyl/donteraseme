/** Isolated shield enemy concept. Centered in 64px space, feet near y=29. */
export function drawShieldDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const walk = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const t = Number.isFinite(phase) ? phase : 0;
    const stride = Math.sin(t) * walk;
    const ink = '#1b1e1b', dark = '#343a34', mid = '#63695e';
    const paper = '#b7baad', light = '#d4d5c9', scratch = '#858b7d';
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save();
    ctx.scale(size / 64, size / 64);
    ctx.imageSmoothingEnabled = false;

    // Compact, staggered legs support the heavy shield from underneath.
    // A short drag and delayed lift imply weight without splayed feet.
    const limb = (ax: number, ay: number, bx: number, by: number, width: number, color: string) => {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx-ax), Math.abs(by-ay))));
        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            px(color, ax+(bx-ax)*u-width/2, ay+(by-ay)*u-width/2, width, width);
        }
    };
    for (const side of [-1, 1]) {
        const cycle = t + (side < 0 ? Math.PI : 0);
        const reach = Math.sin(cycle)*walk;
        const lift = Math.max(0, Math.cos(cycle))*walk*1.2;
        const hipX = side*3-2, footX = hipX + reach*2.5, footY = 26-lift;
        const kneeX = hipX + reach - 1, kneeY = 18-lift*.25;
        limb(hipX, 10, kneeX, kneeY, 7, ink);
        limb(kneeX, kneeY, footX, footY, 6, ink);
        px(ink, footX-3, footY, 8, 3);
        px(dark, footX-2, footY, 5, 1);
    }

    // Hunched ink figure peers out behind its shield, with a single narrow eye.
    const bob = Math.round(walk * Math.abs(stride) * 1.1);
    ctx.translate(Math.round(stride), -bob);
    px(ink, -18, -18, 16, 28); px(ink, -15, -23, 12, 6);
    px(ink, -12, -28, 6, 6); px(ink, -21, -11, 5, 17);
    px(dark, -16, -15, 10, 22); px(mid, -15, -13, 4, 11);
    px(ink, -15, -18, 10, 4); px(light, -13, -17, 6, 2);
    // Ink arm grips the shield's back edge; visible claw remains small and sharp.
    px(ink, -20, 3, 5, 10); px(ink, -23, 10, 6, 3); px(ink, -24, 13, 3, 4);
    px(dark, -21, 4, 2, 8);

    // Large kite-shaped drafting-board shield. Stepped, chipped outline reads
    // separately from the rectangle eraser and resists colored backgrounds.
    px(ink, -5, -25, 24, 3); px(ink, -9, -22, 31, 4);
    px(ink, -12, -18, 37, 19); px(ink, -10, 1, 33, 7);
    px(ink, -7, 8, 27, 5); px(ink, -4, 13, 21, 5);
    px(ink, 0, 18, 13, 4); px(ink, 4, 22, 5, 3);
    px(paper, -7, -19, 27, 18); px(paper, -6, -1, 25, 6);
    px(paper, -4, 5, 21, 5); px(paper, -2, 10, 17, 4);
    px(mid, 18, -17, 4, 16); px(mid, 15, 0, 4, 7);
    px(light, -6, -17, 4, 15); px(scratch, -3, -17, 19, 2);
    // Clipped corner and irregular fracture evoke a broken drawing board.
    px(ink, 16, -22, 6, 5); px(mid, 17, -20, 4, 2);
    px(ink, 7, -17, 3, 5); px(ink, 4, -12, 5, 3);
    px(ink, 5, -9, 3, 5); px(ink, 1, -5, 6, 3);
    px(ink, 1, -2, 3, 5); px(ink, -2, 3, 5, 3);
    px(dark, -4, 7, 4, 3); px(scratch, 9, 6, 6, 2);
    // Narrow bindings and edge notches, not a face or decorative emblem.
    px(dark, -8, -16, 2, 11); px(dark, 19, -9, 3, 4);
    px(ink, 15, 9, 4, 3); px(ink, -4, 14, 4, 2);
    ctx.restore();
}
