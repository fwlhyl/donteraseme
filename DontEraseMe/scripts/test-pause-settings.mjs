// Uses a fresh browser context; saved games and artwork are isolated from the player's profile.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => !!window.gameInstance);
    await page.evaluate(() => window.gameInstance.startGame('endless'));
    await page.waitForFunction(() => window.gameInstance.isRunning);
    const overlay = page.locator('.sketch-esc-overlay');
    await page.keyboard.press('Escape');
    await overlay.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    assert.equal(await overlay.locator('#color-palette').count(), 1);
    assert.equal(await overlay.locator('#setting-auto-attack').count(), 1);
    assert.equal(await overlay.locator('#setting-damage-numbers').count(), 1);
    assert.equal(await page.locator('#setting-alpha').count(), 0);
    await overlay.locator('#setting-auto-attack').check();
    await overlay.locator('#setting-damage-numbers').uncheck();
    await overlay.locator('.palette-swatch[aria-label$="#ff0000"]').click();
    const settings = await page.evaluate(async () => {
        const { Trail } = await import('/src/components/Trail.ts');
        const game = window.gameInstance;
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        return { auto: game.autoAttackEnabled, damage: game.showDamageNumbers, color: player.getComponent(Trail).color };
    });
    assert.deepEqual(settings, { auto: true, damage: false, color: '#ff0000' });
    await page.keyboard.press('Escape');
    assert.equal(await overlay.isVisible(), false);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    await page.click('#pause-btn');
    await overlay.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    assert.equal(await overlay.locator('#setting-auto-attack').isChecked(), true);
    assert.equal(await overlay.locator('#setting-damage-numbers').isChecked(), false);
    const details = await page.evaluate(async () => {
        const game = window.gameInstance;
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        const ctx = game.trailCanvas.getContext('2d');
        ctx.reset();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(1, 1, 1, 1); ctx.restore();
        const exported = game.getExportCanvas().getContext('2d').getImageData(1, 1, 1, 1).data;
        const component = name => [...player.components.values()].find(value => value.constructor.name === name);
        return { opacity: Number(getComputedStyle(game.trailCanvas).opacity), alpha: exported[3],
            quest: component('Quest').steps.map(step => step.type), score: Object.keys(component('Score')),
            scoreText: document.querySelector('.hud-score').textContent };
    });
    assert(details.opacity > 0 && details.opacity <= .25, 'combat marks are displayed faintly');
    assert.equal(details.alpha, 255, 'export retains full canvas opacity');
    assert(!details.quest.includes('rating'));
    assert(!details.score.includes('rating'));
    assert(!/评级|RATING/i.test(details.scoreText));
    await overlay.locator('button').filter({ hasText: '继续 / Esc' }).click();
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    assert.deepEqual(errors, []);
    console.log('Pause settings passed: Escape and button share controls, pause/resume, settings, faint display/full export, no rating or blocked rating quest.');
} finally { await browser.close(); }
