/** Armoured ink-and-paper automaton, facing right in a 64-unit local frame.
 * `time` is an animation phase, `moving` blends the walk, and `attack` is a
 * descending 1-to-0 attack pulse. Ground shadow is drawn by the caller. */
export function drawMagicRobot(ctx: CanvasRenderingContext2D, size: number,
    time: number, moving: number, attack: number, aim = 0): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const phase = Number.isFinite(time) ? time : 0;
    const motion = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const hit = Math.max(0, Math.min(1, Number.isFinite(attack) ? attack : 0));
    const punch = Math.sin((1 - hit) * Math.PI) * (hit > 0 ? 1 : 0);
    const stride = Math.sin(phase) * motion;
    const liftA = Math.max(0, Math.cos(phase)) * 3 * motion;
    const liftB = Math.max(0, -Math.cos(phase)) * 3 * motion;
    const bob = Math.round((Math.abs(Math.sin(phase)) * motion * -.8) + (1 - motion) * Math.sin(phase * .36) * .45);
    const ink = '#202420', dark = '#343b34', steel = '#657063', light = '#9da997', paper = '#c7cbbc';
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;

    // Two separate powered legs alternate. Each foot remains below its hip;
    // only the returning leg lifts, keeping a heavy planted walk.
    const leg = (x: number, step: number, lift: number, rear: boolean) => {
        const foot = Math.round(x + step * 4), rise = Math.round(lift);
        px(ink, x - 5, 9, 10, 10); px(dark, x - 3, 10, 6, 8);
        px(ink, foot - 5, 16 - rise, 10, 10); px(rear ? dark : steel, foot - 3, 17 - rise, 6, 7);
        px(ink, foot - 7, 24 - rise, 14, 5); px(dark, foot - 5, 24 - rise, 10, 3);
        px(light, foot - 3, 24 - rise, 5, 1);
    };
    leg(-7, -stride, liftA, true);
    // Rear shoulder and counterweight sit behind the chassis.
    ctx.save(); ctx.translate(0, bob);
    px(ink, -19, -13, 10, 20); px(dark, -17, -11, 6, 16);
    px(ink, -21, 0, 9, 13); px(steel, -19, 1, 5, 9);
    // Broad torso with a stepped outline and a central armour plate.
    px(ink, -14, -17, 26, 28); px(ink, -17, -11, 31, 18);
    px(dark, -12, -15, 23, 22); px(steel, -10, -14, 17, 13);
    px(light, -9, -13, 14, 2); px(dark, -9, -2, 16, 7);
    px(ink, -5, -7, 10, 4); px(paper, -3, -6, 6, 2);
    px(ink, -12, 8, 24, 4); px(steel, -8, 8, 12, 2);
    // Armoured head: narrow horizontal visor, no cartoon face.
    px(ink, -10, -28, 20, 13); px(ink, -7, -31, 14, 4);
    px(dark, -8, -27, 16, 10); px(steel, -6, -27, 11, 3);
    px(ink, -3, -23, 12, 4); px(paper, 0, -22, 8, 2);
    px(ink, -10, -18, 18, 3); px(steel, -8, -30, 9, 1);
    // Forearm travels forward and recoils along the player's aiming side.
    const extension = Math.round(punch * 11);
    const shoulderX = 10, fistX = 16 + extension;
    ctx.save(); ctx.translate(10,-7); ctx.rotate(Number.isFinite(aim) ? aim : 0); ctx.translate(-10,7);
    px(ink, shoulderX, -12, 7, 12); px(steel, shoulderX + 1, -11, 5, 7);
    px(ink, 14, -7, Math.max(6, fistX - 10), 8);
    px(dark, 15, -6, Math.max(4, fistX - 11), 5);
    px(ink, fistX, -10, 11, 13); px(steel, fistX + 2, -8, 7, 8);
    if (hit > .35) {
        ctx.strokeStyle='#91afbf';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(fistX+12,-11);ctx.lineTo(fistX+18,-6);ctx.lineTo(fistX+14,1);ctx.stroke();
        ctx.strokeStyle=paper;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(fistX+14,-5);ctx.lineTo(fistX+23,-5);ctx.stroke();
    }
    px(light, fistX + 3, -7, 5, 2); px(dark, fistX + 7, -4, 2, 4);
    ctx.restore();
    ctx.restore();
    leg(7, stride, liftB, false);
    ctx.restore();
}
