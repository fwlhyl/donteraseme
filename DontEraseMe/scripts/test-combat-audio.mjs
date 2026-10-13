// Semantic audio checks use real combat systems and an in-memory sound listener.
// No audio device, browser profile, or persistent player save is touched.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'combat-audio-')), 'combat.mjs');
await build({ stdin: { contents: `
export {listenGameSounds} from './src/audio/AudioEvents';
export {WeaponSystem} from './src/systems/WeaponSystem';
export {CollisionSystem} from './src/systems/CollisionSystem';
export {SkillSystem} from './src/systems/SkillSystem';
export {DeathHandler} from './src/systems/DeathHandler';
export {PlayerFactory} from './src/entities/PlayerFactory';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Velocity} from './src/components/Velocity';
export {Renderable} from './src/components/Renderable';
export {Health} from './src/components/Health';
export {Weapon} from './src/components/Weapon';
export {Projectile} from './src/components/Projectile';
export {EnemyBehavior} from './src/components/EnemyBehavior';
export {PlayerStats} from './src/components/PlayerStats';
export {Experience} from './src/components/Experience';
export {ExperienceOrb} from './src/components/ExperienceOrb';
export {Skill} from './src/components/Skill';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' }, outfile: out });

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.Image = class { complete = true; naturalWidth = 1536; naturalHeight = 1024; };
globalThis.window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1000, innerHeight: 700 };
globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const m = await import(pathToFileURL(out));
const { listenGameSounds, WeaponSystem, CollisionSystem, SkillSystem, DeathHandler, PlayerFactory,
    Entity, Transform, Velocity, Renderable, Health, Weapon, Projectile, EnemyBehavior,
    PlayerStats, Experience, ExperienceOrb, Skill } = m;
const context = () => new Proxy({}, { get: (target, key) => key in target ? target[key] : () => {} });
const tick = 1 / 60;
const sounds = [];
const unsubscribe = listenGameSounds((cue, options) => sounds.push({ cue, ...options }));
const count = cue => sounds.filter(sound => sound.cue === cue).length;
const clear = () => { sounds.length = 0; };

function weaponCase(index, patch = {}) {
    const player = PlayerFactory.create(100, 100, 'collector', index);
    const weapon = player.getComponent(Weapon);
    Object.assign(weapon, patch);
    player.getComponent(PlayerStats).critChance = 0;
    const spawned = [];
    const system = new WeaponSystem({ mouse: { down: true }, isKeyDown: () => false }, entity => spawned.push(entity), context(), context());
    system.addEntity(player);
    return { player, weapon, spawned, system };
}

const shotCues = ['shot-brush', 'shot-spray', 'shot-scrape', 'shot-chain', 'shot-ruler', 'shot-ribbon',
    'shot-vortex', 'shot-bucket', 'shot-pen', 'shot-airbrush', 'shot-compass', 'shot-dropper'];
for (let index = 0; index < shotCues.length; index++) {
    const run = weaponCase(index);
    clear(); run.system.update(tick);
    assert.equal(count(shotCues[index]), 1, `weapon ${index} emits one trigger cue`);
    assert.equal(sounds.filter(sound => sound.cue.startsWith('shot-')).length, 1, 'pellets never multiply the attack cue');
    assert.equal(count('hit') + count('hit-heavy'), 0, 'firing into empty space is not a hit');
    assert.deepEqual([sounds[0].x, sounds[0].y], [100, 100], 'shot uses actual world position');
}
for (const patch of [{ cooldown: 10 }, { reloading: true, reloadTimer: 30 }]) {
    const run = weaponCase(0, patch);
    clear(); run.system.update(tick);
    assert.equal(sounds.filter(sound => sound.cue.startsWith('shot-')).length, 0, 'blocked held input is silent');
}
const empty = weaponCase(0);
empty.weapon.ammo[0] = 0;
empty.player.getComponent(PlayerStats).learnSkill('reload_compass_dash');
clear(); empty.system.update(tick); empty.system.update(tick);
assert.equal(count('shot-brush'), 0, 'empty magazine is not a shot');
assert.equal(count('reload'), 1, 'reload emits once at its start');
assert.equal(count('dash'), 1, 'actual reload dash emits once, not once per animation frame');

function enemy(x = 500, y = 500, type = 'chaser') {
    const entity = new Entity();
    entity.tags.add('enemy');
    entity.addComponent(new Transform(x, y));
    entity.addComponent(new Renderable('#fff', 15, 30, 30, 'circle'));
    entity.addComponent(new Health(100, 100));
    entity.addComponent(new Velocity());
    entity.addComponent(new EnemyBehavior(type, type === 'shield' ? 100 : 0));
    return entity;
}
function projectile(owner, x, y, crit = false) {
    const entity = new Entity();
    entity.tags.add('projectile');
    entity.addComponent(new Transform(x, y));
    entity.addComponent(new Renderable('#fff', 5, 10, 10, 'circle'));
    entity.addComponent(new Velocity(1, 0));
    const data = entity.addComponent(new Projectile('standard', 10, owner.id));
    data.isCrit = crit;
    return entity;
}
function collisionCase({ hit = true, crit = false, shield = false } = {}) {
    const player = PlayerFactory.create(100, 100, 'collector');
    const target = enemy(500, 500, shield ? 'shield' : 'chaser');
    const bullet = projectile(player, hit ? 500 : 800, 500, crit);
    const system = new CollisionSystem();
    [player, target, bullet].forEach(entity => system.addEntity(entity));
    clear(); system.update(tick);
    return { player, target, bullet, system };
}
collisionCase({ hit: false });
assert.equal(count('hit') + count('hit-heavy'), 0, 'missed projectile remains silent');
const hit = collisionCase();
assert.equal(hit.target.getComponent(Health).current, 90);
assert.equal(count('hit'), 1, 'real HP loss emits hit');
assert.deepEqual([sounds[0].x, sounds[0].y], [500, 500], 'impact uses target world position');
collisionCase({ crit: true });
assert.equal(count('hit-heavy'), 1, 'critical impact has the stronger cue');
const blocked = collisionCase({ shield: true });
assert.equal(blocked.target.getComponent(Health).current, 100);
assert.equal(count('shield'), 1);
assert.equal(count('hit') + count('hit-heavy'), 0, 'enemy block is not an HP hit');

function playerContact(shielded) {
    const player = PlayerFactory.create(100, 100, 'collector');
    const stats = player.getComponent(PlayerStats);
    stats.dodgeChance = 0;
    if (shielded) { stats.learnSkill('defense_shield'); stats.hasOrigamiShield = true; }
    const target = enemy(110, 100);
    const system = new CollisionSystem();
    system.addEntity(player); system.addEntity(target);
    const hp = player.getComponent(Health), before = hp.current;
    clear(); system.update(tick);
    return { player, target, system, hp, before };
}
const hurt = playerContact(false);
assert.equal(hurt.hp.current, hurt.before - 50);
assert.equal(count('hurt'), 1, 'actual player damage emits hurt');
Object.assign(hurt.target.getComponent(Transform), hurt.player.getComponent(Transform));
hurt.system.update(tick);
assert.equal(count('hurt'), 1, 'invulnerability never repeats hurt');
const protectedPlayer = playerContact(true);
assert.equal(protectedPlayer.hp.current, protectedPlayer.before);
assert.equal(count('shield'), 1);
assert.equal(count('hurt'), 0, 'player shield absorption is not hurt');

const defeated = enemy();
clear();
DeathHandler.handleEnemyDeath(defeated, null, 500, 500, '#fff', new Set([defeated]));
DeathHandler.handleEnemyDeath(defeated, null, 500, 500, '#fff', new Set([defeated]));
assert.equal(count('kill'), 1, 'repeated death handling produces one kill cue');

const collector = PlayerFactory.create(100, 100, 'collector');
const orb = new Entity(); orb.tags.add('xp_orb');
orb.addComponent(new Transform(105, 100)); orb.addComponent(new ExperienceOrb(7));
const pickup = new CollisionSystem(); pickup.addEntity(collector); pickup.addEntity(orb);
const xpBefore = collector.getComponent(Experience).xp;
clear(); pickup.update(tick); pickup.update(tick);
assert.equal(collector.getComponent(Experience).xp, xpBefore + 7);
assert.equal(count('pickup'), 1, 'only collected XP emits a pickup');

const caster = PlayerFactory.create(100, 100, 'collector');
caster.getComponent(Skill).activeTool = 'pin';
const skills = new SkillSystem({ mouse: { x: 0, y: 0 }, isKeyDown: key => key === 'f' }, context(),
    { x: 0, y: 0, shakeX: 0, shakeY: 0, shakeTimer: 0 }, () => {});
skills.addEntity(caster);
clear(); skills.update(tick);
assert.equal(count('skill'), 0, 'locked skill attempts do not sound successful');
caster.getComponent(Experience).level = 30;
caster.getComponent(Skill).toolCooldown = 0;
clear(); skills.update(tick); skills.update(tick);
assert.equal(count('skill'), 1, 'successful skill emits once across cooldown frames');

unsubscribe();
console.log('PASS: twelve weapon triggers, empty/cooldown/reload gates, true hits/criticals, enemy/player shields, damage immunity, death deduplication, pickup and successful skill audio.');
