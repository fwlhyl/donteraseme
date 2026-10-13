// Differential checks against the same combat code with its original linear
// broad phases, plus deterministic operation counts (no device/FPS assumptions).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'combat-performance-'));
const entry = `
export {CollisionSystem} from './src/systems/CollisionSystem';
export {GraffitiSystem} from './src/systems/GraffitiSystem';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Renderable} from './src/components/Renderable';
export {Velocity} from './src/components/Velocity';
export {Health} from './src/components/Health';
export {PlayerStats} from './src/components/PlayerStats';
export {EnemyBehavior} from './src/components/EnemyBehavior';
export {Projectile} from './src/components/Projectile';
export {listenGameSounds} from './src/audio/AudioEvents';
`;
function replaceChecked(source, before, after) {
    assert.ok(source.includes(before), `reference transform still matches: ${before}`);
    return source.replace(before, after);
}
await Promise.all(['indexed', 'linear'].map(async mode => build({
    stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true,
    platform: 'node', format: 'esm', loader: { '.png': 'dataurl' },
    outfile: join(directory, `${mode}.mjs`),
    plugins: [{ name: 'measured-broad-phases', setup(builder) {
        builder.onLoad({ filter: /\/CollisionSystem\.ts$/ }, async ({ path }) => {
            let source = await readFile(path, 'utf8');
            source = replaceChecked(source,
                'const { entity: e2, behavior: beh2, transform: t2, render: r2 } = separation[j];',
                'globalThis.__separationPairVisits++;\n                    const { entity: e2, behavior: beh2, transform: t2, render: r2 } = separation[j];');
            source = replaceChecked(source,
                'neighborhood = separationIndex.query(t1, r1.radius || 15, j);',
                'globalThis.__separationRefreshes++;\n                            neighborhood = separationIndex.query(t1, r1.radius || 15, j);');
            if (mode !== 'linear') return { contents: source, loader: 'ts' };
            source = replaceChecked(source,
                'const enemyIndex = enemies.length >= 48 && projectiles.length > 0 ? new EnemyCollisionIndex(enemies) : null;',
                'const enemyIndex = null as EnemyCollisionIndex | null;');
            source = replaceChecked(source,
                'const separationIndex = enemies.length >= 48 ? new EnemySeparationIndex(separation) : null;',
                'const separationIndex = null as EnemySeparationIndex | null;');
            source = replaceChecked(source,
                'if (minDist > 0 && (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist)) continue;', '');
            // Restore the old repeated component reads inside the pair loop.
            for (const n of [1, 2]) source = replaceChecked(source,
                `const { entity: e${n}, behavior: beh${n}, transform: t${n}, render: r${n} } = separation[${n === 1 ? 'i' : 'j'}];`,
                `const e${n} = enemies[${n === 1 ? 'i' : 'j'}];
                 const beh${n} = e${n}.getComponent(EnemyBehavior);
                 const t${n} = e${n}.getComponent(Transform);
                 const r${n} = e${n}.getComponent(Renderable);`);
            return { contents: source, loader: 'ts' };
        });
    } }],
})));

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1000, innerHeight: 700 };
globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const indexed = await import(pathToFileURL(join(directory, 'indexed.mjs')));
const linear = await import(pathToFileURL(join(directory, 'linear.mjs')));
function randomSource(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function plain(value) {
    if (value instanceof Set) return [...value].map(plain);
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    return value;
}
function runCombat(m, fixture) {
    const { Entity, Transform, Renderable, Velocity, Health, PlayerStats, EnemyBehavior, Projectile } = m;
    const drawing = [], sounds = [], entities = [];
    const context = new Proxy({}, {
        get: (target, key) => key in target ? target[key] : (...args) => drawing.push([key, ...args]),
        set: (target, key, value) => { target[key] = value; drawing.push([key, value]); return true; },
    });
    const system = new m.CollisionSystem(undefined, context);
    const player = new Entity(); player.id = 'player'; player.tags.add('player');
    player.addComponent(new Transform(-10000, -10000));
    player.addComponent(new Health(100)); player.addComponent(new Renderable());
    player.addComponent(new PlayerStats()); system.addEntity(player); entities.push(player);
    fixture.enemies.forEach((config, i) => {
        const enemy = new Entity(); enemy.id = `enemy-${i}`; enemy.tags.add('enemy');
        const transform = enemy.addComponent(new Transform(config.x, config.y));
        transform.rotation = config.rotation ?? 0;
        enemy.addComponent(new Renderable('#c24', config.radius ?? 15, 30, 30, 'circle'));
        enemy.addComponent(new Health(config.hp ?? 100000, config.hp ?? 100000));
        enemy.addComponent(new Velocity());
        const behavior = enemy.addComponent(new EnemyBehavior(config.type ?? 'chaser', config.shield ?? 0));
        behavior.bossTimer = config.bossTimer ?? 0;
        if (config.dummy) enemy.tags.add('ink_dummy');
        if (config.inactive) enemy.active = false;
        system.addEntity(enemy); entities.push(enemy);
    });
    fixture.shots.forEach((config, i) => {
        const shot = new Entity(); shot.id = `shot-${i}`; shot.tags.add('projectile');
        const transform = shot.addComponent(new Transform(config.x, config.y));
        transform.rotation = config.rotation ?? 0;
        shot.addComponent(new Renderable('#3ac', config.radius ?? 5, config.width ?? 0, config.height ?? 0, config.shape ?? 'circle'));
        shot.addComponent(new Velocity(config.vx ?? 1, config.vy ?? 0));
        const data = shot.addComponent(new Projectile(config.type ?? 'standard', config.damage ?? 10, config.owner ?? player.id, 60, config.pierce ?? 0));
        data.isAwakened = config.awakened ?? false;
        data.isCrit = config.crit ?? false;
        system.addEntity(shot); entities.push(shot);
    });
    let componentReads = 0, hypotCalls = 0, randomCalls = 0;
    globalThis.__separationPairVisits = 0;
    globalThis.__separationRefreshes = 0;
    for (const entity of entities) {
        const get = entity.getComponent.bind(entity);
        entity.getComponent = type => { componentReads++; return get(type); };
    }
    const unsubscribe = m.listenGameSounds((cue, options) => sounds.push({ cue, ...options }));
    const random = Math.random, hypot = Math.hypot, next = randomSource(4231);
    Math.random = () => { randomCalls++; return next(); };
    Math.hypot = (...values) => { hypotCalls++; return hypot(...values); };
    const start = performance.now();
    try { for (let i = 0; i < (fixture.frames ?? 1); i++) system.update(1 / 60); }
    finally { Math.random = random; Math.hypot = hypot; unsubscribe(); }
    const elapsedMs = performance.now() - start;
    const state = entities.map(entity => ({
        id: entity.id, active: entity.active,
        components: [...entity.components].map(([type, component]) => [type.name, plain(component)]),
    }));
    return { state, drawing, sounds, randomCalls, componentReads, hypotCalls, elapsedMs,
        separationPairVisits: globalThis.__separationPairVisits,
        separationRefreshes: globalThis.__separationRefreshes };
}
function compareCombat(fixture, label) {
    const expected = runCombat(linear, fixture), actual = runCombat(indexed, fixture);
    for (const key of ['state', 'drawing', 'sounds', 'randomCalls']) assert.deepEqual(actual[key], expected[key], `${label}: ${key}`);
    return { actual, expected };
}
const filler = Array.from({ length: 70 }, (_, i) => ({ x: 2000 + (i % 10) * 180, y: 2000 + Math.floor(i / 10) * 180 }));
compareCombat({ enemies: [{ x: 130, y: 0, radius: 60 }, ...filler], shots: [
    { x: 80, y: 0, type: 'gravity' }, { x: 77, y: 0 },
] }, 'gravity moves a target across a cell before the next shot');
compareCombat({ enemies: [{ x: 127, y: 0, radius: 60 }, ...filler], shots: [
    { x: 110, y: 0, type: 'melee', shape: 'rect', width: 50 }, { x: 192, y: 0 },
] }, 'melee knockback updates subsequent candidate queries');
compareCombat({ enemies: [{ x: 127, y: 0, radius: 60 }, ...filler], shots: [
    { x: 120, y: 0, type: 'standard', shape: 'crescent', width: 50, height: 20 }, { x: 185, y: 0 },
] }, 'rotated rectangular hit pushes targets across cells');
compareCombat({ enemies: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 360, y: 0 }, ...filler], shots: [
    { x: 0, y: 0, type: 'mine', awakened: true, damage: 1 }, { x: 880, y: 0, radius: 70 },
] }, 'awakened mine moves multiple targets during its ordered scan');
compareCombat({ enemies: Array.from({ length: 96 }, () => ({ x: 0, y: 0 })), shots: [
    { x: 0, y: 0, pierce: 100 },
] }, 'packed-cell fallback preserves overlap separation and random order');
compareCombat({ enemies: [{ x: 1e20, y: 1e20 }, ...filler], shots: [
    { x: 1e20, y: 1e20 },
] }, 'extreme coordinates use a bounded linear fallback');

