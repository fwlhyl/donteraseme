import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out=join(await mkdtemp(join(tmpdir(),'fast-projectiles-')),'test.mjs');
await build({stdin:{contents:`
export {BulletFactory} from './src/entities/BulletFactory';
export {WEAPONS} from './src/components/Weapon';
export {MovementSystem} from './src/systems/MovementSystem';
export {CollisionSystem} from './src/systems/CollisionSystem';
export {sweptProjectileCircleTime,sweptWallTime} from './src/systems/ProjectileSweep';
export {Entity} from './src/core/Entity';
export {Renderable} from './src/components/Renderable';
export {Transform} from './src/components/Transform';
export {Velocity} from './src/components/Velocity';
export {Health} from './src/components/Health';
export {Projectile} from './src/components/Projectile';
export {PlayerControl} from './src/components/PlayerControl';
export {PlayerStats} from './src/components/PlayerStats';
export {EnemyBehavior} from './src/components/EnemyBehavior';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:out});
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window=new EventTarget();
const m=await import(pathToFileURL(out));
function fixture(){
 const move=new m.MovementSystem(10000,10000),collision=new m.CollisionSystem();
 const add=e=>{move.addEntity(e);collision.addEntity(e);return e;};
 const player=add(new m.Entity());player.tags.add('player');
 player.addComponent(new m.Transform(800,1000));player.addComponent(new m.Renderable('#222',16.25));
 player.addComponent(new m.PlayerControl());player.addComponent(new m.PlayerStats());player.addComponent(new m.Health(100,100));
 const enemy=(x,y=1000,radius=1)=>{
  const e=add(new m.Entity());e.tags.add('enemy');e.addComponent(new m.Transform(x,y));
  e.addComponent(new m.Renderable('#888',radius));e.addComponent(new m.Health(1000,1000));e.addComponent(new m.EnemyBehavior('chaser'));return e;
 };
 const shot=(overrides={},track=true)=>add(m.BulletFactory.create({...m.WEAPONS[0],radius:1,...overrides},1000,1000,0,'#888',player.id,1,1,track));
 const wall=x=>{
  const e=add(new m.Entity());e.tags.add('wall');e.addComponent(new m.Transform(x,990));
  e.addComponent(new m.Renderable('#888',1,x,1010,'wall_line'));e.addComponent(new m.Health(1000,1000));return e;
 };
 return{move,collision,add,player,enemy,shot,wall,step(){move.update(1/60);collision.update(1/60);}};
}
for(const [id,oldSpeed] of [[0,9],[1,9],[3,9],[5,10],[7,6]]) {
 const config=m.WEAPONS[id];assert(Math.abs(config.speed-oldSpeed*1.8)<1e-9);
 const f=fixture(),bullet=f.shot(config),p=bullet.getComponent(m.Projectile),t=bullet.getComponent(m.Transform);
 let steps=0;while(bullet.active && steps++<200) f.step();
 assert(steps<200);assert(Math.abs(t.x-1000-config.range)<1e-6,`${config.type} exact range`);
 assert.equal(p.remainingRange,0);assert.equal(bullet.active,false);
}
assert.equal(m.WEAPONS[8].speed,18,'instant beam untouched');
{
 const f=fixture(),e=f.enemy(1010),b=f.shot({speed:30});f.step();
 assert.equal(e.getComponent(m.Health).current,990,'crossed small target still hits');assert.equal(b.active,false);
 f.collision.update(1/60);assert.equal(e.getComponent(m.Health).current,990,'inactive projectile cannot damage again');
}
{
 const f=fixture(),e=f.enemy(1020,1000,15);
 for(let i=0;i<8;i++) f.shot({type:'shotgun',speed:50,damage:7});
 f.step();
 assert.equal(e.getComponent(m.Health).current,944,'all shotgun pellets deal damage');
 assert.equal(e.getComponent(m.Transform).x,1025,'shotgun pellets apply one bounded push per target');
}
{
 const f=fixture(),far=f.enemy(1040),near=f.enemy(1010);f.shot({speed:70});f.step();
 assert.equal(near.getComponent(m.Health).current,990,'nearest target wins over insertion order');
 assert.equal(far.getComponent(m.Health).current,1000,'nonpiercing bullet damages one target');
}
{
 const f=fixture(),e=f.enemy(1010,1004);f.shot({speed:30});f.step();
 assert.equal(e.getComponent(m.Health).current,1000,'parallel near miss does not enlarge hitbox');
}
{
 const f=fixture(),e=f.enemy(1009),b=f.shot({range:10,speed:30});f.step();
 assert.equal(b.getComponent(m.Transform).x,1010,'clamped last movement');
 assert.equal(e.getComponent(m.Health).current,990,'final lifetime segment still checked');
}
{
 const f=fixture(),e=f.enemy(1015),b=f.shot({range:10,speed:30});f.step();f.step();
 assert.equal(e.getComponent(m.Health).current,1000,'range cap prevents overshoot hits');assert.equal(b.active,false);
}
{
 const f=fixture(),farWall=f.wall(1050),nearWall=f.wall(1020),e=f.enemy(1040);f.shot({speed:80});f.step();
 assert.equal(nearWall.getComponent(m.Health).current,990,'first crossed wall takes hit');
 assert.equal(farWall.getComponent(m.Health).current,1000,'later wall is protected');
 assert.equal(e.getComponent(m.Health).current,1000,'enemy behind first wall is protected');
}
{
 const f=fixture(),wall=f.wall(1050),e=f.enemy(1010);f.shot({speed:80});f.step();
 assert.equal(e.getComponent(m.Health).current,990,'enemy before wall receives hit');
 assert.equal(wall.getComponent(m.Health).current,1000);
}
{
 const f=fixture(),e=f.enemy(1500);for(let i=0;i<64;i++)f.enemy(3000+i*30,3000);
 f.shot({speed:1200,range:2000});f.step();
 assert.equal(e.getComponent(m.Health).current,990,'indexed broad phase covers complete travelled segment');
}
{
 const f=fixture(),b=f.shot({speed:15,range:10},false),p=b.getComponent(m.Projectile);p.life=25;
 assert.equal(p.sweptCollision,false);assert.equal(p.remainingRange,undefined);
 f.move.update(1/60);assert.equal(b.getComponent(m.Transform).x,1015,'custom skills retain their own speed/lifetime');
}
{
 const f=fixture(),b=f.shot({range:10,speed:30}),p=b.getComponent(m.Projectile);
 p.calligrapherBoomerang=true;p.life=120;p.remainingRange=0;
 f.move.update(1/60);assert.equal(b.getComponent(m.Transform).x,1030,'return ignores exhausted outward range');
 assert.equal(p.life,119);assert(b.active);
}
assert.equal(m.sweptProjectileCircleTime(0,0,30,0,0,'rect',2,2,1,10,4,1),null);
assert.equal(m.sweptWallTime(0,0,30,0,10,-10,10,10,2),8/30);
console.log('PASS: 1.8× bullet speeds, exact ranges, continuous small-target/indexed hits, final-frame contacts, no false near misses, first-target/first-wall order, single hits, custom skills and boomerang returns.');
