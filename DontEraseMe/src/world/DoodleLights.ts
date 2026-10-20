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
const pane = (id: string, phase: number, points: readonly Point[], faulty = false): DoodleLight =>
    ({ id, phase, kind: 'window', faulty, regions: [region(points)] });

// Authored against paper-scenes/{atelier,ruins}-clarity-v1.webp (1536 × 1024).
// The clarity redraw preserves the source light positions and world framing.
// Keep the historical module API; never reuse the old colorful scene masks.
// Only the actual panes / lamp are animated, not broad floating pools of light.
export const DOODLE_LIGHTS: Record<CourtyardTheme, readonly DoodleLight[]> = {
    atelier: [
        lamp('atelier-north-lamp', .4, [[594,6],[603,7],[603,20],[596,19]], [[590,1],[609,1],[608,26],[591,25]]),
        pane('atelier-studio-window', 3.1, [[287,53],[299,49],[299,71],[287,75]]),
        pane('atelier-northeast-window', 5.2, [[1174,49],[1185,54],[1185,79],[1174,74]]),
        pane('atelier-west-window', 8.6, [[103,267],[113,263],[113,282],[103,286]]),
        pane('atelier-east-window', 1.3, [[1487,246],[1496,251],[1496,270],[1487,265]]),
        pane('atelier-west-lower-window', 6.6, [[103,738],[111,734],[111,755],[103,760]]),
        pane('atelier-southwest-window', 4.3, [[85,924],[92,920],[92,940],[85,944]]),
        pane('atelier-southeast-window', 10.7, [[1227,889],[1239,895],[1239,920],[1227,914]]),
    ],
    ruins: [
        pane('ruins-west-survivor', 3.3, [[138,93],[147,88],[147,111],[138,115]], true),
        pane('ruins-east-survivor', 9.7, [[1356,105],[1366,99],[1366,123],[1356,129]], true),
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
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#34312a';
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
