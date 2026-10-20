// Real-browser visual / layer-isolation regression. Every run uses an isolated
// Chrome context: test artwork and progression never reach the user's profile.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.PAPER_SCENE_SCREENSHOTS || 'art-drafts/clarity-unified-2026-10-18/screenshots/scenes');
const url = process.env.PAPER_SCENE_TEST_URL || 'http://127.0.0.1:5174';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [], shots = [];
// Deliberately independent of runtime geometry: an art-only pass must not
// silently move collision / ink-clipping walls to fit its new illustration.
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
async function fresh(context) {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text());
    });
    await page.goto(url); await page.waitForFunction(() => window.gameInstance);
    await page.evaluate(async () => {
        await document.fonts.ready;
        const { getDoodleHeroes, getDoodleEnemies } = await import('/src/art/DoodleArt.ts');
        const { getDoodleWeapons } = await import('/src/art/DoodleWeapons.ts');
        const scene = window.gameInstance.systems.find(system => system.constructor.name === 'RenderSystem').courtyardScene;
        await Promise.all([getDoodleHeroes(), getDoodleEnemies(), getDoodleWeapons(), scene.image, scene.ruinsImage].map(image => image.decode()));
        window.paperFloorTest = await import('/src/world/DoodleFloor.ts');
        window.paperFloorTest.isDoodleFloorTextureReady();
    });
    await page.waitForFunction(() => window.paperFloorTest.isDoodleFloorTextureReady());
    return page;
}
async function shot(page, name) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
    shots.push(name);
}
try {
    for (const dpr of [1, 2]) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dpr });
        try {
            for (const mode of ['create', 'guard']) {
                const page = await fresh(context);
                await page.click(mode === 'guard' ? '#defense-mode-btn' : '#create-mode-btn');
                await page.click('#start-run-btn');
                if (mode === 'guard') await page.click('#skip-defense-intro');
                await page.waitForFunction(() => window.gameInstance.state === 1);
                await page.waitForFunction(() => document.querySelector('#magic-pen-hud [data-hud="count"]')?.textContent.includes('45'));
                const geometry = await page.evaluate(async () => {
                    const game = window.gameInstance; game.stop(); game.clearInput();
                    const { courtyard, COURTYARD_OUTLINE } = await import('/src/world/CourtyardGeometry.ts');
                    const { sceneBounds } = await import('/src/world/SceneLayout.ts');
                    const render = game.systems.find(system => system.constructor.name === 'RenderSystem');
                    const theme = game.currentMode === 'defense' ? 'ruins' : 'atelier';
                    // A small recorded mark proves foreground pigment remains
                    // visible while the scenery stays out of the final artwork.
                    game.artRecording.log.advance(.1);
                    game.trailCtx.save(); game.trailCtx.fillStyle = '#b74736';
                    game.trailCtx.fillRect(game.worldWidth / 2 + 70, game.worldHeight / 2 - 14, 44, 28);
                    game.trailCtx.restore();
                    const expected = document.createElement('canvas');
                    expected.width = game.worldWidth; expected.height = game.worldHeight;
                    const ctx = expected.getContext('2d');
                    if (theme === 'ruins') ctx.drawImage(game.paintingCanvas, 0, 0);
                    ctx.drawImage(game.trailCanvas, 0, 0);
                    window.paperSceneBaseline = {
                        painting: game.paintingCanvas.toDataURL(), trail: game.trailCanvas.toDataURL(),
                        export: expected.toDataURL(), events: game.artRecording.log.eventCount,
                    };
                    const sceneCanvas = document.getElementById('courtyardCanvas');
                    return {
                        world: [game.worldWidth, game.worldHeight], outline: COURTYARD_OUTLINE,
                        mappedOutline: courtyard.points, bounds: sceneBounds(game.worldWidth, game.worldHeight, theme),
                        sources: [render.courtyardScene.image.src, render.courtyardScene.ruinsImage.src],
                        separate: sceneCanvas !== game.paintingCanvas && sceneCanvas !== game.trailCanvas,
                        underPainting: Boolean(sceneCanvas.compareDocumentPosition(game.paintingCanvas) & Node.DOCUMENT_POSITION_FOLLOWING),
                    };
                });
                const world = mode === 'guard' ? [1800, 1200] : [2700, 1800];
                assert.deepEqual(geometry.world, world, `${mode} geometry is unchanged`);
                assert.deepEqual(geometry.outline, approvedOutline, 'all 44 authored collision vertices remain unchanged');
                assert.deepEqual(geometry.mappedOutline, approvedOutline.map(([x, y]) => ({ x: x / 1536 * 2700, y: y / 1024 * 1800 })));
                assert.deepEqual(geometry.bounds, mode === 'guard'
                    ? { x: -450, y: -300, width: 2700, height: 1800 }
                    : { x: -0, y: -0, width: 2700, height: 1800 });
                assert(geometry.sources[0].includes('/paper-scenes/atelier-clarity-v1.webp'));
                assert(geometry.sources[1].includes('/paper-scenes/ruins-clarity-v1.webp'));
                assert(geometry.separate && geometry.underPainting, 'scenery is a separate canvas beneath the artwork');

                for (const [position, nx, ny] of [
                    ['center', .5, .5], ['northwest', .06, .06], ['northeast', .94, .06],
                    ['southwest', .06, .94], ['southeast', .94, .94],
                ]) {
                    const view = await page.evaluate(async ({ nx, ny }) => {
                        const game = window.gameInstance;
                        const { Transform } = await import('/src/components/Transform.ts');
                        const { courtyard } = await import('/src/world/CourtyardGeometry.ts');
                        const { courtyardRadius } = await import('/src/systems/CourtyardBoundarySystem.ts');
                        const { sceneBounds, sceneCameraAxis } = await import('/src/world/SceneLayout.ts');
                        const player = [...game.entities.values()].find(entity => entity.tags.has('player'));
                        const transform = player.getComponent(Transform), radius = courtyardRadius(player);
                        const target = { x: game.worldWidth * nx, y: game.worldHeight * ny };
                        const guarded = game.currentMode === 'defense';
                        Object.assign(transform, guarded ? target : courtyard.project(target, radius));
                        game.courtyardBoundary.update(0);
                        game.render();
                        const render = game.systems.find(system => system.constructor.name === 'RenderSystem');
                        render.update(0);
                        game.systems.find(system => system.constructor.name === 'MinimapSystem').update(0);
                        // The normal game loop applies these after rendering;
                        // here simulation is stopped to make comparison exact.
                        for (const canvas of [game.trailCanvas, game.paintingCanvas]) {
                            canvas.style.transform = `translate3d(${-game.camera.x}px, ${-game.camera.y}px, 0)`;
                        }
                        const theme = guarded ? 'ruins' : 'atelier', bounds = sceneBounds(game.worldWidth, game.worldHeight, theme);
                        const scene = document.getElementById('courtyardCanvas');
                        const baseline = window.paperSceneBaseline;
                        return {
                            camera: [game.camera.x, game.camera.y],
                            expectedCamera: [sceneCameraAxis(transform.x, innerWidth, game.worldWidth, -bounds.x),
                                sceneCameraAxis(transform.y, innerHeight, game.worldHeight, -bounds.y)],
                            sceneSize: [scene.width, scene.height], scene: scene.dataset.scene, visible: scene.style.display !== 'none',
                            playerFits: guarded || courtyard.fits(transform, radius),
                            paintingIntact: baseline.painting === game.paintingCanvas.toDataURL(),
                            trailIntact: baseline.trail === game.trailCanvas.toDataURL(),
                            eventCountUnchanged: baseline.events === game.artRecording.log.eventCount,
                            exportIntact: baseline.export === game.getExportCanvas().toDataURL(),
                        };
                    }, { nx, ny });
                    assert.deepEqual(view.camera, view.expectedCamera, `${mode} ${position} uses original camera bounds`);
                    assert.deepEqual(view.sceneSize, [1366 * dpr, 768 * dpr]);
                    assert.equal(view.scene, mode === 'guard' ? 'ruins' : 'atelier');
                    assert(view.visible && view.playerFits);
                    assert(view.paintingIntact && view.trailIntact && view.eventCountUnchanged && view.exportIntact,
                        `${mode} ${position}: scenery redraw cannot paint into the artwork or its recording`);
                    await shot(page, `${mode}-${position}-${dpr}x`);
                }

                const finished = await page.evaluate(() => {
                    const game = window.gameInstance;
                    game.gameOver(0, true);
                    return {
                        finalMatches: game.artRecording.finalArtwork.toDataURL() === window.paperSceneBaseline.export,
                        exportedMatches: game.getExportCanvas().toDataURL() === window.paperSceneBaseline.export,
                        dimensions: [game.getExportCanvas().width, game.getExportCanvas().height],
                        fallback: game.artRecording.log.fallbackReason,
                    };
                });
                assert(finished.finalMatches && finished.exportedMatches, 'frozen settlement/PNG/gallery source contains only artwork layers');
                assert.deepEqual(finished.dimensions, world);
                assert.equal(finished.fallback, '', 'static scene bitmaps never trigger stroke snapshot fallback');
                await page.click('#replay-btn'); await page.click('#replay-skip');
                assert(await page.locator('#replay-canvas').evaluate(canvas => canvas.toDataURL() === window.paperSceneBaseline.export),
                    'finished replay is pixel-identical to artwork-only export');
                results.push({ mode, dpr, world, positions: 5, artworkIsolation: true, replayExact: true });
                await page.close();
            }
        } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, screenshots: output, shots, results }, null, 2));
} finally { await browser.close(); }
