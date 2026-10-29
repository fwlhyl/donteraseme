/** Concept only: the split ink mass breathes, pulls itself along and sheds ink. */
export function drawBossSlimeDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const motion = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const shift = Math.round(Math.sin(t * .7) * motion * 1.5);
    const swell = Math.round((Math.sin(t * .8) + 1) * .7);
    const ink='#191d1b', dark='#282f2b', mid='#46504a', gray='#7b8478', pale='#bcc1b2';
    const px=(color:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
    ctx.save();ctx.scale(size/64,size/64);ctx.imageSmoothingEnabled=false;
    // Spilled ink claws drag independently under the bulk of the creature.
    const pull=Math.round(Math.sin(t)*2*motion);
    px(ink,-32,19,13,5);px(dark,-31-pull,23,11,3);px(ink,-32-pull,25,5,3);
    px(ink,17,18,15,5);px(dark,23+pull,22,9,4);px(ink,29+pull,25,3,3);
    px(ink,-19,23,38,5);px(dark,-15,26,30,3);
    ctx.translate(shift,-swell);
    // Massive uneven ink swell: broad shoulder, torn crest, pooled lower edge.
    px(ink,-20,-23,38,4);px(ink,-25,-19,48,5);px(ink,-29,-14,56,18);
    px(ink,-30,4,59,12);px(ink,-26,16,51,7);px(ink,-19,22,37,4);
    px(ink,-16,-27,7,5);px(ink,3,-29,6,7);px(ink,15,-25,5,7);
    px(dark,-23,-16,44,31);px(mid,-21,-13,8,19);px(dark,-14,-19,29,5);
    px(ink,-12,-15,29,27);px(dark,16,-9,8,21);px(mid,20,-6,3,14);
    px(gray,-20,-13,4,11);px(mid,-17,-9,3,11);px(gray,13,-15,4,4);
    // Jagged pale split seam, not a face; detached pieces hint at division.
    px(gray,-5,-17,4,4);px(pale,-3,-13,4,5);px(gray,-1,-8,4,4);
    px(pale,0,-4,3,5);px(gray,-3,1,5,3);px(pale,-5,4,4,5);px(gray,-8,9,5,3);
    px(mid,5,-12,6,3);px(mid,8,-9,3,7);px(gray,8,5,5,2);
    px(dark,-22,14,12,4);px(mid,-19,15,8,2);px(dark,10,13,12,5);
    const drip=Math.round((Math.sin(t*1.1)+1)*1.5);
    px(ink,-27,-22-drip,4,5);px(mid,-26,-21-drip,2,2);
    px(ink,24,-16+drip,4,6);px(mid,25,-15+drip,2,3);
    ctx.restore();
}
