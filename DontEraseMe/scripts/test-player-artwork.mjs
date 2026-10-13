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
export {drawPlayerArtwork} from './src/ui/drawPlayerArtwork';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', loader: { '.png': 'dataurl' }, outfile: out });
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
    Weapon, WEAPONS, WEAPON_FRAMES, getDoodleWeapons, drawDoodleWeapon, drawPlayerArtwork } = await import(pathToFileURL(out));
const player = PlayerFactory.create(1000, 800);
const art = player.getComponent(PlayerArtwork), body = player.getComponent(Renderable);
assert(art); assert.equal(art.displaySize, 64);
const approvedImage = await readFile('src/assets/doodle/heroes-body-v2.png');
assert.equal(art.image.src, `data:image/png;base64,${approvedImage.toString('base64')}`, 'factory uses approved doodle atlas');
assert.equal(body.radius, 20); assert.equal(body.shape, 'circle'); assert.equal(body.width, 40);
assert.equal(PlayerFactory.create(0, 0, 'collector').getComponent(PlayerArtwork).image, art.image, 'reuse texture');
const ids = ['collector', 'graffiti', 'classical', 'sketcher', 'watercolor', 'digital', 'calligrapher', 'ink'];
assert.deepEqual(Object.keys(HERO_FRAMES), ids);
for (const id of ids) {
    const hero = PlayerFactory.create(0, 0, id), heroArt = hero.getComponent(PlayerArtwork);
    assert(heroArt, `${id} has artwork`);
    assert.equal(heroArt.image, art.image, `${id} shares atlas texture`);
    assert.equal(heroArt.displaySize, 64);
    assert(heroArt.articulated, `${id} has separate legs and tools`);
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
console.log('PASS: eight articulated 64px heroes, alternating legs/upright bodies, twelve weapon crops, octant aim/layering, switching, unarmed/vehicle/fallback, collision/alpha/skills and balanced canvas.');
