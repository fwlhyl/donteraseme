import { sceneBounds, type CourtyardTheme } from './SceneLayout';

type Point = readonly [number, number];
type Region = { points: readonly Point[]; strength: number };
export type DoodleLight = {
    id: string; phase: number; kind: 'lamp' | 'window'; faulty?: boolean;
    regions: readonly Region[];
};
const region = (points: readonly Point[], strength = 1): Region => ({ points, strength });
const lamp = (id: string, phase: number, bulb: readonly Point[], pool: readonly Point[], faulty = false): DoodleLight =>
    ({ id, phase, kind: 'lamp', faulty, regions: [region(bulb), region(pool, .8)] });
const pane = (id: string, phase: number, points: readonly Point[]): DoodleLight =>
    ({ id, phase, kind: 'window', regions: [region(points)] });

// Coordinates refer to the current 1536 × 1024 doodle source images, not the
// older watercolor art. Multiply keeps their black outlines and flat light shapes.
export const DOODLE_LIGHTS: Record<CourtyardTheme, readonly DoodleLight[]> = {
    atelier: [
        lamp('shop-lamp', .4, [[370,69],[390,69],[386,89],[375,89]], [[345,51],[368,38],[394,40],[410,62],[401,109],[412,160],[392,188],[330,197],[336,166],[349,133],[345,90]]),
        lamp('west-lamp', 2.2, [[141,323],[162,323],[157,346],[146,346]], [[111,315],[143,300],[173,313],[188,340],[183,373],[166,392],[131,388],[110,369],[105,343]]),
        lamp('terrace-lamp', 4.8, [[1295,190],[1316,190],[1311,210],[1300,210]], [[1280,184],[1309,177],[1333,190],[1339,215],[1325,241],[1334,280],[1330,331],[1309,349],[1264,344],[1218,322],[1225,305],[1266,291],[1285,258],[1280,222]]),
        lamp('east-lamp', 7.3, [[1368,566],[1392,567],[1387,587],[1373,586]], [[1344,552],[1379,540],[1410,551],[1430,579],[1421,617],[1392,632],[1350,634],[1332,610],[1329,588]]),
        lamp('south-lamp', 9.2, [[1183,852],[1205,853],[1201,875],[1187,875]], [[1148,837],[1180,820],[1218,826],[1240,849],[1243,883],[1227,911],[1197,932],[1164,930],[1152,908],[1110,887],[1109,869]]),
        lamp('upper-east-lamp', 11.1, [[1427,79],[1442,80],[1438,97],[1430,96]], [[1411,73],[1431,65],[1451,76],[1456,103],[1446,130],[1426,131],[1415,109]]),
        pane('west-window-1', 3.1, [[16,65],[44,54],[45,104],[15,115]]),
        pane('west-window-2', 5.2, [[109,116],[138,102],[137,167],[109,181]]),
        pane('west-window-3', 8.6, [[147,665],[180,680],[181,740],[148,725]]),
        pane('south-window', 1.3, [[22,891],[60,872],[60,947],[22,967]]),
        pane('north-window', 6.6, [[909,3],[936,0],[936,27],[909,39]]),
        pane('east-window-1', 4.3, [[1385,29],[1413,38],[1413,97],[1385,87]]),
        pane('east-window-2', 10.7, [[1501,92],[1526,105],[1526,149],[1501,137]]),
        pane('east-window-3', 13.2, [[1500,875],[1526,890],[1526,933],[1500,946]]),
    ],
    ruins: [
        lamp('ruin-northwest', .8, [[275,28],[293,28],[289,47],[280,48]], [[269,85],[296,78],[331,94],[282,115],[249,105]]),
        lamp('ruin-west-upper', 3.3, [[99,207],[124,208],[118,231],[105,229]], [[79,246],[113,253],[146,277],[109,295],[77,281]], true),
        lamp('ruin-west-middle', 6.1, [[77,461],[96,463],[91,481],[81,479]], [[58,533],[96,523],[111,539],[138,554],[111,568],[76,559]]),
        lamp('ruin-west-lower', 9.7, [[92,825],[125,826],[117,851],[100,849]], [[87,865],[128,861],[147,882],[164,900],[118,932],[85,932],[74,910]], true),
        lamp('ruin-northeast', 12.4, [[1258,27],[1280,26],[1275,49],[1263,48]], [[1210,112],[1250,100],[1293,119],[1282,135],[1259,145]]),
        lamp('ruin-east-middle', 15.2, [[1485,477],[1510,476],[1505,501],[1492,501]], [[1443,494],[1479,477],[1496,504],[1520,516],[1505,543],[1476,517]], true),
        lamp('ruin-east-lower', 18.8, [[1413,774],[1436,773],[1430,797],[1419,796]], [[1371,833],[1400,819],[1426,827],[1459,850],[1420,875],[1401,856]]),
        pane('ruin-window-west', 2.1, [[12,101],[31,94],[31,134],[12,143]]),
        pane('ruin-window-northwest', 5.4, [[124,40],[142,34],[142,77],[124,84]]),
        pane('ruin-window-midwest', 7.9, [[11,471],[30,464],[30,505],[11,515]]),
        pane('ruin-window-east', 11.9, [[1411,43],[1436,54],[1436,100],[1411,90]]),
        pane('ruin-window-mideast', 14.3, [[1509,634],[1529,645],[1529,686],[1509,675]]),
    ],
};

