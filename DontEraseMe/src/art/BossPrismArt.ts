/** Four-faced color-stripping prism; isolated concept, centered in 64-unit space. */
export function drawBossPrismDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const motion = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const ink = '#191c1b', deep = '#303530', slate = '#5d655c', grey = '#91978c', bone = '#c8cabe', white = '#e4e4d8';
    const block = (color:string, x:number, y:number, w:number, h:number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size/64, size/64); ctx.imageSmoothingEnabled = false;
    ctx.translate(0, Math.round(-2 + Math.sin(t*.38) * (motion ? 1.5 : 1)));

    // Four separate chipped guards surround the central prism. Their offsets
    // make the shield layers read at actual size, including on colored paint.
    const shift = Math.round(Math.sin(t*.55));
    block(ink,-6,-29-shift,12,3); block(ink,-9,-26-shift,18,5);
    block(slate,-6,-25-shift,11,3); block(bone,-3,-27-shift,6,2);
    block(ink,-9,22+shift,18,4); block(ink,-6,26+shift,12,3);
    block(slate,-6,23+shift,12,3); block(grey,-3,26+shift,6,2);
    block(ink,-31,-9,4,18); block(ink,-27,-13,5,26); block(deep,-30,-7,3,14);
    block(grey,-26,-10,3,18); block(bone,-25,-8,2,6);
    block(ink,27,-9,4,18); block(ink,22,-13,5,26); block(deep,27,-7,3,14);
    block(grey,23,-10,3,18); block(bone,23,1,2,6);

    // Faceted angular body; heavy dark contours separate each shard.
    block(ink,-7,-23,14,4); block(ink,-13,-19,26,5);
    block(ink,-19,-14,38,6); block(ink,-23,-8,46,16);
    block(ink,-19,8,38,6); block(ink,-13,14,26,5); block(ink,-7,19,14,4);
    block(slate,-7,-20,14,3); block(grey,-13,-17,13,4); block(bone,-8,-16,8,3);
    block(grey,-19,-12,16,5); block(bone,-17,-11,10,3);
    block(slate,2,-16,11,4); block(deep,12,-11,7,10); block(grey,4,-11,8,5);
    block(deep,-20,-5,10,12); block(grey,-9,-9,16,18); block(bone,-7,-8,5,15);
    block(slate,8,-4,12,11); block(grey,13,-2,5,5);
    block(slate,-16,8,13,4); block(grey,-11,12,8,4); block(deep,-5,16,10,4);
    block(grey,4,9,11,4); block(bone,4,10,7,2);
    // A narrow central void and a split facet give the boss a hostile focal point.
    block(ink,-3,-10,6,19); block(white,-2,-4,4,2);
    block(ink,3,-14,2,8); block(ink,5,-8,2,5); block(ink,7,-4,2,5);
    block(ink,6,1,2,5); block(ink,3,5,3,6);
    ctx.restore();
}
