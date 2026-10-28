import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'pixel-motion-')), 'motion.mjs');
await build({ stdin: { contents: `
export { DoodleMotion, sampleDoodleMotion, signalDoodleAttack } from './src/art/DoodleMotion';
export { Entity } from './src/core/Entity';
export { Transform } from './src/components/Transform';
export { Health } from './src/components/Health';
export { Weapon } from './src/components/Weapon';
export { PlayerStats } from './src/components/PlayerStats';
export { drawPaperCollector } from './src/art/PaperCollectorArt';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: out });
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { DoodleMotion, sampleDoodleMotion, signalDoodleAttack, Entity, Transform, Health, Weapon, PlayerStats, drawPaperCollector } = await import(pathToFileURL(out));
const sample = (patch = {}) => ({ x: 0, y: 0, hp: 100, attackSerial: 0, kind: 'player', ...patch });
const near = (a, b, reason) => assert(Math.abs(a-b) < 1e-8, reason);
function valid(pose) {
    for (const value of Object.values(pose)) assert(Number.isFinite(value), 'all animation channels remain finite');
    assert.equal(pose.x, 0); assert.equal(pose.angle, 0);
    assert.equal(pose.scaleX, 1); assert.equal(pose.scaleY, 1);
    assert(Math.abs(pose.y) < 1, 'torso movement remains subpixel at the 64px base size');
    assert(pose.gaitPhase >= 0 && pose.gaitPhase < Math.PI*2);
    assert(pose.moving >= 0 && pose.moving <= 1 && Math.abs(pose.step) <= 1);
    assert(pose.idleWeight >= 0 && pose.idleWeight <= 1 && Math.abs(pose.idleBreath) <= 1);
    const direction = Math.hypot(pose.travelX, pose.travelY);
    assert(direction < 1e-9 || Math.abs(direction-1) < 1e-9, 'travel direction is zero or normalized');
}

// Fixed travel/time must look the same across display refresh rates.
const runs = [];
for (const hz of [30, 60, 120, 144]) {
    const motion = new DoodleMotion(2, sample()); let pose;
    for (let frame=1; frame<=hz; frame++) { pose=motion.update(sample({x:180*frame/hz}), 1/hz); valid(pose); }
    runs.push(pose);
}
for (const pose of runs.slice(1)) for (const key of ['time','gaitPhase','moving','step','y','travelX','travelY']) near(pose[key],runs[0][key],`${key} is refresh-rate independent`);

// Aim direction drives a brief turn pose, independent of travel.
const look = new DoodleMotion(0, sample({aim: 0}));
assert.equal(look.update(sample({aim: 0}), 1/60).turnScale, 1);
const flip = look.update(sample({aim: Math.PI}), 1/60);
assert(flip.turnScale < 1 && flip.turnScale >= .88, 'turn has a subtle visible transition');
const middle = look.update(sample({aim: Math.PI}), 1/60);
assert(middle.turnScale > flip.turnScale, 'turn relaxes after changing direction');
for (let i = 0; i < 12; i++) look.update(sample({aim: Math.PI}), 1/60);
assert.equal(look.update(sample({aim: Math.PI}), 1/60).turnScale, 1);

// Stopping settles once; time alone never advances a walk cycle.
const motion = new DoodleMotion(3, sample());
let last;
for (let frame=1; frame<=20; frame++) last=motion.update(sample({x:frame*3}),1/60);
const phase=last.gaitPhase;
let moving=last.moving;
for (let frame=0; frame<30; frame++) {
    const pose=motion.update(sample({x:60}),1/60); valid(pose);
    assert.equal(pose.gaitPhase,phase); assert(pose.moving<=moving); moving=pose.moving;
    last=pose;
}
assert.equal(last.moving,0); assert.equal(last.step,0);
const paused={...last};
assert.deepEqual(motion.update(sample({x:90,attackSerial:1}),0),paused);
assert.deepEqual(motion.update(sample({x:90}),NaN),paused);

// Turns ease the travel direction independently of mouse aim and keep unit length.
const turn=new DoodleMotion(5,sample());
let turning=turn.update(sample({x:3}),1/60); near(turning.travelX,1); near(turning.travelY,0);
turning=turn.update(sample({x:3,y:3}),1/60);valid(turning);
assert(turning.travelX>0 && turning.travelY>0 && turning.travelY<1);
for(let i=2;i<=6;i++)turning=turn.update(sample({x:3,y:i*3}),1/60);
assert(Math.abs(Math.PI/2-Math.atan2(turning.travelY,turning.travelX)) < 2*Math.PI/180,
    '90-degree travel turn is within 2 degrees of target after 100ms');
for(let i=7;i<60;i++)turning=turn.update(sample({x:3,y:i*3}),1/60);
assert(turning.travelY>.999);

// Teleports and frozen samples clear the moving stance; they never become huge steps.
for (const patch of [{x:900},{x:3,y:180,frozen:true},{x:NaN,y:1}]) {
    const pose=turn.update(sample(patch),1/60);valid(pose);
    assert.equal(pose.moving,0);assert.equal(pose.step,0);assert.equal(pose.gaitPhase,0);
    assert.equal(pose.travelX,0);assert.equal(pose.travelY,0);
    if(patch.frozen)assert.equal(pose.idleWeight,0,'frozen pose has no idle motion');
}

// A restrained ready stance is visible at the new 52px size while both feet stay planted.
const idle=new DoodleMotion(0,sample()),idlePoses=[];
for(let i=0;i<240;i++){const pose=idle.update(sample(),1/60);valid(pose);idlePoses.push(pose);}
const low=idlePoses.reduce((a,b)=>a.y<b.y?a:b),high=idlePoses.reduce((a,b)=>a.y>b.y?a:b);
const displayRange=(high.y-low.y)*52/64;
assert(displayRange>1.3 && displayRange<1.5,'idle breathing remains visible but restrained at 52px');
function renderIdle(pose){
    const calls=[],stack=[];let transform={x:0,y:0,sx:1,sy:1};
    const ctx={
        save(){stack.push({...transform});},restore(){transform=stack.pop();},
        scale(x,y){transform.sx*=x;transform.sy*=y;},
        translate(x,y){transform.x+=x*transform.sx;transform.y+=y*transform.sy;},
        fillRect(x,y,w,h){calls.push({x:transform.x+x*transform.sx,y:transform.y+y*transform.sy,w:w*transform.sx,h:h*transform.sy});},
    };
    drawPaperCollector(ctx,{},52,false,0,pose,null);
    assert.equal(stack.length,0);return calls;
}
const renderedLow=renderIdle(low),renderedHigh=renderIdle(high);
const feet=calls=>calls.filter(call=>call.y>=52/64*24);
assert.deepEqual(feet(renderedLow),feet(renderedHigh),'rendered boots do not slide or lift during idle');
assert.notDeepEqual(renderedLow,renderedHigh,'the displayed idle actually changes raster geometry');
const headRange=Math.min(...renderedHigh.map(c=>c.y))-Math.min(...renderedLow.map(c=>c.y));
assert(headRange>1 && headRange<2.5,'head settling stays within a small two-pixel display range');
const busy=new DoodleMotion(0,sample());
for(let i=0;i<40;i++)busy.update(sample(),1/60);
assert.equal(busy.update(sample({attackSerial:1}),1/60).idleWeight,0,'shot immediately focuses the ready stance');
assert.equal(busy.update(sample({reloading:true,reloadProgress:0}),1/60).idleWeight,0,'reload start suppresses idle before timer advances');
assert.equal(busy.update(sample({reloading:true,reloadProgress:.5}),1/60).idleWeight,0,'reload stays free of idle gestures');
let running;
for(let i=1;i<61;i++)running=busy.update(sample({x:i*3,attackSerial:1}),1/60);
assert(running.idleWeight<.004,'walking fades quiet gestures out');

// Attack and hurt signals still respond exactly once, including events held while paused.
const events=new DoodleMotion(6,sample());
const before=events.update(sample(),1/60);
events.update(sample({hp:70,attackSerial:1}),0);
const eventPose=events.update(sample({hp:70,attackSerial:1}),1/60);
assert.equal(eventPose.hit,1);assert.equal(eventPose.attack,1);valid(eventPose);
let settled;
for(let i=0;i<30;i++)settled=events.update(sample({hp:70,attackSerial:1}),1/60);
assert.equal(settled.hit,0);assert.equal(settled.attack,0);
assert.equal(before.attack,0,'returned previous poses remain immutable');

// Reload channels use gameplay timing, including reduced reload duration and HP-based upgrades.
const entity=new Entity();entity.tags.add('player');
entity.addComponent(new Transform(12,15));entity.addComponent(new Health(100,100));
const weapon=entity.addComponent(new Weapon(0)),stats=entity.addComponent(new PlayerStats());
weapon.reloading=true;weapon.reloadTimeMul=.8;stats.reloadSpeedMultiplier=1.5;
const cache=new WeakMap();
for(const acquired of [false,true]) {
    stats.acquiredSkills=acquired?{awakening_sketcher_2:1}:{};stats.currentHp=50;
    const frames=Math.max(1,Math.floor(weapon.config.reloadTime*weapon.reloadTimeMul/stats.totalReloadMultiplier));
    for(const progress of [0,.25,.5,.75,1]) {
        weapon.reloadTimer=frames*(1-progress);
        const original=JSON.stringify([...entity.components.values()]);
        const pose=sampleDoodleMotion(entity,1/60,cache);valid(pose);
        near(pose.reloadProgress,progress,'reload animation matches upgraded gameplay duration');
        assert.equal(JSON.stringify([...entity.components.values()]),original,'animation never writes gameplay components');
    }
}
weapon.reloading=false;weapon.reloadTimer=0;
assert.equal(sampleDoodleMotion(entity,1/60,cache).reloadProgress,0);
signalDoodleAttack(entity);assert.equal(sampleDoodleMotion(entity,1/60,cache).attack,1);
const malformed=new DoodleMotion(7);
assert.equal(malformed.update(sample({reloadProgress:Infinity}),1/60).reloadProgress,0);
assert.equal(malformed.update(sample({reloadProgress:2}),1/60).reloadProgress,1);

console.log('PASS: pixel motion refresh-rate consistency, fast directional turns, visible 52px idle with planted feet, busy-state idle suppression, stop/freeze/teleport handling, upright torso, attack/hit continuity, upgraded reload timing and unchanged gameplay components.');
