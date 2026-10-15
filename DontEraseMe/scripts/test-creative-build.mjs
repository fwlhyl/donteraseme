// UI-only smoke test: no /src imports, works against the production preview.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => requests.push(r.url()));
try {
    await page.goto(process.env.CREATIVE_BUILD_URL || 'http://127.0.0.1:5175');
    await page.waitForFunction(() => window.gameInstance);
    assert.equal(requests.some(url => /ArtGallery.*\.js/.test(url)), false, 'gallery must be lazy');
    await page.click('#drawing-mode-btn');
    await page.waitForSelector('#drawing-hud:visible');
    assert.equal(await page.locator('#pause-btn').isVisible(), false);
    await page.mouse.move(890, 380); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    await page.keyboard.down('d'); await page.waitForTimeout(150); await page.keyboard.up('d');
    assert.ok(await page.evaluate(() => window.gameInstance.artRecording.log.eventCount > 2), 'minified build must actually run drawing systems');
    await page.click('#drawing-finish'); await page.click('#save-btn');
    await page.fill('#gallery-art-name', '构建验收'); await page.click('#gallery-save-confirm');
    await page.waitForFunction(() => document.querySelector('#gallery-save-status').textContent.includes('已保存'));
    await page.click('#cancel-frame-save'); await page.click('#back-main-btn');
    // Delay the first gallery chunk and race the selection entry directly.
    await page.route(/ArtGallery.*\.js/, async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue(); });
    await page.click('#gallery-btn');
    await page.evaluate(() => window.gameInstance.showSelectionScreen('endless'));
    await page.waitForSelector('#art-gallery');
    await page.waitForSelector('.gallery-thumbnail');
    assert.equal(await page.locator('#selection-screen').isVisible(), false);
    assert.equal(await page.evaluate(() => window.gameInstance.state), 7);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    await page.click('.gallery-artwork-card');
    assert.ok((await page.locator('body').innerText()).includes('构建验收'));
    await page.keyboard.press('Escape');
    await page.click('#gallery-exit-btn');
    assert.equal(await page.evaluate(() => window.gameInstance.state), 0);
    assert.equal(await page.locator('#main-menu').isVisible(), true);
    assert.equal(await page.locator('#selection-screen').isVisible(), false);
    await page.click('#drawing-mode-btn'); await page.click('#drawing-finish');
    assert.equal(await page.locator('#game-over h1').innerText(), '作品完成');
    assert.deepEqual(errors, []);
    console.log('Production build passed: lazy gallery chunk, minified drawing systems, save/display, load race, return/restart.');
} finally { await browser.close(); }
