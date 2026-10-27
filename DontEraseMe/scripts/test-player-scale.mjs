import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out=join(await mkdtemp(join(tmpdir(),'player-scale-')),'test.mjs');
await build({stdin:{contents:`
export {PlayerFactory} from './src/entities/PlayerFactory';
export {PLAYER_PRESENTATION} from './src/config/PlayerPresentation';
export {PlayerArtwork} from './src/components/PlayerArtwork';
export {CollisionSystem} from './src/systems/CollisionSystem';
export {courtyardRadius} from './src/systems/CourtyardBoundarySystem';
export {Entity} from './src/core/Entity';
export {Renderable} from './src/components/Renderable';
export {Transform} from './src/components/Transform';
export {Health} from './src/components/Health';
export {Projectile} from './src/components/Projectile';
export {PlayerControl} from './src/components/PlayerControl';
export {PlayerStats} from './src/components/PlayerStats';
export {EnemyBehavior} from './src/components/EnemyBehavior';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:out});
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window=new EventTarget();globalThis.Image=class{set src(_){};};
const m=await import(pathToFileURL(out));
const reference=m.PlayerFactory.create(0,0,'collector',0);
const art=reference.getComponent(m.PlayerArtwork),render=reference.getComponent(m.Renderable);
assert.equal(render.radius,16.25);assert.equal(art.displaySize,52);assert.equal(art.baseRadius,render.radius);
assert.equal(render.width,32.5);assert.equal(m.courtyardRadius(reference),16.25);
assert.equal(art.displaySize/art.baseRadius,64/20,'same visual-to-hitbox ratio as approved previous size');
function contact(distance,bullet=false,scale=1){
 const system=new m.CollisionSystem(),player=new m.Entity();player.tags.add('player');
 player.addComponent(new m.Transform(0,0));player.addComponent(new m.Renderable('#222',m.PLAYER_PRESENTATION.hitRadius*scale));
 player.addComponent(new m.PlayerControl());player.addComponent(new m.PlayerStats());const hp=player.addComponent(new m.Health(100,100));
 const other=new m.Entity();other.addComponent(new m.Transform(distance,0));
 other.addComponent(new m.Renderable('#888',bullet?5:15));
 if(bullet)other.addComponent(new m.Projectile('standard',50,'hostile',60));
 else{other.tags.add('enemy');other.addComponent(new m.Health(100,100));other.addComponent(new m.EnemyBehavior('chaser'));}
 system.addEntity(player);system.addEntity(other);system.update(1/60);return hp.current;
}
assert.equal(contact(33),100,'old oversized enemy-contact reach no longer hits');
assert.equal(contact(31),50,'true overlap with the smaller body still damages');
assert.equal(contact(23,true),100,'hostile bullets use the smaller player radius');
assert.equal(contact(20,true),50,'hostile bullets still damage at real contact');
assert.equal(contact(38,false,1.5),50,'body-size upgrades continue to scale collisions');
assert.equal(art.displaySize*(render.radius*1.5)/art.baseRadius,78,'body-size upgrades also scale artwork');
console.log('PASS: 52px appearance, proportional 16.25px collision/wall radius, enemy contact, hostile projectile contact and body-size upgrades.');
