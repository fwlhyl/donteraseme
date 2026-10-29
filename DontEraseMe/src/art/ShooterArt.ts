/** Correction-fluid shooter concept, drawn only in the isolated review page.
 * Origin is the body centre, size is the display edge, feet end near y=30. */
export function drawShooterDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const m = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const stride = Math.sin(t) * m;
    const ink = '#1c201e', deep = '#343a36', grey = '#72786f', paper = '#c3c7bb', pale = '#e3e4d8';
    const block = (c: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size/64,size/64); ctx.imageSmoothingEnabled = false;
    // Low, heavy continuous track: the belt stays grounded while individual
    // tread marks travel through the exposed middle, giving forward motion.
    block(ink,-20,17,40,11); block(ink,-17,14,34,3);
    block(ink,-17,28,34,2); block(deep,-18,18,36,8);
    block(grey,-15,19,30,5); block(deep,-15,20,30,3);
    for (const x of [-12, 0, 12]) {
        block(ink,x-3,19,6,6); block(grey,x-2,20,4,4); block(deep,x-1,21,2,2);
    }
    const offset = Math.floor((t * 2) % 6);
    for (let x=-16; x<=12; x+=6) {
        const tick = x + (m > .04 ? offset : 0);
        if (tick <= 16) { block(paper,tick,15,3,1); block(grey,tick,26,3,1); }
    }
    // Only a subtle motor vibration; the tracked base does not bob or skate.
    ctx.translate(Math.round(stride*.35), 0);
    // Cracked correction-fluid bottle: a narrow, tall, asymmetrical silhouette.
    block(ink,-12,-20,25,35); block(ink,-9,-25,19,5); block(ink,-7,-29,15,5);
    block(ink,-5,-33,11,4); block(deep,-4,-32,9,2);
    block(paper,-10,-18,21,30); block(pale,-9,-17,4,25); block(grey,8,-17,3,25);
    block(deep,-11,-8,22,10); block(grey,-9,-7,17,5); block(ink,-8,-5,14,3);
    // Slit in place of a face, dark split and angled, broken labels.
    block(pale,-5,-4,8,1); block(ink,3,-19,2,6); block(ink,1,-13,3,5);
    block(ink,-1,-8,3,5); block(ink,-2,3,2,7); block(deep,-8,7,10,2);
    // Long nozzle points toward the target. Dark tube silhouette reads at 50px.
    block(ink,10,-11,8,8); block(ink,17,-10,10,5); block(ink,26,-9,5,3);
    block(grey,12,-10,10,2); block(pale,23,-9,5,1); block(ink,13,-3,4,6);
    // Torn paper wrap and scuffed base.
    block(ink,-13,8,25,5); block(deep,-10,10,19,3); block(ink,-8,14,18,4);
    ctx.restore();
}
