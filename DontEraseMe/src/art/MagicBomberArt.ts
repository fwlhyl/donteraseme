/** Piloted bomber, drawn upright and facing right. The caller owns the ground
 * shadow and mirroring. `time` is in seconds; `attack` decays from 1 to 0. */
export function drawMagicBomber(ctx: CanvasRenderingContext2D, size: number,
    time: number, moving: number, attack: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(time) ? time : 0;
    const m = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const a = Math.max(0, Math.min(1, Number.isFinite(attack) ? attack : 0));
    const ink = '#1c211e', dark = '#343b35', mid = '#687468';
    const light = '#a1a99a', paper = '#d3d5c8', glow = '#c78351';
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;
    // Airframe floats above the ground; a hit of recoil moves it backwards,
    // while the separate fixed ground shadow remains with the caller.
    ctx.translate(Math.round(-a * 3), Math.round(-13 + Math.sin(t * 3) * 1.5 - a));

    // Engine exhaust is intermittent at idle, longer while travelling.
    const flame = 3 + Math.round(m * 4) + Math.round((Math.sin(t * 19) + 1) * 1.2);
    px(dark, -29 - flame, 0, flame + 4, 4);
    px(glow, -29 - flame, 1, Math.max(2, flame - 1), 2);
    px(paper, -29 - Math.round(flame * .55), 1, 3, 1);

    // Swept rear stabilizer and high, angular main wing sit behind the hull.
    px(ink,-27,-15,8,17); px(ink,-29,-12,9,3); px(ink,-24,-19,4,7);
    px(mid,-26,-13,5,10); px(light,-24,-17,2,6);
    px(ink,-15,-14,8,17); px(ink,-13,-18,7,15); px(ink,-10,-21,7,14);
    px(ink,-7,-23,5,13); px(ink,-3,-21,5,15); px(ink,1,-16,5,12);
    px(dark,-12,-14,5,14); px(mid,-10,-18,4,12); px(light,-7,-21,3,10);
    px(mid,-4,-19,3,10); px(dark,0,-14,3,8);

    // Long armoured fuselage, blunt tail and tapered nose.
    px(ink,-28,-8,43,17); px(ink,-25,-11,36,3); px(ink,14,-7,8,14);
    px(ink,21,-5,5,10); px(ink,26,-3,4,6); px(ink,30,-1,3,2);
    px(dark,-26,-6,43,13); px(mid,-23,-8,31,4); px(mid,-21,-4,37,8);
    px(light,-20,-7,27,2); px(light,-18,-3,29,2); px(paper,8,-5,7,2);
    px(dark,14,0,10,4); px(mid,22,-2,4,4); px(light,26,-1,3,2);
    px(ink,-25,5,44,3); px(dark,-20,6,32,2);

    // Cockpit is a dark canopy, not a cartoon face.
    px(ink,-1,-12,11,6); px(ink,8,-10,5,4); px(dark,0,-11,8,4);
    px(light,2,-10,4,1); px(paper,8,-8,2,1);
    px(ink,-21,-3,3,5); px(dark,-17,-2,7,2); px(ink,11,-1,2,3);

    // Near wing and engine nacelle have stepped contours for pixel readability.
    px(ink,-11,2,15,7); px(ink,-14,7,15,6); px(ink,-18,12,15,5);
    px(ink,-21,16,12,4); px(ink,-23,19,8,3);
    px(mid,-10,4,11,4); px(mid,-13,8,11,4); px(dark,-17,13,10,3);
    px(light,-12,5,7,1); px(light,-15,10,5,1);
    px(ink,-14,0,12,8); px(dark,-12,1,9,6); px(mid,-11,2,6,2);
    px(ink,-18,2,5,4); px(paper,-15,2,2,1);

    // A brief opening bomb bay and falling cartridge make the attack readable.
    // This is visual feedback only; combat projectiles are owned by the system.
    if (a > .04) {
        const fall = Math.round((1 - a) * 9);
        px(ink,-4,8,12,3); px(mid,-2,9,7,1);
        px(ink,0,11 + fall,6,7); px(dark,1,12 + fall,4,5);
        px(light,2,12 + fall,2,2); px(ink,2,18 + fall,2,2);
    }
    ctx.restore();
}
