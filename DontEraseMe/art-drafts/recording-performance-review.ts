import { StrokeLog } from '../src/core/StrokeLog';
import { courtyard } from '../src/world/CourtyardGeometry';

const output = document.getElementById('result')!;
const buttons = [...document.querySelectorAll('button')];
const host = document.getElementById('canvases')!;
function canvas(w: number, h: number, title: string) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.setAttribute('aria-label', title);
    const label = document.createElement('div'); label.textContent = title; label.append(document.createElement('br'), c); host.append(label);
    return c;
}
function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
function diff(a: HTMLCanvasElement, b: HTMLCanvasElement) {
    const aa = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
    const bb = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
    let sum = 0, changed = 0;
    for (let i = 0; i < aa.length; i++) { const d = Math.abs(aa[i] - bb[i]); sum += d; if (d) changed++; }
    return { mean: sum / aa.length, changedChannels: changed };
}
function stream(ctx: CanvasRenderingContext2D, frame: number, width: number, height: number) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${.05 / 60})`;
    ctx.fillRect(0, 0, width, height); ctx.restore();
    for (let i = 0; i < 8; i++) {
        const x = (frame * 31 + i * 131) % width, y = (frame * 19 + i * 77) % height;
        ctx.save(); ctx.translate(x, y); ctx.rotate((frame + i) * .1);
        ctx.strokeStyle = ['#df7180', '#438fc3', '#e9bc45', '#8a76b7'][i % 4]; ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 3 + i; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-15, -4); ctx.quadraticCurveTo(8, -8, 30, 3); ctx.stroke();
        ctx.restore();
    }
    // Deliberate persistent state changes are also part of the API contract.
    ctx.lineWidth = 3 + frame % 6; ctx.lineCap = frame % 2 ? 'butt' : 'round';
}
async function run(task: () => Promise<void> | void) {
    buttons.forEach(b => b.disabled = true); host.replaceChildren();
    try { await task(); } catch (error) { output.textContent = `FAIL: ${String(error)}`; console.error(error); }
    finally { buttons.forEach(b => b.disabled = false); }
}
document.getElementById('pixels')!.onclick = () => void run(() => {
    const a = canvas(320, 220, '原逐笔裁剪'), b = canvas(320, 220, '新批处理'), replay = canvas(320, 220, '新记录回放');
    const boundary = [{ x: 35, y: 15 }, { x: 275, y: 20 }, { x: 310, y: 130 }, { x: 170, y: 205 }, { x: 30, y: 150 }];
    const old = new StrokeLog(), log = new StrokeLog(); old.start(320, 220, boundary); log.start(320, 220, boundary);
    const ca = old.wrapContext(a.getContext('2d')!), cb = log.wrapContext(b.getContext('2d')!);
    for (let frame = 0; frame < 180; frame++) {
        old.advance(1 / 60); log.advance(1 / 60); stream(ca, frame, 320, 220);
        log.withPaintBoundary(cb, () => stream(cb, frame, 320, 220));
        check(ca.lineWidth === cb.lineWidth && ca.lineCap === cb.lineCap, 'final styles differ');
    }
    check(old.numberCount === log.numberCount, 'recorded command lengths differ');
    for (let i = 0; i < old.numberCount; i++) check(old.valueAt(i) === log.valueAt(i), `command differs at ${i}`);
    log.finish();
    const cursor = log.createCursor({ trail: replay.getContext('2d')!, erase() {}, repair() {} });
    while (!cursor.renderUntil(log.duration, 1000)) { /* exercise bounded replay */ }
    const actual = diff(a, b), playback = diff(b, replay);
    // Reusing a clip can choose a different native raster batch; permit only a
    // handful of antialias edge channels, never geometry/coverage differences.
    check(actual.mean < .001 && actual.changedChannels <= 8, `live pixel output changed: ${JSON.stringify(actual)}`);
    check(playback.mean < .15, 'replay exceeds Float32 pixel tolerance');
    output.textContent = `PASS · 原/新平均通道差 ${actual.mean.toFixed(6)}，${actual.changedChannels} / 281600 通道不同（边缘栅格误差）\n记录命令逐数一致：${log.eventCount} 事件 / ${log.numberCount} 数字\n实绘/回放平均通道差 ${playback.mean.toFixed(6)}（Float32 / 栅格误差）\n裁剪区域、变换、笔触顺序、透明度、末尾画笔状态一致。`;
});
document.getElementById('stress')!.onclick = () => void run(async () => {
    const c = canvas(2700, 1800, '300 秒模拟最终作品（2700 × 1800 原尺寸，不降采样）');
    const log = new StrokeLog(); log.start(2700, 1800, courtyard.points);
    const ctx = log.wrapContext(c.getContext('2d')!); const samples: number[] = [];
    const start = performance.now();
    for (let frame = 0; frame < 18000; frame++) {
        log.advance(1 / 60); const t = performance.now();
        log.withPaintBoundary(ctx, () => stream(ctx, frame, 2700, 1800)); samples.push(performance.now() - t);
        if (frame % 12 === 11) {
            output.textContent = `运行中：${(log.duration).toFixed(1)} / 300 秒模拟\n事件 ${log.eventCount} · 日志 ${(log.byteLength / 1048576).toFixed(1)} MiB`;
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
    }
    log.finish(); samples.sort((a, b) => a - b);
    check(log.eventCount === 162000, 'some paints were lost'); check(log.overflowAt === null, 'unexpected snapshot fallback');
    output.textContent = `PASS · 300 秒 / 18000 帧模拟 / ${log.eventCount} 绘画事件\n日志 ${(log.byteLength / 1048576).toFixed(2)} MiB（上限 96 MiB）\nCPU 提交中位 ${samples[9000].toFixed(3)} ms，P95 ${samples[17100].toFixed(3)} ms\n实际测试耗时 ${((performance.now() - start) / 1000).toFixed(1)} 秒\n没有丢笔迹、降低画布尺寸或关闭回放。这里只测试画布/记录路径，不代表完整战斗 FPS。`;
});
