import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out=join(await mkdtemp(join(tmpdir(),'doodle-skills-')),'test.mjs');
await build({stdin:{contents:`
export * from './src/art/DoodleSkillArt';
export * from './src/art/DoodleSkillEffects';
export {Entity} from './src/core/Entity';
export {RenderSystem} from './src/systems/RenderSystem';
export {SummonSystem} from './src/systems/SummonSystem';
export {PlayerFactory} from './src/entities/PlayerFactory';
export {Summon} from './src/components/Summon';
export {PlayerStats} from './src/components/PlayerStats';
export {Skill} from './src/components/Skill';
export {SkillVisual} from './src/components/SkillVisual';
export {Transform} from './src/components/Transform';
export {Velocity} from './src/components/Velocity';
export {Renderable} from './src/components/Renderable';
export {EnemyBehavior} from './src/components/EnemyBehavior';
export {MagicManifestation} from './src/components/MagicManifestation';
export {PlayerArtwork} from './src/components/PlayerArtwork';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',loader:{'.png':'dataurl'},outfile:out});
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.Image=class{complete=true;naturalWidth=1536;naturalHeight=1024;};
globalThis.window={addEventListener(){},dispatchEvent(){},innerWidth:1000,innerHeight:700,devicePixelRatio:1};
function context(){
 const calls=[],stack=[],s={calls,stack,globalAlpha:.6,shadowBlur:0,strokeStyle:'',fillStyle:'',matrix:[1,0,0,1,0,0],canvas:{clientWidth:1000,clientHeight:700}};
 const mul=n=>{const[a,b,c,d,e,f]=s.matrix,[u,v,w,x,y,z]=n;s.matrix=[a*u+c*v,b*u+d*v,a*w+c*x,b*w+d*x,a*y+c*z+e,b*y+d*z+f];};
 return new Proxy(s,{get(o,k){if(k in o)return o[k];if(k==='save')return()=>stack.push({globalAlpha:o.globalAlpha,shadowBlur:o.shadowBlur,strokeStyle:o.strokeStyle,fillStyle:o.fillStyle,matrix:[...o.matrix]});if(k==='restore')return()=>{assert(stack.length);Object.assign(o,stack.pop());};return(...args)=>{
   calls.push({name:k,args,alpha:o.globalAlpha,stroke:o.strokeStyle,fill:o.fillStyle,matrix:[...o.matrix]});
   for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),`${String(k)} has finite coordinates`);
   if(k==='translate')mul([1,0,0,1,...args]);if(k==='scale')mul([args[0],0,0,args[1],0,0]);if(k==='rotate'){const c=Math.cos(args[0]),n=Math.sin(args[0]);mul([c,n,-n,c,0,0]);}
 };}});
}
globalThis.document={body:{insertBefore(){}},getElementById:()=>null,createElement:()=>({style:{},dataset:{},getContext:()=>context()})};
const m=await import(pathToFileURL(out));
const {Entity,RenderSystem,SummonSystem,PlayerFactory,Summon,PlayerStats,Skill,SkillVisual,Transform,Velocity,Renderable,EnemyBehavior,MagicManifestation,PlayerArtwork,
 DOODLE_VEHICLE_SCALE,SKILL_FRAMES,getDoodleSkills,drawDoodleSkillSprite,drawDoodleSkillEntity,drawDoodleTurret,drawDoodlePlayerEffects,drawDoodleStatus}=m;
const image=getDoodleSkills(),png=await readFile('src/assets/doodle/skills-v1.png');
assert.equal(image.src,`data:image/png;base64,${png.toString('base64')}`);assert.equal(png[25],6,'RGBA alpha channel');
const callsFor=(ctx,kind)=>ctx.calls.filter(c=>c.name==='drawImage'&&c.args[0]===image&&c.args[1]===SKILL_FRAMES[kind].x&&c.args[2]===SKILL_FRAMES[kind].y);
for(const [kind,f] of Object.entries(SKILL_FRAMES)){
 assert(f.x>=0&&f.y>=0&&f.x+f.width<=1536&&f.y+f.height<=1024);
 const c=context();assert(drawDoodleSkillSprite(c,kind,32,.3));assert.equal(callsFor(c,kind).length,1);
 const d=callsFor(c,kind)[0];assert(Math.abs(Math.max(d.args[7],d.args[8])-32)<1e-9);assert.equal(d.alpha,.6);assert.equal(c.stack.length,0);
}
assert.equal(drawDoodleSkillSprite(context(),'palette',NaN),false);
function actor(kind){const e=new Entity();e.addComponent(new Transform(700,450,1.1));e.addComponent(new Renderable('#fff',20,30,30,'rect'));if(['stickman','palette','scythe','drone'].includes(kind))e.addComponent(new Summon(kind,'owner'));else if(['tank','robot','bomber'].includes(kind))e.getComponent(Renderable).shape=`magic_${kind}`;else e.tags.add(kind);return e;}
for(const kind of ['stickman','palette','scythe','drone','paperclip','ink_dummy','tank','robot','bomber']){
 const e=actor(kind),c=context(),before=JSON.stringify([...e.components.values()]);
 assert(drawDoodleSkillEntity(c,e,2,{step:.8,y:-.5}));assert.equal(callsFor(c,kind).length,1);assert.equal(JSON.stringify([...e.components.values()]),before);assert.equal(c.stack.length,0);
 if(kind==='stickman'){const d=callsFor(c,kind)[0];assert.equal(d.matrix[1],0);assert.equal(d.matrix[2],0,'stickman torso never tilts');}
}
const basic=actor('none');assert.equal(drawDoodleSkillEntity(context(),basic,0),false,'ordinary entity untouched');
image.complete=false;assert.equal(drawDoodleSkillEntity(context(),actor('stickman'),0),false);assert.equal(drawDoodleTurret(context(),0,300),false);image.complete=true;
image.naturalWidth=0;assert.equal(drawDoodleSkillSprite(context(),'palette',20),false);image.naturalWidth=1536;

// Real Magic Pen vehicle bodies remain upright across every aim heading. Aim,
// attack clocks, footprint and hidden pilot stay gameplay-owned and unchanged.
assert.equal(DOODLE_VEHICLE_SCALE,1.4);
const vehicleSpecs=[['tank',58,38,24],['robot',44,56,26],['bomber',70,42,30]];
function vehicleActor([kind,width,height,radius]){
 const e=new Entity();e.tags.add('magic_manifestation');
 e.addComponent(new Transform(700,450,0));
 const r=new Renderable('#60a5fa',radius,width,height,`magic_${kind}`,50);
 // Old squash must never deform the new vehicle art or the loading fallback.
 r.scaleX=1.8;r.scaleY=.45;e.addComponent(r);
 e.addComponent(new MagicManifestation(kind,'pilot','A',1.6,487,17,.3));
 return e;
}
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-9,`${message}: ${actual} != ${expected}`);
const headings=[...Array.from({length:25},(_,i)=>i*Math.PI/12),...Array.from({length:8},(_,i)=>-i*Math.PI/4)];
// cos(angle) probes both sides of the dead zone after facing right/left.
const hysteresis=[0,Math.acos(.08),Math.acos(-.08),Math.PI/2,Math.acos(-.13),Math.acos(.08),Math.PI/2,
 Math.acos(.13),Math.PI,Math.PI*1.5-.08,Math.PI*1.5+.08,Math.PI*1.5,Math.PI*1.5+.13];
for(const spec of vehicleSpecs){
 const [kind,width,height,radius]=spec;
 for(const availability of ['ready','loading','failed-width','failed-height']){
  image.complete=availability!=='loading';image.naturalWidth=availability==='failed-width'?0:1536;image.naturalHeight=availability==='failed-height'?0:1024;
  const e=vehicleActor(spec),t=e.getComponent(Transform),r=e.getComponent(Renderable),c=context();
  const render=new RenderSystem(c,{x:0,y:0},2700,1800,()=>true);render.addEntity(e);
  let facing=1;
  for(const angle of [...headings,...hysteresis]){
   t.rotation=angle;const horizontal=Math.cos(angle);
   if(horizontal>.12)facing=1;else if(horizontal<-.12)facing=-1;
   const before=JSON.stringify([...e.components.values()]);c.calls.length=0;render.update(1/60);
   assert.equal(JSON.stringify([...e.components.values()]),before,`${kind}/${availability}: render never changes aim, dimensions or combat state`);
   assert.deepEqual([r.width,r.height,r.radius],[width,height,radius]);
   const spriteCalls=callsFor(c,kind);
   if(availability==='ready'){
    assert.equal(spriteCalls.length,1);const d=spriteCalls[0],f=SKILL_FRAMES[kind];
    assert.deepEqual(d.matrix,[facing,0,0,1,700,450],`${kind}: upright X-only flip at ${angle}`);
    near(Math.max(d.args[7],d.args[8]),Math.max(width,height)*1.4,`${kind}: enlarged display size`);
    near(d.args[7]/d.args[8],f.width/f.height,`${kind}: original atlas aspect ratio`);
    assert.equal(d.alpha,.6,'vehicle inherits render alpha');
   }else{
    assert.equal(spriteCalls.length,0,'unavailable image uses geometry fallback');
    const body=c.calls.filter(d=>['fillRect','strokeRect','fill','stroke'].includes(d.name)&&d.matrix[4]===700&&d.matrix[5]===450);
    assert(body.length>0,`${kind}: visible fallback body`);
    for(const d of body)assert.deepEqual(d.matrix,[facing*1.4,0,0,1.4,700,450],`${kind}/${availability}: fallback stays upright and enlarged`);
   }
   assert(!c.calls.some(d=>d.name==='rotate'&&Math.abs(d.args[0])>1e-9&&d.matrix[4]===700&&d.matrix[5]===450),'vehicle never rotates the hull');
   assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,.6);assert.deepEqual(c.matrix,[1,0,0,1,0,0]);
  }
 }
}
image.complete=true;image.naturalWidth=1536;image.naturalHeight=1024;
for(const spec of vehicleSpecs){
 const pilot=PlayerFactory.create(700,450,'collector'),e=vehicleActor(spec),c=context();
 pilot.getComponent(Renderable).visible=false;pilot.tags.add('magic_piloting');
 const before=JSON.stringify([...pilot.components.values()]),art=pilot.getComponent(PlayerArtwork);
 const render=new RenderSystem(c,{x:0,y:0},2700,1800,()=>true);render.addEntity(pilot);render.addEntity(e);render.update(0);
 assert.equal(callsFor(c,spec[0]).length,1);assert(!c.calls.some(d=>d.name==='drawImage'&&d.args[0]===art.image),'piloted character remains hidden');
 assert.equal(JSON.stringify([...pilot.components.values()]),before,'render does not restore/change hidden pilot state');
 assert(pilot.tags.has('magic_piloting'));assert.equal(c.stack.length,0);
}

// Eraser-hunting summon drones use their existing legacy +PI/2 aim offset,
// but only the sprite's X facing changes. Bob/rotors animate independently.
function droneActor(){
 const e=new Entity();e.tags.add('summon');e.addComponent(new Transform(700,450,Math.PI/2));
 const r=new Renderable('#00ffff',15,0,0,'triangle');r.scaleX=1.8;r.scaleY=.45;e.addComponent(r);
 e.addComponent(new Summon('drone','pilot',3,1,.7,50,.05,17,40));
 e.addComponent(new Velocity(3,-2,8,.9));return e;
}
for(const availability of ['ready','loading','failed-width','failed-height']){
 image.complete=availability!=='loading';image.naturalWidth=availability==='failed-width'?0:1536;image.naturalHeight=availability==='failed-height'?0:1024;
 const e=droneActor(),t=e.getComponent(Transform),c=context(),render=new RenderSystem(c,{x:0,y:0},2700,1800,()=>true);
 render.addEntity(e);let facing=1,time=0;
 for(const angle of [...headings,...hysteresis]){
  t.rotation=angle+Math.PI/2;const horizontal=Math.cos(angle);
  if(horizontal>.12)facing=1;else if(horizontal<-.12)facing=-1;
  const before=JSON.stringify([...e.components.values()]);c.calls.length=0;render.update(1/60);time+=1/60;
  const bob=-1.2*Math.sin(time*4),sprites=callsFor(c,'drone');
  assert.equal(JSON.stringify([...e.components.values()]),before,`drone/${availability}: aim, summon cooldowns, footprint and velocity unchanged`);
  assert.deepEqual([e.getComponent(Renderable).radius,e.getComponent(Renderable).width,e.getComponent(Renderable).height],[15,0,0]);
  if(availability==='ready'){
   assert.equal(sprites.length,1);const d=sprites[0],f=SKILL_FRAMES.drone;
   assert.deepEqual(d.matrix.slice(0,5),[facing,0,0,1,700],`drone stays upright at aim ${angle}`);
   near(d.matrix[5],450+bob,'drone vertical hover');assert(Math.abs(d.matrix[5]-450)<=1.2+1e-9);
   near(Math.max(d.args[7],d.args[8]),32,'drone remains 32px, not enlarged with piloted vehicles');
   near(d.args[7]/d.args[8],f.width/f.height,'drone keeps atlas aspect');assert.equal(d.alpha,.6);
  }else{
   assert.equal(sprites.length,0);
   const body=c.calls.filter(d=>['fill','stroke','fillRect','strokeRect'].includes(d.name)&&d.matrix[4]===700&&Math.abs(d.matrix[5]-(450+bob))<1e-9);
   assert(body.some(d=>d.name==='fill'||d.name==='fillRect'),'unavailable drone atlas draws visible upright fallback');
   for(const d of body)assert.deepEqual(d.matrix.slice(0,4),[facing,0,0,1],`drone/${availability}: fallback X flip only`);
  }
  const rotor=c.calls.find(d=>d.name==='stroke'&&d.stroke==='#b7e6e5');
  assert(rotor,'rotor animation retained');assert.deepEqual(rotor.matrix.slice(0,5),[facing,0,0,1,700]);near(rotor.matrix[5],450+bob,'rotor follows bob only');
  assert(!c.calls.some(d=>d.name==='rotate'&&Math.abs(d.args[0])>1e-9&&d.matrix[4]===700),'drone never rotates hull or rotors with aim');
  assert.equal(c.stack.length,0);assert.equal(c.globalAlpha,.6);assert.deepEqual(c.matrix,[1,0,0,1,0,0]);
 }
 // Rendering paused frames must freeze both hover and rotor animation.
 c.calls.length=0;render.update(0);const frozen=JSON.stringify(c.calls);
 c.calls.length=0;render.update(0);assert.equal(JSON.stringify(c.calls),frozen);
 if(availability!=='ready')assert(drawDoodleSkillEntity(context(),droneActor(),0),'drone fallback consumes rendering instead of falling through to rotating generic triangle');
}
image.complete=true;image.naturalWidth=1536;image.naturalHeight=1024;
for(const time of [0,Math.PI/8,Math.PI/4,Math.PI*3/8,Math.PI/2]){
 const c=context();assert(drawDoodleSkillEntity(c,droneActor(),time));
 const d=callsFor(c,'drone')[0];near(d.matrix[5],-1.2*Math.sin(time*4),'full hover cycle reaches at most 1.2px');
 assert(Math.abs(d.matrix[5])<=1.2);assert.equal(c.stack.length,0);
}

// Actual SummonSystem factories/levels feeding the production RenderSystem.
for(const level of [1,2,3]){
 const c=context(),render=new RenderSystem(c,{x:0,y:0},2700,1800,()=>true),player=PlayerFactory.create(750,450,'collector');
 const stats=player.getComponent(PlayerStats);Object.assign(stats.acquiredSkills,{summon_stickman:level,summon_palette:level,summon_scythe:level,summon_drone:level,synergy_legion:1});
 const system=new SummonSystem(e=>{system.addEntity(e);render.addEntity(e);});system.addEntity(player);render.addEntity(player);system.update(1/60);
 const objects=[...system.entities].filter(e=>e.hasComponent(Summon)),before=JSON.stringify(objects.map(e=>[...e.components.values()]));
 render.update(1/60);
 const stick=level===1?1:2;
 assert.equal(callsFor(c,'stickman').length,stick);assert.equal(callsFor(c,'drone').length,level===1?1:2);
 assert.equal(callsFor(c,'palette').length,level+1+stick*2);assert.equal(callsFor(c,'scythe').length,1);
 assert.equal(JSON.stringify(objects.map(e=>[...e.components.values()])),before,'all cooldowns/orbits/velocities untouched by render');
 assert.equal(c.stack.length,0);
 // No phantom movement while paused; entities and visual time remain unchanged.
 c.calls.length=0;render.update(0);const frozen=JSON.stringify(c.calls);
 c.calls.length=0;render.update(0);assert.equal(JSON.stringify(c.calls),frozen);
}
// Digital pen: exact gameplay clock/radius, 1/2 pens or stationary turrets, never both.
const oldNow=Date.now;Date.now=()=>3000;
const p=PlayerFactory.create(750,450,'digital'),st=p.getComponent(PlayerStats),c=context(),rr=new RenderSystem(c,{x:0,y:0},2700,1800,()=>true);rr.addEntity(p);
for(const count of [1,2]){st.acquiredSkills.awakening_digital_1=count-1;c.calls.length=0;rr.update(0);assert.equal(callsFor(c,'digital_pen').length,count);assert(c.calls.some(d=>d.name==='translate'&&Math.abs(d.args[0]-(750+Math.cos(10)*40))<1e-9&&Math.abs(d.args[1]-(450+Math.sin(10)*40))<1e-9));}
st.acquiredSkills.awakening_digital_2=1;st.digitalTurrets=[{x:800,y:400,lifeTimer:150,rotation:1.2}];c.calls.length=0;const turrets=JSON.stringify(st.digitalTurrets);rr.update(0);
assert.equal(callsFor(c,'digital_pen').length,0);assert.equal(callsFor(c,'turret').length,1);assert.equal(JSON.stringify(st.digitalTurrets),turrets);
assert(c.calls.some(d=>d.name==='arc'&&d.args[2]===30&&Math.abs(d.args[4]-Math.PI/2)<1e-9));Date.now=oldNow;

// All shield triggers, layer count and fixed eraser radius; overlays inherit blink.
const ps=new PlayerStats(),sk=new Skill(),fx=context();ps.characterId='classical';ps.hasClassicalShield=true;ps.classicalShieldStacks=3;ps.hasOrigamiShield=true;
ps.hasCalligrapherPassive=true;ps.calligrapherDamageStacks=10;ps.explosionCooldownFrames=3600;ps.acquiredSkills.defense_desperate_explosion=1;sk.eraserShieldFrames=120;
const snapshot=JSON.stringify([ps,sk]);drawDoodlePlayerEffects(fx,20,ps,sk,1);
assert.equal(JSON.stringify([ps,sk]),snapshot);assert(fx.calls.some(d=>d.name==='arc'&&d.args[2]===60));
assert.equal(fx.calls.filter(d=>d.name==='stroke'&&d.stroke==='#e7bc59').length,3);
assert(fx.calls.some(d=>d.name==='fillText'&&d.args[0]==='+20%'));assert(fx.calls.filter(d=>d.name==='stroke').every(d=>d.alpha<=.6));assert.equal(fx.stack.length,0);assert.equal(fx.globalAlpha,.6);
const none=context();drawDoodlePlayerEffects(none,20,new PlayerStats(),new Skill(),0);assert(!none.calls.some(d=>['stroke','fill','fillText'].includes(d.name)));
for(const cd of [3540,0]){ps.explosionCooldownFrames=cd;const x=context();drawDoodlePlayerEffects(x,20,ps,sk,1);assert(!x.calls.some(d=>d.stroke==='#ee8072'));}
const eb=new EnemyBehavior('chaser');eb.frozenFrames=10;eb.burnFrames=10;eb.corrosiveStacks=3;eb.blindFrames=10;
const status=context(),old=JSON.stringify(eb);drawDoodleStatus(status,20,eb,1);assert.equal(JSON.stringify(eb),old);assert(status.calls.some(d=>d.stroke==='#a9ddeb'));assert.equal(status.calls.filter(d=>d.name==='fill'&&d.fill==='#a9ca69').length,3);assert.equal(status.stack.length,0);
for(const kind of ['paper_shard','pencil_shard','desperate_burst']){const e=actor('none'),x=context();e.addComponent(new SkillVisual(kind));assert(drawDoodleSkillEntity(x,e,1));assert.equal(x.stack.length,0);}
for(const tag of ['summon_bullet_stickman','summon_bullet_drone','magic-pen-projectile','magic-robot-pulse']){const e=actor('none');e.tags.add(tag);if(tag==='magic-robot-pulse')e.tags.add('magic-pen-projectile');assert(drawDoodleSkillEntity(context(),e,1));}
console.log('PASS: 12 skill frames; real summon factories/levels/legion; digital orbit/dual/turret; upright gait; 3 vehicles upright across 360 degrees, X-only flip hysteresis, 1.4x display and hidden pilots; eraser-hunting drones upright at 32px with independent hover/rotors; loading/failed fallback; shields/statuses/projectiles; no gameplay mutation; alpha, pause and canvas balance.');
