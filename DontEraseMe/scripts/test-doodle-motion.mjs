import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'doodle-motion-')), 'test.mjs');
await build({ stdin: { contents: `
export {DoodleMotion, signalDoodleAttack, sampleDoodleMotion} from './src/art/DoodleMotion';
export {PlayerFactory} from './src/entities/PlayerFactory';
export {EnemyFactory} from './src/entities/EnemyFactory';
export {Transform} from './src/components/Transform';
export {Renderable} from './src/components/Renderable';
export {Velocity} from './src/components/Velocity';
export {Health} from './src/components/Health';
export {Weapon} from './src/components/Weapon';
export {PlayerStats} from './src/components/PlayerStats';
export {PlayerArtwork} from './src/components/PlayerArtwork';
export {EnemyBehavior} from './src/components/EnemyBehavior';
export {RenderSystem} from './src/systems/RenderSystem';
export {WeaponSystem} from './src/systems/WeaponSystem';
export {EnemySystem} from './src/systems/EnemySystem';
export {ENEMY_FRAMES, getDoodleEnemies, drawDoodleEnemy} from './src/art/DoodleArt';
export {ENEMY_GAITS} from './src/art/DoodleEnemyGait';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' }, outfile: out });

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.Image = class { complete = true; naturalWidth = 1536; naturalHeight = 1024; };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1 };
globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
function context() {
    const calls = [], stack = [];
    const state = { calls, stack, globalAlpha: 1, shadowBlur: 0, strokeStyle: '#000', fillStyle: '#000', lineCap: 'butt', lineWidth: 1, canvas: { clientWidth: 1000, clientHeight: 700 } };
    return new Proxy(state, { get(target, key) {
        if (key in target) return target[key];
        if (key === 'save') return () => stack.push({ globalAlpha: target.globalAlpha, shadowBlur: target.shadowBlur,
            strokeStyle: target.strokeStyle, fillStyle: target.fillStyle, lineCap: target.lineCap, lineWidth: target.lineWidth });
        if (key === 'restore') return () => { assert(stack.length, 'restore has matching save'); Object.assign(target, stack.pop()); };
        return (...args) => calls.push({ name: key, args, alpha: target.globalAlpha, strokeStyle: target.strokeStyle });
    } });
}
globalThis.document = { body: { insertBefore() {} }, getElementById: () => null,
    createElement: () => ({ style: {}, dataset: {}, getContext: () => context() }) };
const { DoodleMotion, signalDoodleAttack, sampleDoodleMotion, PlayerFactory, EnemyFactory,
    Transform, Renderable, Velocity, Health, Weapon, PlayerStats, PlayerArtwork, EnemyBehavior, RenderSystem, WeaponSystem, EnemySystem,
    ENEMY_FRAMES, getDoodleEnemies, drawDoodleEnemy, ENEMY_GAITS } = await import(pathToFileURL(out));

const sample = (patch = {}) => ({ x: 0, y: 0, hp: 100, attackSerial: 0, ...patch });
const clone = value => structuredClone(value);
const tick = 1 / 60;
function bounded(pose) {
    for (const key of ['x', 'y', 'angle', 'scaleX', 'scaleY', 'attack', 'hit', 'shadowScale']) {
        assert(Number.isFinite(pose[key]), `${key} remains finite`);
    }
    assert(Math.abs(pose.x) <= 5 && Math.abs(pose.y) <= 5, 'body offset stays within five pixels');
    assert(Math.abs(pose.angle) < .2, 'lean stays under .2 radians');
    assert(pose.scaleX >= .8 && pose.scaleX <= 1.2 && pose.scaleY >= .8 && pose.scaleY <= 1.2, 'body squash is bounded');
    assert(pose.attack >= 0 && pose.attack <= 1 && pose.hit >= 0 && pose.hit <= 1, 'event pulses are normalized');
    assert(pose.shadowScale > 0 && pose.shadowScale <= 2, 'shadow remains finite and modest');
}

// Motion follows simulation time; a paused sample must not consume changed input.
const idle = new DoodleMotion(17);
let pose = idle.update(sample(), tick);
assert.equal(pose.hit, 0, 'initial HP does not look like damage');
assert.equal(pose.attack, 0, 'spawn alone is not an attack');
bounded(pose);
const paused = clone(pose);
assert.deepEqual(idle.update(sample({ x: 5, hp: 70, attackSerial: 1 }), 0), paused, 'dt zero freezes exact pose');
pose = idle.update(sample({ x: 5, hp: 70, attackSerial: 1 }), tick);
assert(pose.hit > 0 && pose.attack > 0, 'events held during pause apply when simulation resumes');

const bornAttacking = new DoodleMotion(17);
assert(bornAttacking.update(sample({ attackSerial: 1 }), tick).attack > 0, 'first visible frame still shows an actual spawn-frame attack');
const healing = new DoodleMotion(17);
healing.update(sample({ hp: 70 }), tick);
assert.equal(healing.update(sample({ hp: 100 }), tick).hit, 0, 'healing does not trigger a hit');
healing.update(sample({ hp: 60 }), tick);
for (let i = 0; i < 180; i++) pose = healing.update(sample({ hp: 60 }), tick);
assert(pose.hit < .001, 'hit reaction settles');

// Equal simulation time produces the same result after tab-switch dt capping.
const capped = new DoodleMotion(29), normal = new DoodleMotion(29);
capped.update(sample(), tick); normal.update(sample(), tick);
assert.deepEqual(capped.update(sample({ x: 4, attackSerial: 1 }), 30), normal.update(sample({ x: 4, attackSerial: 1 }), .1));
const walking = new DoodleMotion(31), standing = new DoodleMotion(31);
walking.update(sample(), tick); standing.update(sample(), tick);
let walkPose, standPose;
for (let i = 1; i <= 24; i++) {
    walkPose = clone(walking.update(sample({ x: i * 3 }), tick));
    standPose = clone(standing.update(sample(), tick));
    bounded(walkPose); bounded(standPose);
}
assert.notDeepEqual(walkPose, standPose, 'actual travel drives a different gait from idle');
const teleport = new DoodleMotion(37), stationary = new DoodleMotion(37);
teleport.update(sample(), tick); stationary.update(sample(), tick);
assert.deepEqual(teleport.update(sample({ x: 200 }), tick), stationary.update(sample(), tick), 'teleport is not a huge running step');
const frozenWalk = new DoodleMotion(41), frozenStill = new DoodleMotion(41);
frozenWalk.update(sample({ frozen: true }), tick); frozenStill.update(sample({ frozen: true }), tick);
for (let i = 1; i <= 30; i++) {
    assert.deepEqual(frozenWalk.update(sample({ x: i * 4, frozen: true }), tick),
        frozenStill.update(sample({ frozen: true }), tick), 'frozen actors do not run in place');
}
const stress = new DoodleMotion(53);
for (let i = 0; i < 1200; i++) {
    bounded(stress.update(sample({ x: i * 7, y: Math.sin(i) * 4, hp: 100 - i,
        attackSerial: Math.floor(i / 2), frozen: i % 40 < 5, kind: i % 2 ? 'boss_roller' : 'collector' }), tick));
}

// Players now walk with articulated feet, not the enemy's whole-body wobble.
function naturalPlayerPose(pose) {
    bounded(pose);
    assert.equal(pose.x, 0, 'player torso has no horizontal sway');
    assert.equal(pose.angle, 0, 'player torso never tilts');
    assert.equal(pose.scaleX, 1, 'player torso does not squash horizontally');
    assert.equal(pose.scaleY, 1, 'player torso does not squash vertically');
    assert(Math.abs(pose.y) <= 1, 'player vertical motion stays within one pixel');
    assert(Number.isFinite(pose.step) && pose.step >= -1 && pose.step <= 1, 'signed stride is normalized');
    assert(Number.isFinite(pose.moving) && pose.moving >= 0 && pose.moving <= 1, 'movement blend is normalized');
}
const gait = new DoodleMotion(71);
gait.update(sample({ kind: 'player' }), tick);
const strides = [];
for (let i = 1; i <= 72; i++) {
    const frame = clone(gait.update(sample({ kind: 'player', x: i * 3 }), tick));
    naturalPlayerPose(frame); strides.push(frame);
}
assert(strides.some(frame => frame.step > .8) && strides.some(frame => frame.step < -.8), 'feet alternate in both stride directions');
assert(new Set(strides.slice(0, 5).map(frame => frame.step)).size === 5, 'player stride is not quantized to old twelve-frame wobble');
assert(Math.abs(strides[8].step / strides[8].moving - 1) < 1e-9, '27px travel reaches forward foot phase');
assert(Math.abs(strides[26].step / strides[26].moving + 1) < 1e-9, '81px travel reaches opposite foot phase');
assert(Math.abs(strides[35].step) < 1e-9, '108px travel completes one foot cycle');
const stridePaused = clone(strides.at(-1));
assert.deepEqual(gait.update(sample({ kind: 'player', x: 220, hp: 90, attackSerial: 1 }), 0), stridePaused, 'paused articulated gait is unchanged');
let stopped;
for (let i = 0; i < 18; i++) stopped = gait.update(sample({ kind: 'player', x: 216 }), tick);
naturalPlayerPose(stopped);
assert.equal(stopped.moving, 0, 'stationary player settles within 0.3 seconds');
assert.equal(stopped.step, 0, 'stationary feet do not keep cycling');
const gaitReaction = gait.update(sample({ kind: 'player', x: 219, hp: 75, attackSerial: 1 }), tick);
assert(gaitReaction.hit > 0 && gaitReaction.attack > 0);
naturalPlayerPose(gaitReaction); // Tool recoil/hit accent may animate, never torso distortion.
const gaitFrozen = gait.update(sample({ kind: 'player', x: 223, hp: 75, attackSerial: 1, frozen: true }), tick);
naturalPlayerPose(gaitFrozen); assert.equal(gaitFrozen.moving, 0); assert.equal(gaitFrozen.step, 0);
const gaitTeleport = gait.update(sample({ kind: 'player', x: 1000, hp: 75, attackSerial: 1 }), tick);
naturalPlayerPose(gaitTeleport); assert.equal(gaitTeleport.moving, 0); assert.equal(gaitTeleport.step, 0);

// Every grounded sprite replaces its baked feet with displacement-driven legs.
const walkerTypes = ['chaser', 'eraser', 'shield', 'shooter', 'summoner', 'boss', 'boss_roller', 'boss_eraser'];
assert.deepEqual(Object.keys(ENEMY_GAITS), walkerTypes);
for (const type of walkerTypes) {
    const motion = new DoodleMotion(0), config = ENEMY_GAITS[type];
    motion.update(sample({ kind: type }), tick);
    const frames = [];
    const distance = config.cycleDistance / 48;
    for (let i = 1; i <= 96; i++) {
        const p = clone(motion.update(sample({ kind: type, x: i * distance }), tick));
        bounded(p); frames.push(p);
        assert.equal(p.x, 0, `${type} walking does not move the torso sideways`);
        assert.equal(p.angle, 0, `${type} walking keeps the torso upright`);
        assert.equal(p.scaleX, 1); assert.equal(p.scaleY, 1, `${type} body does not squash while stepping`);
        assert(Math.abs(p.y) < 1, `${type} has less than a pixel of body bounce at nominal size`);
    }
    assert(frames.some(p => p.step > .5) && frames.some(p => p.step < -.5), `${type} both feet take turns`);
    assert(Math.abs(frames[11].step / frames[11].moving - 1) < 1e-9, `${type} forward phase follows distance`);
    assert(Math.abs(frames[35].step / frames[35].moving + 1) < 1e-9, `${type} opposite phase follows distance`);
    assert.equal(new Set(frames.slice(0, 8).map(p => p.step)).size, 8, `${type} smooth gait is not quantized`);
    const last = clone(frames.at(-1));
    assert.deepEqual(motion.update(sample({ kind: type, x: 10000 }), 0), last, `${type} pause freezes all gait state`);
    let settled;
    for (let i = 0; i < 18; i++) settled = motion.update(sample({ kind: type, x: 96 * distance }), tick);
    assert.equal(settled.moving, 0); assert.equal(settled.step, 0, `${type} stops cycling when blocked`);
    const reaction = motion.update(sample({ kind: type, x: 96 * distance, hp: 80, attackSerial: 1 }), tick);
    assert(reaction.hit > 0 && reaction.attack > 0, `${type} keeps damage and attack feedback`);
    assert.equal(reaction.angle, 0, `${type} feedback does not tip over the body`);
    const frozen = motion.update(sample({ kind: type, x: 97 * distance, hp: 80, attackSerial: 1, frozen: true }), tick);
    assert.equal(frozen.moving, 0); assert.equal(frozen.step, 0, `${type} frozen feet stay planted`);
    const relocated = motion.update(sample({ kind: type, x: 10000, hp: 80, attackSerial: 1 }), tick);
    assert.equal(relocated.moving, 0); assert.equal(relocated.step, 0, `${type} teleport does not advance feet`);
}
for (const type of ['paper_plane', 'boss_prism', 'boss_slime', 'blackhole']) {
    assert.equal(ENEMY_GAITS[type], undefined, `${type} keeps its own nonwalking motion`);
}

// Public entity adapter must neither consume gameplay RNG nor mutate physics/stats.
const player = PlayerFactory.create(500, 400);
const cache = new WeakMap();
const t = player.getComponent(Transform), hp = player.getComponent(Health), body = player.getComponent(Renderable);
const physicsBefore = JSON.stringify([t, hp, body, player.getComponent(Velocity), player.getComponent(Weapon)]);
const random = Math.random;
Math.random = () => { throw new Error('visual animation must not consume gameplay RNG'); };
try {
    sampleDoodleMotion(player, tick, cache);
    signalDoodleAttack(player);
    const playerSample = sampleDoodleMotion(player, tick, cache);
    assert(playerSample.attack > 0); naturalPlayerPose(playerSample);
} finally { Math.random = random; }
assert.equal(JSON.stringify([t, hp, body, player.getComponent(Velocity), player.getComponent(Weapon)]), physicsBefore);
hp.current -= 5;
assert(sampleDoodleMotion(player, tick, cache).hit > 0, 'adapter observes damage');
const pausePose = clone(sampleDoodleMotion(player, tick, cache));
assert.deepEqual(sampleDoodleMotion(player, 0, cache), pausePose, 'adapter respects pause');

// Real WeaponSystem: trigger from committed fire, never held input alone.
function weaponCase({ ammo = 12, cooldown = 0, reload = false, key = '', weaponIndex = 0, infinite = false } = {}) {
    const actor = PlayerFactory.create(500, 400, 'collector', weaponIndex);
    const weapon = actor.getComponent(Weapon), motion = new WeakMap(), spawned = [];
    weapon.ammo[weaponIndex] = ammo; weapon.cooldown = cooldown;
    weapon.reloading = reload; weapon.reloadTimer = reload ? 60 : 0;
    weapon.unlocked.add(1);
    if (infinite) actor.getComponent(PlayerStats).infiniteAmmoUntil = Date.now() + 10000;
    const input = { mouse: { down: true }, isKeyDown: name => name === key };
    const weapons = new WeaponSystem(input, entity => spawned.push(entity), context(), context());
    weapons.addEntity(actor);
    sampleDoodleMotion(actor, tick, motion);
    weapons.update(tick);
    return { actor, weapon, spawned, pose: sampleDoodleMotion(actor, tick, motion) };
}
assert(weaponCase().pose.attack > 0, 'real successful shot pulses');
assert(weaponCase({ weaponIndex: 2 }).pose.attack > 0, 'melee pulses without consuming ammo');
const infiniteShot = weaponCase({ infinite: true });
assert(infiniteShot.pose.attack > 0 && infiniteShot.weapon.ammo[0] === 12, 'infinite-ammo shot pulses with unchanged ammo');
assert.equal(weaponCase({ ammo: 0 }).pose.attack, 0, 'empty click is not an attack');
assert.equal(weaponCase({ reload: true }).pose.attack, 0, 'reload is not an attack');
assert.equal(weaponCase({ cooldown: 10 }).pose.attack, 0, 'held fire during cooldown is not an attack');
assert.equal(weaponCase({ key: '2' }).pose.attack, 0, 'weapon switch cooldown is not an attack');

function enemyAttackCase(type, patch = {}) {
    const actor = EnemyFactory.create(type, 700, 400), target = PlayerFactory.create(500, 400), motion = new WeakMap();
    Object.assign(actor.getComponent(EnemyBehavior), patch);
    const spawned = [], enemies = new EnemySystem(entity => spawned.push(entity), context());
    enemies.addEntity(target); enemies.addEntity(actor);
    sampleDoodleMotion(actor, tick, motion);
    enemies.update(tick);
    return { pose: sampleDoodleMotion(actor, tick, motion), spawned };
}
for (const type of ['shooter', 'summoner']) {
    const action = enemyAttackCase(type);
    assert(action.spawned.length > 0 && action.pose.attack > 0, `${type} real action pulses`);
    assert.equal(enemyAttackCase(type, { frozenFrames: 30 }).pose.attack, 0, `${type} frozen attack is suppressed`);
}
assert.equal(enemyAttackCase('shooter', { shootCooldown: 30 }).pose.attack, 0, 'shooter cooldown does not pulse');
assert.equal(enemyAttackCase('summoner', { summonCooldown: 30 }).pose.attack, 0, 'summoner cooldown does not pulse');
for (const [type, bossTimer] of [['boss', 179], ['boss_prism', 59], ['boss_slime', 89], ['boss_eraser', 399]]) {
    const action = enemyAttackCase(type, { bossTimer });
    assert(action.spawned.length > 0 && action.pose.attack > 0, `${type} real attack pulses`);
}

// Hidden vehicle pilots still age visual reactions and sample damage/attack events.
// Dismount must not replay either an old visible pulse or a pulse received while hidden.
const pilot = PlayerFactory.create(500, 400), pilotCtx = context();
const pilotRenderer = new RenderSystem(pilotCtx, { x: 0, y: 0 }, 2700, 1800, () => true);
const pilotBody = pilot.getComponent(Renderable), pilotHp = pilot.getComponent(Health);
const pilotImage = pilot.getComponent(PlayerArtwork).image;
pilotRenderer.addEntity(pilot);
const renderPilot = () => { pilotCtx.calls.length = 0; pilotRenderer.update(tick); };
const pilotDraws = () => pilotCtx.calls.filter(call => call.name === 'drawImage' && call.args[0] === pilotImage);
const pulseStrokes = () => pilotCtx.calls.filter(call => call.name === 'stroke' && ['#ffdd90', '#fff1bd'].includes(call.strokeStyle));
renderPilot();
signalDoodleAttack(pilot); pilotHp.current -= 5; renderPilot();
assert(pulseStrokes().length > 0, 'visible hit/attack reaction exists before mounting');
pilotBody.visible = false; pilot.tags.add('magic_piloting');
for (let i = 0; i < 60; i++) {
    if (i === 20) { signalDoodleAttack(pilot); pilotHp.current -= 5; }
    renderPilot();
    assert.equal(pilotDraws().length, 0, 'hidden pilot never draws');
    assert.equal(pulseStrokes().length, 0, 'hidden pilot never draws reaction accents');
}
pilotBody.visible = true; pilot.tags.delete('magic_piloting'); renderPilot();
assert.equal(pilotDraws().length, 1, 'dismount restores exactly one body');
assert.equal(pulseStrokes().length, 0, 'dismount does not replay stale hit/attack accents');
// Read the existing renderer cache with dt zero, which does not advance or consume events.
const dismountPose = sampleDoodleMotion(pilot, 0, pilotRenderer.doodleMotion);
assert.equal(dismountPose.attack, 0, 'attack age advanced while hidden');
assert.equal(dismountPose.hit, 0, 'hidden HP changes were consumed without a delayed hit');
assert.equal(pilotCtx.stack.length, 0);
pilotRenderer.removeEntity(pilot);

// The actual renderer keeps all enemy shape routes and shield/status overlays.
const enemyImage = getDoodleEnemies();
const neutralEnemyPose = { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, attack: 0, hit: 0, shadowScale: 1, moving: 1, step: 0 };
for (const type of walkerTypes) {
    const ctx = context();
    const renderLegs = step => {
        ctx.calls.length = 0;
        assert(drawDoodleEnemy(ctx, type, 25.6, 1.1, { ...neutralEnemyPose, step }));
        const draw = ctx.calls.findIndex(c => c.name === 'drawImage');
        const legs = ctx.calls.slice(0, draw).filter(c => c.name === 'moveTo' || c.name === 'lineTo').slice(0, 8);
        assert.equal(legs.length, 8, `${type} has two separate four-point legs`);
        assert(ctx.calls.some(c => c.name === 'clip'), `${type} hides the atlas's fixed legs`);
        assert(!ctx.calls.some(c => c.name === 'rotate' || c.name === 'scale'), `${type} body is rendered upright without wobble`);
        assert.equal(ctx.stack.length, 0);
        return legs.map(c => c.args);
    };
    const a = renderLegs(1), b = renderLegs(-1);
    assert(Math.abs(a[2][0]-b[2][0]+ENEMY_GAITS[type].stride*2) < 1e-9, `${type} left foot strides`);
    assert(Math.abs(a[6][0]-b[6][0]-ENEMY_GAITS[type].stride*2) < 1e-9, `${type} right foot strides oppositely`);
    assert(a[2][1] > b[2][1] && a[6][1] < b[6][1], `${type} only the advancing foot lifts`);
}
const enemyTypes = ['chaser', 'eraser', 'shield', 'shooter', 'summoner', 'paper_plane', 'boss', 'boss_roller', 'boss_prism', 'boss_slime', 'boss_eraser'];
for (const type of enemyTypes) {
    const enemy = EnemyFactory.create(type, 600, 450), ctx = context();
    const render = new RenderSystem(ctx, { x: 0, y: 0 }, 2700, 1800, () => true);
    render.addEntity(enemy);
    const transform = enemy.getComponent(Transform), shape = enemy.getComponent(Renderable), beh = enemy.getComponent(EnemyBehavior);
    transform.rotation = 1.1;
    const before = JSON.stringify([transform, shape, enemy.getComponent(Health), enemy.getComponent(Velocity), beh]);
    render.update(tick);
    const draws = ctx.calls.filter(call => call.name === 'drawImage' && call.args[0] === enemyImage);
    assert.equal(draws.length, 1, `${type} draws exactly one body`);
    const frame = ENEMY_FRAMES[type];
    assert.deepEqual(draws[0].args.slice(1, 5), [frame.x, frame.y, frame.width, frame.height], `${type} correct atlas cell`);
    assert.equal(JSON.stringify([transform, shape, enemy.getComponent(Health), enemy.getComponent(Velocity), beh]), before, `${type} render is visual only`);
    if (type === 'shield') assert(ctx.calls.some(call => call.name === 'arc' && call.args[2] === shape.radius + 6), 'directional shield overlay survives');
    if (type === 'paper_plane') {
        assert(ctx.calls.some(call => call.name === 'rotate' && Math.abs(call.args[0] - 1.1) < 1e-6), `${type} retains heading`);
    }
    if (type === 'boss_roller') {
        const bodyIndex = ctx.calls.findIndex(call => call.name === 'drawImage' && call.args[0] === enemyImage);
        assert(!ctx.calls.slice(0,bodyIndex).some(call => call.name === 'rotate' && Math.abs(call.args[0]-1.1)<1e-6), 'roller legs and body stay upright');
        assert(ctx.calls.slice(bodyIndex+1).some(call => call.name === 'rotate' && Math.abs(call.args[0]-1.1)<1e-6), 'roller warning still follows actual attack heading');
    }
    beh.frozenFrames = 30; beh.burnFrames = 20; beh.corrosiveStacks = 2;
    ctx.calls.length = 0; render.update(tick);
    assert(ctx.calls.some(call => call.name === 'stroke' && call.strokeStyle === '#a9ddeb'), `${type} paper-ice outline survives on every shape`);
    assert(ctx.calls.some(call => call.name === 'translate' && Math.abs(Math.hypot(...call.args)-(shape.radius+4))<1e-6), `${type} fire glyphs keep their original orbit radius`);
    if (type === 'boss_roller') {
        shape.scaleX = 2.75; shape.scaleY = 1 / 2.75;
        ctx.calls.length = 0; render.update(tick);
        assert(!ctx.calls.some(call => call.name === 'scale' && call.args[0] === 2.75), 'legacy high-speed squash does not distort doodle body');
    }
    assert.equal(ctx.stack.length, 0, `${type} canvas state balanced`);
    assert.equal(ctx.globalAlpha, 1);
    render.removeEntity(enemy);
}

console.log('PASS: eight upright grounded enemies with independent alternating legs, clipped fixed feet, displacement/stop/freeze/teleport gait, retained flight/slime motion, attack and damage feedback, player weapon gates, all enemy shape routes, overlays and visual-only rendering.');