// The first enemy is pushed repeatedly into cells outside its initial query.
// Static one-time candidate lists silently lose these newly contacting pairs.
const liveNeighbor = compareCombat({ enemies: [
    { x: 100, y: 0, radius: 30 },
    ...Array.from({ length: 24 }, (_, i) => ({ x: 101 - i * 15, y: 0, radius: 30 })),
    ...Array.from({ length: 400 }, (_, i) => ({ x: 3000 + (i % 20) * 180, y: Math.floor(i / 20) * 180 })),
], shots: [], frames: 3 }, 'sequential pushes refresh future contacts and moved buckets');
assert.ok(liveNeighbor.actual.separationRefreshes > 0, 'fixture crosses candidate coverage during an inner loop');

const clustered = compareCombat({ enemies: Array.from({ length: 600 }, (_, i) => ({
    x: (i % 20) * 250 + Math.floor(i / 20) % 6 * 8,
    y: Math.floor(i / 120) * 250 + Math.floor(i / 20) % 5 * 8,
    radius: i % 13 === 0 ? 48 : 15,
    type: i % 13 === 0 ? 'boss_roller' : 'chaser', bossTimer: i % 2 ? 190 : 0,
})), shots: [], frames: 4 }, '600 mixed-size clustered enemies preserve dense contact order');
assert.ok(clustered.actual.separationPairVisits < clustered.expected.separationPairVisits * 0.12,
    'clustered crowds skip at least 88% of unrelated pairs');

