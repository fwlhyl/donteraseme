// Isolated browser / save data. Test-only state injection reaches rare UI states;
// no developer wallet, gallery or gameplay parameters are edited.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.PAPER_UI_SCREENSHOTS || 'art-drafts/clarity-unified-2026-10-18/screenshots/ui');
await mkdir(output, { recursive: true });
const grain = await readFile(resolve('src/assets/ui/paper-grain.svg'), 'utf8');
assert.doesNotMatch(grain, /<(?:filter|feTurbulence|feGaussianBlur|image)\b/, 'paper texture is sparse vector artwork, not filtered noise or a scaled bitmap');
assert.match(grain, /viewBox="0 0 512 512"/, 'paper fibers repeat over a sparse 512px field');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const errors = [], shots = [];
const url = process.env.PAPER_UI_TEST_URL || 'http://127.0.0.1:5174';
async function fresh(browserContext = context) {
    const page = await browserContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error' && msg.text().includes('System update failed')) errors.push(msg.text()); });
    await page.goto(url); await page.waitForFunction(() => window.gameInstance);
    await page.evaluate(async () => {
        const decode = async image => {
            try { await image.decode(); }
            catch { throw new Error(`Unable to decode UI test resource: ${image.src}`); }
        };
        await document.fonts.ready;
        const image = new Image();
        image.src = getComputedStyle(document.querySelector('.menu-stage')).backgroundImage.match(/url\("?(.+?)"?\)/)[1];
        await decode(image);
        if (!image.src.includes('paper-menu-clarity-v1.webp')) throw new Error('Main menu is not using the approved clarity revision');
        const { getDoodleHeroes, getDoodleEnemies } = await import('/src/art/DoodleArt.ts');
        const { getDoodleWeapons } = await import('/src/art/DoodleWeapons.ts');
        const scene = window.gameInstance.systems.find(s => s.constructor.name === 'RenderSystem').courtyardScene;
        await Promise.all([getDoodleHeroes(), getDoodleEnemies(), getDoodleWeapons(), scene.image, scene.ruinsImage].map(decode));
    });
    return page;
}
async function shot(page, name) {
    // Let viewport-resize composition settle; never capture a half-updated frame.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: join(output, `${name}.png`), animations: 'disabled' });
    shots.push(name);
}
async function inViewport(page, selector) {
    const rect = await page.locator(selector).boundingBox(), size = page.viewportSize();
    assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= size.width + 1 && rect.y + rect.height <= size.height + 1, `${selector} is within ${size.width}x${size.height}`);
}
try {
    const menu = await fresh();
    assert.equal(await menu.locator('#main-menu .mode-entry').count(), 4);
    const colors = await menu.locator('#create-mode-btn').evaluate(e => ({ color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
    assert.equal(colors.color, 'rgb(238, 228, 200)');
    assert.equal(colors.bg, 'rgba(37, 38, 33, 0.44)');
    for (const [width, height] of [[1366,768],[1024,768],[390,844]]) {
        await menu.setViewportSize({ width, height });
        for (const id of ['create-mode-btn','defense-mode-btn','drawing-mode-btn','gallery-btn','settings-btn','exit-btn']) await inViewport(menu, `#${id}`);
        await shot(menu, `menu-${width}`);
    }
    await menu.setViewportSize({ width:1366, height:768 });
    await menu.click('#settings-btn'); await shot(menu, 'settings');
    await menu.click('#lang-en-btn');
    assert.equal(await menu.locator('#settings-btn svg').count(), 1, 'language update preserves icons');
    assert.equal(await menu.locator('#lang-en-btn').getAttribute('aria-pressed'), 'true');
    await menu.click('#lang-zh-btn'); await menu.click('#close-settings-btn');
    await menu.click('#create-mode-btn'); await shot(menu, 'preparation');
    assert.equal(await menu.locator('#selection-screen').evaluate(e => getComputedStyle(e).filter), 'none', 'preparation uses unblurred paper');
    assert.ok(await menu.locator('#selection-details').evaluate(e => e.scrollHeight <= e.clientHeight + 1), 'loadout details do not overflow their frame');
    await menu.click('#start-run-btn');
    await menu.waitForSelector('#ui:visible');
    await menu.waitForFunction(() => document.querySelector('#magic-pen-hud [data-hud="count"]').textContent.includes('45'));
    await menu.evaluate(() => {
        const game = window.gameInstance, player = [...game.entities.values()].find(e => e.tags.has('player'));
        const magic = game.systems.find(s => s.constructor.name === 'MagicPenSystem');
        magic.progressByPlayer.set(player.id, 32); magic.updateHud(player.id); game.stop();
    });
    assert.equal(await menu.locator('#magic-pen-hud [role=progressbar]').getAttribute('aria-valuenow'), '71');
    for (const s of ['#ui','#magic-pen-hud','#pause-btn','#minimapCanvas']) await inViewport(menu, s);
    await shot(menu, 'combat-hud');
    assert.equal(await menu.locator('.hud-paper').first().evaluate(e => getComputedStyle(e).textShadow), 'rgb(37, 38, 33) 0px 1px 0px', 'HUD lettering uses a sharp offset, not a blur halo');
    await menu.evaluate(() => window.gameInstance.start()); await menu.keyboard.press('Escape');
    await menu.waitForSelector('.sketch-esc-overlay:visible'); await inViewport(menu, '.sketch-dialog');
    await shot(menu, 'escape'); await menu.keyboard.press('Escape');
    await menu.click('#pause-btn'); await menu.waitForSelector('#pause-menu:visible');
    await shot(menu, 'pause-settings'); await menu.click('#resume-btn');
    await menu.evaluate(() => {
        const game = window.gameInstance, player = [...game.entities.values()].find(e => e.tags.has('player'));
        game.showLevelUpScreen(player.id);
    });
    assert.equal(await menu.locator('#level-up-cards .card').count(), 4);
    await shot(menu, 'upgrades'); await menu.locator('#level-up-cards .card').first().click();
    await menu.evaluate(() => window.gameInstance.showBossAwakeningScreen(1));
    assert.ok((await menu.locator('#level-up-screen .title').innerText()).includes('人物觉醒'));
    await shot(menu, 'awakening'); await menu.locator('#level-up-cards .card').first().click();
    assert.equal(await menu.locator('#level-up-screen .title').innerText(), '力量觉醒');
    await menu.evaluate(() => {
        const game = window.gameInstance, player = [...game.entities.values()].find(e => e.tags.has('player'));
        const magic = game.systems.find(s => s.constructor.name === 'MagicPenSystem');
        magic.progressByPlayer.set(player.id, 45); magic.updateHud(player.id);
    });
    await menu.keyboard.press('g'); await menu.waitForSelector('#magic-pen-board:visible');
    await inViewport(menu, '.sketch-board-panel'); await shot(menu, 'magic-board');
    await menu.getByRole('button', { name:'机器人', exact:true }).click();
    assert.equal(await menu.getByRole('button', { name:'机器人', exact:true }).getAttribute('aria-pressed'), 'true');
    await menu.keyboard.press('Escape'); assert.equal(await menu.locator('#magic-pen-board').isVisible(), false);
    await menu.close();

    const guard = await fresh();
    await guard.click('#defense-mode-btn'); await shot(guard, 'guard-preparation');
    await guard.click('#start-run-btn'); await guard.waitForSelector('#defense-intro:visible');
    await shot(guard, 'guard-intro'); await guard.click('#skip-defense-intro');
    await guard.waitForSelector('#defense-hud:visible');
    await guard.waitForFunction(() => document.querySelector('#magic-pen-hud [data-hud="count"]').textContent.includes('45'));
    await guard.evaluate(() => window.gameInstance.stop());
    await inViewport(guard, '#defense-hud'); await shot(guard, 'guard-hud');
    await guard.setViewportSize({ width:800, height:600 });
    await guard.evaluate(() => {
        const game = window.gameInstance;
        game.render();
        game.systems.find(s => s.constructor.name === 'RenderSystem').update(0);
        game.systems.find(s => s.constructor.name === 'MinimapSystem').update(0);
    });
    await shot(guard, 'guard-hud-800');
    const defense = await guard.locator('#defense-hud').boundingBox(), magic = await guard.locator('#magic-pen-hud').boundingBox();
    assert.ok(defense.x + defense.width < magic.x, 'small desktop guard status and magic meter do not overlap');
    await guard.close();

    const drawing = await fresh(); await drawing.click('#drawing-mode-btn');
    await drawing.waitForSelector('#drawing-hud:visible'); await shot(drawing, 'drawing-tools');
    assert.equal(await drawing.locator('#drawing-timer').evaluate(e => getComputedStyle(e).color), 'rgb(238, 228, 200)');
    await drawing.mouse.move(900,430); await drawing.mouse.down(); await drawing.waitForTimeout(250); await drawing.mouse.up();
    await drawing.click('#drawing-finish'); await drawing.waitForSelector('#game-over:visible'); await shot(drawing, 'results');
    await drawing.click('#save-btn'); await shot(drawing, 'save');
    await drawing.fill('#gallery-art-name', 'UI 测试作品'); await drawing.click('#gallery-save-confirm');
    await drawing.waitForFunction(() => document.querySelector('#gallery-save-status').textContent.includes('已保存'));
    await drawing.click('#cancel-frame-save'); await drawing.click('#replay-btn');
    await drawing.waitForSelector('#art-replay:visible'); await shot(drawing, 'replay');
    await drawing.click('#replay-close'); await drawing.click('#back-main-btn'); await drawing.click('#gallery-btn');
    await drawing.waitForSelector('.art-gallery:visible'); await drawing.waitForSelector('.gallery-artwork-card');
    await shot(drawing, 'gallery'); await drawing.click('#gallery-exit-btn');
    assert.equal(await drawing.locator('#main-menu').isVisible(), true);
    await drawing.close();

    // Actual Retina backing pixels, not a resized DPR 1 screenshot. Keep this
    // context separate from all test save data and from the user's browser.
    const retina = await browser.newContext({ viewport: { width:1366, height:768 }, deviceScaleFactor:2 });
    try {
        const page = await fresh(retina);
        assert.equal(await page.evaluate(() => devicePixelRatio), 2);
        await shot(page, 'menu-retina-2x');
        await page.click('#settings-btn'); await shot(page, 'settings-retina-2x');
        await page.click('#close-settings-btn'); await page.click('#create-mode-btn');
        await shot(page, 'preparation-retina-2x'); await page.click('#start-run-btn');
        await page.waitForSelector('#ui:visible');
        await page.waitForFunction(() => document.querySelector('#magic-pen-hud [data-hud="count"]').textContent.includes('45'));
        await page.evaluate(() => window.gameInstance.stop());
        for (const selector of ['#ui','#magic-pen-hud','#pause-btn','#minimapCanvas']) await inViewport(page, selector);
        await shot(page, 'combat-hud-retina-2x');
        await page.close();
    } finally { await retina.close(); }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok:true, screenshots:output, shots, checks:['sparse unfiltered vector paper','approved menu clarity asset','menu palette/layout','language icons','sharp HUD lettering','combat HUD','pause/settings','upgrade/awakening','magic charge/board','guard status','drawing/results/save/replay/gallery','DPR 2 menu/settings/preparation/HUD','no runtime errors'] },null,2));
} finally { await browser.close(); }
