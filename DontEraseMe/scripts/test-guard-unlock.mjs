// Isolated browser profile verifies the complete drawing-to-guard unlock flow.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.goto(process.env.DRAWING_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => !!window.gameInstance);
    await page.waitForFunction(() => document.querySelector('#defense-mode-btn').getAttribute('aria-disabled') === 'true');
    assert.match(await page.locator('#defense-mode-btn').getAttribute('title'), /画画模式/);
    await page.click('#defense-mode-btn', { force: true });
    assert.equal(await page.locator('#selection-screen').isVisible(), false);
    await page.click('#drawing-mode-btn');
    await page.waitForSelector('#drawing-hud:visible');
    await page.evaluate(() => {
        const ctx = window.gameInstance.trailCtx;
        ctx.save(); ctx.strokeStyle = '#ed3158'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(400, 400); ctx.lineTo(700, 400); ctx.lineTo(700, 650); ctx.stroke(); ctx.restore();
    });
    await page.click('#drawing-finish');
    await page.waitForSelector('#game-over:visible');
    const original = await page.evaluate(() => window.gameInstance.artRecording.finalArtwork.toDataURL('image/png'));
    await page.click('#save-btn');
    await page.fill('#gallery-art-name', '我的守卫作品');
    await page.click('#gallery-save-confirm');
    await page.waitForFunction(() => document.querySelector('#gallery-save-status').textContent.includes('已保存到我的画廊'), null, { timeout: 30000 });
    const saved = await page.evaluate(async () => {
        const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
        const id = await ArtworkStore.getDrawingArtworkId();
        const art = await ArtworkStore.getArtwork(id);
        return { id, selected: await ArtworkStore.getSelectedArtworkId(), name: art.name, raster: art.rasterDataUrl };
    });
    assert.equal(saved.id, saved.selected);
    assert.equal(saved.name, '我的守卫作品');
    assert.equal(saved.raster, original);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#defense-mode-btn').getAttribute('aria-disabled') === 'false');
    await page.click('#defense-mode-btn');
    await page.waitForFunction(() => window.gameInstance.artworkPicker.selected?.name === '我的守卫作品');
    assert.equal(await page.locator('.defense-art-card').count(), 1);
    await page.click('#start-run-btn');
    await page.waitForSelector('#defense-artwork-overlay:visible');
    await page.click('#defense-art-start');
    await page.waitForSelector('#defense-intro:visible');
    await page.click('#skip-defense-intro');
    await page.waitForFunction(() => window.gameInstance.defensePainting.active);
    assert.equal(await page.evaluate(() => window.gameInstance.defensePainting.name), '我的守卫作品');
    assert.deepEqual(errors, []);
    console.log('Guard unlock: locked, drawing saved, original PNG retained, reload, guard start passed.');
} finally { await browser.close(); }