// Fully packed mobs intentionally fall back to the sequential solver; the
// optimization cannot promise a sparse-map gain when most pairs can interact.
const packed = compareCombat({ enemies: Array.from({ length: 600 }, () => ({
    x: 0, y: 0, radius: 15,
})), shots: [], frames: 2 }, '600 coincident enemies retain exact dense fallback ordering');
assert.ok(packed.actual.separationPairVisits <= packed.expected.separationPairVisits,
    'dense fallback never visits a pair twice');

for (const count of [0, 1, 47, 48, 49]) {
    compareCombat({ enemies: Array.from({ length: count }, (_, i) => ({
        x: -128 + (i % 7) * 12, y: -128 + Math.floor(i / 7) * 14,
        radius: i % 3 ? 15 : 0,
    })), shots: [], frames: 3 }, `index threshold and negative cell boundary: ${count} enemies`);
}
compareCombat({ enemies: [
    { x: -128, y: -128, radius: -3 }, { x: -128, y: -128, radius: 0 },
    ...filler,
], shots: [], frames: 3 }, 'legacy zero and negative radius fallback');
compareCombat({ enemies: [{ x: 0, y: 0, radius: 10000 }, ...filler], shots: [], frames: 2 },
    'giant bodies use bounded fallback instead of visiting millions of grid cells');

for (let seed = 21; seed <= 30; seed++) {
    const random = randomSource(seed);
    compareCombat({ enemies: Array.from({ length: 180 }, (_, i) => ({
        x: random() * 300 - 150, y: random() * 300 - 150,
        radius: 8 + random() * 70,
        type: i % 17 === 0 ? 'boss_roller' : 'chaser', bossTimer: i % 2 ? 190 : 0,
        inactive: i % 23 === 0,
    })), shots: [], frames: 5 }, `packed moving separation ${seed}`);
}

for (let seed = 1; seed <= 12; seed++) {
    const random = randomSource(seed);
    const enemies = Array.from({ length: 110 }, (_, i) => ({
        x: i < 6 ? 64 : Math.floor(random() * 1800) - 900,
        y: i < 6 ? -64 : Math.floor(random() * 1800) - 900,
        radius: 8 + random() * 45, hp: 200 + Math.floor(random() * 200),
        type: i % 13 === 0 ? 'boss_roller' : i % 7 === 0 ? 'shield' : 'chaser',
        bossTimer: i % 2 ? 190 : 0, shield: i % 7 === 0 ? 50 : 0,
        inactive: i % 17 === 0, dummy: i % 23 === 0,
    }));
    const types = ['standard', 'gravity', 'rocket', 'sniper', 'chain', 'compass', 'melee'];
    const shots = Array.from({ length: 60 }, (_, i) => ({
        x: enemies[i].x + random() * 20 - 10, y: enemies[i].y + random() * 20 - 10,
        type: types[i % types.length], shape: i % 7 === 3 ? 'line' : i % 7 === 6 ? 'rect' : 'circle',
        width: i % 7 === 3 ? enemies[i + 1].x : 40, height: i % 7 === 3 ? enemies[i + 1].y : 20,
        awakened: i % 7 === 1 || i % 7 === 5, pierce: i % 3,
        rotation: random() * Math.PI * 2, crit: i % 5 === 0,
    }));
    compareCombat({ enemies, shots, frames: 3 }, `seeded mixed combat ${seed}`);
}

const denseEnemies = Array.from({ length: 600 }, (_, i) => ({ x: (i % 30) * 180 - 2700, y: Math.floor(i / 30) * 180 - 1800 }));
const denseShots = Array.from({ length: 900 }, (_, i) => ({ x: denseEnemies[i % 600].x + 8, y: denseEnemies[i % 600].y }));
const combat = compareCombat({ enemies: denseEnemies, shots: denseShots }, '600 enemies / 900 projectiles');
assert.ok(combat.actual.componentReads < combat.expected.componentReads * 0.1, 'dense component reads drop by at least 90%');
assert.ok(combat.actual.hypotCalls < combat.expected.hypotCalls * 0.1, 'distant separation pairs avoid exact distance calculations');
assert.ok(combat.actual.separationPairVisits < combat.expected.separationPairVisits * 0.02,
    'spatial separation avoids at least 98% of all pair visits for dispersed enemies');

