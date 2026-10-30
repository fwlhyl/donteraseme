// Isolated browser test: no player profile or artwork is changed.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const path = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = path ? await import(pathToFileURL(path).href) : await import('playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.goto(process.env.GAME_TEST_URL || 'http://127.0.0.1:5173/index.html');
    await page.waitForFunction(() => !!window.gameInstance);
    await page.evaluate(() => window.gameInstance.startGame('endless'));
    await page.waitForFunction(() => window.gameInstance.isRunning);
    const readSkills = () => page.evaluate(() => {
        const player = [...window.gameInstance.entities.values()].find(e => e.tags.has('player'));
        return { ...[...player.components.values()].find(c => c.constructor.name === 'PlayerStats').acquiredSkills };
    });
    const triggerLevel = () => page.evaluate(() => {
        const game = window.gameInstance;
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        game.showLevelUpScreen(player.id);
    });
    const screen = page.locator('#level-up-screen');
    const cards = screen.locator('.upgrade-card');
    const confirm = screen.locator('#level-up-confirm');
    const skip = screen.locator('#level-up-skip');
    await triggerLevel();
    assert.equal(await screen.isVisible(), true);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    assert.equal(await confirm.isDisabled(), true, 'confirmation must require a selection');
    assert.equal(await cards.count(), 4, 'four regular choices');
    const initial = await readSkills();
    await cards.nth(0).click();
    assert.equal(await cards.nth(0).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await readSkills(), initial, 'selecting must not apply an upgrade');
    await cards.nth(1).click();
    assert.equal(await cards.nth(0).getAttribute('aria-pressed'), 'false');
    assert.equal(await cards.nth(1).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await readSkills(), initial, 'changing selection must not apply upgrades');
    if (process.env.SKILL_SCREENSHOT) await page.screenshot({path: process.env.SKILL_SCREENSHOT});
    await confirm.click();
    assert.equal(await screen.isVisible(), false);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    const after = await readSkills();
    assert.equal(Object.values(after).reduce((s, n) => s + n, 0) - Object.values(initial).reduce((s, n) => s + n, 0), 1, 'confirm applies exactly one level');
    await triggerLevel();
    const beforeSkip = await readSkills();
    await cards.first().click();
    await skip.click();
    assert.deepEqual(await readSkills(), beforeSkip, 'skip discards the current selection');
    assert.equal(await screen.isVisible(), false);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    await page.evaluate(() => window.gameInstance.showBossAwakeningScreen(1));
    assert.equal(await screen.isVisible(), true, 'boss offers a separate awakening');
    assert.equal(await confirm.isDisabled(), true);
    const bossBefore = await readSkills();
    await cards.first().click();
    assert.deepEqual(await readSkills(), bossBefore);
    await confirm.click();
    const bossAfter = await readSkills();
    assert.equal((bossAfter.awakening_collector_1 || 0) - (bossBefore.awakening_collector_1 || 0), 1, 'boss confirm applies awakening');
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    // A large XP pickup really triggers multiple synchronous level events.
    await page.evaluate(() => {
        const game = window.gameInstance;
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        const exp = [...player.components.values()].find(c => c.constructor.name === 'Experience');
        exp.xp = exp.next + Math.floor(exp.next * 1.2 + 50);
        game.systems.find(s => s.constructor.name === 'LevelSystem').update(1/60);
    });
    assert.equal(await screen.isVisible(), true);
    const beforeQueue = await readSkills();
    await cards.first().click();
    await confirm.click();
    assert.equal(await screen.isVisible(), true, 'second level reward remains after first confirmation');
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false, 'game stays paused while reward is pending');
    assert.equal(await confirm.isDisabled(), true, 'queued reward needs a fresh selection');
    await skip.click();
    assert.equal(await screen.isVisible(), false);
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), true);
    const afterQueue = await readSkills();
    assert.equal(Object.values(afterQueue).reduce((s, n) => s + n, 0) - Object.values(beforeQueue).reduce((s, n) => s + n, 0), 1);
    // The previous run's no-choices timeout must not close a new run's dialog.
    await page.evaluate(async () => {
        const game = window.gameInstance;
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        const stats = [...player.components.values()].find(c => c.constructor.name === 'PlayerStats');
        const {SKILLS} = await import('/src/config/EndlessConfig.ts');
        for (const skill of SKILLS) stats.acquiredSkills[skill.id] = skill.maxLevel;
        game.showLevelUpScreen(player.id);
        game.startGame('endless');
        const next = [...game.entities.values()].find(e => e.tags.has('player'));
        game.showLevelUpScreen(next.id);
    });
    await page.waitForTimeout(1800);
    assert.equal(await screen.isVisible(), true, 'stale timeout must not close the new run reward');
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false);
    await skip.click();
    assert.deepEqual(errors, []);
    console.log('PASS: confirm, skip, boss awakening and queued level rewards.');
} finally { await context.close(); await browser.close(); }
