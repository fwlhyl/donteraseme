/** The painted tank faces right in a 64-unit square. Motion is presentation
 * only: time is simulation seconds, moving and attack are normalized 0..1. */
export function drawMagicTank(ctx: CanvasRenderingContext2D, size: number, time: number,
    moving: number, attack: number, aim = 0): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(time) ? time : 0;
    const move = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const fire = Math.max(0, Math.min(1, Number.isFinite(attack) ? attack : 0));
    const ink = '#202520', dark = '#343c34', steel = '#566254';
    const pale = '#a4aa96', light = '#7d8b76', paper = '#c3c4ad';
    const rect = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;

    // Continuous dark track stays planted; plates move through the belt.
    rect(ink,-27,12,51,14); rect(ink,-24,9,44,3); rect(ink,-24,26,44,2);
    rect(dark,-25,14,47,10); rect(steel,-23,15,43,7);
    for (const x of [-17,-5,7,17]) {
        rect(ink,x-4,15,8,8); rect(light,x-3,16,6,6); rect(dark,x-1,18,2,2);
    }
    const phase = move > .025 ? Math.floor(t * 14) % 7 : 0;
    for (let x = -23; x < 21; x += 7) {
        const mark = x + phase;
        if (mark < 20) { rect(pale,mark,11,4,1); rect(ink,mark,24,4,2); }
    }

    // Sloped side-armour and ragged paint-can fittings; the heavy chassis
    // vibrates in place rather than sliding the tracks under the player.
    ctx.translate(Math.round(Math.sin(t * 17) * move * .4), 0);
    rect(ink,-24,-2,46,13); rect(ink,-20,-6,35,4);
    rect(dark,-22,0,42,8); rect(steel,-19,-3,34,8);
    rect(light,-17,-2,27,2); rect(dark,11,-2,7,9);
    rect(ink,-22,7,43,3); rect(pale,-20,6,29,1);
    rect(ink,-24,3,6,6); rect(light,-23,3,3,3);
    rect(ink,-17,-5,5,3); rect(paper,-16,-5,3,1);
    rect(ink,-11,0,3,4); rect(pale,-10,1,1,2);
    rect(ink,0,0,3,4); rect(pale,1,1,1,2);

    // Turret and brush-like cannon recoil as one mass; no collision changes.
    ctx.save(); ctx.translate(-Math.round(fire * 7), -Math.round(fire * 1.5));
    rect(ink,-15,-16,29,12); rect(ink,-12,-20,21,4);
    rect(dark,-13,-15,25,9); rect(steel,-11,-17,19,8);
    const idle = move < .05 && Math.sin(t * 2.2) > .35 ? 1 : 0;
    rect(light,-9,-16,13,2); rect(ink,-5,-22-idle,9,3);
    rect(pale,-4,-21-idle,6,1); rect(ink,7,-14,7,8);
    ctx.save(); ctx.translate(11,-10); ctx.rotate(Number.isFinite(aim) ? aim : 0); ctx.translate(-11,10);
    rect(ink,11,-13,17,6); rect(steel,13,-12,14,3);
    rect(ink,26,-15,4,10); rect(pale,27,-13,2,5);
    // A tiny single-frame spark reinforces the shot, kept close to the muzzle.
    if (fire > .45) {
        ctx.fillStyle=light;ctx.strokeStyle=ink;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(30,-12);ctx.lineTo(38,-17);ctx.lineTo(36,-11);
        ctx.lineTo(44,-10);ctx.lineTo(36,-8);ctx.lineTo(38,-3);ctx.lineTo(30,-8);ctx.closePath();ctx.fill();ctx.stroke();
        rect(paper,31,-11,6,2);
    }
    ctx.restore();
    ctx.restore();
    ctx.restore();
}
