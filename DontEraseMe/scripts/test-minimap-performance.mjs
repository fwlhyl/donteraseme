// The minimap must not inspect components of thousands of invisible-to-map
// shots/particles, and Retina resizing must remain idempotent.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'minimap-workload-')), 'test.mjs');
await build({ stdin: { contents: `
export {MinimapSystem} from './src/systems/MinimapSystem';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Renderable} from './src/components/Renderable';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: out });
globalThis.window = { devicePixelRatio: 2, innerWidth: 1200, innerHeight: 800 };
const { MinimapSystem, Entity, Transform, Renderable } = await import(pathToFileURL(out));
const calls = [];
const canvas = { width: 300, height: 300, clientWidth: 150, clientHeight: 150, style: {} };
const context = new Proxy({ canvas }, { get(target, key) {
    return key in target ? target[key] : (...args) => calls.push([key, ...args]);
} });
const camera = { x: -100, y: -80 };
let courtyard = false;
const system = new MinimapSystem(context, 1800, 1200, camera, () => courtyard);
let ignoredReads = 0, markerReads = 0;
for (let i = 0; i < 10000; i++) {
    const entity = new Entity();
    entity.tags.add(i % 2 ? 'projectile' : 'particle');
    entity.getComponent = () => { ignoredReads++; throw new Error('irrelevant entity reached minimap component path'); };
    system.addEntity(entity);
}
for (const [tag, x, y, visible] of [
    ['player', 900, 600, true], ['enemy', 180, 120, true],
    ['magic_manifestation', 360, 240, true], ['enemy', 500, 500, false],
]) {
    const entity = new Entity(); entity.tags.add(tag);
    entity.addComponent(new Transform(x, y));
    entity.addComponent(new Renderable('#fff', 10, 20, 20, 'circle', 0, visible));
    const get = entity.getComponent.bind(entity);
    entity.getComponent = type => { markerReads++; return get(type); };
    system.addEntity(entity);
}
calls.length = 0;
system.update(1 / 60);
assert.equal(ignoredReads, 0, 'no component reads for 10,000 shots/particles');
assert.equal(markerReads, 8, 'only four map markers need component reads');
assert.deepEqual(calls.filter(([name]) => name === 'arc'), [
    ['arc', 75, 75, 4, 0, Math.PI * 2],
    ['arc', 15, 15, 2, 0, Math.PI * 2],
    ['arc', 30, 30, 4, 0, Math.PI * 2],
], 'marker position, visibility and sizes are unchanged');
assert.deepEqual(calls.find(([name]) => name === 'strokeRect'),
    ['strokeRect', 0, 0, 1100 * (150 / 1800), 90], 'negative camera clamps viewport to the arena');
for (let i = 0; i < 8; i++) system.update(1 / 60);
assert.equal(canvas.width, 300, 'Retina backing width never compounds');
assert.equal(canvas.height, 300, 'Retina backing height never compounds');
assert.deepEqual(calls.filter(([name]) => name === 'setTransform').at(-1),
    ['setTransform', 2, 0, 0, 2, 0, 0], 'repeated frames use an absolute DPR transform');
window.devicePixelRatio = 1.5;
canvas.clientWidth = 120; canvas.clientHeight = 100;
system.setWorldSize(2700, 1800); courtyard = true;
calls.length = 0; system.update(1 / 60);
assert.equal(canvas.width, 180); assert.equal(canvas.height, 150);
assert.deepEqual(calls.find(([name]) => name === 'arc'),
    ['arc', 900 * (120 / 2700), 600 * (100 / 1800), 4, 0, Math.PI * 2], 'mode and CSS size changes recompute marker scale');
assert.ok(calls.some(([name]) => name === 'closePath'), 'courtyard outline still appears');
console.log('PASS: 10,000 non-map entities cause zero component reads; markers, camera clipping, mode changes and Retina sizing remain correct.');
