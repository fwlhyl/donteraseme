// Isolated command/state differential test. Real Canvas pixels are additionally
// covered by art-drafts/recording-performance-review.html in a browser.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = join(await mkdtemp(join(tmpdir(), 'stroke-batch-tests-')), 'log.mjs');
await build({ entryPoints: ['src/core/StrokeLog.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out });
const { StrokeLog } = await import(pathToFileURL(out));
const identity = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const multiply = (l, r) => ({
    a: l.a * r.a + l.c * r.b, b: l.b * r.a + l.d * r.b,
    c: l.a * r.c + l.c * r.d, d: l.b * r.c + l.d * r.d,
    e: l.a * r.e + l.c * r.f + l.e, f: l.b * r.e + l.d * r.f + l.f,
});
const copy = value => structuredClone(value);
const defaults = () => ({
    fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1, globalCompositeOperation: 'source-over',
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDashOffset: 0, filter: 'none', font: '10px sans-serif', imageSmoothingEnabled: true,
});
const styleNames = Object.keys(defaults());

class FakePath {
    commands = [];
    moveTo(...args) { this.commands.push(['moveTo', ...args]); }
    lineTo(...args) { this.commands.push(['lineTo', ...args]); }
    closePath() { this.commands.push(['closePath']); }
}
globalThis.Path2D = FakePath;

class FakeContext {
    matrix = identity(); dash = []; clips = []; path = []; stack = []; paints = [];
    counts = { getTransform: 0, save: 0, restore: 0, clip: 0 };
    constructor() { Object.assign(this, defaults()); }
    state() { return { styles: Object.fromEntries(styleNames.map(key => [key, this[key]])), matrix: copy(this.matrix), dash: [...this.dash], clips: copy(this.clips) }; }
    save() { this.counts.save++; this.stack.push(this.state()); }
    restore() {
        this.counts.restore++;
        const state = this.stack.pop(); if (!state) return;
        Object.assign(this, state.styles); this.matrix = state.matrix; this.dash = state.dash; this.clips = state.clips;
    }
    getTransform() { this.counts.getTransform++; return { ...this.matrix }; }
    setTransform(...values) {
        const [a, b, c, d, e, f] = values;
        this.matrix = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f };
    }
    resetTransform() { this.matrix = identity(); }
    transform(a, b, c, d, e, f) { this.matrix = multiply(this.matrix, { a, b, c, d, e, f }); }
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
    scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
    rotate(angle) { const c = Math.cos(angle), s = Math.sin(angle); this.transform(c, s, -s, c, 0, 0); }
    getLineDash() { return [...this.dash]; }
    setLineDash(dash) { this.dash = dash.length % 2 ? [...dash, ...dash] : [...dash]; }
    beginPath() { this.path = []; }
    clip(path) { this.counts.clip++; this.clips.push({ path: copy(path?.commands ?? this.path), matrix: copy(this.matrix) }); }
    paint(name, args) { this.paints.push({ name, args, state: this.state(), path: name === 'fill' || name === 'stroke' ? copy(this.path) : [] }); }
    fill(...args) { this.paint('fill', args); }
    stroke(...args) { this.paint('stroke', args); }
    fillRect(...args) { this.paint('fillRect', args); }
    strokeRect(...args) { this.paint('strokeRect', args); }
    clearRect(...args) { this.paint('clearRect', args); }
    drawImage(...args) { this.paint('drawImage', args); }
    fillText(...args) { this.paint('fillText', args); }
    strokeText(...args) { this.paint('strokeText', args); }
    reset() { Object.assign(this, defaults()); this.matrix = identity(); this.dash = []; this.clips = []; this.stack = []; this.path = []; }
}
for (const name of ['moveTo', 'lineTo', 'arc', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'rect', 'closePath', 'arcTo', 'roundRect']) {
    FakeContext.prototype[name] = function (...args) { this.path.push({ name, args, matrix: copy(this.matrix) }); };
}
const boundary = [{ x: 15, y: 10 }, { x: 260, y: 24 }, { x: 290, y: 160 }, { x: 80, y: 190 }];
const packed = log => Array.from({ length: log.numberCount }, (_, i) => log.valueAt(i));
const pair = (clip = boundary, budget) => {
    const log = new StrokeLog(budget), native = new FakeContext(), ctx = log.wrapContext(native);
    log.start(320, 200, clip); return { log, native, ctx };
};
function brush(ctx, frame) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.00083)';
    ctx.fillRect(0, 0, 320, 200); ctx.restore();
    ctx.strokeStyle = '#abcdef'; ctx.fillStyle = '#dd5533'; ctx.lineWidth = 4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'bevel'; ctx.lineDashOffset = frame / 4;
    ctx.setLineDash([3, 5, 2]);
    ctx.beginPath(); ctx.moveTo(4, 5); ctx.lineTo(17, 28);
    ctx.save(); ctx.translate(frame % 9, 14); ctx.rotate(.2); ctx.scale(1.2, .8);
    ctx.quadraticCurveTo(10, 8, 30, 22); ctx.bezierCurveTo(10, 20, 30, 50, 22, 10);
    ctx.save(); ctx.transform(1, .1, -.2, 1, 8, 3); ctx.arc(12, 15, 5, 0, 3, true); ctx.restore();
    ctx.arcTo(3, 6, 18, 20, 5); ctx.stroke(); ctx.restore();
    ctx.ellipse(25, 30, 4, 9, .3, 0, 5, true); ctx.rect(8, 9, 20, 21); ctx.closePath(); ctx.fill('evenodd');
    ctx.strokeRect(10, 20, 40, 50);
    // Persistent changes must survive the batch's private outer save/restore.
    ctx.translate(2, 3); ctx.globalAlpha = .6; ctx.font = '18px serif'; ctx.imageSmoothingEnabled = false;
    ctx.setLineDash([9, 2]); ctx.lineDashOffset = 1;
    ctx.save(); ctx.fillStyle = '#112233'; ctx.lineWidth = 99; ctx.setLineDash([1]); ctx.restore();
}
for (const clip of [boundary, null]) {
    const normal = pair(clip), batched = pair(clip);
    // Native manipulation between scopes must never leave the cached matrix stale.
    normal.native.translate(2, 7); batched.native.translate(2, 7);
    for (let frame = 0; frame < 12; frame++) {
        normal.log.advance(1 / 60); batched.log.advance(1 / 60);
        brush(normal.ctx, frame);
        batched.log.withPaintBoundary(batched.ctx, () => {
            batched.log.withPaintBoundary(batched.ctx, () => brush(batched.ctx, frame));
        });
        assert.deepEqual(batched.native.state(), normal.native.state(), 'final paint state, transform and dash');
        assert.deepEqual(batched.native.path, normal.native.path, 'native current path survives boundary scope');
        assert.equal(batched.native.stack.length, 0, 'native save stack remains balanced');
        normal.native.translate(.5, -.25); batched.native.translate(.5, -.25);
        normal.ctx.lineTo(40 + frame, 70); batched.ctx.lineTo(40 + frame, 70);
        normal.ctx.stroke(); batched.ctx.stroke();
    }
    assert.deepEqual(packed(batched.log), packed(normal.log), 'every packed timestamp/state/path/draw number matches');
    assert.deepEqual(batched.native.paints, normal.native.paints, 'every live paint sees the same clip, path and state');
    assert.equal(batched.log.overflowAt, null);
    // Replay receives exactly the same commands even with event-budget yielding.
    const replayA = new FakeContext(), replayB = new FakeContext();
    const cursorA = normal.log.createCursor({ trail: replayA, erase() {}, repair() {} });
    const cursorB = batched.log.createCursor({ trail: replayB, erase() {}, repair() {} });
    while (!cursorA.renderUntil(1, 2)) {} while (!cursorB.renderUntil(1, 3)) {}
    assert.deepEqual(replayA.paints, replayB.paints, 'replay command stream is unchanged');
}
console.log('PASS: exact differential live commands + packed log + replay; clip/no-clip, transforms, persistent styles/dash/current path and nesting.');

