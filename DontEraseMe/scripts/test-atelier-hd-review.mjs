// Isolated real-game A/B review; no runtime source/assets or user profile writes.
// Usage: node scripts/test-atelier-hd-review.mjs [candidate.webp]
// PAPER_SCENE_TEST_URL can point at an already-running Vite server.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

const output = resolve('art-drafts/atelier-hd-review-2026-10-18');
const shotsDir = join(output, 'screenshots');
const beforePath = resolve('src/assets/paper-scenes/atelier-v1.webp');
const candidatePath = resolve(process.argv[2] || join(output, 'atelier-clarity-v1.webp'));
const url = process.env.PAPER_SCENE_TEST_URL || 'http://127.0.0.1:5174';
const viewport = { width: 1366, height: 768 };
const positions = [['northwest', .06, .06], ['southeast', .94, .94]];
const approvedOutline = [
    [250,280],[330,238],[407,204],[520,160],[572,129],[685,152],
    [722,137],[858,137],[928,165],[985,218],[1130,275],[1175,266],
    [1240,344],[1340,407],[1372,445],[1335,490],[1335,557],
    [1278,634],[1192,704],[1200,760],[1120,834],[1070,847],
    [990,840],[915,883],[832,910],[808,962],[720,962],[673,914],
    [639,899],[581,824],[540,843],[430,831],[355,782],[344,729],
    [313,711],[328,645],[346,605],[305,548],[290,487],[324,438],
    [323,400],[287,381],[281,334],[249,311],
];
const hash = value => createHash('sha256').update(value).digest('hex');
const beforeBytes = await readFile(beforePath);
const candidateBytes = await readFile(candidatePath);
const snapshots = new Map();
for (const path of [
    beforePath, resolve('src/world/CourtyardGeometry.ts'), resolve('src/world/SceneLayout.ts'),
    resolve('src/world/CourtyardScene.ts'), resolve('src/world/DoodleFloor.ts'),
]) snapshots.set(path, hash(await readFile(path)));
await mkdir(shotsDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
let assets;
try {
    for (const dpr of [1, 2]) {
        // Never use a persistent context or the user's existing browser storage.
        const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
        try {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text());
            });
            // The candidate is served only into this disposable test browser.
            await page.route('**/__atelier_hd_review_candidate.webp', route => route.fulfill({
                status: 200, contentType: 'image/webp', body: candidateBytes,
            }));
            await page.goto(url);
            await page.waitForFunction(() => window.gameInstance);
            await page.evaluate(async () => {
                await document.fonts.ready;
                const { getDoodleHeroes, getDoodleEnemies } = await import('/src/art/DoodleArt.ts');
                const { getDoodleWeapons } = await import('/src/art/DoodleWeapons.ts');
                const scene = window.gameInstance.systems.find(system => system.constructor.name === 'RenderSystem').courtyardScene;
                await Promise.all([getDoodleHeroes(), getDoodleEnemies(), getDoodleWeapons(), scene.image].map(image => image.decode()));
                window.hdFloor = await import('/src/world/DoodleFloor.ts');
                window.hdFloor.isDoodleFloorTextureReady();
                const candidate = new Image(); candidate.src = '/__atelier_hd_review_candidate.webp';
                await candidate.decode();
                window.hdReview = { beforeImage: scene.image, candidate };
            });
            await page.waitForFunction(() => window.hdFloor.isDoodleFloorTextureReady());
            await page.click('#create-mode-btn');
            await page.click('#start-run-btn');
            await page.waitForFunction(() => window.gameInstance.state === 1);
            await page.waitForFunction(() => document.querySelector('#magic-pen-hud [data-hud="count"]')?.textContent.includes('45'));
            const setup = await page.evaluate(async () => {
                const game = window.gameInstance; game.stop(); game.clearInput();
                const { COURTYARD_OUTLINE } = await import('/src/world/CourtyardGeometry.ts');
                const { sceneBounds } = await import('/src/world/SceneLayout.ts');
                const render = game.systems.find(system => system.constructor.name === 'RenderSystem');
                render.artTime = 0; render.shakeFrames = 0;
                // Distinct pigment proves a background swap cannot contaminate
                // saved drawing pixels, even if both floors are very dark.
                game.trailCtx.save(); game.trailCtx.fillStyle = '#b74736';
                game.trailCtx.fillRect(1350, 900, 44, 28); game.trailCtx.restore();
                window.hdReview.layers = {
                    painting: game.paintingCanvas.toDataURL(), trail: game.trailCanvas.toDataURL(),
                    export: game.getExportCanvas().toDataURL(), events: game.artRecording.log.eventCount,
                };
                return {
                    world: [game.worldWidth, game.worldHeight], outline: COURTYARD_OUTLINE,
                    bounds: sceneBounds(game.worldWidth, game.worldHeight, 'atelier'),
                    before: [window.hdReview.beforeImage.naturalWidth, window.hdReview.beforeImage.naturalHeight],
                    after: [window.hdReview.candidate.naturalWidth, window.hdReview.candidate.naturalHeight],
                };
            });
            assert.deepEqual(setup.world, [2700, 1800]);
            assert.deepEqual(setup.outline, approvedOutline);
            assert.deepEqual(setup.bounds, { x: -0, y: -0, width: 2700, height: 1800 });
            assert(setup.before.every(n => n > 0) && setup.after.every(n => n > 0));
            assert(Math.abs(setup.after[0] / setup.after[1] - 1.5) < .005,
                'candidate must preserve the existing 3:2 framing; do not silently stretch it');
            assets = [
                { label: 'before', path: beforePath, bytes: beforeBytes.length, sha256: hash(beforeBytes), dimensions: setup.before },
                { label: 'after', path: candidatePath, bytes: candidateBytes.length, sha256: hash(candidateBytes), dimensions: setup.after },
            ].map(asset => ({
                ...asset, decodedRgbaMiB: Number((asset.dimensions[0] * asset.dimensions[1] * 4 / 1048576).toFixed(2)),
                worldSize: setup.world,
                scaleAtDpr1: Number((2700 / asset.dimensions[0]).toFixed(4)),
                scaleAtDpr2: Number((5400 / asset.dimensions[0]).toFixed(4)),
            }));

            for (const [position, nx, ny] of positions) {
                await page.evaluate(async ({ nx, ny }) => {
                    const game = window.gameInstance;
                    const { Transform } = await import('/src/components/Transform.ts');
                    const { courtyard } = await import('/src/world/CourtyardGeometry.ts');
                    const { courtyardRadius } = await import('/src/systems/CourtyardBoundarySystem.ts');
                    const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
                    const transform = player.getComponent(Transform);
                    Object.assign(transform, courtyard.project({ x: game.worldWidth * nx, y: game.worldHeight * ny }, courtyardRadius(player)));
                    game.courtyardBoundary.update(0);
                    const render = game.systems.find(system => system.constructor.name === 'RenderSystem');
                    render.artTime = 0; render.shakeFrames = 0;
                    game.render(); render.update(0);
                    game.render(); render.update(0);
                    game.systems.find(system => system.constructor.name === 'MinimapSystem').update(0);
                    for (const canvas of [game.trailCanvas, game.paintingCanvas])
                        canvas.style.transform = `translate3d(${-game.camera.x}px, ${-game.camera.y}px, 0)`;
                    window.hdReview.fixedCamera = [game.camera.x, game.camera.y];
                    window.hdReview.foreground = game.gameCanvas.toDataURL();
                }, { nx, ny });
                const pair = { position, dpr, screenshots: {} };
                for (const variant of ['before', 'after']) {
                    const frame = await page.evaluate(async variant => {
                        const game = window.gameInstance;
                        const render = game.systems.find(system => system.constructor.name === 'RenderSystem');
                        const scene = render.courtyardScene;
                        scene.image = variant === 'before' ? window.hdReview.beforeImage : window.hdReview.candidate;
                        scene.lastFrame = '';
                        // Real render path and original floor/lamps; only one
                        // instance image changes, and only in this browser.
                        game.render(); render.update(0);
                        const { courtyard, COURTYARD_OUTLINE } = await import('/src/world/CourtyardGeometry.ts');
                        const { courtyardRadius } = await import('/src/systems/CourtyardBoundarySystem.ts');
                        const { Transform } = await import('/src/components/Transform.ts');
                        const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
                        const baseline = window.hdReview.layers;
                        const canvas = document.getElementById('courtyardCanvas');
                        return {
                            camera: [game.camera.x, game.camera.y], fixedCamera: window.hdReview.fixedCamera,
                            canvas: [canvas.width, canvas.height], outline: COURTYARD_OUTLINE,
                            playerFits: courtyard.fits(player.getComponent(Transform), courtyardRadius(player)),
                            paintingIntact: baseline.painting === game.paintingCanvas.toDataURL(),
                            trailIntact: baseline.trail === game.trailCanvas.toDataURL(),
                            exportIntact: baseline.export === game.getExportCanvas().toDataURL(),
                            logIntact: baseline.events === game.artRecording.log.eventCount,
                            foregroundIntact: window.hdReview.foreground === game.gameCanvas.toDataURL(),
                            scene: canvas.dataset.scene, running: game.isRunning,
                        };
                    }, variant);
                    assert.deepEqual(frame.camera, frame.fixedCamera, 'A/B view must be pixel-aligned');
                    assert.deepEqual(frame.canvas, [viewport.width * dpr, viewport.height * dpr]);
                    assert.deepEqual(frame.outline, approvedOutline);
                    assert(frame.playerFits && !frame.running && frame.scene === 'atelier');
                    assert(frame.paintingIntact && frame.trailIntact && frame.exportIntact && frame.logIntact,
                        'candidate is scenery only, never artwork or replay data');
                    assert(frame.foregroundIntact, 'the exact same player/entity frame must appear in both screenshots');
                    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                    const name = `atelier-${position}-${dpr}x-${variant}.png`;
                    await page.screenshot({ path: join(shotsDir, name), animations: 'disabled' });
                    pair.screenshots[variant] = `screenshots/${name}`;
                    pair.camera = frame.camera;
                }
                results.push(pair);
            }
            // End/replay is deliberately not invoked: this comparison does not
            // save art even into the disposable profile. The existing full
            // scene suite already tests settlement/replay; here we check bytes.
        } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    for (const [path, digest] of snapshots) assert.equal(hash(await readFile(path)), digest, `${path} unchanged by review`);
    const report = {
        ok: true, createdAt: new Date().toISOString(), viewport, assets, results,
        constraints: { isolatedProfile: true, runtimeFilesUnchanged: true, originalFloorAndLights: true,
            originalCollisionAndCamera: true, artworkAndReplayEventsUnchanged: true, foregroundPixelsUnchanged: true },
        note: 'The native candidate remains 1536×1024, not a resolution upgrade. Only illustration clarity is being reviewed. The original floor cache and lights remain unchanged. This is not a performance claim. RGBA figures exclude mipmaps, canvas buffers and decoder overhead.',
    };
    await writeFile(join(output, 'review-results.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(output, 'index.html'), reviewHtml(report)
        .replace('<title>创造模式 · 清晰度对照</title>', '<title>清晰度修订对照 · 原生分辨率未提升</title>')
        .replace('<h1>创造模式 · 实机清晰度对照</h1>', '<h1>清晰度修订对照 · 原生分辨率未提升</h1><p><strong>仅画法清晰度修订；原生像素未提升，不能视为已完成高清化。中心地面缓存与灯光仍沿用运行版。</strong></p>'));
    console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }

