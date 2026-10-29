// Integration checks for assistant movement, readable hostile shots, and player pigment.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = join(await mkdtemp(join(tmpdir(), 'combat-clarity-')), 'test.mjs');
await build({ stdin: { contents: `
export { SummonSystem } from './src/systems/SummonSystem';
export { EnemySystem } from './src/systems/EnemySystem';
export { WeaponSystem } from './src/systems/WeaponSystem';
export { CollisionSystem } from './src/systems/CollisionSystem';
export { EnemyFactory } from './src/entities/EnemyFactory';
export { Entity } from './src/core/Entity';
export { Transform } from './src/components/Transform';
export { Velocity } from './src/components/Velocity';
export { Renderable } from './src/components/Renderable';
export { Health } from './src/components/Health';
export { Projectile } from './src/components/Projectile';
export { Summon } from './src/components/Summon';
export { PlayerStats } from './src/components/PlayerStats';
export { Weapon, WEAPONS } from './src/components/Weapon';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: out });
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = new EventTarget();
globalThis.CustomEvent ??= class extends Event { constructor(type, init) { super(type); this.detail = init?.detail; } };
const m = await import(pathToFileURL(out));
const player = new m.Entity(); player.tags.add('player');
const position = new m.Transform(300, 300, 0); player.addComponent(position);
player.addComponent(new m.Renderable('#24a5bc', 20)); player.addComponent(new m.Health(100,100));
const stats = new m.PlayerStats(); player.addComponent(stats);
{
  const spawned = []; const sys = new m.SummonSystem(e => { spawned.push(e); sys.addEntity(e); });
  sys.addEntity(player); stats.acquiredSkills.summon_stickman = 2; sys.update(1/60);
  const assistants = spawned.filter(e => e.getComponent(m.Summon)?.type === 'stickman');
  assert.equal(assistants.length, 2);
  for (let i = 0; i < 200; i++) {
    if (i < 60) { position.x += 3; position.y -= 2; }
    sys.update(1/60);
    for (const e of assistants) {
      const s = e.getComponent(m.Summon), t = e.getComponent(m.Transform), v = e.getComponent(m.Velocity);
      assert.equal(t.x, position.x - s.distance); assert.equal(t.y, position.y + (s.index % 2 === 0 ? 30 : -30));
      assert.equal(v.x, 0); assert.equal(v.y, 0);
    }
  }
  const enemy = m.EnemyFactory.create('chaser', position.x+100, position.y); sys.addEntity(enemy);
  for (let i=0;i<65;i++) sys.update(1/60);
  assert(spawned.some(e => e.tags.has('summon_bullet_stickman')), 'assistant still shoots');
}
{
  const spawned=[]; const sys = new m.EnemySystem(e => spawned.push(e)); sys.addEntity(player);
  const enemy = m.EnemyFactory.create('shooter', position.x+500, position.y); sys.addEntity(enemy); sys.update(1/60);
  assert.equal(spawned.length,1); const shot=spawned[0];
  assert.equal(shot.getComponent(m.Renderable).radius,10);
  assert(Math.abs(Math.hypot(shot.getComponent(m.Velocity).x,shot.getComponent(m.Velocity).y)-0.8)<1e-9);
  for(let i=0;i<359;i++) sys.update(1/60); assert.equal(spawned.length,1, 'no early shot');
  sys.update(1/60); assert.equal(spawned.length,2, 'fires after cooldown');
}
{
  const spawned=[]; const sys = new m.WeaponSystem({}, e=>spawned.push(e));
  const weapon=new m.Weapon(); player.addComponent(weapon); stats.hasDigitalPassive=true;
  sys.shoot(player, weapon, position, '#24a5bc', stats);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(spawned.at(-1)?.getComponent(m.Renderable).color,'#24a5bc', 'digital pistol matches player');
  stats.lastAttackConfig=m.WEAPONS[0]; stats.digitalPenCooldown=0;
  sys.handleDigitalPen(player, stats, position, player.getComponent(m.Renderable));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(spawned.at(-1)?.getComponent(m.Renderable).color,'#24a5bc', 'digital pen matches player');
  player.getComponent(m.Renderable).color='#ffffff'; stats.acquiredSkills.awakening_digital_2=1;
  stats.digitalPenCooldown=100; stats.digitalTurrets=[{ x:position.x, y:position.y, lifeTimer:10, burstCount:1, burstDelay:0, config:m.WEAPONS[9] }];
  sys.handleDigitalPen(player, stats, position, player.getComponent(m.Renderable));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(spawned.at(-1)?.getComponent(m.Renderable).color,'#ffffff', 'white digital flame does not fall back to orange');
}
{
  const colors=[]; const ctx={ fillStyle:'', globalAlpha:1, beginPath(){}, moveTo(){}, quadraticCurveTo(){}, closePath(){}, ellipse(){}, arc(){}, save(){}, restore(){}, fill(){colors.push(this.fillStyle);} };
  const sys = new m.CollisionSystem(undefined, ctx); sys.addEntity(player);
  const enemy=m.EnemyFactory.create('shooter', position.x+100, position.y);
  enemy.getComponent(m.Renderable).color='#ff0000'; enemy.getComponent(m.Health).current=1; sys.addEntity(enemy);
  const shot=new m.Entity(); shot.addComponent(new m.Transform(position.x+100,position.y));
  shot.addComponent(new m.Renderable('#00ff00', 8, 0, 0, 'circle'));
  shot.addComponent(new m.Projectile('rocket', 100, player.id, 20)); sys.addEntity(shot);
  sys.update(1/60);
  assert.equal(enemy.active,false,'rocket kills enemy');
  assert.equal(colors[0], '#000000', 'death splash uses black, independent of enemy and shot pigment');
  assert(colors.includes('#00ff00'), 'weapon explosion retains its separate pigment');
}
console.log('PASS: assistants follow and fire; shooter cadence, size, and speed; digital pigment; black enemy death splash.');