// Compare all new-path queries with the exact old ordered segment traversal.
const graffiti = new indexed.GraffitiSystem();
let indexedTests = 0, linearTests = 0;
const intersect = graffiti.linesIntersect.bind(graffiti);
graffiti.linesIntersect = (...points) => { indexedTests++; return intersect(...points); };
function checkPath(path, next) {
    const last = path[path.length - 1];
    let expected = -1;
    for (let i = 0; i < path.length - 10; i++) {
        linearTests++;
        if (intersect(last, next, path[i], path[i + 1])) { expected = i; break; }
    }
    assert.equal(graffiti.checkIntersection(path, last, next), expected, 'same earliest intersecting segment');
    path.push(next);
}
const longPath = [{ x: -5000, y: 0 }];
for (let i = 1; i <= 5000; i++) checkPath(longPath, { x: -5000 + i * 6, y: Math.sin(i / 40) * 150 });
const longPathCounts = { indexedTests, linearTests };
assert.ok(indexedTests < linearTests * 0.02, 'long uninterrupted paths avoid at least 98% of exact segment tests');
for (let seed = 1; seed <= 20; seed++) {
    const random = randomSource(seed), path = [{ x: 0, y: 0 }];
    for (let i = 1; i < 350; i++) checkPath(path, {
        x: path[path.length - 1].x + (random() - 0.5) * 100,
        y: path[path.length - 1].y + (random() - 0.5) * 100,
    });
    checkPath(path, { x: 100000, y: -100000 });
    checkPath(path, { x: -100000, y: 100000 });
    for (let i = 0; i < 20; i++) checkPath(path, { x: i * 20 - 100, y: 96 });
    for (let i = 0; i < 20; i++) checkPath(path, { x: 1e20, y: 1e20 });
}
// Closing a real loop still passes the exact polygon to the unchanged effect.
function runGraffiti(useLinear) {
    const system = new indexed.GraffitiSystem();
    if (useLinear) system.checkIntersection = (path, p1, p2) => {
        for (let i = 0; i < path.length - 10; i++) if (intersect(p1, p2, path[i], path[i + 1])) return i;
        return -1;
    };
    const stats = new indexed.PlayerStats(); stats.characterId = 'graffiti';
    const loops = [];
    system.triggerLoopEffect = polygon => loops.push(polygon);
    const points = [];
    for (let x = 0; x <= 600; x += 6) points.push({ x, y: 0 });
    for (let y = 6; y <= 120; y += 6) points.push({ x: 600, y });
    for (let x = 594; x >= 3; x -= 6) points.push({ x, y: 120 });
    points.push({ x: 3, y: -6 });
    for (const point of points) system.recordPath(stats, new indexed.Transform(point.x, point.y));
    return { loops, remaining: stats.graffitiPath };
}
assert.deepEqual(runGraffiti(false), runGraffiti(true));
assert.equal(runGraffiti(false).loops.length, 1, 'long closed stroke still triggers exactly one loop');
console.log('PASS: ordered hits, HP/shields, positions, piercing, critical rolls, audio and paint commands match linear combat; graffiti retains exact first intersection and loop polygon.');
console.log(JSON.stringify({
    combat: { enemies: 600, projectiles: 900,
        componentReads: { linear: combat.expected.componentReads, indexed: combat.actual.componentReads },
        exactSeparationDistances: { linear: combat.expected.hypotCalls, indexed: combat.actual.hypotCalls },
        separationPairVisits: { linear: combat.expected.separationPairVisits, indexed: combat.actual.separationPairVisits },
        elapsedMs: { linear: Number(combat.expected.elapsedMs.toFixed(2)), indexed: Number(combat.actual.elapsedMs.toFixed(2)) } },
    clusteredSeparation: { enemies: 600, frames: 4,
        pairVisits: { linear: clustered.expected.separationPairVisits, indexed: clustered.actual.separationPairVisits },
        exactDistances: { linear: clustered.expected.hypotCalls, indexed: clustered.actual.hypotCalls } },
    fullyPackedSeparation: { enemies: 600, frames: 2,
        pairVisits: { linear: packed.expected.separationPairVisits, indexed: packed.actual.separationPairVisits },
        exactDistances: { linear: packed.expected.hypotCalls, indexed: packed.actual.hypotCalls } },
    graffiti: { points: 5000, exactIntersectionTests: longPathCounts },
}, null, 2));
