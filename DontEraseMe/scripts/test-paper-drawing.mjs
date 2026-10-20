// Isolated browser/save state. Presentation-only tests never change real artwork.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = resolve(process.env.PAPER_DRAWING_SCREENSHOTS || 'art-drafts/clarity-unified-2026-10-18/screenshots/drawing');
await mkdir(output, { recursive: true });
const errors = [], results = [];
const url = process.env.PAPER_DRAWING_TEST_URL || 'http://127.0.0.1:5174';
async function redraw(page, position = [.5, .5]) {
    return page.evaluate(async ([nx, ny]) => {
        const game = window.gameInstance;
        const { Transform } = await import('/src/components/Transform.ts');
        const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
        Object.assign(player.getComponent(Transform), { x: nx * game.worldWidth, y: ny * game.worldHeight });
        game.render(); game.systems.find(system => system.constructor.name === 'RenderSystem').update(0);
        game.systems.find(system => system.constructor.name === 'MinimapSystem').update(0);
        for (const canvas of [game.trailCanvas, game.paintingCanvas]) canvas.style.transform = `translate3d(${-game.camera.x}px,${-game.camera.y}px,0)`;
        const scene = document.getElementById('courtyardCanvas');
        return { camera: [game.camera.x, game.camera.y], size: [scene.width, scene.height], scene: scene.dataset.scene };
    }, position);
}
async function screenshot(page, name) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
}
try {
    for (const dpr of [1, 2]) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dpr });
        try {
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text()); });
            await page.goto(url); await page.waitForFunction(() => window.gameInstance);
            await page.evaluate(async () => {
                const { PlayerProfile } = await import('/src/core/PlayerProfile.ts');
                const profile = PlayerProfile.load(); profile.unlockedWeaponIds = [0, 2, 10, 11]; PlayerProfile.save(profile);
                const { getDoodleHeroes } = await import('/src/art/DoodleArt.ts');
                const { getDoodleWeapons } = await import('/src/art/DoodleWeapons.ts');
                await Promise.all([document.fonts.ready, getDoodleHeroes().decode(), getDoodleWeapons().decode()]);
            });
            await page.click('#drawing-mode-btn'); await page.waitForSelector('#drawing-hud:visible');
            await page.waitForFunction(() => {
                const image = window.gameInstance.systems.find(system => system.constructor.name === 'RenderSystem').drawingScene.image;
                return image?.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024;
            });
            assert(await page.evaluate(() => window.gameInstance.systems.find(system => system.constructor.name === 'RenderSystem').drawingScene.image.src.includes('drawing-studio-clarity-v1.webp')), 'approved clarity desk is active');
            const state = await page.evaluate(async () => {
                const game = window.gameInstance; game.stop(); game.clearInput();
                const { PlayerStats } = await import('/src/components/PlayerStats.ts');
                const { Skill } = await import('/src/components/Skill.ts');
                const { Weapon } = await import('/src/components/Weapon.ts');
                const { drawingSceneBounds } = await import('/src/world/DrawingScene.ts');
                const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
                game.trailCtx.save(); game.trailCtx.fillStyle = '#b74736';
                game.trailCtx.fillRect(game.worldWidth / 2 + 75, game.worldHeight / 2, 80, 30); game.trailCtx.restore();
                window.drawingPaperBaseline = { pixels: game.trailCanvas.toDataURL(), events: game.artRecording.log.eventCount };
                return {
                    world: [game.worldWidth, game.worldHeight], bounds: drawingSceneBounds(game.worldWidth, game.worldHeight),
                    hero: player.getComponent(PlayerStats).characterId, skill: player.hasComponent(Skill),
                    weapons: [...player.getComponent(Weapon).unlocked], duration: game.drawingDuration,
                    white: [...game.trailCtx.getImageData(10, 10, 1, 1).data],
                    enemyCount: [...game.entities.values()].filter(entity => entity.tags.has('enemy')).length,
                };
            });
            assert.deepEqual(state.world, [1800, 1200]);
            assert.deepEqual(state.bounds, { x: -450, y: -300, width: 2700, height: 1800 });
            assert.equal(state.hero, 'collector'); assert.equal(state.skill, false); assert.equal(state.enemyCount, 0);
            assert.deepEqual(state.weapons, [0, 2, 10, 11]); assert.equal(state.duration, 1200);
            assert.deepEqual(state.white, [255, 255, 255, 255], 'display scene does not recolor the real white artwork');
            assert.equal(await page.locator('#drawing-weapon option').count(), 4);
            for (const [name, point] of [['center', [.5,.5]], ['northwest', [.02,.02]], ['southeast', [.98,.98]]]) {
                const view = await redraw(page, point);
                assert.equal(view.scene, 'drawing'); assert.deepEqual(view.size, [1366*dpr,768*dpr]);
                const isolation = await page.evaluate(() => {
                    const game = window.gameInstance, baseline = window.drawingPaperBaseline;
                    const pixels = game.gameCtx.getImageData(0, 0, game.gameCanvas.width, game.gameCanvas.height).data;
                    let nonempty = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) nonempty++;
                    return {
                        bitmap: game.trailCanvas.toDataURL() === baseline.pixels,
                        log: game.artRecording.log.eventCount === baseline.events,
                        export: game.getExportCanvas().toDataURL() === baseline.pixels,
                        foregroundCoverage: nonempty / (pixels.length / 4),
                    };
                });
                assert(isolation.bitmap && isolation.log && isolation.export, 'desk/camera cannot enter painting, recording or live export');
                assert(isolation.foregroundCoverage < .02, 'only the small player remains above the paper; no legacy grid or cartoon buildings');
                await screenshot(page, `drawing-${name}-${dpr}x`);
            }
            const verifyCache = async () => {
                const cache = await page.evaluate(() => {
                    const game = window.gameInstance, renderer = game.systems.find(system => system.constructor.name === 'RenderSystem');
                    const scene = renderer.drawingScene, canvas = document.getElementById('courtyardCanvas');
                    const ctx = canvas.getContext('2d'), original = ctx.drawImage; let draws = 0;
                    ctx.drawImage = function (...args) { draws++; return original.apply(this, args); };
                    scene.lastFrame = '';
                    try {
                        // Exercise the actual owner hand-off on every render tick:
                        // disabled courtyard -> drawing desk -> entity rendering.
                        // A direct scene.draw loop would miss a disabled courtyard
                        // accidentally relabelling the shared canvas each frame.
                        for (let i = 0; i < 120; i++) renderer.update(0);
                        const stableDraws = draws;
                        const pixels = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        const equalPixels = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
                        // Chrome may switch a GPU-backed canvas to its CPU raster
                        // path after repeated readbacks. On this lossless desk,
                        // even identical, uncorrupted redraws changed 5 channels
                        // by 1 at DPR 1 (18 at DPR 2), then changed more during the
                        // backend switch. That is not an ownership-restore error.
                        // Prime readback before capturing a baseline, then require
                        // an uncorrupted control AND the restored frame to match
                        // every RGBA byte exactly. No pixel tolerance is allowed.
                        for (let i = 0; i < 3; i++) {
                            scene.lastFrame = ''; renderer.update(0);
                            pixels();
                        }
                        scene.lastFrame = ''; renderer.update(0);
                        const baseline = pixels();
                        scene.lastFrame = ''; renderer.update(0);
                        const control = pixels();
                        const beforeRestore = draws;
                        canvas.dataset.scene = 'ruins'; ctx.fillStyle = '#b74736'; ctx.fillRect(0, 0, 100, 100);
                        const contaminationDetected = !equalPixels(control, pixels());
                        renderer.update(0);
                        return {
                            stableDraws, restorationDraws: draws - beforeRestore,
                            controlStable: equalPixels(baseline, control), contaminationDetected,
                            ownershipRestored: equalPixels(control, pixels()), owner: canvas.dataset.scene,
                        };
                    } finally { ctx.drawImage = original; }
                });
                assert.equal(cache.stableDraws, 1, '120 stationary RenderSystem updates need only one static desk image draw');
                assert(cache.controlStable, 'uncorrupted control redraw is byte-exact after readback priming');
                assert(cache.contaminationDetected, 'ownership probe visibly contaminates the shared canvas');
                assert.equal(cache.restorationDraws, 1, 'foreign ownership requires exactly one same-camera desk redraw');
                assert.equal(cache.owner, 'drawing');
                assert(cache.ownershipRestored, 'shared canvas ownership restores every RGBA byte exactly');
            };

            for (const [width, height] of [[2000,1400],[800,600],[390,844]]) {
                await page.setViewportSize({ width, height });
                await page.waitForFunction(({width,height}) => window.gameInstance.width === width && window.gameInstance.height === height, { width, height });
                await redraw(page);
                for (const selector of ['#drawing-hud','#drawing-weapon','#drawing-color','#drawing-pause','#drawing-finish']) {
                    const box = await page.locator(selector).boundingBox();
                    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${selector} fits ${width}×${height}`);
                }
                await screenshot(page, `drawing-${width}-${dpr}x`);
            }
            // Keep review screenshots on the normal display path; only the
            // exact restoration assertion deliberately exercises readback.
            await page.setViewportSize({width:1366,height:768}); await redraw(page, [.98,.98]);
            await verifyCache();
            await redraw(page);
            await page.selectOption('#drawing-weapon', '11');
            await page.locator('#drawing-color').evaluate(input => { input.value = '#a34635'; input.dispatchEvent(new Event('input', {bubbles:true})); });
            const controls = await page.evaluate(async () => {
                const { Weapon } = await import('/src/components/Weapon.ts');
                const { Renderable } = await import('/src/components/Renderable.ts');
                const player = [...window.gameInstance.entities.values()].find(entity => entity.tags.has('player'));
                return [player.getComponent(Weapon).currentWeaponIndex, player.getComponent(Renderable).color];
            });
            assert.deepEqual(controls,[11,'#a34635']);
            await page.click('#drawing-finish'); await page.waitForSelector('#game-over:visible');
            assert(await page.evaluate(() => window.gameInstance.getExportCanvas().toDataURL() === window.drawingPaperBaseline.pixels), 'finished PNG/gallery artwork excludes desk, frame and UI');
            await page.click('#replay-btn'); await page.click('#replay-skip');
            assert(await page.locator('#replay-canvas').evaluate(canvas => canvas.toDataURL() === window.drawingPaperBaseline.pixels));
            await page.click('#replay-close'); await page.click('#back-main-btn');
            assert.equal(await page.locator('#courtyardCanvas').isVisible(), false, 'desk follows normal return-to-menu hiding');
            await page.click('#defense-mode-btn'); await page.click('#start-run-btn'); await page.click('#skip-defense-intro');
            await page.waitForFunction(() => document.getElementById('courtyardCanvas').dataset.scene === 'ruins');
            await page.evaluate(() => window.gameInstance.gameOver(0, true)); await page.click('#back-main-btn');
            await page.click('#drawing-mode-btn');
            await page.waitForFunction(() => document.getElementById('courtyardCanvas').dataset.scene === 'drawing');
            assert(await page.locator('#drawing-hud').isVisible(), 'returning from guard restores the drawing toolbar');
            results.push({dpr, screenshots:6, noArtworkContamination:true, staticCache:true, ownershipRestore:'byte-exact', modeSwitch:true});
        } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok:true, screenshots:output, results}, null, 2));
} finally { await browser.close(); }