{
    const a = pair(), b = pair();
    const fail = ctx => { ctx.fillStyle = '#aabbcc'; ctx.translate(8, 12); ctx.setLineDash([7, 2]); throw new Error('brush failure'); };
    assert.throws(() => fail(a.ctx), /brush failure/);
    assert.throws(() => b.log.withPaintBoundary(b.ctx, () => fail(b.ctx)), /brush failure/);
    assert.deepEqual(b.native.state(), a.native.state(), 'exception retains original observable final styles');
    assert.equal(b.native.stack.length, 0, 'exception releases private clip');
    a.ctx.fillRect(1, 2, 3, 4); b.ctx.fillRect(1, 2, 3, 4);
    assert.deepEqual(b.native.paints, a.native.paints, 'outside-batch clip remains correct after exception');
    assert.throws(() => b.log.withPaintBoundary(new FakeContext(), () => {}), /wrapped context/);
    for (const name of ['clearRect', 'reset', 'clip']) {
        assert.throws(() => b.log.withPaintBoundary(b.ctx, () => b.ctx[name](0, 0, 20, 20)), /outside withPaintBoundary/);
        assert.equal(b.native.stack.length, 0, `${name} contract error cleans up private save`);
    }
    b.ctx.clearRect(0, 0, 320, 200);
    assert.deepEqual(b.native.paints.at(-1).state.clips, [], 'reset clear remains unrestricted outside batch');
    // Native reset outside the scope invalidates transforms AND the captured path.
    b.log.finish(); b.ctx.beginPath(); b.ctx.moveTo(77, 88); b.ctx.reset(); b.log.start(320, 200, boundary);
    b.log.withPaintBoundary(b.ctx, () => { b.ctx.lineTo(2, 4); b.ctx.stroke(); });
    const fresh = pair(); fresh.ctx.lineTo(2, 4); fresh.ctx.stroke();
    assert.deepEqual(packed(b.log), packed(fresh.log), 'new run after Canvas reset has no old path or transform');
    const events = b.log.eventCount; b.log.finish(); b.log.withPaintBoundary(b.ctx, () => b.ctx.fillRect(1, 2, 3, 4));
    assert.equal(b.log.eventCount, events, 'finished recording remains immutable');
    b.log.clear(); assert.equal(b.log.byteLength, 0); assert.equal(b.log.numberCount, 0); assert.equal(b.log.hasContent, false);
    b.ctx.fillRect(1, 2, 3, 4); assert.deepEqual(b.native.paints.at(-1).state.clips, [], 'clear releases previous boundary');
}
console.log('PASS: exception cleanup, forbidden reset/clip/clear guard, outside-batch reset + restart, immutable finish and clear.');

