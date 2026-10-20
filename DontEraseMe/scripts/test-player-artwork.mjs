import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'player-artwork-')), 'test.mjs');
await build({ stdin: { contents: `
export {PlayerFactory} from './src/entities/PlayerFactory';
export {PlayerArtwork} from './src/components/PlayerArtwork';
export {Renderable} from './src/components/Renderable';
export {Health} from './src/components/Health';
export {Skill} from './src/components/Skill';
export {Transform} from './src/components/Transform';
export {RenderSystem} from './src/systems/RenderSystem';
export {HERO_FRAMES} from './src/art/DoodleArt';
export {Weapon,WEAPONS} from './src/components/Weapon';
export {WEAPON_FRAMES,getDoodleWeapons,drawDoodleWeapon} from './src/art/DoodleWeapons';
export {PAPER_COLLECTOR_PARTS,PAPER_COLLECTOR_BODY_CLIP,getPaperCollector} from './src/art/PaperCollectorArt';
export {drawPlayerArtwork} from './src/ui/drawPlayerArtwork';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', loader: { '.png': 'dataurl', '.webp': 'dataurl' }, outfile: out });
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.Image = class { complete = true; naturalWidth = 1536; naturalHeight = 1024; };
globalThis.window = { addEventListener() {}, innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1 };
function context() {
    const calls = [], stack = [];
    const state = { globalAlpha: 1, shadowBlur: 0, matrix: [1,0,0,1,0,0], canvas: { clientWidth: 1000, clientHeight: 700 }, calls, stack };
    function multiply(n) {
        const [a,b,c,d,e,f]=state.matrix, [u,v,w,x,y,z]=n;
        state.matrix=[a*u+c*v,b*u+d*v,a*w+c*x,b*w+d*x,a*y+c*z+e,b*y+d*z+f];
    }
    return new Proxy(state, { get(target, key) {
        if (key in target) return target[key];
        if (key === 'save') return () => stack.push({ globalAlpha: target.globalAlpha, shadowBlur: target.shadowBlur, matrix:[...target.matrix] });
        if (key === 'restore') return () => { assert(stack.length > 0); Object.assign(target, stack.pop()); };
        return (...args) => {
            calls.push({ name: key, args, alpha: target.globalAlpha, shadow: target.shadowBlur, matrix:[...target.matrix] });
            if(key==='translate')multiply([1,0,0,1,...args]);
            if(key==='scale')multiply([args[0],0,0,args[1],0,0]);
            if(key==='rotate'){const c=Math.cos(args[0]),s=Math.sin(args[0]);multiply([c,s,-s,c,0,0]);}
            if(key==='setTransform')target.matrix=[...args];
        };
    } });
}
globalThis.document = { body: { insertBefore() {} }, getElementById: () => null,
    createElement: () => ({ style: {}, dataset: {}, getContext: () => context() }) };
const { PlayerFactory, PlayerArtwork, Renderable, Health, Skill, Transform, RenderSystem, HERO_FRAMES,
    Weapon, WEAPONS, WEAPON_FRAMES, getDoodleWeapons, drawDoodleWeapon, drawPlayerArtwork,
    PAPER_COLLECTOR_PARTS, PAPER_COLLECTOR_BODY_CLIP, getPaperCollector } = await import(pathToFileURL(out));
// Keep the old seven-character renderer under the complete existing regression suite.
const player = PlayerFactory.create(1000, 800, 'graffiti');
const art = player.getComponent(PlayerArtwork), body = player.getComponent(Renderable);
assert(art); assert.equal(art.displaySize, 64);
const approvedImage = await readFile('src/assets/doodle/heroes-body-v2.png');
assert.equal(art.image.src, `data:image/png;base64,${approvedImage.toString('base64')}`, 'factory uses approved doodle atlas');
assert.equal(body.radius, 20); assert.equal(body.shape, 'circle'); assert.equal(body.width, 40);
assert.equal(PlayerFactory.create(0, 0, 'graffiti').getComponent(PlayerArtwork).image, art.image, 'reuse legacy texture');
const ids = ['collector', 'graffiti', 'classical', 'sketcher', 'watercolor', 'digital', 'calligrapher', 'ink'];
assert.deepEqual(Object.keys(HERO_FRAMES), ids);
for (const id of ids.slice(1)) {
    const hero = PlayerFactory.create(0, 0, id), heroArt = hero.getComponent(PlayerArtwork);
    assert(heroArt, `${id} has artwork`);
    assert.equal(heroArt.image, art.image, `${id} shares atlas texture`);
    assert.equal(heroArt.displaySize, 64);
    assert(heroArt.articulated, `${id} has separate legs and tools`);
    assert.equal(heroArt.rig, undefined, `${id} keeps the legacy renderer`);
    assert.deepEqual(heroArt.frame, HERO_FRAMES[id], `${id} uses its own measured atlas bounds`);
    assert.equal(hero.getComponent(Renderable).radius, 20, `${id} collision radius unchanged`);
}
const ctx = context(), system = new RenderSystem(ctx, { x: 0, y: 0 }, 2700, 1800, () => true);
system.addEntity(player);
const render = () => { ctx.calls.length = 0; system.update(1 / 60); return ctx.calls.filter(c => c.name === 'drawImage' && c.args[0] === art.image); };
function assertAtlasDraw(call, frame, size) {
    assert(call, 'one atlas body draw exists');
    assert.equal(call.args.length, 9, 'source cropping uses nine-argument drawImage');
    assert.deepEqual(call.args.slice(1, 5), [frame.x, frame.y, frame.width, frame.height]);
    const scale = size / Math.max(frame.width, frame.height), w = frame.width * scale, h = frame.height * scale;
    const expected = [-w / 2, -h * (frame.pivotY ?? .5), w, h];
    call.args.slice(5).forEach((value, i) => assert(Math.abs(value - expected[i]) < 1e-9, 'atlas keeps aspect ratio and stable pivot'));
    assert(Math.abs(Math.max(w, h) - size) < 1e-9);
}
assertAtlasDraw(render()[0], art.frame, 56);
assert(!ctx.calls.some(c => c.name === 'fillRect'), 'no placeholder barrel over artwork');
player.getComponent(Transform).rotation = Math.PI;
render(); assert(art.facingLeft); assert(ctx.calls.some(c => c.name === 'scale' && c.args[0] < 0));
let torso=ctx.calls.find(c=>c.name==='drawImage'&&c.args[0]===art.image);
assert.deepEqual(torso.matrix.slice(0,4),[-1,0,0,1], 'only body mirror, no tilt to follow weapon aim');
player.getComponent(Transform).rotation = Math.PI / 2;
render(); assert(art.facingLeft, 'vertical aim preserves facing');
player.getComponent(Transform).rotation = 0;
render(); assert(!art.facingLeft);
body.radius = 30; assertAtlasDraw(render()[0], art.frame, 84); body.radius = 20;
const now = Date.now; Date.now = () => 200;
player.getComponent(Health).invincibleFrames = 10;
assert.equal(render()[0].alpha, .5, 'preserve damage blink'); Date.now = now;
player.getComponent(Skill).eraserShieldFrames = 10;
render(); assert(ctx.calls.some(c => c.name === 'arc' && c.args[2] === 60), 'shield still drawn');
const weaponImage=getDoodleWeapons();
const approvedWeapons=await readFile('src/assets/doodle/weapons-v1.png');
assert.equal(weaponImage.src,`data:image/png;base64,${approvedWeapons.toString('base64')}`);
const weaponDraws=()=>ctx.calls.filter(c=>c.name==='drawImage'&&c.args[0]===weaponImage);
body.visible = false; assert.equal(render().length, 0, 'vehicle hides player');
assert.equal(weaponDraws().length,0,'vehicle hides held weapon too');
body.visible = true; assert.equal(render().length, 1, 'dismount restores player');
assert.equal(weaponDraws().length,1,'dismount restores exactly one current tool');
art.image.complete = false; assert.equal(render().length, 0);
assert(ctx.calls.some(c => c.name === 'arc' && c.args[2] === 20), 'loading fallback remains');
art.image.complete = true; art.image.naturalWidth = 0; assert.equal(render().length, 0, 'failed image safely falls back');
art.image.naturalWidth = 1536; assert.equal(render().length, 1);
player.getComponent(Health).invincibleFrames=0;
player.getComponent(Skill).eraserShieldFrames=0;
const weapon=player.getComponent(Weapon);
for (const config of WEAPONS) {
    weapon.currentWeaponIndex=config.id;
    const before=JSON.stringify(weapon);
    render();const draws=weaponDraws();
    assert.equal(draws.length,1,`${config.type}: replace, never stack weapon sprites`);
    const frame=WEAPON_FRAMES[config.type];assert(frame,`${config.type}: has production frame`);
    assert.deepEqual(draws[0].args.slice(1,5),[frame.x,frame.y,frame.width,frame.height]);
    assert(draws[0].args[7]>=32&&draws[0].args[7]<=42,'weapon display length stays compact');
    assert.equal(JSON.stringify(weapon),before,'rendering cannot mutate ammo/cooldown/config');
}
for (const angle of [0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI,5*Math.PI/4,3*Math.PI/2,7*Math.PI/4]) {
    player.getComponent(Transform).rotation=angle;render();
    const draw=weaponDraws()[0], bodyDraw=ctx.calls.find(c=>c.name==='drawImage'&&c.args[0]===art.image);
    assert(Math.abs(draw.matrix[0]-Math.cos(angle))<1e-9);
    assert(Math.abs(draw.matrix[1]-Math.sin(angle))<1e-9,'weapon points along actual aim in all octants');
    const determinant=draw.matrix[0]*draw.matrix[3]-draw.matrix[1]*draw.matrix[2];
    assert.equal(Math.round(determinant),Math.cos(angle)<0?-1:1,'local Y mirror keeps tool upright on left');
    assert.equal(bodyDraw.matrix[1],0);assert.equal(bodyDraw.matrix[2],0,'body never rotates with tool');
    const order=ctx.calls.filter(c=>c.name==='drawImage'&&(c.args[0]===art.image||c.args[0]===weaponImage));
    assert.equal(order[0].args[0],Math.sin(angle)<-.2?weaponImage:art.image,'upward tool goes behind body');
}
body.scaleX=2;body.scaleY=.5;render();
torso=ctx.calls.find(c=>c.name==='drawImage'&&c.args[0]===art.image);
assert.equal(Math.abs(torso.matrix[0]),1);assert.equal(torso.matrix[3],1,'old movement stretch cannot squash player');
body.scaleX=body.scaleY=1;
weapon.currentWeaponIndex=-1;render();assert.equal(weaponDraws().length,0,'unarmed is genuinely empty-handed');
weapon.currentWeaponIndex=1;
weaponImage.complete=false;render();assert.equal(weaponDraws().length,0,'loading weapon does not draw invalid image');
weaponImage.complete=true;weaponImage.naturalWidth=0;render();assert.equal(weaponDraws().length,0,'failed weapon is safe');
weaponImage.naturalWidth=1536;render();assert.equal(weaponDraws().length,1);
const isolated=context(), neutral={x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:0,hit:0,shadowScale:1,step:0,moving:0};
const legPath=(step)=>{
    isolated.calls.length=0;
    drawPlayerArtwork(isolated,art,20,0,{...neutral,step,moving:1},null);
    const bodyCall=isolated.calls.findIndex(c=>c.name==='drawImage');
    return isolated.calls.slice(0,bodyCall).filter(c=>['moveTo','lineTo'].includes(c.name)).map(c=>c.args);
};
const forward=legPath(1),backward=legPath(-1);
assert.equal(forward.length,8,'two independent four-point legs');
assert.notDeepEqual(forward,backward,'foot geometry alternates without moving the torso');
assert(Math.abs(forward[2][0]-backward[2][0]+6.4)<1e-9,'left foot exchanges forward/backward stride');
assert(Math.abs(forward[6][0]-backward[6][0]-6.4)<1e-9,'right foot uses opposite stride');
for(const invalid of [null,undefined,'not-a-weapon']) {
    isolated.calls.length=0;assert.equal(drawDoodleWeapon(isolated,invalid,64,0),false);assert.equal(isolated.calls.length,0);
}
assert.equal(isolated.stack.length,0,'independent draw restores all state');
for (const id of ids.slice(1)) {
    const hero = PlayerFactory.create(1000, 800, id), heroArt = hero.getComponent(PlayerArtwork);
    system.removeEntity(player); system.addEntity(hero);
    const draws = render();
    assert.equal(draws.length, 1, `${id} has exactly one atlas body`);
    assertAtlasDraw(draws[0], heroArt.frame, 56);
    system.removeEntity(hero);
}
assert.equal(ctx.globalAlpha, 1, 'canvas state balanced');
assert.equal(ctx.stack.length, 0, 'all canvas saves are restored');

// Collector trial uses the approved transparent original, not a recolored legacy hero.
const collector = PlayerFactory.create(1000, 800);
const paper = collector.getComponent(PlayerArtwork), paperBody = collector.getComponent(Renderable);
assert.equal(paper.rig, 'paper-collector-v1');
assert.equal(paper.image, getPaperCollector(), 'paper texture is cached');
assert.equal(paper.image, PlayerFactory.create(0, 0, 'collector').getComponent(PlayerArtwork).image);
assert.notEqual(paper.image, art.image, 'collector does not replace the other seven characters');
const paperSource = await readFile('src/assets/characters/collector-paper-v1.webp');
assert.equal(paper.image.src, `data:image/webp;base64,${paperSource.toString('base64')}`);
assert.equal(paper.displaySize, 64); assert.equal(paper.baseRadius, 20);
assert.equal(paperBody.radius, 20); assert.equal(paperBody.shape, 'circle');
assert.deepEqual([paperBody.width, paperBody.height], [40, 40], 'collision dimensions unchanged');
const paperContext = context(), paperSystem = new RenderSystem(paperContext, { x: 0, y: 0 }, 2700, 1800, () => true);
paperSystem.addEntity(collector);
const partCalls = () => paperContext.calls.filter(c => c.name === 'drawImage' && c.args[0] === paper.image);
const callsForPart = name => partCalls().filter(c => {
    const frame = PAPER_COLLECTOR_PARTS[name];
    return c.args.slice(1, 5).every((v, i) => v === [frame.x, frame.y, frame.width, frame.height][i]);
});
const paperRender = () => { paperContext.calls.length = 0; paperSystem.update(1 / 60); return partCalls(); };
paperRender();
for (const part of ['body', 'leftShoe', 'rightShoe']) assert.equal(callsForPart(part).length, 1, `${part} is drawn once`);
assert.equal(callsForPart('hand').length, 2, 'separate empty and gripping hands');
assert.equal(partCalls().length, 5, 'no baked-in second weapon or duplicate body');
assert(paperContext.calls.some(c => c.name === 'clip'), 'body uses a polygon rather than rectangular crop alone');
assert.deepEqual(PAPER_COLLECTOR_BODY_CLIP, [
    [438,202],[966,202],[966,620],[836,659],[836,910],[550,910],[550,714],[438,714],
], 'approved source polygon excludes both detached fists, both shoes and baked brush');
const bodyFrame = PAPER_COLLECTOR_PARTS.body;
const expectedScale = 60 / 796;
let paperTorso = callsForPart('body')[0];
assert(Math.abs(paperTorso.args[7] / bodyFrame.width - expectedScale) < 1e-9);
assert(Math.abs(paperTorso.args[8] / bodyFrame.height - expectedScale) < 1e-9, 'source aspect ratio is unchanged');
assert(Math.abs(paperTorso.args[6] + 30) < 1e-9, 'head starts at -30 in the nominal 64px frame');

for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, -.8, .8]) {
    collector.getComponent(Transform).rotation = angle; paperRender();
    const torso = callsForPart('body')[0];
    assert.equal(torso.matrix[1], 0); assert.equal(torso.matrix[2], 0);
    assert.equal(Math.abs(torso.matrix[0]), 1); assert.equal(torso.matrix[3], 1, 'body stays upright at every aim');
    const calls = paperContext.calls;
    const torsoIndex = calls.indexOf(torso), toolIndex = calls.findIndex(c => c.name === 'drawImage' && c.args[0] === weaponImage);
    assert.equal(toolIndex < torsoIndex, Math.sin(angle) < -.2, 'tool depth stays behind body for upward aim');
}
collector.getComponent(Transform).rotation = Math.PI; paperRender(); assert(paper.facingLeft);
collector.getComponent(Transform).rotation = Math.PI / 2; paperRender(); assert(paper.facingLeft, 'paper rig keeps vertical-facing hysteresis');
collector.getComponent(Transform).rotation = 0; paperRender(); assert(!paper.facingLeft);
const paperWeapon = collector.getComponent(Weapon);
for (const config of WEAPONS) {
    paperWeapon.currentWeaponIndex = config.id;
    const before = JSON.stringify(paperWeapon); paperRender();
    assert.equal(paperContext.calls.filter(c => c.name === 'drawImage' && c.args[0] === weaponImage).length, 1, `${config.type} remains the real equipped weapon`);
    assert.equal(callsForPart('hand').length, 2);
    assert.equal(JSON.stringify(paperWeapon), before, 'cutout cannot alter weapon logic');
}
paperWeapon.currentWeaponIndex = -1; paperRender();
assert.equal(callsForPart('hand').length, 2, 'unarmed has two empty original fists');
assert(!paperContext.calls.some(c => c.name === 'drawImage' && c.args[0] === weaponImage));
paperWeapon.currentWeaponIndex = 0;
Date.now = () => 200; collector.getComponent(Health).invincibleFrames = 10;
assert(paperRender().every(call => call.alpha === .5), 'all five paper parts inherit damage blink');
Date.now = now; collector.getComponent(Health).invincibleFrames = 0;
collector.getComponent(Skill).eraserShieldFrames = 10; paperRender();
assert(paperContext.calls.some(c => c.name === 'arc' && c.args[2] === 60), 'paper hero retains shield');
collector.getComponent(Skill).eraserShieldFrames = 0;
paperBody.visible = false; assert.equal(paperRender().length, 0, 'mount hides every paper part');
assert(!paperContext.calls.some(c => c.name === 'drawImage' && c.args[0] === weaponImage));
paperBody.visible = true; assert.equal(paperRender().length, 5, 'dismount restores complete cutout');
for (const fault of ['loading', 'width', 'height']) {
    paper.image.complete = fault !== 'loading';
    paper.image.naturalWidth = fault === 'width' ? 0 : 1346;
    paper.image.naturalHeight = fault === 'height' ? 0 : 1168;
    assert.equal(paperRender().length, 0, `${fault}: invalid paper image falls back safely`);
}
paper.image.complete = true; paper.image.naturalWidth = 1346; paper.image.naturalHeight = 1168;
paperBody.radius = 30; paperRender();
assert(Math.abs(callsForPart('body')[0].args[7] / bodyFrame.width - expectedScale * 1.5) < 1e-9, 'visual scaling preserves original radius behavior');
paperBody.radius = 20;

function paperStride(step, y = -.6) {
    paperContext.calls.length = 0;
    drawPlayerArtwork(paperContext, paper, 20, 0, { ...neutral, x: 4, angle: .1, scaleX: .8, scaleY: 1.2, step, y, moving: 1 }, paperWeapon);
    return Object.fromEntries(['body', 'leftShoe', 'rightShoe'].map(name => [name, callsForPart(name)[0]]));
}
const paperForward = paperStride(1), paperBackward = paperStride(-1);
assert.deepEqual(paperForward.body.args, paperBackward.body.args, 'body does not move sideways with stride');
assert.deepEqual(paperForward.body.matrix, paperBackward.body.matrix, 'body does not wobble or squash');
assert.deepEqual(paperForward.body.matrix, [1,0,0,1,0,-.6], 'body accepts only the vertical bob');
assert(Math.abs(paperForward.leftShoe.args[5] - paperBackward.leftShoe.args[5] + 5.4) < 1e-9);
assert(Math.abs(paperForward.rightShoe.args[5] - paperBackward.rightShoe.args[5] - 5.4) < 1e-9);
assert(Math.abs(paperForward.leftShoe.args[6] - paperBackward.leftShoe.args[6] - 1.8) < 1e-9);
assert(Math.abs(paperForward.rightShoe.args[6] - paperBackward.rightShoe.args[6] + 1.8) < 1e-9);
assert.deepEqual(paperForward.leftShoe.matrix, [1,0,0,1,0,0], 'feet stay floor-anchored, not torso-anchored');
assert(!paperContext.calls.some(c => c.name === 'stroke'), 'detached rig draws no stick arms/legs or replacement hand circles');
assert.equal(paperContext.stack.length, 0); assert.equal(paperContext.globalAlpha, 1);
console.log('PASS: approved detached collector with isolated original parts, upright body/alternating shoes, seven unchanged heroes, twelve equipped tools, collision, alpha, skills, mount/fallback and balanced canvas.');
