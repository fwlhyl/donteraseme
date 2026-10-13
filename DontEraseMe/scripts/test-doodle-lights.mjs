import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'doodle-lights-')), 'lights.mjs');
await build({ entryPoints: ['src/world/DoodleLights.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out });
const { DOODLE_LIGHTS, sampleDoodleLight, drawDoodleLights } = await import(pathToFileURL(out));

for (const [theme, lights] of Object.entries(DOODLE_LIGHTS)) {
    assert(lights.filter(light => light.kind === 'lamp').length >= 3, `${theme} has several independent lamps`);
    assert(lights.some(light => light.kind === 'window'), `${theme} includes lit windows`);
    assert.equal(new Set(lights.map(light => light.id)).size, lights.length, 'light identifiers are unique');
    const traces = lights.map(light => Array.from({ length: 1801 }, (_, frame) => sampleDoodleLight(light, frame / 60)));
    for (const [index, light] of lights.entries()) {
        const trace = traces[index];
        assert.deepEqual(trace, Array.from({ length: 1801 }, (_, frame) => sampleDoodleLight(light, frame / 60)), 'animation is repeatable at the same simulation time');
        assert(trace.every(level => Number.isFinite(level) && level >= .28 && level <= 1), 'all samples remain finite and softly lit');
        assert(Math.max(...trace) - Math.min(...trace) > .03, 'each light visibly varies over time');
        for (let frame = 1; frame < trace.length; frame++) {
            assert(Math.abs(trace[frame] - trace[frame - 1]) < .045, 'faster 60 Hz samples stay smooth, with no one-frame flash');
        }
        for (const time of [NaN, Infinity, -Infinity, -10, -Number.MIN_VALUE]) {
            assert.equal(sampleDoodleLight(light, time), sampleDoodleLight(light, 0), 'invalid or negative time falls back to a stable zero-time sample');
        }
        for (let other = 0; other < index; other++) {
            assert(trace.some((level, frame) => Math.abs(level - traces[other][frame]) > .02), 'different lamps and windows never share an identical phase trace');
        }
    }
}

const faulty = DOODLE_LIGHTS.ruins.filter(light => light.faulty);
assert(faulty.length >= 2, 'ruins contain independently failing lamps');
assert.equal(DOODLE_LIGHTS.atelier.filter(light => light.faulty).length, 0, 'atelier lighting stays calm');
for (const light of faulty) {
    const healthy = { ...light, faulty: false }, dips = [];
    let begin;
    for (let frame = 0; frame <= 60 * 60; frame++) {
        const time = frame / 60;
        const dim = sampleDoodleLight(healthy, time) - sampleDoodleLight(light, time) > .2;
        if (dim && begin === undefined) begin = time;
        if (!dim && begin !== undefined) { if (begin > 0) dips.push([begin, time]); begin = undefined; }
    }
    assert(dips.length >= 5, 'faulty lamps repeat their slow dimming during a minute');
    for (const [start, end] of dips) assert(end - start > .4 && end - start < .9, 'a fault is a sustained local dip, never a strobe');
    for (let index = 1; index < dips.length; index++) {
        const separation = dips[index][0] - dips[index - 1][0];
        assert(separation > 3.3 && separation < 4.6, 'fault cycles follow the faster reviewed pace');
    }
}

function canvas() {
    const fills = [], stack = [], transforms = [];
    let path = [];
    const ctx = {
        globalAlpha: .37, globalCompositeOperation: 'screen', fillStyle: '#135724',
        save() { stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, fillStyle: this.fillStyle }); },
        restore() { assert(stack.length); Object.assign(this, stack.pop()); },
        translate: (...args) => transforms.push(['translate', ...args]),
        scale: (...args) => transforms.push(['scale', ...args]),
        beginPath() { path = []; },
        moveTo: (x, y) => path.push([x, y]),
        lineTo: (x, y) => path.push([x, y]),
        closePath() {},
        fill() { fills.push({ points: structuredClone(path), alpha: this.globalAlpha, composite: this.globalCompositeOperation, color: this.fillStyle }); },
    };
    return { ctx, fills, stack, transforms };
}

for (const theme of ['atelier', 'ruins']) {
    const width = theme === 'ruins' ? 1800 : 2700, height = theme === 'ruins' ? 1200 : 1800;
    const offset = theme === 'ruins' ? [-450, -300] : [-0, -0];
    const all = canvas();
    drawDoodleLights(all.ctx, width, height, theme, 12.3);
    const regions = DOODLE_LIGHTS[theme].flatMap(light => light.regions);
    assert.equal(all.fills.length, regions.length, 'no viewport draws each local light region exactly once');
    assert.deepEqual(all.fills.map(fill => fill.points), regions.map(region => region.points), 'drawn patches follow authored image coordinates');
    assert.deepEqual(all.transforms, [['translate', ...offset], ['scale', 2700 / 1536, 1800 / 1024]], 'light transform matches the scene image for both world sizes');
    assert(all.fills.every(fill => fill.composite === 'multiply' && fill.alpha >= 0 && fill.alpha <= .72), 'light patches only dim their local region with bounded alpha');
    assert.equal(all.stack.length, 0);
    assert.deepEqual([all.ctx.globalAlpha, all.ctx.globalCompositeOperation, all.ctx.fillStyle], [.37, 'screen', '#135724'], 'drawing restores every modified canvas property');

    const outside = canvas();
    drawDoodleLights(outside.ctx, width, height, theme, 12.3, { x: 20000, y: 20000, width: 100, height: 100 });
    assert.equal(outside.fills.length, 0, 'offscreen light regions are culled');
    assert.equal(outside.stack.length, 0, 'an empty viewport also restores canvas state');

    const cropped = canvas(), view = { x: offset[0], y: offset[1], width: 340, height: 400 };
    drawDoodleLights(cropped.ctx, width, height, theme, 12.3, view);
    assert(cropped.fills.length > 0 && cropped.fills.length < all.fills.length, 'viewport culling keeps nearby lamps and removes distant ones');
    const expected = DOODLE_LIGHTS[theme].filter(light => {
        const points = light.regions.flatMap(region => region.points);
        const xs = points.map(([x]) => offset[0] + x * 2700 / 1536);
        const ys = points.map(([, y]) => offset[1] + y * 1800 / 1024);
        return Math.max(...xs) >= view.x && Math.min(...xs) <= view.x + view.width
            && Math.max(...ys) >= view.y && Math.min(...ys) <= view.y + view.height;
    }).flatMap(light => light.regions.map(region => region.points));
    assert.deepEqual(cropped.fills.map(fill => fill.points), expected, 'viewport uses world coordinates including the ruins image offset');
}

console.log('PASS: deterministic independent faster doodle lights, continuous local faults, invalid-time fallback, image-aligned transforms, viewport culling and canvas state restoration.');
