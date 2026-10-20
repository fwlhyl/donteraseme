import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const out=join(await mkdtemp(join(tmpdir(),'floor-cache-')),'floor.mjs');
await build({entryPoints:['src/world/DoodleFloor.ts'],bundle:true,platform:'node',format:'esm',outfile:out,loader:{'.webp':'file'}});
const {drawBlendedDoodleFloor,isDoodleFloorTextureReady}=await import(pathToFileURL(out));
const canvases=[];
const images=[];
globalThis.Image=class {complete=false;naturalWidth=0;src='';constructor(){images.push(this);}};
function context() {
 const calls=[],stack=[];
 const ctx={calls,filter:'none',globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'',strokeStyle:'',lineWidth:1,lineJoin:'miter',
 save(){stack.push({filter:this.filter,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineJoin:this.lineJoin});},
 restore(){assert(stack.length);Object.assign(this,stack.pop());},scale(...args){calls.push(['scale',...args]);},
 beginPath(){calls.push(['begin']);},moveTo(...args){calls.push(['move',...args]);},lineTo(...args){calls.push(['line',...args]);},
 rect(...args){calls.push(['rect',...args]);},closePath(){},clip(){calls.push(['clip']);},
 fill(){calls.push(['fill',this.globalCompositeOperation,this.fillStyle]);},
 stroke(){calls.push(['stroke',this.globalCompositeOperation,this.filter,this.lineWidth]);},
 drawImage(...args){calls.push(['image',...args]);}};
 return ctx;
}
globalThis.document={createElement(){const canvas={width:0,height:0,ctx:context(),getContext(){return this.ctx;}};canvases.push(canvas);return canvas;}};
const target=context();
for(let frame=0;frame<120;frame++)drawBlendedDoodleFloor(target,2700,1800,'atelier');
assert.equal(canvases.length,1,'120 frames build only one static floor');
assert.equal(target.calls.filter(c=>c[0]==='image').length,120,'each frame is only a cached image draw');
assert.equal(target.calls.filter(c=>c[0]==='stroke'||c[0]==='fill').length,0,'no per-frame vector construction or blur on visible canvas');
assert.deepEqual([canvases[0].width,canvases[0].height],[1536,1024]);
assert.deepEqual(target.calls[0].slice(2),[0,0,2700,1800],'floor stays in world coordinates');
assert(canvases[0].ctx.calls.some(c=>c[0]==='stroke'&&c[1]==='destination-out'&&c[2]==='blur(10px)'&&c[3]===66),'feather erases only border opacity, no global glow');
assert.equal(canvases[0].ctx.globalCompositeOperation,'source-over');
assert.equal(canvases[0].ctx.filter,'none');
drawBlendedDoodleFloor(target,1800,1200,'ruins');
assert.equal(canvases.length,2,'mode-specific floor cached separately');
assert(canvases[1].ctx.calls.some(c=>c[0]==='rect'&&c[3]===1800&&c[4]===1200),'guard collision rectangle is unchanged');
drawBlendedDoodleFloor(target,2700,1800,'atelier');assert.equal(canvases.length,2,'returning to mode reuses cached floor');
assert.equal(images.length,1,'floor texture is loaded once across modes');
assert.match(images[0].src,/floor-clarity-v1.*\.webp$/,'the approved clarity floor is loaded');
assert.equal(isDoodleFloorTextureReady(),false,'unfinished texture retains the quiet fallback');
images[0].complete=true;images[0].naturalWidth=1536;
for(let frame=0;frame<120;frame++)drawBlendedDoodleFloor(target,2700,1800,'atelier');
assert.equal(canvases.length,3,'late texture readiness rebuilds one floor, not each frame');
const textureDraws=canvases[2].ctx.calls.filter(c=>c[0]==='image'&&c[1]===images[0]);
assert.equal(textureDraws.length,1,'paper grain is drawn only once into the static floor cache');
assert.deepEqual(textureDraws[0].slice(2),[0,0,2700,1800],'texture and floor share exact world alignment');
assert.equal(canvases[2].ctx.globalAlpha,1,'texture opacity restores before edge blending');
const fallback=context();delete fallback.filter;
drawBlendedDoodleFloor(fallback,2700,1800,'atelier');
assert.equal(canvases.length,3,'no-filter Canvas has a safe direct-draw fallback');
assert(fallback.calls.some(c=>c[0]==='fill'),'fallback is not blank');
assert(fallback.calls.some(c=>c[0]==='image'&&c[1]===images[0]),'no-filter Canvas still draws loaded paper texture');
console.log('PASS: feathered world-aligned paper floor, mode cache reuse, delayed texture invalidation, 120 frames with one-time blur/texture, restored state and legacy Canvas fallback.');
