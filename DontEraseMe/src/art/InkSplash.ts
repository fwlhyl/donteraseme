/** Irregular ink impact. Uses recorded canvas paths so artwork replay matches the original. */
export function drawInkSplash(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, opacity = 1): void {
    if (![x, y, radius].every(Number.isFinite) || radius <= 0) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= opacity;
    // A low, uneven pool with soft lobes, rather than a circular stamp.
    const count = 14, phase = Math.random() * Math.PI * 2;
    const points: [number, number][] = [];
    for (let i = 0; i < count; i++) {
        const angle = phase + i * Math.PI * 2 / count;
        const reach = radius * (.22 + Math.random() * .24);
        points.push([x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * .78]);
    }
    ctx.beginPath();
    const last = points[count - 1], first = points[0];
    ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
    for (let i = 0; i < count; i++) {
        const p = points[i], next = points[(i + 1) % count];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
    }
    ctx.closePath(); ctx.fill();
    // Asymmetric, tapered spatters with small detached droplets.
    const sprays = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < sprays; i++) {
        const angle = phase + Math.random() * Math.PI * 2;
        const reach = radius * (.43 + Math.random() * .46);
        const length = radius * (.10 + Math.random() * .19);
        const width = radius * (.025 + Math.random() * .035);
        const dx = Math.cos(angle), dy = Math.sin(angle) * .78;
        const px = -Math.sin(angle), py = Math.cos(angle) * .78;
        const sx = x + dx * reach, sy = y + dy * reach;
        ctx.beginPath();
        ctx.moveTo(sx - dx * length, sy - dy * length);
        ctx.quadraticCurveTo(sx + px * width, sy + py * width, sx + dx * length * .22, sy + dy * length * .22);
        ctx.quadraticCurveTo(sx - px * width, sy - py * width, sx - dx * length, sy - dy * length);
        ctx.fill();
        if (i % 2 === 0) {
            const offset = reach + length * (1.3 + Math.random());
            ctx.beginPath();
            ctx.ellipse(x + dx * offset, y + dy * offset, Math.max(1, width * .55), Math.max(.8, width * .35), angle, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
