/** Worn, broken eraser inspired by the original cover. The art faces right;
 * callers flip it to follow the enemy's travel direction. Ground anchor: y=29. */
export function drawEraser(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const m = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const ink = '#20221f', shadow = '#383b35', band = '#4a4d46';
    const rubber = '#b5b6aa', light = '#d1d0c5', shade = '#969b90';
    const pixel = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    };
    // Rasterize silhouettes in whole pixels to keep the same hard pixel edges as
    // the other game characters, while retaining the cover's oblique planes.
    const shape = (color: string, points: [number, number][]) => {
        ctx.fillStyle = color;
        const top = Math.floor(Math.min(...points.map(p => p[1])));
        const bottom = Math.ceil(Math.max(...points.map(p => p[1])));
        for (let y = top; y < bottom; y++) {
            const intersections: number[] = [];
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                const scan = y + .5;
                if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan))
                    intersections.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
            }
            intersections.sort((a, b) => a - b);
            for (let i = 0; i + 1 < intersections.length; i += 2) {
                const left = Math.floor(intersections[i]), right = Math.ceil(intersections[i + 1]);
                ctx.fillRect(left, y, right - left, 1);
            }
        }
    };
    ctx.save();
    ctx.scale(-size / 64, size / 64); // Cover composition is drawn left-facing, then mirrored.
    ctx.imageSmoothingEnabled = false;
    // Four blade-like feet, staggered and planted beneath the heavy block.
    for (let i = 0; i < 4; i++) {
        const x = [-19, -5, 11, 23][i];
        const cycle = t + (i % 2 ? Math.PI : 0);
        const reach = Math.round(Math.sin(cycle) * 2 * m);
        const lift = Math.round(Math.max(0, Math.cos(cycle)) * 2 * m);
        const rear = i === 0 || i === 2;
        shape(rear ? shadow : ink, [[x - 3, 14], [x + 2, 12], [x + 5 + reach, 20 - lift], [x + 1 + reach, 28 - lift], [x + reach, 21 - lift], [x - 4, 20]]);
        if (!rear) shape('#565a51', [[x, 16], [x + 3 + reach, 20 - lift], [x + 1 + reach, 23 - lift], [x - 1, 20]]);
    }
    ctx.translate(Math.round(Math.sin(t) * m * .5), 0);
    // Outer cut silhouette and top/side planes echo the original cover's block.
    shape(ink, [[-30,-10],[-26,-17],[19,-25],[28,-22],[30,-17],[29,9],[23,12],[22,16],[-20,23],[-26,21],[-29,13],[-25,7],[-29,3],[-25,-2],[-29,-4]]);
    shape(light, [[-28,-10],[-25,-15],[18,-23],[27,-20],[28,-17],[17,-12],[-19,-5],[-24,-6]]);
    shape(rubber, [[-19,-5],[17,-12],[28,-17],[27,8],[22,10],[20,14],[-19,21],[-24,19],[-27,13],[-23,7],[-27,3],[-23,-1]]);
    shape(shade, [[27,-17],[29,-16],[28,8],[23,11],[23,-13]]);
    // The dark band wraps across the top and down the right side, not across
    // the entire body, leaving its light rubber silhouette immediately legible.
    shape(ink, [[4,-21],[15,-23],[25,-18],[14,-14]]);
    shape(band, [[5,-21],[14,-23],[23,-18],[14,-15]]);
    shape(ink, [[14,-14],[25,-18],[24,10],[14,13]]);
    shape(band, [[15,-13],[23,-16],[22,10],[15,12]]);
    // A deep, irregular broken opening with black splinters, like the cover.
    shape(ink, [[-25,-7],[-20,-8],[-18,-5],[-14,-6],[-10,-1],[-9,3],[-13,4],[-17,9],[-20,7],[-24,12],[-24,7],[-29,5],[-34,8],[-31,3],[-28,1],[-25,1],[-23,-2],[-27,-3]]);
    shape(shadow, [[-24,-5],[-20,-6],[-17,-3],[-15,-4],[-13,0],[-18,0],[-21,3],[-25,1]]);
    shape(ink, [[-25,6],[-29,6],[-33,8],[-31,4],[-27,2],[-25,3]]);
    // Fine chips and shallow hairline cracks, grouped for legibility at game scale.
    pixel(shade,-20,-11,3,1); pixel(shade,-19,-10,1,2); pixel(shade,-16,-8,3,1);
    pixel(shade,-10,-4,2,1); pixel(shade,-9,-3,1,3); pixel(shade,-8,0,2,1);
    pixel(shade,-9,10,1,3); pixel(shade,-11,13,2,1); pixel(shade,-12,14,1,3);
    pixel(shade,-18,18,6,1); pixel(shade,1,12,4,1); pixel(shade,4,11,2,1);
    pixel(light,-4,-4,7,1); pixel(light,18,-19,4,1); pixel(shade,26,-15,1,3);
    if (m > .08) {
        pixel(shadow,-32,20,2,1); pixel(shade,-30,23,2,1);
    }
    ctx.restore();
}
