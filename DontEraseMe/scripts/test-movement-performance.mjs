// Compare against exact original geometry and all-entity wall scanning. Counts
// describe this fixture's work, not a device's real frame rate.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'movement-perf-'));
const entry = `
export { CourtyardGeometry } from './src/world/CourtyardGeometry';
export { MovementSystem } from './src/systems/MovementSystem';
export { Entity } from './src/core/Entity';
export { Transform } from './src/components/Transform';
export { Velocity } from './src/components/Velocity';
export { Renderable } from './src/components/Renderable';
`;
await Promise.all(['optimized', 'reference'].map(mode => build({
    stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm',
    outfile: join(dir, `${mode}.mjs`), plugins: mode === 'reference' ? [{ name: 'original-hot-paths', setup(b) {
        b.onLoad({ filter: /\/(CourtyardGeometry|MovementSystem)\.ts$/ }, async ({ path }) => {
            let source = await readFile(path, 'utf8');
            const before = path.endsWith('CourtyardGeometry.ts')
                ? 'if (this.cellSafelyFits(p, radius)) return true;'
                : 'for (const wall of walls) {';
            assert(source.includes(before), 'reference rewrite matches actual code');
            source = source.replace(before, path.endsWith('CourtyardGeometry.ts') ? '' : 'for (const wall of this.entities) {');
            return { contents: source, loader: 'ts' };
        });
    } }] : [],
})));
globalThis.localStorage = { getItem: () => null, setItem() {} };
const fast = await import(pathToFileURL(join(dir, 'optimized.mjs')));
const old = await import(pathToFileURL(join(dir, 'reference.mjs')));
let seed = 27;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const a = new fast.CourtyardGeometry(2700, 1800), b = new old.CourtyardGeometry(2700, 1800);
let checks = 0;
for (let i = 0; i < 25000; i++) {
    const p = { x: random() * 3100 - 200, y: random() * 2200 - 200 };
    const r = [0, 3, 18, 24, 60, 114, -24, .001][i % 8];
    assert.equal(a.fits(p, r), b.fits(p, r)); checks++;
    if (i < 1200) {
        assert.deepEqual(a.project(p, r), b.project(p, r));
        const q = { x: p.x + random() * 80 - 40, y: p.y + random() * 80 - 40 };
        assert.deepEqual(a.move(p, q, r), b.move(p, q, r));
        assert.equal(a.segmentClear(p, q, r), b.segmentClear(p, q, r));
    }
}
for (const g of [a, b]) {
    // Warm the central safe cells, then count exact polygon traversals.
    for (let x = 1000; x < 1700; x += 20) for (let y = 700; y < 1100; y += 20) g.fits({ x, y }, 20);
    let count = 0; const original = g.contains.bind(g);
    g.contains = p => { count++; return original(p); };
    for (let n = 0; n < 20; n++) for (let x = 1000; x < 1700; x += 20) for (let y = 700; y < 1100; y += 20) g.fits({ x, y }, 20);
    g.traversals = count;
}
assert(a.traversals < b.traversals / 10);
function movement(m, hasWalls) {
    const s = new m.MovementSystem(2700, 1800, undefined, undefined, undefined, () => true);
    const actors = [];
    const make = (tag, x, y, radius = 15, shape = 'circle') => {
        const e = new m.Entity(); e.tags.add(tag); e.addComponent(new m.Transform(x, y));
        e.addComponent(new m.Velocity(tag === 'enemy' ? .8 : 0, tag === 'enemy' ? .3 : 0));
        e.addComponent(new m.Renderable('#ffffff', radius, radius * 2, radius * 2, shape));
        s.addEntity(e); return e;
    };
    actors.push(make('player', 1350, 900, 20));
    for (let i = 0; i < 200; i++) actors.push(make('enemy', 940 + i % 20 * 38, 630 + Math.floor(i / 20) * 45));
    for (let i = 0; i < 800; i++) make('particle', i % 80 * 30, Math.floor(i / 80) * 40, 2);
    if (hasWalls) {
        make('wall', 1000, 700, 30, 'rect');
        make('wall', 1220, 890, 30, 'rect').active = false;
    }
    let wallTagChecks = 0;
    for (const e of s.entities) { const has = e.tags.has.bind(e.tags); e.tags.has = t => { if (t === 'wall') wallTagChecks++; return has(t); }; }
    const before = performance.now();
    for (let frame = 0; frame < 30; frame++) s.update(1 / 60);
    return { positions: actors.map(e => ({ ...e.getComponent(m.Transform) })), wallTagChecks, ms: performance.now() - before };
}
for (const walls of [false, true]) {
    const before = movement(old, walls), after = movement(fast, walls);
    assert.deepEqual(after.positions, before.positions, 'all actor movement and wall collision unchanged');
    assert(after.wallTagChecks < before.wallTagChecks / 50);
    console.log(`PASS ${walls ? 'legacy walls' : 'create no walls'}: wall tag scans ${before.wallTagChecks} -> ${after.wallTagChecks}; fixture CPU ${before.ms.toFixed(1)} -> ${after.ms.toFixed(1)} ms / 30 updates.`);
}
console.log(`PASS ${checks} exact fits + 1200 projection/movement/segment differentials; warmed interior polygon traversals ${b.traversals} -> ${a.traversals}.`);
