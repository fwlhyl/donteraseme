import { drawEraser } from '../art/EraserArt';

/** Childlike pencil marks are kept on their own layer so only they are erased. */
function drawChildhood(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = '#353630'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = (...points: number[]) => {
        ctx.beginPath(); ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
        ctx.stroke();
    };
    // A deliberately uneven sun and rays, like a pencil drawing on paper.
    ctx.beginPath(); ctx.ellipse(351, 553, 33, 31, -.1, 0, Math.PI * 2); ctx.stroke();
    [[351,506,351,492],[351,601,351,613],[305,552,289,551],[397,553,411,553],
     [318,520,308,509],[386,520,397,509],[319,587,309,596],[385,586,397,596]].forEach(p => line(...p));
    // Small stick figure; no game character or equipment.
    ctx.beginPath(); ctx.ellipse(292, 663, 19, 20, .12, 0, Math.PI * 2); ctx.stroke();
    line(291,684,294,727,277,753); line(294,726,313,752);
    line(292,697,267,711); line(293,698,318,711);
    // House, roof, chimney, window and doorway.
    line(447,675,523,611,603,674); line(458,668,459,755,591,752,590,667);
    line(540,624,541,605,559,606,558,638);
    line(472,693,495,692,496,716,473,717,472,693); line(484,693,484,716); line(473,704,495,704);
    line(530,753,530,711,554,711,554,753); line(549,733,550,733);
    // Loose tree and a couple of paper-ground marks.
    line(742,751,742,695); line(765,752,764,695);
    ctx.beginPath(); ctx.moveTo(752,627); ctx.bezierCurveTo(724,621,708,644,718,660);
    ctx.bezierCurveTo(695,672,707,699,730,700); ctx.bezierCurveTo(742,712,761,710,770,699);
    ctx.bezierCurveTo(799,702,806,679,791,666); ctx.bezierCurveTo(804,645,781,624,766,633);
    ctx.bezierCurveTo(763,627,757,626,752,627); ctx.stroke();
    line(684,752,805,751); line(247,757,327,755);
    ctx.restore();
}

/** Menu artwork uses the game's eraser rig; drawing and erasure are visual only. */
export function mountMenuArtwork(): void {
    const menu = document.getElementById('main-menu');
    const canvas = document.getElementById('menu-artwork') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!menu || !canvas || !ctx) return;
    const marks = document.createElement('canvas'); marks.width = canvas.width; marks.height = canvas.height;
    const pencil = marks.getContext('2d');
    if (!pencil) return;
    drawChildhood(pencil);
    // The eraser's actual sprite supplies the mask. The untouched original is
    // retained separately so the drawing can reappear after the sweep.
    const remaining = document.createElement('canvas'); remaining.width = canvas.width; remaining.height = canvas.height;
    const paper = remaining.getContext('2d');
    const sprite = document.createElement('canvas'); sprite.width = 320; sprite.height = 320;
    const spriteCtx = sprite.getContext('2d');
    if (!paper || !spriteCtx) return;
    const resetMarks = () => { paper.clearRect(0, 0, remaining.width, remaining.height); paper.drawImage(marks, 0, 0); };
    resetMarks();
    let frame = 0, last = 0, time = 0, previousX = 1020, previousY = 675, previousT = 0;
    const visible = () => !document.hidden && menu.getClientRects().length > 0;
    const draw = (now: number) => {
        frame = 0;
        if (!visible()) { last = 0; return; }
        const dt = last ? Math.min((now - last) / 1000, .05) : 0;
        last = now; time += dt;
        // Crouch briefly, then accelerate into a dash and settle at the end.
        // The smoothstep has zero speed at each end, so neither turn is a jump.
        const t = time % 10;
        if (t < previousT) { resetMarks(); previousX = 1020; previousY = 675; }
        const windup = t < 1.3 ? Math.sin(Math.PI * t / 1.3) : 0;
        const u = Math.max(0, Math.min(1, (t - 1.3) / 2.6));
        const progress = u * u * (3 - 2 * u);
        const x = 1020 + windup * 18 - progress * 850;
        const y = 675 + windup * 5 - (u > 0 && u < 1 ? Math.sin(Math.PI * u) * 7 : 0);
        const moving = u > 0 && u < 1;
        const restore = Math.max(0, Math.min(1, (t - 6) / 2));
        const opacity = t < 5 ? 1 : t < 6 ? 6 - t : t < 9 ? 0 : t - 9;

        // Paint the exact same silhouette that is shown to the viewer. Include
        // the animated feet but not the separate ground shadow or crumbs.
        spriteCtx.clearRect(0, 0, sprite.width, sprite.height);
        spriteCtx.save(); spriteCtx.translate(160, 160); spriteCtx.scale(-1, 1);
        drawEraser(spriteCtx, 240, time * (moving ? 13 : 3.3), moving ? 1 : 0);
        spriteCtx.restore();
        if (moving) {
            // Sample the swept path, not just frame endpoints: a fast dash must
            // not leave gaps, even at low frame rates. Only pencil pixels under
            // the opaque parts of the sprite are removed.
            const distance = Math.hypot(x - previousX, y - previousY);
            const steps = Math.max(1, Math.ceil(distance / 5));
            paper.save(); paper.globalCompositeOperation = 'destination-out';
            for (let i = 0; i <= steps; i++) {
                const a = i / steps;
                paper.drawImage(sprite, previousX + (x - previousX) * a - 160, previousY + (y - previousY) * a - 160);
            }
            paper.restore();
        }
        previousX = x; previousY = y; previousT = t;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(remaining, 0, 0);
        if (restore > 0) { ctx.save(); ctx.globalAlpha = restore; ctx.drawImage(marks, 0, 0); ctx.restore(); }
        if (progress > 0 && t < 6) {
            ctx.fillStyle = '#4b4b4238';
            for (let i = 0; i < 17; i++) {
                const crumbX = 225 + i * 47;
                if (crumbX > x + 65 && crumbX < 1030) {
                    const crumbY = 765 + ((i * 29) % 19);
                    ctx.fillRect(crumbX, crumbY, 3 + (i % 3), 2 + (i % 2));
                }
            }
        }
        if (opacity > 0) {
            ctx.save(); ctx.globalAlpha = opacity;
            const shownX = t >= 9 ? 1020 : x;
            ctx.fillStyle = '#292a231c'; ctx.beginPath(); ctx.ellipse(shownX, y + 106, 83, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.drawImage(sprite, shownX - 160, y - 160); ctx.restore();
        }
        frame = requestAnimationFrame(draw);
    };
    const sync = () => {
        if (visible()) { if (!frame) frame = requestAnimationFrame(draw); }
        else { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; }
    };
    new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    document.addEventListener('visibilitychange', sync);
    sync();
}
