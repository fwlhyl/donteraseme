// Deterministic Canvas command counts, not a browser/GPU or FPS benchmark.
// The unculled reference invokes the same renderer with only its visibility gate disabled.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'render-workload-')), 'test.mjs');
await build({ stdin: { contents: `
export {RenderSystem} from './src/systems/RenderSystem';
export {Entity} from './src/core/Entity';
export {Transform} from './src/components/Transform';
export {Renderable} from './src/components/Renderable';
export {EnemyBehavior} from './src/components/EnemyBehavior';
export {Health} from './src/components/Health';
export {Particle} from './src/components/Particle';
export {ExperienceOrb} from './src/components/ExperienceOrb';
export {Projectile} from './src/components/Projectile';
export {ControlPoint} from './src/components/ControlPoint';
export {SpriteAttachments} from './src/components/SpriteAttachments';
export {SpriteAnimation} from './src/components/SpriteAnimation';
export {SkillVisual} from './src/components/SkillVisual';
export {PlayerStats} from './src/components/PlayerStats';
export {sampleDoodleMotion, signalDoodleAttack} from './src/art/DoodleMotion';
export {getDoodleSkills} from './src/art/DoodleSkillArt';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', loader: { '.png': 'dataurl', '.webp': 'dataurl' }, outfile: out });

globalThis.Image = class { complete = true; naturalWidth = 1536; naturalHeight = 1024; };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {}, innerWidth: 1000, innerHeight: 700, devicePixelRatio: 2 };
const paints = new Set(['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText']);
function context() {
    const calls = [], stack = [];
    const target = { canvas: { clientWidth: 1000, clientHeight: 700, width: 2000, height: 1400 },
        globalAlpha: 1, shadowBlur: 0, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
        globalCompositeOperation: 'source-over', matrix: [1, 0, 0, 1, 0, 0] };
    const multiply = ([a,b,c,d,e,f]) => {
        const [aa,bb,cc,dd,ee,ff] = target.matrix;
        target.matrix = [aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];
    };
    return new Proxy(target, { get(state, key) {
        if (key === 'calls') return calls;
        if (key === 'stack') return stack;
        if (key in state) return state[key];
        if (key === 'save') return () => stack.push({ ...state, matrix: [...state.matrix] });
        if (key === 'restore') return () => { assert(stack.length, 'Canvas restore has a matching save'); Object.assign(state, stack.pop()); };
        if (key === 'translate') return (x,y) => multiply([1,0,0,1,x,y]);
        if (key === 'scale') return (x,y) => multiply([x,0,0,y,0,0]);
        if (key === 'rotate') return angle => multiply([Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]);
        if (key === 'setTransform') return (...args) => { state.matrix = args; };
        return (...args) => {
            if (paints.has(key)) calls.push({ method: key, args, matrix: [...state.matrix], alpha: state.globalAlpha,
                fill: state.fillStyle, stroke: state.strokeStyle, composite: state.globalCompositeOperation });
        };
    } });
}
globalThis.document = { body: { insertBefore() {} }, getElementById: () => null,
    createElement: () => ({ style: {}, dataset: {}, getContext: () => context() }) };
const m = await import(pathToFileURL(out));
const { RenderSystem, Entity, Transform, Renderable, EnemyBehavior, Health, Particle, ExperienceOrb,
    Projectile, ControlPoint, SpriteAttachments, SpriteAnimation, SkillVisual, PlayerStats,
    sampleDoodleMotion, signalDoodleAttack, getDoodleSkills } = m;
const tick = 1 / 60;
const originalNow = Date.now;
Date.now = () => 123450;

function body(kind, x, y, color = '#abcdef') {
    const entity = new Entity();
    entity.addComponent(new Transform(x,y));
    entity.addComponent(new Renderable(color, 10, 0, 0, kind === 'xp' ? 'diamond' : 'circle'));
    if (kind === 'enemy') { entity.tags.add('enemy'); entity.addComponent(new EnemyBehavior('chaser')); entity.addComponent(new Health()); }
    else if (kind === 'particle') entity.addComponent(new Particle());
    else if (kind === 'xp') { entity.tags.add('xp_orb'); entity.addComponent(new ExperienceOrb(1)); }
    return entity;
}
function renderer(entities, unculled = false, camera = { x: 0, y: 0 }) {
    const ctx = context();
    const system = new RenderSystem(ctx, camera, 6000, 4000, () => true);
    // Count entity work only; scene caching is covered by the scene tests.
    system.courtyardScene = { draw() {}, drawForeground() {} };
    if (unculled) system.isOutsideViewport = () => false;
    for (const entity of entities) system.addEntity(entity);
    return { ctx, system, camera };
}
function frame(run) { run.ctx.calls.length = 0; run.system.update(tick); assert.equal(run.ctx.stack.length, 0); return run.ctx.calls; }

try {
    const dense = [], visible = [];
    for (const [kind, count] of [['enemy',240],['particle',120],['xp',160]]) {
        for (let i=0; i<count; i++) {
            const entity = body(kind, i<20 ? 200+i*20 : 2200+i, 350);
            dense.push(entity); if (i<20) visible.push(entity);
        }
    }
    const reference = renderer(dense,true), optimized = renderer(dense), visibleReference = renderer(visible,true);
    const before = [...frame(reference)], after = [...frame(optimized)], expected = [...frame(visibleReference)];
    assert.deepEqual(after,expected,'all retained drawing commands, transforms, alpha and z ordering match the visible reference');
    assert(after.length < before.length * .2,'a mostly off-screen crowd must remove at least 80% of paint calls');
    assert(dense.every(entity=>entity.active),'render visibility never changes active/combat membership');
    console.log('Canvas paint calls for 240 enemies + 120 particles + 160 XP orbs (20 of each visible):',
        { unculled: before.length, culled: after.length, removed: before.length-after.length,
            reduction: `${((1-after.length/before.length)*100).toFixed(1)}%`, note: 'command counts only; not measured FPS' });

    // Edges use CSS pixels even with a 2x backing store; the margin includes status rows and scaled bodies.
    const gate = optimized.system.isOutsideViewport.bind(optimized.system);
    const outside = entity => gate(entity,0,0,1000,700);
    for (const [x,y] of [[-10,350],[1010,350],[500,-10],[500,710]]) assert.equal(outside(body('enemy',x,y)),false);
    assert(outside(body('enemy',1200,350)),'backing-store dimensions must not enlarge the CSS viewport');
    const scaled = body('enemy',1200,350); scaled.getComponent(Renderable).scaleX = -10;
    assert.equal(outside(scaled),false,'mirrored/scaled body can reach the viewport');
    const corroded = body('enemy',-2000,350); corroded.getComponent(EnemyBehavior).corrosiveStacks = 1000;
    assert.equal(outside(corroded),false,'wide corrosion indicator stays visible');
    const special = [];
    for (const type of ['boss','boss_roller','boss_prism','boss_slime','boss_eraser','blackhole']) {
        const entity=body('enemy',5000,350); entity.getComponent(EnemyBehavior).type=type;
        entity.getComponent(Renderable).radius=1500; special.push(entity);
    }
    for (const shape of ['line','wall_line','shockwave','crescent','magic_tank']) {
        const entity=body('particle',5000,350); entity.getComponent(Renderable).shape=shape; special.push(entity);
    }
    for (const component of [new Projectile('standard',10,'enemy'),new ControlPoint(6000),
        new SpriteAttachments(),new SkillVisual('desperate_burst')]) {
        const entity=body('enemy',5000,350); entity.addComponent(component); special.push(entity);
    }
    const noBody=body('enemy',5000,350); noBody.removeComponent(Renderable); noBody.addComponent(new ControlPoint(6000)); special.push(noBody);
    assert(special.every(entity=>!outside(entity)),'unbounded/unknown overlays and entities without a body are retained');
    const animated=body('enemy',5000,350), animation=new SpriteAnimation(new Image(),64,64,4,10);
    animated.addComponent(animation); assert.equal(outside(animated),false);
    frame(renderer([animated])); assert.equal(animation.elapsedFrames,1,'screen culling cannot pause legacy sprite animation');

    // Screen shake moves the true viewport: this body is beyond the padded unshaken edge.
    const shaken=body('particle',1075,350), shaking=renderer([shaken]);
    shaking.system.shakeMag=20; shaking.system.shakeFrames=40;
    const originalRandom=Math.random; Math.random=()=>0;
    try { assert(frame(shaking).length>0,'negative screen shake reveals the padded right edge'); } finally { Math.random=originalRandom; }

    const order = [['#100000',10],['#050001',5],['#000000',0],['#050002',5]].map(([color,z])=>{
        const entity=body('particle',500,350,color); entity.getComponent(Renderable).zIndex=z; return entity;
    });
    const ordered=renderer([order[0],noBody,...order.slice(1)]);
    assert.deepEqual(frame(ordered).filter(call=>call.method==='fill').map(call=>call.fill),
        ['#000000','#050001','#050002','#100000'],'z ordering remains stable even with a non-renderable entity');
    order[0].getComponent(Renderable).zIndex=-1;
    assert.equal(frame(ordered).find(call=>call.method==='fill').fill,'#100000','public zIndex edits apply next frame');

    // Compare every pose field with a renderer which never culls while the same actor travels and takes damage.
    const walker=body('enemy',2000,350), uncropped=renderer([walker],true), cropped=renderer([walker]);
    for(let i=0;i<180;i++) {
        walker.getComponent(Transform).x+=2;
        if(i===4)walker.getComponent(Health).current-=10;
        if(i===9)signalDoodleAttack(walker);
        frame(uncropped); frame(cropped);
        assert.deepEqual(sampleDoodleMotion(walker,0,cropped.system.doodleMotion),
            sampleDoodleMotion(walker,0,uncropped.system.doodleMotion),'off-screen motion consumes each normal frame');
    }
    walker.getComponent(Transform).x=900;
    assert.deepEqual([...frame(cropped)],[...frame(uncropped)],'re-entering view preserves pose, alpha and expired hit/attack pulses');

    // Digital pens must aim at an eligible off-screen enemy despite the shorter draw list.
    const player=body('player',500,350); player.tags.add('player'); player.getComponent(Transform).rotation=1.2;
    const stats=player.addComponent(new PlayerStats()); stats.hasDigitalPassive=true;
    const target=body('enemy',1250,500), all=renderer([player,target],true), filtered=renderer([player,target]);
    const skillDraws=run=>frame(run).filter(call=>call.method==='drawImage'&&call.args[0]===getDoodleSkills());
    assert.deepEqual(skillDraws(filtered),skillDraws(all),'off-screen targets retain the same digital pen aim');
    console.log('PASS: conservative edge/scale/status bounds, large bosses and skill/attachment exemptions, legacy animation, screen shake, stable z order, off-screen motion continuity and digital pen aim.');
} finally { Date.now=originalNow; }
