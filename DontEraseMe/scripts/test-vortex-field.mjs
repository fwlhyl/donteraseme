import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const outfile = join(await mkdtemp(join(tmpdir(), 'vortex-field-')), 'field.mjs');
await build({ stdin: { contents: `export {drawVortexField} from './src/art/VortexField'; export {Entity} from './src/core/Entity'; export {Projectile} from './src/components/Projectile'; export {Transform} from './src/components/Transform'; export {Renderable} from './src/components/Renderable';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile });
const { drawVortexField, Entity, Projectile, Transform, Renderable } = await import(pathToFileURL(outfile));
const stops = [];
let builds = 0;
globalThis.document = { createElement() { builds++; return { width: 0, height: 0, getContext() { return { createRadialGradient() { return { addColorStop(...args) { stops.push(args); } }; }, fillRect() {} }; } }; } };
function context() {
 const calls = [], stack = [];
 const ctx = { calls, globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); }, translate(...args) { calls.push(['translate', ...args]); }, drawImage(...args) { calls.push(['drawImage', ...args.slice(1)]); }, beginPath() {}, arc(...args) { calls.push(['arc', ...args]); }, fill() {} };
 return ctx;
}
function actor(awakened = false, life = 180) {
 const entity = new Entity(); entity.addComponent(new Transform(100, 200));
 const projectile = new Projectile('gravity', 0.5, 'player', life); projectile.isAwakened = awakened;
 entity.addComponent(projectile); entity.addComponent(new Renderable()); return entity;
}
const base = actor(), c = context();
drawVortexField(c, base, 'player', 0);
assert.deepEqual(c.calls[0], ['translate',100,200]);
assert.deepEqual(c.calls[1], ['drawImage',-250,-250,500,500]);
assert.equal(c.calls.filter(call => call[0] === 'arc').length, 8);
assert.equal(c.globalAlpha, 1);
const later = context(); drawVortexField(later, base, 'player', .5);
assert.notDeepEqual(later.calls.find(call => call[0] === 'arc'), c.calls.find(call => call[0] === 'arc'), 'motes move over time');
assert.deepEqual(stops.map(stop => stop[0]), [0, .3, .7, 1]);
assert.match(stops.at(-1)[1], /,0\)$/);
const awakened = context(); drawVortexField(awakened, actor(true), 'player', 1);
assert.deepEqual(awakened.calls[1], ['drawImage',-300,-300,600,600]);
assert.equal(builds, 1, 'gradient canvas is cached between projectiles and frames');
for (const entity of [actor(false, 0), actor()]) {
 const hidden = context(); drawVortexField(hidden, entity, entity.getComponent(Projectile).life ? 'other' : 'player', 0);
 assert.equal(hidden.calls.length, 0, 'expired and hostile shots do not draw');
}
console.log('PASS: owner, lifetime, attraction bounds, outward fade, moving motes, canvas restoration and gradient cache.');
