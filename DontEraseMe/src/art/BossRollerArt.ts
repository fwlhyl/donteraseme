/** Dark giant paint-roller boss concept; origin at center, 64 unit canvas. */
export function drawBossRollerDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const move = Number.isFinite(moving) ? Math.max(0, Math.min(1, moving)) : 0;
    const ink = '#1c201d', black = '#292e29', dark = '#424a40', mid = '#70776b';
    const pale = '#b7bbad', light = '#dcddd1', dust = '#8f9587';
    const block = (c:string, x:number,y:number,w:number,h:number) => {ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
    ctx.save(); ctx.scale(size/64,size/64); ctx.imageSmoothingEnabled=false;
    const jolt = Math.round(Math.sin(t)*move*.6);
    // Heavy steel frame: broad shoulders and upright handle, no face or feet.
    block(ink,-6,-30,12,4); block(ink,-8,-26,16,5);
    block(dark,-5,-29,7,3); block(ink,-4,-22,8,12); block(mid,-2,-22,3,10);
    block(ink,-19,-14,38,4); block(dark,-16,-13,32,2);
    block(ink,-23,-11,7,11); block(ink,16,-11,7,11);
    block(mid,-21,-10,3,9); block(dark,18,-10,3,9);
    ctx.translate(jolt,0);
    // Horizontal roller cylinder dominates the silhouette. Stepped and chipped
    // edges, a dark center and irregular scraping streaks suggest use and menace.
    block(ink,-29,-4,58,25); block(ink,-26,-8,52,4);
    block(ink,-27,21,54,5); block(ink,-24,26,48,3);
    block(dark,-27,-3,54,23); block(mid,-23,-5,45,4);
    block(pale,-25,0,49,18); block(light,-22,1,44,3);
    block(dust,-23,5,45,4); block(mid,-24,15,47,4);
    block(black,-29,-3,5,24); block(black,24,-3,5,24);
    block(mid,-27,1,2,16); block(mid,25,0,2,18);
    // Broken metal bands and black trails scroll around the roller on movement.
    const shift = Math.round(Math.sin(t)*move*2);
    block(ink,-16,0,4,19); block(dark,-15,2,2,15);
    block(ink,13,0,4,19); block(dark,14,1,2,15);
    block(ink,-10,5+shift,9,2); block(dark,-5,8+shift,12,2);
    block(ink,-2,14+shift,13,2); block(ink,18,8-shift,4,2);
    block(light,3,3,7,1); block(dark,-21,10,5,2);
    // Torn, uneven bristle edge drags across the canvas.
    for (const [x,h] of [[-25,3],[-20,5],[-14,3],[-8,6],[-2,4],[4,6],[10,3],[16,5],[22,3]] as const) {
        block(ink,x,24,4,h); block(dark,x+1,24,2,Math.max(1,h-1));
    }
    block(ink,-26,27,52,2); block(mid,-22,28,5,1); block(mid,13,28,6,1);
    // Displaced ink splinters are local to the boss, not part of artwork.
    if(move>.08){block(dark,-30,22,2,2);block(dust,-31,26,2,1);}
    ctx.restore();
}
