import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out=join(await mkdtemp(join(tmpdir(),'doodle-projectiles-')),'test.mjs');
await build({stdin:{contents:`
export * from './src/art/DoodleProjectiles';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Renderable} from './src/components/Renderable';
export {Projectile} from './src/components/Projectile';
export {Velocity} from './src/components/Velocity';
export {Weapon,WEAPONS} from './src/components/Weapon';
export {PlayerStats} from './src/components/PlayerStats';
export {SkillVisual} from './src/components/SkillVisual';
export {BulletFactory} from './src/entities/BulletFactory';
export {RenderSystem} from './src/systems/RenderSystem';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',loader:{'.png':'dataurl','.webp':'dataurl'},outfile:out});
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.Image=class{complete=true;naturalWidth=1536;naturalHeight=1024;};
globalThis.window={addEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1};
let canvasCount=0;
function context(){
 const calls=[],stack=[],target={calls,stack,globalAlpha:.6,shadowBlur:0,fillStyle:'',strokeStyle:'',canvas:{clientWidth:1280,clientHeight:720}};
 return new Proxy(target,{get(o,k){if(k in o)return o[k];if(k==='save')return()=>stack.push({globalAlpha:o.globalAlpha,shadowBlur:o.shadowBlur});if(k==='restore')return()=>{assert(stack.length);Object.assign(o,stack.pop());};return(...args)=>{calls.push({name:k,args,alpha:o.globalAlpha});for(const a of args)if(typeof a==='number')assert(Number.isFinite(a));};}});
}
globalThis.document={body:{insertBefore(){}},getElementById:()=>null,createElement:()=>{canvasCount++;const ctx=context();return {width:0,height:0,style:{},dataset:{},getContext:()=>ctx};}};
const m=await import(pathToFileURL(out));
const {Entity,Transform,Renderable,Projectile,Velocity,Weapon,WEAPONS,PlayerStats,SkillVisual,BulletFactory,RenderSystem,
 DOODLE_PROJECTILE_TYPES,drawDoodleProjectile,drawDoodleProjectileLine,drawDoodleRulerShot,getDoodleProjectileCacheStats}=m;
assert.deepEqual([...DOODLE_PROJECTILE_TYPES].sort(),WEAPONS.map(w=>w.type).sort(),'all twelve selectable weapons have art');
function actor(config){const e=BulletFactory.create(config,450,350,.7,'#55b8e1','player');if(config.type==='melee'){const r=e.getComponent(Renderable);r.width=100;r.color='transparent';e.getComponent(Projectile).life=5;}return e;}
const snapshot=e=>JSON.stringify([...e.components.values()]);
for(const config of WEAPONS){
 const e=actor(config),before=snapshot(e),c=context();
 assert(drawDoodleProjectile(c,e,'player'),config.type);assert.equal(snapshot(e),before);
 assert.equal(c.calls.filter(x=>x.name==='drawImage').length,1,'one cached blit per projectile');
 assert(!c.calls.some(x=>['beginPath','stroke','fill'].includes(x.name)),'runtime body does not retessellate art');
 assert.equal(c.globalAlpha,.6);assert.equal(c.stack.length,0);
 const made=canvasCount;for(let frame=0;frame<120;frame++)drawDoodleProjectile(context(),e,'player');
 assert.equal(canvasCount,made,`${config.type}: steady state reuses bitmap`);
 assert.equal(drawDoodleProjectile(context(),e,'enemy'),false,'hostile bullets untouched');
 assert.equal(drawDoodleProjectile(context(),e),false,'no player ID is not a match');
 for(const tag of ['magic-pen-projectile','summon_bullet_stickman','summon_bullet_drone']){e.tags.add(tag);assert.equal(drawDoodleProjectile(context(),e,'player'),false);e.tags.delete(tag);}
 e.addComponent(new SkillVisual('pencil_shard'));assert.equal(drawDoodleProjectile(context(),e,'player'),false,'skill provenance wins');
}
const mine=actor(WEAPONS[11]);
for(let i=0;i<16;i++){mine.getComponent(Transform).rotation=i*Math.PI/8;mine.getComponent(Velocity).x=i;const c=context();drawDoodleProjectile(c,mine,'player');assert.deepEqual(c.calls.filter(x=>x.name==='rotate').map(x=>x.args[0]),[0],'ink drop always upright, including awakened attraction');}
const compass=actor(WEAPONS[10]);compass.getComponent(Transform).rotation=2.2;const cc=context();drawDoodleProjectile(cc,compass,'player');assert.equal(cc.calls.find(x=>x.name==='rotate').args[0],2.2,'compass preserves existing spin');
const flame=actor(WEAPONS[9]);drawDoodleProjectile(context(),flame,'player');const stable=canvasCount;
for(let i=0;i<200;i++){flame.getComponent(Renderable).color=`rgba(25,140,220,${i/200})`;drawDoodleProjectile(context(),flame,'player');}
assert.equal(canvasCount,stable,'per-frame flame color opacity cannot grow stamp cache');
const faded=context();flame.getComponent(Renderable).color='rgba(25,140,220,0.25)';drawDoodleProjectile(faded,flame,'player');assert.equal(faded.calls.find(x=>x.name==='drawImage').alpha,.15,'flame alpha preserved');
const beam=actor(WEAPONS[8]),br=beam.getComponent(Renderable);br.shape='line';br.width=950;br.height=450;
const beamBefore=snapshot(beam),bc=context();assert(drawDoodleProjectileLine(bc,beam,'player'));assert.equal(snapshot(beam),beamBefore);assert.equal(bc.stack.length,0);assert.equal(drawDoodleProjectile(context(),beam,'player'),false);
assert.equal(drawDoodleProjectileLine(context(),beam,'hostile'),false);
const player=new Entity();player.tags.add('player');player.addComponent(new Transform(450,350,.7));player.addComponent(new Renderable('#55b8e1',20));player.addComponent(new Weapon(4));player.addComponent(new PlayerStats());
const pose={x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:1,hit:0,shadowScale:1,step:0,moving:0};
for(const awakened of [false,true]){
 player.getComponent(PlayerStats).acquiredSkills=awakened?{mastery_ruler:1}:{};
 const c=context(),before=snapshot(player);assert(drawDoodleRulerShot(c,player,pose));assert.equal(snapshot(player),before);
 assert.equal(c.calls.find(x=>x.name==='drawImage').args[3],(awakened?1000:600)*1.112,'hitscan range mirrors real WeaponSystem');
 assert.equal(c.stack.length,0);assert.equal(drawDoodleRulerShot(context(),player,{...pose,attack:0}),false,'no fake ruler shot without actual attack pulse');
}
player.getComponent(Weapon).currentWeaponIndex=0;
const renderCtx=context(),render=new RenderSystem(renderCtx,{x:0,y:0},2700,1800,()=>true);
player.id='player';render.addEntity(player);
for(const config of WEAPONS){const e=actor(config);if(config.type==='sniper'){e.getComponent(Renderable).shape='line';e.getComponent(Renderable).width=900;e.getComponent(Renderable).height=350;}render.addEntity(e);}
render.update(1/60);assert.equal(renderCtx.stack.length,0,'production integration balances all canvas saves');
assert.equal(renderCtx.globalAlpha,.6,'production caller alpha restored');
// Exercise every pigment/awakening combination; bitmap memory stays bounded.
for(const color of ['#f3d754','#ef9151','#e85564','#ac78dc','#647beb','#55b8e1','#66d3cc','#60b975','#dfdfcc','#303c58','#de7fc3','#ba9970'])for(const config of WEAPONS)for(const awake of [false,true]){
 const e=actor(config);e.getComponent(Renderable).color=color;e.getComponent(Projectile).baseColorRGB=undefined;e.getComponent(Projectile).isAwakened=awake;drawDoodleProjectile(context(),e,'player');
}
const cache=getDoodleProjectileCacheStats();assert(cache.size<=cache.limit);assert.equal(cache.limit,192);
console.log('PASS: all 12 weapon stamps, upright ink-drop mine, spinning compass, sniper ray/ruler pulse, melee visibility, flame fade, hostile/skill exclusions, bounded caching, no gameplay mutation, production alpha/canvas balance.');