for (const reason of ['memory-budget', 'drawImage', 'paint-style', 'Path2D']) {
    const a = pair(boundary, reason === 'memory-budget' ? 1024 : undefined);
    const b = pair(boundary, reason === 'memory-budget' ? 1024 : undefined);
    const unsupported = ctx => {
        for (let i = 0; i < 10; i++) ctx.fillRect(i, i, 1, 2);
        if (reason === 'drawImage') ctx.drawImage('test-image', 3, 4);
        if (reason === 'paint-style') { ctx.filter = 'blur(2px)'; ctx.fillRect(3, 4, 5, 6); }
        if (reason === 'Path2D') ctx.fill(new FakePath());
        ctx.fillRect(5, 8, 13, 21);
    };
    unsupported(a.ctx); b.log.withPaintBoundary(b.ctx, () => unsupported(b.ctx));
    assert.equal(b.log.fallbackReason, reason); assert.equal(b.log.overflowAt, a.log.overflowAt);
    assert.deepEqual(packed(b.log), packed(a.log), 'snapshot fallback has the same preceding timeline');
    assert.deepEqual(b.native.paints, a.native.paints, 'drawing continues unchanged after fallback');
    if (reason === 'memory-budget') assert(b.log.byteLength <= 1024);
}
console.log('PASS: memory limit and unsupported-paint snapshot fallbacks retain the same timeline and native paints.');

{
    const a = pair(), b = pair();
    const dots = ctx => {
        for (let i = 0; i < 400; i++) {
            ctx.beginPath(); ctx.moveTo(i, i + 1); ctx.lineTo(i + 2, i + 3);
            ctx.arc(i, i, 3, 0, Math.PI * 2); ctx.fill();
        }
    };
    dots(a.ctx); b.log.withPaintBoundary(b.ctx, () => dots(b.ctx));
    assert.deepEqual(packed(b.log), packed(a.log)); assert.deepEqual(b.native.paints, a.native.paints);
    assert.equal(a.native.counts.clip, 400); assert.equal(b.native.counts.clip, 1);
    assert.equal(a.native.counts.getTransform, 2000); assert.equal(b.native.counts.getTransform, 2);
    console.log(`PASS: 400 unchanged paints — native clips ${a.native.counts.clip} → ${b.native.counts.clip}; getTransform allocations ${a.native.counts.getTransform} → ${b.native.counts.getTransform}.`);
}