/** Simulation time only: no random per-frame jumps, wall clock or full-screen flash. */
export function sampleDoodleLight(light: DoodleLight, timeSeconds: number): number {
    const time = Number.isFinite(timeSeconds) && timeSeconds > 0 ? timeSeconds : 0;
    // Readable local flicker (~2.2× the first pass), still smooth and asynchronous.
    const t = time * 2.2 + light.phase;
    const wave = .075 * Math.sin(t * 1.17 + light.phase * .7)
        + .04 * Math.sin(t * 2.05 - light.phase) + .025 * Math.sin(t * 4.1 + light.phase);
    let value = light.kind === 'window' ? .91 + wave * .5 : .84 + wave;
    if (light.faulty) {
        const period = 3.4 + light.phase % 1.1;
        const phase = ((time + light.phase * 2) % period) / period;
        // Local fault every 3.4–4.5 seconds, with a soft ~1 second envelope.
        if (phase > .2 && phase < .48) value -= .46 * Math.sin((phase - .2) / .28 * Math.PI) ** 2;
    }
    return Math.max(.28, Math.min(1, value));
}

const lightBounds = new Map(Object.values(DOODLE_LIGHTS).flat().map(light => {
    const points = light.regions.flatMap(region => region.points);
    return [light, { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
        minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) }];
}));

/** Call after background image and BEFORE opaque playable floor, on scenery only. */
export function drawDoodleLights(ctx: CanvasRenderingContext2D, worldWidth: number, worldHeight: number,
    theme: CourtyardTheme, timeSeconds: number, view?: { x: number; y: number; width: number; height: number }): void {
    const b = sceneBounds(worldWidth, worldHeight, theme), sx = b.width / 1536, sy = b.height / 1024;
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(sx, sy);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#444658';
    for (const light of DOODLE_LIGHTS[theme]) {
        const box = lightBounds.get(light)!;
        if (view && (b.x + box.maxX * sx < view.x || b.x + box.minX * sx > view.x + view.width
            || b.y + box.maxY * sy < view.y || b.y + box.minY * sy > view.y + view.height)) continue;
        const level = sampleDoodleLight(light, timeSeconds);
        for (const region of light.regions) {
            ctx.globalAlpha = (1 - level) * region.strength;
            ctx.beginPath();
            region.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath(); ctx.fill();
        }
    }
    ctx.restore();
}
