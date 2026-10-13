// 运行时性能剖析（不改任何源码）：劫持每个 system.update 计时 + 注入后期压力 + 帧间隔采样。
// 用法: node scripts/prof-live-run.mjs [总秒数=30] [敌人上限=300] [CPU倍率=1] [笔迹洪流数=0]
//   例: node scripts/prof-live-run.mjs 30 300 1          → 敌潮场景
//       node scripts/prof-live-run.mjs 30 0 1 6000       → 纯笔迹洪流场景
//       node scripts/prof-live-run.mjs 30 300 4          → CPU 降速 4 倍（模拟弱机）
// 前置: vite dev 跑在 5174（npm run dev -- --port 5174 --strictPort）；需本机 Chrome。
// 输出: 每系统 avg/p95/max(ms) + 帧率统计 + 长帧计数 + 实体计数 + JS 堆 + 帧内缺口（画布栅格/合成开销）。
import { chromium } from 'playwright';

const [totalSeconds = 30, enemyCap = 300, cpuRate = 1, strokeFlood = 0] = process.argv.slice(2).map(Number);
const url = process.env.PROF_TEST_URL || 'http://localhost:5174';

const browser = await chromium.launch({ channel: 'chrome', headless: process.env.PROF_HEADFUL !== '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

try {
    if (cpuRate > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    }
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.gameInstance), null, { timeout: 30000 });
    console.log(`[prof] 场景: 敌潮=${enemyCap} 敌人 / CPU×${cpuRate} / ${totalSeconds}s`);

    const result = await page.evaluate(async ({ totalSeconds, enemyCap, strokeFlood, noFade, noClip }) => {
        const game = window.gameInstance;
        // 决定性实验（都必须在 startGame 前打补丁，Proxy 方法缓存才会捕获到替换后函数）
        const instrument = { fadeHits: 0, clearTime: 0, clearCount: 0 };
        if (noClip) {
            game.artRecording.log.applyPaintBoundary = () => {};
        }
        if (noFade) {
            const target = game.artRecording.log.wrappedContexts.get(game.trailCtx).target;
            const origFR = target.fillRect.bind(target);
            target.fillRect = function (x, y, w, h) {
                if (target.globalCompositeOperation === 'destination-out'
                    && w >= game.worldWidth - 1 && h >= game.worldHeight - 1) { instrument.fadeHits++; return; }
                return origFR(x, y, w, h);
            };
        } else {
            const target = game.artRecording.log.wrappedContexts.get(game.trailCtx).target;
            const origFR = target.fillRect.bind(target);
            target.fillRect = function (x, y, w, h) {
                if (target.globalCompositeOperation === 'destination-out'
                    && w >= game.worldWidth - 1 && h >= game.worldHeight - 1) {
                    instrument.fadeHits++;
                    const t0 = performance.now();
                    const r = origFR(x, y, w, h);
                    instrument.fadeTime = (instrument.fadeTime || 0) + (performance.now() - t0);
                    return r;
                }
                return origFR(x, y, w, h);
            };
        }
        const origClear = game.gameCtx.clearRect.bind(game.gameCtx);
        game.gameCtx.clearRect = function (...args) {
            const t0 = performance.now();
            const r = origClear(...args);
            instrument.clearTime += performance.now() - t0;
            instrument.clearCount++;
            return r;
        };
        game.selectedCharacterId = 'collector';
        game.selectedWeaponId = 0;
        game.startGame('endless');
        await new Promise(r => setTimeout(r, 300));

        const { EnemyFactory } = await import('/src/entities/EnemyFactory.ts');
        const { Projectile } = await import('/src/components/Projectile.ts');

        // 1) 劫持每个 system 的 update 计时
        const stats = [];
        for (const system of game.systems) {
            const entry = { name: system.constructor.name, ring: new Float64Array(600), count: 0, max: 0 };
            const orig = system.update.bind(system);
            system.update = (dt) => {
                const t0 = performance.now();
                orig(dt);
                const cost = performance.now() - t0;
                entry.count++;
                entry.ring[entry.count % 600] = cost;
                if (cost > entry.max) entry.max = cost;
            };
            stats.push(entry);
        }

        // 2) 帧间隔采样（rAF 驱动，与游戏循环同源）+ loop 真实执行时长
        const frames = new Float64Array(2400);
        const loopTimes = new Float64Array(2400);
        let frameCount = 0;
        let last = performance.now();
        let loopHitches = 0;
        let loopTimeTotal = 0;
        const tick = (now) => {
            const dt = now - last; last = now;
            frames[frameCount % frames.length] = dt;
            frameCount++;
            if (frameCount < frames.length || performance.now() - start < totalSeconds * 1000) requestAnimationFrame(tick);
        };
        const start = performance.now();
        requestAnimationFrame(tick);
        const origLoop = game.loop.bind(game);
        game.loop = function (time) {
            const t0 = performance.now();
            const r = origLoop(time);
            const cost = performance.now() - t0;
            loopTimes[frameCount % loopTimes.length] = cost;
            loopTimeTotal += cost;
            if (cost > 8) loopHitches++;
            return r;
        };

        // 3) 玩家持续开火 + 注入敌人
        game.autoAttackEnabled = true;
        game.inputManager.mouse.down = true;
        const types = ['chaser', 'eraser', 'shooter', 'summoner', 'shield', 'paper_plane'];

        const Transform = (await import('/src/components/Transform.ts')).Transform;
        const spawnTick = setInterval(() => {
            let alive = 0;
            for (const [, e] of game.entities) if (e.tags.has('enemy') && e.active) alive++;
            if (alive >= enemyCap) return;
            let px = game.worldWidth / 2, py = game.worldHeight / 2;
            for (const [, e] of game.entities) if (e.tags.has('player')) { const t = e.getComponent(Transform); if (t) { px = t.x; py = t.y; } }
            const batch = Math.min(20, enemyCap - alive);
            for (let i = 0; i < batch; i++) {
                const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 600;
                const x = Math.max(50, Math.min(game.worldWidth - 50, px + Math.cos(a) * r));
                const y = Math.max(50, Math.min(game.worldHeight - 50, py + Math.sin(a) * r));
                game.addEntity(EnemyFactory.create(types[Math.floor(Math.random() * types.length)], x, y));
            }
        }, 500);

        // 4) 每 2 秒采样实体计数 + 堆
        const snapshots = [];
        const sample = () => {
            let enemies = 0, bullets = 0, particles = 0, xp = 0;
            for (const [, e] of game.entities) {
                if (!e.active) continue;
                if (e.tags.has('enemy')) enemies++;
                if (e.getComponent(Projectile)) bullets++;
                if (e.tags.has('particle')) particles++;
                if (e.tags.has('xp')) xp++;
            }
            const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
            snapshots.push({ t: Math.round((performance.now() - start) / 1000), enemies, bullets, particles, xp, heap });
        };
        sample();
        const sampleInterval = setInterval(sample, 2000);

        // 5) 笔迹洪流：后 10 秒向作品层刷随机笔迹（模拟后期满屏画作）
        if (strokeFlood > 0) {
            const strokePerTick = Math.max(1, Math.floor(strokeFlood / 10));
            const strokeTick = setInterval(() => {
                if ((performance.now() - start) / 1000 > totalSeconds - 2) { clearInterval(strokeTick); return; }
                const ctx = game.trailCtx;
                for (let i = 0; i < strokePerTick; i++) {
                    const x = Math.random() * game.worldWidth, y = Math.random() * game.worldHeight;
                    ctx.save();
                    ctx.strokeStyle = ['#ff6644', '#44aaff', '#ffcc33', '#66ff99', '#cc66ff'][Math.floor(Math.random() * 5)];
                    ctx.lineWidth = 2 + Math.random() * 10;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.quadraticCurveTo(x + (Math.random() - .5) * 400, y + (Math.random() - .5) * 400,
                        x + (Math.random() - .5) * 500, y + (Math.random() - .5) * 500);
                    ctx.stroke();
                    ctx.restore();
                }
            }, 500);
        }

        await new Promise(r => setTimeout(r, totalSeconds * 1000));
        clearInterval(spawnTick); clearInterval(sampleInterval);
        game.stop();

        // 汇总
        const summary = stats.map(s => {
            const n = Math.min(s.count, 600);
            const copy = Array.from(s.ring).sort((a, b) => a - b);
            const windowSamples = copy.slice(Math.max(0, copy.length - n));
            const sum = windowSamples.reduce((a, b) => a + b, 0);
            const p95 = windowSamples[Math.floor(windowSamples.length * 0.95)] || 0;
            return { name: s.name, count: s.count, avg: +(sum / windowSamples.length).toFixed(3), p95: +p95.toFixed(2), max: +s.max.toFixed(2) };
        }).sort((a, b) => b.avg - a.avg);

        const f = Array.from(frames).slice(0, Math.min(frameCount, frames.length)).filter(v => v > 0);
        f.sort((a, b) => a - b);
        const avg = f.reduce((a, b) => a + b, 0) / f.length;
        const fps = Math.round(1000 / avg);
        const p95 = f[Math.floor(f.length * 0.95)] || 0;
        const over16 = f.filter(v => v > 16.7).length;
        const over33 = f.filter(v => v > 33.4).length;

        const sysTotal = summary.reduce((a, s) => a + s.avg, 0);
        const fadeAvg = (instrument.fadeTime || 0) / Math.max(1, instrument.fadeHits);
        const clearAvg = instrument.clearTime / Math.max(1, instrument.clearCount);
        return {
            systems: summary,
            frame: { samples: f.length, avg: +avg.toFixed(2), p95: +p95.toFixed(1), fps,
                over16ms: over16, over33ms: over33,
                over16Pct: +(over16 / f.length * 100).toFixed(1),
                sysTotal: +sysTotal.toFixed(2), gap: +(avg - sysTotal).toFixed(2) },
            instrument: { fadeHits: instrument.fadeHits, fadeAvg: +fadeAvg.toFixed(2), clearAvg: +clearAvg.toFixed(2) },
            loop: { avg: +(loopTimeTotal / Math.max(1, frameCount)).toFixed(2), hitches: loopHitches, max: +(Math.max(...Array.from(loopTimes.slice(0, Math.min(frameCount, loopTimes.length)))) || 0).toFixed(1) },
            env: { dpr: window.devicePixelRatio, hz: Math.round(1000 / avg) },
            snapshots, pageErrors: [],
            strokeEvents: game.artRecording.log.eventCount,
            logMB: +(game.artRecording.log.byteLength / 1048576).toFixed(2),
        };
    }, { totalSeconds, enemyCap, strokeFlood, noFade: process.env.PROF_NOFADE === '1', noClip: process.env.PROF_NOCLIP === '1' });

    console.log('\n=== 帧统计 ===');
    console.log(`fps≈${result.frame.fps}  帧均 ${result.frame.avg}ms  p95 ${result.frame.p95}ms  >16.7ms ${result.frame.over16ms} 帧(${result.frame.over16Pct}%)  >33.4ms ${result.frame.over33ms} 帧`);
    console.log(`系统合计 ${result.frame.sysTotal}ms/帧  →  帧内缺口（消隐+栅格+合成+其他）${result.frame.gap}ms/帧`);
    console.log(`消隐 fillRect: ${result.instrument.fadeHits} 次 / 均 ${result.instrument.fadeAvg}ms  |  gameCtx clearRect: 均 ${result.instrument.clearAvg}ms`);
    console.log(`loop 真实执行: 均 ${result.loop.avg}ms  max ${result.loop.max}ms  卡帧(>8ms) ${result.loop.hitches} 次  |  dpr=${result.env.dpr} 采样率≈${result.env.hz}Hz`);
    console.log(`StrokeLog: ${result.strokeEvents} 事件 / ${result.logMB} MiB`);
    console.log('\n=== 每系统耗时（avg 降序，单位 ms/帧）===');
    console.log('name'.padEnd(28), 'avg'.padStart(8), 'p95'.padStart(8), 'max'.padStart(8), 'count'.padStart(8));
    for (const s of result.systems) {
        console.log(s.name.padEnd(28), String(s.avg).padStart(8), String(s.p95).padStart(8), String(s.max).padStart(8), String(s.count).padStart(8));
    }
    console.log('\n=== 每 2s 实体采样（t=秒 enemies/bullets/particles/xp, heap MB）===');
    for (const s of result.snapshots) {
        console.log(`t=${String(s.t).padStart(3)}  敌${s.enemies} 弹${s.bullets} 粒${s.particles} 珠${s.xp}  heap ${s.heap}MB`);
    }
    if (pageErrors.length) { console.log('\n=== 页面错误 ==='); for (const e of pageErrors) console.log(e); }
} finally {
    await browser.close();
}
