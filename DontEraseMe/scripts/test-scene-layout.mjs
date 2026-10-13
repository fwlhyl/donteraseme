import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'scene-tests-'));
await build({ entryPoints: ['src/world/SceneLayout.ts', 'src/world/CourtyardScene.ts', 'src/world/CourtyardGeometry.ts', 'src/world/DoodleFloor.ts'],
    bundle: true, platform: 'node', format: 'esm', outdir: dir, outExtension: { '.js': '.mjs' },
    loader: { '.png': 'file' }, assetNames: '[name]-[hash]' });
const { sceneBounds, sceneCameraAxis } = await import(pathToFileURL(join(dir, 'SceneLayout.mjs')));
const { COURTYARD_OUTLINE } = await import(pathToFileURL(join(dir, 'CourtyardGeometry.mjs')));
const { DOODLE_FLOOR } = await import(pathToFileURL(join(dir, 'DoodleFloor.mjs')));
assert.deepEqual(sceneBounds(2700, 1800, 'atelier'), { x: -0, y: -0, width: 2700, height: 1800 });
const bounds = sceneBounds(1800, 1200, 'ruins');
assert.deepEqual(bounds, { x: -450, y: -300, width: 2700, height: 1800 });
// The existing guard board occupies only the clear central 2/3 of the image.
assert.equal((0 - bounds.x) / bounds.width, 1 / 6);
assert.equal((1800 - bounds.x) / bounds.width, 5 / 6);
assert.equal(sceneCameraAxis(0, 1280, 1800, 450), -450);
assert.equal(sceneCameraAxis(1800, 1280, 1800, 450), 970);
assert.equal(sceneCameraAxis(900, 1280, 1800, 450), 260);
assert.equal(sceneCameraAxis(0, 2600, 1800, 450), -400);
assert.equal(sceneCameraAxis(1800, 2600, 1800, 450), -400);
assert.equal(sceneCameraAxis(0, 1280, 2700), -0);
assert.equal(sceneCameraAxis(2700, 1280, 2700), 1420);

// Verify scene routing, DPR and layer separation without browser/game-state hooks.
const draws = [], transforms = [], canvases = [], images = [], fills = [], clips = [], strokes = [], translations = [], scales = [], stack = [], layers = [];
let path = [];
const painting = { id: 'paintingCanvas' };
const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'miter', dash: [], globalAlpha: 1, globalCompositeOperation: 'source-over',
    setTransform: (...args) => transforms.push(args),
    fillRect: (...args) => fills.push({ type: 'rect', args, color: ctx.fillStyle }),
    drawImage: (...args) => { draws.push(args); layers.push('image'); },
    translate: (...args) => translations.push(args),
    scale: (...args) => scales.push(args),
    save() { stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineJoin: this.lineJoin, dash: [...this.dash], globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); },
    restore() { assert(stack.length > 0, 'restore always matches a save'); Object.assign(this, stack.pop()); },
    beginPath() { path = []; },
    rect: (...args) => path.push(['rect', ...args]),
    moveTo: (...args) => path.push(['moveTo', ...args]),
    lineTo: (...args) => path.push(['lineTo', ...args]),
    closePath: () => path.push(['closePath']),
    fill: () => { fills.push({ type: 'path', path: structuredClone(path), color: ctx.fillStyle, alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation }); layers.push(ctx.globalCompositeOperation === 'multiply' ? 'light' : ctx.fillStyle === DOODLE_FLOOR ? 'floor' : 'detail'); },
    stroke: () => strokes.push({ path: structuredClone(path), color: ctx.strokeStyle, width: ctx.lineWidth, dash: [...ctx.dash] }),
    clip: () => clips.push(structuredClone(path)),
    setLineDash(values) { this.dash = [...values]; },
};
globalThis.window = { devicePixelRatio: 2, innerWidth: 1280, innerHeight: 720 };
globalThis.Image = class { complete = true; naturalWidth = 1536; naturalHeight = 1024; src = ''; constructor() { images.push(this); } };
globalThis.document = {
    createElement: () => { const canvas = { style: {}, dataset: {}, getContext: () => ctx }; canvases.push(canvas); return canvas; },
    getElementById: () => painting,
    body: { insertBefore: (canvas, before) => assert.equal(before, painting) }
};
const { CourtyardScene } = await import(pathToFileURL(join(dir, 'CourtyardScene.mjs')));
const scene = new CourtyardScene();
scene.draw({ x: 260, y: 240 }, 1800, 1200, true, 'ruins');
assert.match(draws.at(-1)[0].src, /ruins-v2/);
assert.deepEqual(draws.at(-1).slice(1), [-710, -540, 2700, 1800]);
assert.deepEqual([canvases[0].width, canvases[0].height], [2560, 1440]);
assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0]);
assert.deepEqual(translations.at(-1), [-260, -240], 'floor follows world camera');
const guardFloor = [['rect', 0, 0, 1800, 1200], ['closePath']];
assert.deepEqual(fills.find(fill => fill.type === 'path' && fill.color === DOODLE_FLOOR)?.path, guardFloor, 'guard floor stays inside original gameplay rectangle');
assert.deepEqual(clips.at(-1), guardFloor, 'guard pencil seams clip to the same floor');
assert(!strokes.some(stroke => JSON.stringify(stroke.path) === JSON.stringify(guardFloor)), 'guard floor no longer draws an artificial rectangular outline');
assert.equal(stack.length, 0, 'guard scene and floor restore canvas state');
assert.deepEqual(ctx.dash, [], 'guard edge dash does not leak');
assert.deepEqual(scales.at(-1), [2700 / 1536, 1800 / 1024], 'lights scale from the same source image coordinates');
assert(!layers.includes('light'), 'central guard viewport correctly culls all perimeter lights');
assert(fills.filter(fill => fill.color === DOODLE_FLOOR).every(fill => fill.alpha === 1 && fill.composite === 'source-over'), 'light opacity and blend mode never leak into the playable floor');
assert.equal(ctx.globalAlpha, 1);
assert.equal(ctx.globalCompositeOperation, 'source-over');
assert.equal(canvases[0].dataset.scene, 'ruins');

