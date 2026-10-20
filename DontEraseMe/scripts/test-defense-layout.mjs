import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const output = await mkdtemp(join(tmpdir(), 'donteraseme-layout-'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.goto(process.env.REPLAY_TEST_URL || 'http://127.0.0.1:5174');
    await page.waitForFunction(() => Boolean(window.gameInstance));
    await page.locator('#defense-mode-btn').click();
    await page.locator('#start-run-btn').click();
    await page.locator('#skip-defense-intro').click();
    await page.waitForFunction(() => window.gameInstance.state === 1);
    const geometry = await page.evaluate(async () => {
        const g = window.gameInstance; g.stop();
        const { Transform } = await import('/src/components/Transform.ts');
        const player = [...g.entities.values()].find(e => e.tags.has('player')).getComponent(Transform);
        const bounds = g.defensePainting.bounds;
        return { world: [g.worldWidth, g.worldHeight], center: [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
            size: [bounds.width, bounds.height], player: [player.x, player.y],
            systems: g.systems.filter(s => 'worldWidth' in s).map(s => ({ name: s.constructor.name, width: s.worldWidth, height: s.worldHeight })) };
    });
    assert.deepEqual(geometry.world, [1800, 1200]);
    assert.deepEqual(geometry.center, [900, 600]);
    assert.deepEqual(geometry.player, [900, 600]);
    assert(geometry.size[0] > 1250 && geometry.size[1] === 960);
    for (const system of geometry.systems) assert.deepEqual([system.width, system.height], [1800, 1200], system.name);
    await page.screenshot({ path: join(output, 'guard-centered.png') });
    const baseline = await page.evaluate(() => window.gameInstance.paintingCanvas.toDataURL());
    await page.setViewportSize({ width: 2600, height: 1600 });
    await page.waitForFunction(() => window.gameInstance.width === 2600 && window.gameInstance.height === 1600);
    await page.evaluate(() => {
        const g = window.gameInstance;
        g.systems.find(s => s.constructor.name === 'RenderSystem').update(0);
        g.systems.find(s => s.constructor.name === 'MinimapSystem').update(0);
    });
    const wide = await page.evaluate(() => ({ camera: [window.gameInstance.camera.x, window.gameInstance.camera.y], paint: window.gameInstance.paintingCanvas.toDataURL() }));
    assert.deepEqual(wide.camera, [-400, -200], 'world smaller than viewport must remain centered');
    assert.equal(wide.paint, baseline, 'viewport resizing must preserve the painting');
    const pixelsMatch = await page.evaluate(async () => {
        const { DefensePainting } = await import('/src/core/DefensePainting.ts');
        const g = window.gameInstance;
        const replay = new DefensePainting(document.createElement('canvas'), g.worldWidth, g.worldHeight);
        replay.beginArtwork(g.artRecording.initialArtwork);
        g.artRecording.log.advance(1); g.defensePainting.eraseAt(900, 600, 220, .4);
        g.artRecording.log.advance(1); g.defensePainting.repairStroke(800, 600, 0, 180, 60, .3);
        const trail = document.createElement('canvas'); trail.width = g.worldWidth; trail.height = g.worldHeight;
        const cursor = g.artRecording.log.createCursor({ trail: trail.getContext('2d'), erase: (...args) => replay.eraseAt(...args), repair: (...args) => replay.repairStroke(...args) });
        while (!cursor.renderUntil(g.artRecording.log.duration)) {}
        return replay.canvas.toDataURL() === g.paintingCanvas.toDataURL();
    });
    assert(pixelsMatch, 'enlarged painting erase/repair replay must be pixel-exact');
    await page.evaluate(() => window.gameInstance.gameOver());
    await page.locator('#replay-btn').click(); await page.locator('#replay-skip').click();
    assert.deepEqual(await page.locator('#replay-canvas').evaluate(c => [c.width, c.height]), [1800, 1200]);
    await page.locator('#replay-close').click(); await page.locator('#back-main-btn').click();
    await page.locator('#create-mode-btn').click(); await page.locator('#start-run-btn').click();
    const restored = await page.evaluate(() => {
        const g = window.gameInstance; g.stop();
        return [g.worldWidth, g.worldHeight, g.trailCanvas.width, g.trailCanvas.height,
            ...g.systems.filter(s => 'worldWidth' in s).flatMap(s => [s.worldWidth, s.worldHeight])];
    });
    for (let i = 0; i < restored.length; i += 2) assert.deepEqual(restored.slice(i, i + 2), [2700, 1800]);
    assert.deepEqual(errors, []);
    console.log('PASS: compact arena, enlarged centered art, all world systems, large viewport/Retina, exact replay, mode-switch restoration.', geometry);
    console.log('Screenshots:', output);
} finally { await context.close(); await browser.close(); }
