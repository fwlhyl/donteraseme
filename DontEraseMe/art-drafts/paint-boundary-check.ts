import { ArtReplayRecording } from '../src/core/ArtReplayRecording';
import { CourtyardGeometry } from '../src/world/CourtyardGeometry';

const width = 540, height = 360, geometry = new CourtyardGeometry(width, height);
// Keep rasterization on one backend during repeated pixel reads; otherwise
// Chromium may switch GPU -> CPU and change boundary antialiasing mid-test.
const canvas = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d', { willReadFrequently: true }); return c; };
const live = canvas(), replay = canvas(), mask = canvas(), empty = canvas();
const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const pixels = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, width, height).data;
const maskCtx = mask.getContext('2d')!;
maskCtx.beginPath(); geometry.points.forEach((p, i) => i ? maskCtx.lineTo(p.x, p.y) : maskCtx.moveTo(p.x, p.y)); maskCtx.closePath(); maskCtx.fill();
const stencil = pixels(mask);
function leaks(c: HTMLCanvasElement) {
    const p = pixels(c); let outside = 0, inside = 0;
    for (let i = 3; i < p.length; i += 4) { if (!stencil[i] && p[i]) outside++; if (stencil[i] === 255 && p[i]) inside++; }
    return { outside, inside };
}
function compare(a: HTMLCanvasElement, b: HTMLCanvasElement) {
    const aa = pixels(a), bb = pixels(b); let difference = 0;
    for (let i = 0; i < aa.length; i++) difference += Math.abs(aa[i] - bb[i]);
    return difference / aa.length;
}
try {
    const recording = new ArtReplayRecording();
    const ctx = recording.log.wrapContext(live.getContext('2d')!);
    recording.start(width, height, false, undefined, geometry.points);
    ctx.fillStyle = '#2784bc'; ctx.fillRect(-100, -100, width + 200, height + 200);
    recording.log.advance(1);
    ctx.save(); ctx.translate(80, 70); ctx.rotate(.32); ctx.scale(1.2, .8);
    ctx.strokeStyle = '#f0c644'; ctx.lineWidth = 90; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-200, 20); ctx.lineTo(600, 90); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = '#e87192'; ctx.shadowBlur = 18; ctx.shadowColor = '#e87192';
    ctx.beginPath(); ctx.arc(440, 230, 100, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(0, 0, width, height); ctx.restore();
    ctx.clearRect(250, 130, 30, 30);
    check(leaks(live).outside === 0 && leaks(live).inside > 10000, '越界像素或内部笔迹被错误隐藏');
    check(recording.log.overflowAt === null, '固定边界不应触发快照降级');
    const cursor = recording.log.createCursor({ trail: replay.getContext('2d')!, erase() {}, repair() {} });
    while (!cursor.renderUntil(1, 2)) {}
    check(leaks(replay).outside === 0, '回放越界');
    const difference = compare(live, replay);
    check(difference < .12, `实机/回放像素差异过大 ${difference}`);
    recording.finish(empty, live);
    check(leaks(recording.finalArtwork!).outside === 0, '结算导出越界');
    check(compare(live, recording.finalArtwork!) < .01, '导出改变内部画作');
    replay.getContext('2d')!.clearRect(0, 0, width, height); cursor.reset();
    while (!cursor.renderUntil(1, 1)) {}
    check(compare(live, replay) < .12, `从头回放差异 ${compare(live, replay)}，首次差异 ${difference}，越界 ${leaks(replay).outside}`);
    // Resize clears native canvas state; per-paint clipping must survive it.
    const resizing = canvas(); const resizeCtx = recording.log.wrapContext(resizing.getContext('2d')!);
    resizing.width = width; resizeCtx.fillRect(0, 0, width, height);
    check(leaks(resizing).outside === 0 && leaks(resizing).inside > 10000, '画布重置后边界失效');
    // Full reset and mode switches must not retain the create-mode clip.
    recording.start(width, height, true); ctx.clearRect(0, 0, width, height); ctx.fillRect(0, 0, width, height);
    check(pixels(live)[3] === 255, '守卫模式仍被创造边界裁剪');
    recording.start(width, height, false, undefined, geometry.points);
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#2784bc'; ctx.fillRect(0, 0, width, height);
    check(pixels(live)[3] === 0 && leaks(live).outside === 0, '重开后遗留旧像素或边界失效');
    // Show the original full test drawing and its replay, not the reset sample.
    live.getContext('2d')!.clearRect(0, 0, width, height); live.getContext('2d')!.drawImage(replay, 0, 0);
    for (const [label, c] of [['实时笔迹（含旋转、粗线、阴影、擦除）', live], ['笔迹回放', replay]] as const) {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = label; figure.append(caption, c); document.getElementById('canvases')!.append(figure);
    }
    document.getElementById('result')!.textContent = `PASS · 实时绘制越界像素 0 · 回放越界像素 0\n平均像素差 ${difference.toFixed(6)}（阈值 0.12）\n导出、从头回放、画布重置、重开与守卫模式隔离均通过。`;
} catch (error) { document.getElementById('result')!.textContent = `FAIL · ${error}`; throw error; }