layers.length = 0;
scene.draw({ x: -450, y: -300 }, 1800, 1200, true, 'ruins');
assert(layers.includes('light'), 'guard edge camera reveals nearby perimeter lights');
assert(layers.lastIndexOf('light') < layers.indexOf('floor'), 'every visible light is below the opaque playable floor');
assert(layers.indexOf('image') < layers.indexOf('light'), 'lights affect only the already rendered scenery image');
assert.equal(stack.length, 0, 'edge light pass restores canvas state');

fills.length = 0; clips.length = 0; strokes.length = 0; layers.length = 0;
scene.draw({ x: 0, y: 0 }, 2700, 1800, true);
assert.match(draws.at(-1)[0].src, /atelier-v1/);
assert.deepEqual(draws.at(-1).slice(1), [-0, -0, 2700, 1800]);
const atelierFloor = COURTYARD_OUTLINE.map(([x, y], i) => [i ? 'lineTo' : 'moveTo', x / 1536 * 2700, y / 1024 * 1800]);
atelierFloor.push(['closePath']);
assert.deepEqual(fills.find(fill => fill.type === 'path' && fill.color === DOODLE_FLOOR)?.path, atelierFloor, 'atelier floor follows real irregular collision outline');
assert.deepEqual(clips.at(-1), atelierFloor, 'atelier texture uses exactly the same polygon');
assert(!strokes.some(stroke => JSON.stringify(stroke.path) === JSON.stringify(atelierFloor)), 'atelier no longer draws a double line across the original scenery');
assert.equal(stack.length, 0, 'atelier scene and floor restore canvas state');
assert(layers.includes('light') && layers.lastIndexOf('light') < layers.indexOf('floor'), 'atelier lights also stay below the collision floor');
assert.equal(canvases[0].dataset.scene, 'atelier');
assert.deepEqual(transforms.at(-1), [2, 0, 0, 2, 0, 0], 'repeated draw resets DPR instead of compounding it');

// Image failures keep the board/floor legible and do not throw drawImage errors.
for (const image of images) image.naturalWidth = 0;
const drawCount = draws.length, fillCount = fills.length, lightCount = layers.filter(layer => layer === 'light').length;
scene.draw({ x: 0, y: 0 }, 2700, 1800, true);
assert.equal(draws.length, drawCount, 'failed image is never drawn');
assert.equal(layers.filter(layer => layer === 'light').length, lightCount, 'failed image never leaves floating light patches');
assert(fills.length > fillCount, 'quiet playable floor remains without image');
assert.equal(stack.length, 0);

const disabledFillCount = fills.length;
scene.draw({ x: 0, y: 0 }, 2700, 1800, false);
assert.equal(canvases[0].style.display, 'none');
assert.equal(fills.length, disabledFillCount, 'disabled scenery does no painting');
assert.equal(canvases.length, 1, 'mode switching reuses a separate scenery canvas');
console.log('PASS: doodle scene routing, unchanged guard/atelier collision polygon, quiet floors without artificial outlines, image fallback, balanced canvas, edge cameras, Retina and reusable scenery layer.');
