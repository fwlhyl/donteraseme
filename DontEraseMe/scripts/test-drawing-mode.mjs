// Isolated save/browser: never touches the developer's wallet or artworks.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const output = await mkdtemp(join(tmpdir(), 'dont-erase-me-drawing-'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text()); });
try {
    await page.goto(process.env.DRAWING_TEST_URL || 'http://127.0.0.1:5174');
    await page.waitForFunction(() => window.gameInstance);
    await page.evaluate(async () => {
        const { PlayerProfile } = await import('/src/core/PlayerProfile.ts');
        const p = PlayerProfile.load(); p.coins = 987; p.unlockedWeaponIds = [0, 1, 2, 10, 11];
        p.unlockedCharacterIds.push('watercolor'); p.selectedCharacterId = 'watercolor'; PlayerProfile.save(p);
        window.gameInstance.selectedCharacterId = 'watercolor';
        window.gameInstance.selectedWeaponId = 11; window.gameInstance.autoAttackEnabled = true;
    });
    await page.screenshot({ path: join(output, 'menu.png') });
    await page.click('#drawing-mode-btn');
    await page.waitForSelector('#drawing-hud:visible');
    const state = await page.evaluate(async () => {
        const { PlayerStats } = await import('/src/components/PlayerStats.ts');
        const { Skill } = await import('/src/components/Skill.ts');
        const { Weapon } = await import('/src/components/Weapon.ts');
        const game = window.gameInstance, player = [...game.entities.values()].find(e => e.tags.has('player'));
        return { mode: game.currentMode, hero: player.getComponent(PlayerStats).characterId,
            passive: player.getComponent(PlayerStats).hasWatercolorPassive, skill: player.hasComponent(Skill),
            weapons: [...player.getComponent(Weapon).unlocked], selected: game.selectedCharacterId,
            white: [...game.trailCtx.getImageData(10, 10, 1, 1).data] };
    });
    assert.equal(state.mode, 'drawing'); assert.equal(state.hero, 'collector'); assert.equal(state.skill, false);
    assert.equal(Boolean(state.passive), false); assert.deepEqual(state.weapons, [0, 1, 2, 10, 11]);
    assert.equal(state.selected, 'watercolor'); assert.deepEqual(state.white, [255, 255, 255, 255]);
    assert.equal(await page.locator('#drawing-weapon option').count(), 5);
    await page.mouse.move(920, 450); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await page.keyboard.press('r'); await page.keyboard.press('g');
    assert.equal(await page.evaluate(() => [...window.gameInstance.entities.values()].some(e => e.tags.has('enemy'))), false);
    await page.selectOption('#drawing-weapon', '11');
    await page.mouse.move(850, 600); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    await page.screenshot({ path: join(output, 'drawing.png') });
    await page.click('#drawing-pause');
    const paused = await page.evaluate(() => ({ elapsed: window.gameInstance.drawingElapsed, duration: window.gameInstance.artRecording.log.duration, running: window.gameInstance.isRunning }));
    assert.equal(paused.running, false);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => ({ elapsed: window.gameInstance.drawingElapsed, duration: window.gameInstance.artRecording.log.duration, running: window.gameInstance.isRunning })), paused);
    await page.locator('.sketch-esc-overlay button').filter({ hasText: '继续 / Esc' }).click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    // A stationary untouched pixel remains fully opaque; no gradual erasure.
    assert.deepEqual(await page.evaluate(() => [...window.gameInstance.trailCtx.getImageData(10, 10, 1, 1).data]), [255, 255, 255, 255]);
    await page.click('#drawing-finish');
    await page.waitForSelector('#game-over:visible');
    assert.equal(await page.locator('#game-over h1').innerText(), '作品完成');
    const frozen = await page.evaluate(() => window.gameInstance.artRecording.finalArtwork.toDataURL());
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.gameInstance.artRecording.finalArtwork.toDataURL()), frozen);
    await page.click('#save-btn');
    await page.fill('#gallery-art-name', '画画测试 <安全文字>');
    await page.click('#gallery-save-confirm');
    await page.waitForFunction(() => document.querySelector('#gallery-save-status').textContent.includes('已保存'));
    // Double save updates this run, not two identical gallery entries.
    await page.click('#gallery-save-confirm');
    await page.waitForFunction(() => !document.querySelector('#gallery-save-confirm').disabled);
    const saved = await page.evaluate(async () => {
        const { GalleryStore } = await import('/src/core/GalleryStore.ts');
        const { PlayerProfile } = await import('/src/core/PlayerProfile.ts');
        const list = await GalleryStore.list();
        return { list, coins: PlayerProfile.load().coins, blob: (await GalleryStore.get(list[0].id)).blob.type };
    });
    assert.equal(saved.list.length, 1); assert.equal(saved.list[0].mode, 'drawing');
    assert.equal(saved.list[0].name, '画画测试 <安全文字>'); assert.equal(saved.coins, 987);
    assert.equal(saved.blob, 'image/png');
    const downloadPromise = page.waitForEvent('download'); await page.click('#export-art-png');
    const download = await downloadPromise; assert.ok(download.suggestedFilename().endsWith('.png'));
    await page.click('#cancel-frame-save');
    await page.click('#replay-btn');
    await page.waitForFunction(() => window.gameInstance.state === 5);
    assert.ok((await page.locator('body').innerText()).includes('纯画画 · 本次创作过程'));
    await page.evaluate(() => window.gameInstance.artReplay.close());
    await page.click('#back-main-btn');
    await page.click('#drawing-mode-btn');
    await page.evaluate(() => { const game = window.gameInstance; game.drawingElapsed = 1199.98; game.artRecording.log.advance(1199.98 - game.artRecording.log.duration); });
    await page.waitForSelector('#game-over:visible');
    assert.equal(await page.evaluate(() => window.gameInstance.drawingElapsed), 1200);
    assert.equal(await page.evaluate(() => window.gameInstance.artRecording.log.duration), 1200);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    await page.click('#back-main-btn');
    await page.click('#drawing-mode-btn'); await page.keyboard.press('Escape');
    await page.locator('.sketch-esc-overlay button').filter({ hasText: '完成绘画并查看作品' }).click();
    await page.waitForSelector('#game-over:visible');
    assert.equal(await page.locator('.sketch-esc-overlay').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks: ['Collector/no skills', 'shared unlocks/wallet', 'white canvas/no decay', 'pause', 'early finish/frozen image', 'gallery save/update', 'PNG', 'replay', '20-minute cutoff', 'Esc finish'], screenshots: output }));
} finally { await browser.close(); }
