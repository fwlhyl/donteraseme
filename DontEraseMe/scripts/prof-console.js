// 真实游玩性能剖析（浏览器控制台版）——不改源码，不打 test 场景，测的就是你真实的一局。
//
// 用法（家里 Mac）：
//   1. 终端跑: cd DontEraseMe && npm run dev
//   2. 浏览器打开 dev 服务器地址，F12 打开控制台
//   3. 把本文件全部内容粘贴进控制台回车 → 看到「性能采样已开启」
//   4. 像平时一样正常玩（选你平时会卡的模式/角色/技能组合）
//   5. 感觉到卡之后，在控制台输入 __profReport() 回车
//   6. 把输出截图/文本发回来
//
// 输出内容：采样时长、平均帧/fps、>33ms 卡帧次数、JS 堆、实体计数、
// 以及每个系统的 avg/p95/max 耗时排行（谁在吃帧一目了然）。
(() => {
    const game = window.gameInstance;
    if (!game || !game.isRunning) { console.error('游戏还没开始，先进一局再粘贴'); return; }

    const stats = new Map();
    for (const system of game.systems) {
        const entry = { total: 0, count: 0, max: 0, ring: [] };
        const orig = system.update.bind(system);
        system.update = (dt) => {
            const t0 = performance.now();
            orig(dt);
            const cost = performance.now() - t0;
            entry.total += cost; entry.count++;
            if (cost > entry.max) entry.max = cost;
            entry.ring.push(cost);
            if (entry.ring.length > 1800) entry.ring.shift();
        };
        stats.set(system.constructor.name, entry);
    }

    const prof = { start: performance.now(), frames: [], hitches: 0 };
    let last = performance.now();
    const tick = (now) => {
        const dt = now - last; last = now;
        prof.frames.push(dt);
        if (prof.frames.length > 6000) prof.frames.shift();
        if (dt > 33.4) prof.hitches++;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // 回归实验开关：关掉每帧共享 clip（第二轮优化引入），观察帧率是否恢复
    window.__profNoClip = () => {
        const log = game.artRecording.log;
        const enabled = log.applyPaintBoundary.toString().includes('this.paintClip');
        log.applyPaintBoundary = enabled ? () => {} : function (ctx) {
            if (!this.paintClip) return;
            const m = ctx.getTransform();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clip(this.paintClip);
            ctx.setTransform(m);
        };
        console.log(enabled ? '✅ clip 已关闭（笔迹将不再被地形裁剪，仅测试用）' : '✅ clip 已恢复');
    };

    window.__profReport = () => {
        const seconds = (performance.now() - prof.start) / 1000;
        const f = [...prof.frames].sort((a, b) => a - b);
        if (!f.length) { console.log('还没有帧数据'); return; }
        const avgF = f.reduce((a, b) => a + b, 0) / f.length;
        const p95 = f[Math.floor(f.length * 0.95)];
        const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + 'MB' : 'n/a';
        let enemies = 0, particles = 0, all = 0;
        for (const [, e] of game.entities) {
            if (!e.active) continue;
            all++;
            if (e.tags.has('enemy')) enemies++;
            if (e.tags.has('particle')) particles++;
        }
        console.log(`=== 性能报告 ===`);
        console.log(`采样 ${seconds | 0}s | 实体 ${all}(敌 ${enemies} 粒 ${particles}) | JS堆 ${heap}`);
        console.log(`平均帧 ${avgF.toFixed(1)}ms (${(1000 / avgF).toFixed(0)}fps) | p95 ${p95.toFixed(1)}ms | 卡帧>33ms: ${prof.hitches} 次`);
        console.log(`StrokeLog: ${game.artRecording.log.eventCount} 事件 / ${(game.artRecording.log.byteLength / 1048576).toFixed(1)} MiB`);
        const rows = [...stats.entries()].map(([name, e]) => ({
            system: name,
            'avg(ms)': +(e.total / e.count).toFixed(2),
            'p95(ms)': +[...e.ring].sort((a, b) => a - b)[Math.floor(e.ring.length * 0.95)].toFixed(2),
            'max(ms)': +e.max.toFixed(2),
        })).sort((a, b) => b['avg(ms)'] - a['avg(ms)']);
        console.table(rows.slice(0, 15));
        console.log(`再玩一段后再输入 __profReport() 可重新出报告（累计口径）。`);
    };

    console.log('✅ 性能采样已开启。正常游玩，卡的时候输入 __profReport() 查看报告。');
})();