function reviewHtml(report) {
    const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const rows = report.assets.map(a => `<tr><th>${a.label === 'before' ? '当前运行版' : '候选重绘版'}</th><td>${a.dimensions.join(' × ')}</td><td>${(a.bytes / 1048576).toFixed(2)} MiB</td><td>${a.decodedRgbaMiB} MiB</td><td>${a.scaleAtDpr1}× / ${a.scaleAtDpr2}×</td></tr>`).join('');
    const cards = report.results.map((pair, index) => `<section class="pair"><header><h2>${pair.position === 'northwest' ? '西北街区' : '东南街区'} · DPR ${pair.dpr}</h2><span>相机 ${pair.camera.map(n => n.toFixed(1)).join(', ')} · ${viewport.width * pair.dpr} × ${viewport.height * pair.dpr} 实机截图</span></header><div class="switches"><button type="button" data-pair="${index}" data-variant="before" aria-pressed="true">当前运行版</button><button type="button" data-pair="${index}" data-variant="after" aria-pressed="false">候选重绘版</button><a href="${esc(pair.screenshots.before)}" target="_blank">原图 Before</a><a href="${esc(pair.screenshots.after)}" target="_blank">原图 After</a></div><div class="viewport"><img id="pair-${index}" src="${esc(pair.screenshots.before)}" alt="${pair.position} 实机对照"></div><label><input type="checkbox" data-zoom="${index}"> 以截图原始像素查看（可横向滚动）</label></section>`).join('');
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>创造模式 · 清晰度对照</title><style>html{background:#252621;color:#eee4c8;font:15px/1.6 system-ui,sans-serif}body{margin:28px auto;max-width:1500px;padding:0 22px}h1{font-size:26px}h2{font-size:18px;margin:0}p,header span{color:#b0aa95}table{border-collapse:collapse;font-size:14px}th,td{padding:8px 18px 8px 0;text-align:left;border-bottom:1px solid #524f43}.pair{margin:32px 0;border-top:1px solid #524f43;padding-top:18px}.switches{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}button{background:transparent;color:#eee4c8;border:1px solid #807965;padding:8px 18px;cursor:pointer}button[aria-pressed=true]{border-color:#b74736;background:#633a2e}a{color:#d3c3a1}.viewport{overflow:auto;background:#1f211d}.viewport img{width:100%;height:auto;display:block}.viewport.native img{width:auto;max-width:none}label{display:inline-block;margin-top:9px;color:#b0aa95}code{color:#d3c3a1}</style><h1>创造模式 · 实机清晰度对照</h1><p>同一游戏帧、同一相机、相同地面与灯光，仅临时替换浏览器实例中的背景图。不会覆盖游戏资源，也不会操作用户存档。</p><table><thead><tr><th>素材</th><th>实际自然尺寸</th><th>文件体积</th><th>RGBA 解码估算</th><th>DPR 1 / 2 地图采样放大</th></tr></thead><tbody>${rows}</tbody></table><p>请优先在原始像素视图检查建筑边缘。更大的文件或像素尺寸不等于新增细节，是否更清楚以同机位实机图为准。内存数值不包含画布、解码器及额外 GPU 缓冲。</p>${cards}<p>候选文件：<code>${esc(basename(candidatePath))}</code> · <a href="review-results.json">完整检查记录</a></p><script>const pairs=${JSON.stringify(report.results)};document.addEventListener('click',e=>{const b=e.target.closest('button[data-pair]');if(!b)return;const n=Number(b.dataset.pair);document.getElementById('pair-'+n).src=pairs[n].screenshots[b.dataset.variant];b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});document.addEventListener('change',e=>{if(e.target.dataset.zoom===undefined)return;document.getElementById('pair-'+e.target.dataset.zoom).parentNode.classList.toggle('native',e.target.checked)});</script></html>`;
}
