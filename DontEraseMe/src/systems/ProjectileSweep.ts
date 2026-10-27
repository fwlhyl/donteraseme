/** Continuous checks for fast weapon bodies. A null result means no contact;
 * otherwise the result is the first contact fraction along this frame's path. */
function segmentCircleTime(ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, radius: number): number | null {
    const dx = bx - ax, dy = by - ay, ox = ax - cx, oy = ay - cy;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a === 0) return null;
    const b = ox * dx + oy * dy, discriminant = b * b - a * c;
    if (discriminant < 0) return null;
    const t = (-b - Math.sqrt(discriminant)) / a;
    return t >= 0 && t <= 1 ? t : null;
}
function segmentBoxTime(ax: number, ay: number, bx: number, by: number,
    hx: number, hy: number): number | null {
    let enter = 0, exit = 1;
    for (const [a, d, h] of [[ax, bx - ax, hx], [ay, by - ay, hy]]) {
        if (Math.abs(d) < 1e-10) {
            if (a < -h || a > h) return null;
            continue;
        }
        let near = (-h - a) / d, far = (h - a) / d;
        if (near > far) [near, far] = [far, near];
        enter = Math.max(enter, near); exit = Math.min(exit, far);
        if (enter > exit) return null;
    }
    return enter;
}
function earliest(times: (number | null)[]): number | null {
    let result: number | null = null;
    for (const time of times) if (time !== null && (result === null || time < result)) result = time;
    return result;
}
export function sweptProjectileCircleTime(
    ax: number, ay: number, bx: number, by: number, angle: number,
    shape: string, width: number, height: number, radius: number,
    cx: number, cy: number, targetRadius: number,
): number | null {
    if (![ax, ay, bx, by, angle, cx, cy, targetRadius].every(Number.isFinite)) return null;
    if (shape !== 'rect' && shape !== 'crescent') {
        return segmentCircleTime(ax, ay, bx, by, cx, cy, (radius || 5) + targetRadius);
    }
    // Transform the target relative to both endpoints into the moving body's axes.
    const cos = Math.cos(angle), sin = Math.sin(angle), dx0 = cx - ax, dy0 = cy - ay;
    const dx1 = cx - bx, dy1 = cy - by;
    const x0 = dx0 * cos + dy0 * sin, y0 = -dx0 * sin + dy0 * cos;
    const x1 = dx1 * cos + dy1 * sin, y1 = -dx1 * sin + dy1 * cos;
    const hw = (width || 40) / 2, hh = (height || 10) / 2;
    // Minkowski sum: two strips and four round corners, not an enlarged hitbox.
    const times = [segmentBoxTime(x0, y0, x1, y1, hw + targetRadius, hh),
        segmentBoxTime(x0, y0, x1, y1, hw, hh + targetRadius)];
    for (const x of [-hw, hw]) for (const y of [-hh, hh]) {
        times.push(segmentCircleTime(x0, y0, x1, y1, x, y, targetRadius));
    }
    return earliest(times);
}

/** Sweep the existing circular wall-collision body against a wall capsule. */
export function sweptWallTime(ax: number, ay: number, bx: number, by: number,
    wx1: number, wy1: number, wx2: number, wy2: number, radius: number): number | null {
    const dx = wx2 - wx1, dy = wy2 - wy1, length = Math.hypot(dx, dy);
    if (length === 0) return segmentCircleTime(ax, ay, bx, by, wx1, wy1, radius);
    const cos = dx / length, sin = dy / length;
    const x0 = (ax - wx1) * cos + (ay - wy1) * sin - length / 2;
    const y0 = -(ax - wx1) * sin + (ay - wy1) * cos;
    const x1 = (bx - wx1) * cos + (by - wy1) * sin - length / 2;
    const y1 = -(bx - wx1) * sin + (by - wy1) * cos;
    return earliest([segmentBoxTime(x0, y0, x1, y1, length / 2, radius),
        segmentCircleTime(ax, ay, bx, by, wx1, wy1, radius),
        segmentCircleTime(ax, ay, bx, by, wx2, wy2, radius)]);
}
