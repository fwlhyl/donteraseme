/** Dark ink-bottle mother, isolated visual concept. Ground anchor near y=29. */
export function drawSummonerDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number | boolean): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const walk = typeof moving === 'boolean' ? Number(moving) : Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const step = Math.sin(t) * walk;
    const pulse = Math.round(Math.sin(t * .5) * (1 - walk) + Math.abs(step));
    const INK = '#1b1e1c', DARK = '#343934', MID = '#62685e', PAPER = '#bfc2b2', LIGHT = '#dbddd0';
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;

    // The engine is anchored to the hovering bottle; its flat-topped triangle
    // widens toward the exhaust, which flickers below the wide lower edge.
    const hover = 7 + Math.round((Math.sin(t * .7) + 1) * .75);
    const flicker = Math.round((Math.sin(t * 2.4) + 1) * 1.25);
    const engineDrift = Math.round(step * .5);
    ctx.save();
    ctx.translate(Math.round(step*.5), -hover - Math.round(pulse*.4));
    // Broken rim and stopper form a recognizable ink bottle silhouette.
    px(INK,-11,-30,23,5); px(INK,-8,-34,16,4); px(DARK,-6,-33,11,2);
    px(INK,-9,-26,19,7); px(MID,-7,-25,15,2); px(INK,5,-28,6,5);
    // Wide glass shoulders and heavy opaque contents, with jagged lower edge.
    px(INK,-17,-21,33,4); px(INK,-21,-17,41,4); px(INK,-24,-13,47,27);
    px(INK,-22,14,43,5); px(INK,-19,19,34,4); px(INK,15,18,4,4);
    px(MID,-20,-14,38,27); px(DARK,-17,-12,34,26);
    px(PAPER,-20,-12,4,21); px(LIGHT,-18,-15,19,2); px(MID,17,-10,3,19);
    px(INK,-14,-8,28,19); px(INK,-10,-12,20,5); px(INK,-16,9,29,7);
    // A fractured label and bottle cracks replace facial features.
    px(PAPER,-12,-5,22,12); px(MID,-10,-3,18,8); px(DARK,-8,-2,14,6);
    px(INK,-2,-6,3,4); px(INK,0,-3,3,4); px(INK,-2,0,4,3);
    px(INK,-4,3,3,4); px(PAPER,8,-9,2,5); px(PAPER,10,-5,2,3);
    px(INK,14,-12,3,8); px(INK,12,-5,3,5); px(INK,9,0,4,3);
    // Emerging ink drops connect the figure to the summoning mechanic.
    const drift = Math.round((Math.sin(t * .7) + 1) * 1.5);
    px(INK,20,-18-drift,5,7); px(DARK,21,-16-drift,3,4);
    px(INK,23,-10-drift,4,5); px(INK,-25,-20+drift,5,6);
    px(PAPER,-24,-19+drift,2,2);
    ctx.restore();

    ctx.save(); ctx.translate(engineDrift, 0);
    // A stepped, flat-topped triangle: broad enough at the top to join the
    // bottle and unmistakably wider at the exhaust lip.
    px(INK,-6,17-hover,12,3); px(DARK,-4,17-hover,8,2);
    px(INK,-9,20-hover,18,3); px(MID,-7,20-hover,14,2);
    px(INK,-12,23-hover,24,3); px(DARK,-10,23-hover,20,2);
    px(INK,-15,26-hover,30,4); px(MID,-12,26-hover,24,2);
    px(INK,-16,30-hover,32,3); px(PAPER,-12,30-hover,24,1);
    // Broad segmented jet and warm inner plume, extending visibly below the lip.
    px('#743d32',-12,33-hover,24,3);
    px('#b4744b',-9,36-hover,18,3+flicker);
    px('#d7b27a',-6,34-hover,12,5+Math.floor(flicker/2));
    px('#8c5140',-4,39-hover+flicker,8,2);
    ctx.restore();
    ctx.restore();
}
