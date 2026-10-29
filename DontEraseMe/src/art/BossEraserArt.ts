/** The final eraser: a monumental, shattered version of the cover creature. */
export function drawBossEraserDraft(ctx: CanvasRenderingContext2D, size: number, phase: number, moving: number): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const t = Number.isFinite(phase) ? phase : 0;
    const m = Math.max(0, Math.min(1, Number.isFinite(moving) ? moving : 0));
    const ink = '#1a1d1a', shadow = '#343832', band = '#4d514a';
    const rubber = '#b7b8ac', light = '#d4d4ca', shade = '#8d9389';
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    // Scanline polygons preserve pixel edges at both review and gameplay sizes.
    const shape = (color: string, points: [number, number][]) => {
        ctx.fillStyle = color;
        const top = Math.floor(Math.min(...points.map(p => p[1])));
        const bottom = Math.ceil(Math.max(...points.map(p => p[1])));
        for (let y = top; y < bottom; y++) {
            const xs: number[] = [];
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length], scan = y + .5;
                if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan))
                    xs.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
            }
            xs.sort((a, b) => a - b);
            for (let i = 0; i + 1 < xs.length; i += 2)
                ctx.fillRect(Math.floor(xs[i]), y, Math.ceil(xs[i + 1]) - Math.floor(xs[i]), 1);
        }
    };
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;
    // A heavy smear and broken, pointed supports make the weight feel grounded.
    px(shadow,-26,28,52,2); px(ink,-17,30,34,1);
    for (let i = 0; i < 5; i++) {
        const x = [-22,-12,0,12,22][i];
        const cycle = t * .55 + i * Math.PI;
        const reach = Math.round(Math.sin(cycle) * 2 * m);
        const lift = Math.round(Math.max(0, Math.cos(cycle)) * 2 * m);
        shape(i % 2 ? shadow : ink, [[x-4,14],[x+3,13],[x+5+reach,21-lift],[x+1+reach,29-lift],[x-1+reach,23-lift],[x-5,21]]);
        shape('#62665d', [[x,17],[x+3+reach,21-lift],[x+1+reach,24-lift],[x-1,21]]);
    }
    ctx.translate(Math.round(Math.sin(t * .48) * m * .6), Math.round(Math.sin(t * .35) * .55));
    // Long worn block, with a light top and a separate darker end face.
    shape(ink, [[-31,-11],[-27,-18],[17,-25],[27,-22],[31,-16],[30,9],[26,13],[23,17],[-19,23],[-27,20],[-30,14],[-25,8],[-31,3],[-26,-2],[-31,-5]]);
    shape(light, [[-29,-11],[-25,-16],[17,-23],[26,-20],[29,-16],[20,-12],[-19,-5],[-25,-7]]);
    shape(rubber, [[-20,-5],[20,-12],[29,-16],[28,8],[24,11],[22,15],[-19,21],[-25,19],[-28,14],[-23,8],[-29,3],[-24,-2]]);
    shape(shade, [[27,-15],[30,-16],[29,8],[24,12],[24,-13]]);
    // Ruined wrapper wraps around the rear, held by dark metal staples.
    shape(ink, [[2,-21],[14,-24],[25,-19],[13,-14]]);
    shape(band, [[3,-21],[13,-23],[23,-19],[13,-15]]);
    shape(ink, [[13,-14],[25,-19],[24,10],[13,14]]);
    shape(band, [[15,-13],[23,-16],[22,10],[15,12]]);
    px(shade,17,-11,2,3); px(shade,18,5,2,3); px(ink,21,-13,2,22);
    // Widen the cover's broken face into an irregular, deep erasure cavity.
    shape(ink, [[-26,-9],[-22,-10],[-19,-7],[-15,-9],[-10,-6],[-7,-2],[-9,1],[-5,4],[-10,8],[-13,12],[-18,10],[-21,16],[-24,11],[-29,11],[-32,15],[-30,7],[-27,5],[-30,2],[-26,-1],[-31,-5]]);
    shape(shadow, [[-25,-7],[-20,-8],[-18,-5],[-15,-6],[-11,-3],[-12,-1],[-16,0],[-13,3],[-17,6],[-21,5],[-24,9],[-24,5],[-28,4],[-24,0],[-28,-3]]);
    // Fractured shards jut from the void, not eyes or a cartoon face.
    shape(ink, [[-25,-3],[-31,-4],[-34,-9],[-30,-7],[-26,-9],[-22,-6]]);
    shape(ink, [[-25,6],[-30,7],[-34,12],[-29,10],[-24,11],[-21,7]]);
    shape(ink, [[-15,-5],[-10,-5],[-8,-2],[-12,-1],[-11,2],[-15,3],[-17,0]]);
    // Long black cracks and chipped edges imply immense pressure inside the slab.
    shape(ink, [[-7,-7],[-4,-5],[-3,-1],[0,0],[-1,2],[2,5],[0,6],[-2,3],[-5,2],[-5,-1],[-8,-3]]);
    shape(ink, [[-2,11],[1,9],[3,10],[4,14],[7,15],[6,17],[2,16],[1,13],[-2,14]]);
    shape(shade, [[-18,-13],[-15,-12],[-14,-10],[-11,-10],[-10,-8],[-13,-9],[-15,-9],[-16,-11]]);
    px(shade,2,-9,5,1); px(shade,5,-8,1,3); px(shade,7,-5,3,1);
    px(shade,-16,17,5,1); px(light,1,-14,5,1); px(shade,9,11,3,1);
    // A faint slow pulse in the crack gives life while retaining its black void.
    if (Math.sin(t * .45) > .1) { px('#64504a',-16,0,2,1); px('#64504a',-13,4,2,1); }
    ctx.restore();
}
