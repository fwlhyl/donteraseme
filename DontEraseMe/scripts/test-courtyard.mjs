import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out=join(await mkdtemp(join(tmpdir(),'courtyard-tests-')),'geometry.mjs');
await build({entryPoints:['src/world/CourtyardGeometry.ts'],bundle:true,platform:'node',format:'esm',outfile:out});
const {courtyard:g,CourtyardGeometry,CourtyardNavigation}=await import(pathToFileURL(out));
assert(g.fits(g.center,150),'central drawing space accepts large bosses');
assert(!g.fits({x:100,y:100},10),'building corner is solid');
let checked=0;
for(const radius of [10,24,60,114]) {
    for(let x=-100;x<=2800;x+=97) for(let y=-100;y<=1900;y+=103) {
        const p=g.project({x,y},radius);
        assert(g.fits(p,radius),`recovery ${x},${y} radius ${radius}`);checked++;
    }
    for(const edge of g.points) {
        let p=g.project(edge,radius);
        const before={...p};
        // Repeated attempts into the building, including a fast dash.
        for(let n=0;n<12;n++) {
            p=g.move(p,{x:p.x+(edge.x-before.x)*2,y:p.y+(edge.y-before.y)*2},radius);
            assert(g.fits(p,radius),'movement cannot enter a building');checked++;
        }
        p=g.move(g.center,{x:edge.x*1.5-g.center.x*.5,y:edge.y*1.5-g.center.y*.5},radius);
        assert(g.fits(p,radius),'long dash remains inside walkable polygon');
    }
}

// New artwork has a broadly convex arena. Check that real perimeter spawn
// recovery and the direct routes into the center remain valid for each size.
for(const radius of [18,60,114]) {
    const nav=new CourtyardNavigation(g);
    for(let i=0;i<48;i++) {
        const angle=i*Math.PI*2/48;
        const spawn=g.project({x:g.center.x+1300*Math.cos(angle),y:g.center.y+1000*Math.sin(angle)},radius);
        assert(g.fits(spawn,radius),`perimeter spawn radius ${radius}, angle ${i}`);
        assert(g.segmentClear(spawn,g.center,radius),`perimeter route radius ${radius}, angle ${i}`);
        assert(g.fits(nav.waypoint(spawn,g.center,radius),radius),`navigation waypoint radius ${radius}, angle ${i}`);
    }
}

// Retain obstacle-routing coverage in a synthetic concave arena; the new
// scene no longer has the old artwork's recessed corners.
const concave=new CourtyardGeometry(1800,1200);
concave.points.splice(0,concave.points.length,...[
    [250,200],[700,200],[700,550],[1100,550],
    [1100,200],[1550,200],[1550,1000],[250,1000]
].map(([x,y])=>({x,y})));
const nav=new CourtyardNavigation(concave);
let routed=0;
for(const radius of [18,60,114]) {
    const samples=concave.points.map(p=>concave.project(p,radius+3));
    let count=0;
    for(let i=0;i<samples.length&&count<4;i++) for(let j=i+1;j<samples.length&&count<4;j++) {
        const goal=samples[j];let p=samples[i];
        if(concave.segmentClear(p,goal,radius))continue;
        for(let step=0;step<900&&Math.hypot(goal.x-p.x,goal.y-p.y)>8;step++) {
            const target=concave.segmentClear(p,goal,radius)?goal:nav.waypoint(p,goal,radius);
            const dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy);
            p=concave.move(p,{x:p.x+dx/Math.max(1,len)*Math.min(8,len),y:p.y+dy/Math.max(1,len)*Math.min(8,len)},radius);
            assert(concave.fits(p,radius),'route stays outside architecture');
        }
        assert(Math.hypot(goal.x-p.x,goal.y-p.y)<=8,`route stuck radius ${radius}, ${i}->${j}: ${JSON.stringify(p)}`);
        count++;routed++;
    }
    assert(count>0,'concave route cases were exercised');
}
console.log(`PASS: ${checked} projection / collision checks; 144 new-arena perimeter routes; ${routed} synthetic concave routes including bosses.`);

const systemsOut=join(await mkdtemp(join(tmpdir(),'courtyard-systems-')),'systems.mjs');
await build({stdin:{contents:`
export {CourtyardBoundarySystem,courtyardRadius} from './src/systems/CourtyardBoundarySystem';
export {MovementSystem} from './src/systems/MovementSystem';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Velocity} from './src/components/Velocity';
export {Renderable} from './src/components/Renderable';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:systemsOut});
// i18n reads the language at module initialization; use isolated in-memory
// storage in this Node test, never the user's browser profile.
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const {CourtyardBoundarySystem,MovementSystem,Entity,Transform,Velocity,Renderable,courtyardRadius}=await import(pathToFileURL(systemsOut));
let enabled=true;
const bounds=new CourtyardBoundarySystem(()=>enabled);
const actor=(tag,x,y,radius,shape='circle')=>{
    const e=new Entity();e.tags.add(tag);e.addComponent(new Transform(x,y));
    e.addComponent(new Velocity(0,0));e.addComponent(new Renderable('#fff',radius,radius*2,radius*2,shape));return e;
};
const p=actor('player',100,100,18),boss=actor('enemy',2700,0,80,'rect');
bounds.addEntity(p);bounds.addEntity(boss);
for(const e of [p,boss])assert(g.fits(e.getComponent(Transform),courtyardRadius(e)),'new actors spawn outside architecture');
const move=new MovementSystem(g.width,g.height,undefined,undefined,undefined,()=>enabled);
move.addEntity(p);
p.getComponent(Velocity).x=-100;p.getComponent(Velocity).y=-80;
for(let i=0;i<60;i++) {move.update(1/60);assert(g.fits(p.getComponent(Transform),18),'actual MovementSystem blocks fast movement');}
Object.assign(p.getComponent(Transform),{x:0,y:0});bounds.update(0);
assert(g.fits(p.getComponent(Transform),18),'post-knockback boundary recovery');
enabled=false;
const guardEnemy=actor('enemy',0,0,20);bounds.addEntity(guardEnemy);bounds.update(0);
assert.equal(guardEnemy.getComponent(Transform).x,0,'guard mode ignores courtyard boundaries');
console.log('PASS: real spawn hooks, fast MovementSystem motion, late displacement recovery and guard-mode isolation.');
