/** A hostile torn-paper plane. Origin is the centre of its 64-unit drawing box. */
export function drawPlane(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number, elapsedSeconds = phase / 7): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const m = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const ink = '#1d211e', shadow = '#454b45', grey = '#93988d', paper = '#d4d6ca';
    // A slower on/off warning: the whole craft becomes red, then its paper
    // colors return completely. Ease only at the two transitions.
    const seconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    const cycle = seconds % .7;
    const pulse = cycle < .07 ? cycle / .07 : cycle < .28 ? 1 : cycle < .35 ? (.35 - cycle) / .07 : 0;
    const tint = (hex: string): string => {
        if (pulse <= 0) return hex;
        const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        const light = (rgb[0] + rgb[1] + rgb[2]) / 3;
        // Preserve each layer's brightness so folds and tears remain readable.
        const target = [Math.min(255, 110 + light * .57), light * .10, light * .08];
        return `rgb(${rgb.map((v, i) => Math.round(v + (target[i] - v) * pulse)).join(',')})`;
    };
    const block = (c: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = tint(c); ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size/64,size/64); ctx.imageSmoothingEnabled = false;
    // Hover clearly above its ground reference. The torn wings shudder in motion.
    ctx.translate(0, Math.round(-7 - Math.sin(t*.8)*(m ? 2 : 1)));
    const flutter = Math.round(Math.sin(t*1.5)*m*2);
    if (pulse > 0) {
        ctx.save(); ctx.globalAlpha *= pulse;
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';
        ctx.strokeStyle = '#fa3434'; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(30,-1); ctx.lineTo(16,-8);
        ctx.lineTo(-30,-15+flutter); ctx.lineTo(-16,-3);
        ctx.lineTo(-30,17); ctx.lineTo(15,5); ctx.closePath(); ctx.stroke();
        ctx.restore();
    }
    // Stepped swept-back silhouette has a sharp point and a deep asymmetric tear.
    block(ink,-30,-15+flutter,14,5); block(ink,-25,-11+flutter,18,5);
    block(ink,-20,-6+flutter,22,5); block(ink,-15,-1,28,6);
    block(ink,-21,4,30,5); block(ink,-27,9,28,5); block(ink,-30,13,15,5);
    block(ink,-13,-11,31,19); block(ink,15,-8,8,13); block(ink,22,-5,5,7); block(ink,26,-3,5,3);
    // Paper faces are deliberately opaque so colored artwork cannot swallow them.
    block(paper,-24,-12+flutter,13,3); block(paper,-18,-8+flutter,20,4);
    block(paper,-13,-3,26,5); block(grey,-17,4,24,4); block(paper,-23,9,19,3);
    block(paper,8,-6,10,9); block(grey,18,-4,6,5); block(paper,23,-3,4,3);
    // Fold and tears create menace without eyes or cartoon expression.
    block(ink,-11,-2,30,3); block(shadow,-17,4,18,2); block(ink,-17,11,3,4);
    block(ink,-21,9,3,3); block(ink,-9,-8,2,4); block(ink,-7,-5,4,2);
    block(shadow,1,-4,10,2); block(paper,-8,-2,11,1);
    ctx.restore();
}
