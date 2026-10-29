import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'magic-vehicle-collision-')), 'test.mjs');
await build({ stdin: { contents: `
export { CollisionSystem } from './src/systems/CollisionSystem';
export { Entity } from './src/core/Entity';
export { Transform } from './src/components/Transform';
export { Renderable } from './src/components/Renderable';
export { Health } from './src/components/Health';
export { Projectile } from './src/components/Projectile';
export { EnemyBehavior } from './src/components/EnemyBehavior';
export { PlayerStats } from './src/components/PlayerStats';
export { MagicManifestation } from './src/components/MagicManifestation';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: out });
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = new EventTarget();
globalThis.CustomEvent ??= class extends Event { constructor(type, init) { super(type); this.detail = init?.detail; } };
const m = await import(pathToFileURL(out));
function fixture(type, enemyType = 'chaser', enemyHealth = 500) {
    const sys = new m.CollisionSystem();
    const player = new m.Entity(); player.tags.add('player');
    if (type) player.tags.add(`magic_piloting_${type}`);
    player.addComponent(new m.Transform(100, 100)); player.addComponent(new m.Renderable('#111', 20));
    player.addComponent(new m.Health(1000, 1000)); player.addComponent(new m.PlayerStats()); sys.addEntity(player);
    if (type) { const v = new m.Entity(); v.addComponent(new m.MagicManifestation(type, player.id, 'B', 1)); sys.addEntity(v); }
    const enemy = new m.Entity(); enemy.tags.add('enemy'); enemy.addComponent(new m.Transform(110, 100));
    enemy.addComponent(new m.Renderable('#111', 15)); enemy.addComponent(new m.Health(enemyHealth, enemyHealth));
    enemy.addComponent(new m.EnemyBehavior(enemyType)); sys.addEntity(enemy);
    return { sys, player, enemy };
}
for (const type of ['tank', 'robot']) {
    const f = fixture(type); f.sys.update(1 / 60);
    assert.equal(f.enemy.getComponent(m.Health).current, type === 'tank' ? 450 : 458, `${type} ram damage`);
    assert(f.enemy.getComponent(m.Transform).x > 110, `${type} knocks enemy away`);
    assert(f.player.getComponent(m.Health).current < 1000, `${type} retains contact damage to player`);
    for (let i = 0; i < 29; i++) { f.enemy.getComponent(m.Transform).x = 110; f.sys.update(1 / 60); }
    assert.equal(f.enemy.getComponent(m.Health).current, type === 'tank' ? 450 : 458, 'no damage before cooldown');
    f.enemy.getComponent(m.Transform).x = 110; f.sys.update(1 / 60);
    assert.equal(f.enemy.getComponent(m.Health).current, type === 'tank' ? 400 : 416, 'ram recovers after cooldown');
    const lethal = fixture(type, 'chaser', 10); lethal.sys.update(1 / 60);
    assert.equal(lethal.enemy.active, false, 'lethal ram runs enemy death path');
}
{
    const f = fixture(null); f.sys.update(1 / 60);
    assert.equal(f.enemy.getComponent(m.Health).current, 500, 'ordinary player does not ram');
    assert(f.player.getComponent(m.Health).current < 1000, 'ordinary contact unchanged');
}
{
    const f = fixture('bomber'); f.sys.update(1 / 60);
    assert.equal(f.player.getComponent(m.Health).current, 1000, 'bomber avoids enemy contact');
    assert.equal(f.enemy.getComponent(m.Health).current, 500, 'bomber does not ram');
    const p = new m.Entity(); p.addComponent(new m.Transform(100, 100)); p.addComponent(new m.Renderable('#000', 4));
    p.addComponent(new m.Projectile('standard', 25, 'enemy', 10)); f.sys.addEntity(p); f.sys.update(1 / 60);
    assert(f.player.getComponent(m.Health).current < 1000, 'bomber still receives projectile damage');
}
{
    const f = fixture('tank', 'shield'); const b = f.enemy.getComponent(m.EnemyBehavior);
    b.shield = 100; f.enemy.getComponent(m.Transform).rotation = 0; f.sys.update(1 / 60);
    assert.equal(b.shield, 50, 'ram respects facing shield'); assert.equal(f.enemy.getComponent(m.Health).current, 500);
}
{
    const f = fixture('robot', 'boss_eraser'); f.enemy.getComponent(m.EnemyBehavior).bossTimer = 450;
    f.sys.update(1 / 60); assert.equal(f.enemy.getComponent(m.Health).current, 500, 'boss shield prevents ram damage');
}
console.log('PASS: tank/robot ramming, knockback, cooldown, enemy death, shield and bomber contact immunity/projectile damage.');
