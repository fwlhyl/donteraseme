// Run against a local Vite server. Uses an isolated browser context, never the
// developer's save. Set PLAYWRIGHT_MODULE_PATH if Playwright is bundled elsewhere.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const url = process.env.REPLAY_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text()); });
const output = await mkdtemp(join(tmpdir(), 'donteraseme-replay-'));

try {
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.gameInstance));
    const core = await page.evaluate(async () => {
        const { StrokeLog } = await import('/src/core/StrokeLog.ts');
        const { DefensePainting } = await import('/src/core/DefensePainting.ts');
        const { ArtReplayRecording } = await import('/src/core/ArtReplayRecording.ts');
        const check = (condition, message) => { if (!condition) throw new Error(message); };
        const canvas = (w = 320, h = 200) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
        const compare = (a, b) => {
            const aa = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
            const bb = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
            let difference = 0;
            for (let i = 0; i < aa.length; i++) difference += Math.abs(aa[i] - bb[i]);
            return difference / aa.length;
        };
        const live = canvas(), replay = canvas();
        const log = new StrokeLog();
        const ctx = log.wrapContext(live.getContext('2d'));
        log.start(320, 200);
        ctx.fillStyle = '#123456'; ctx.fillRect(10, 10, 70, 30);
        log.advance(1);
        ctx.save(); ctx.strokeStyle = 'rgba(240,80,20,0.5)'; ctx.globalAlpha = .6;
        ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(25, 50); ctx.lineTo(160, 130); ctx.stroke(); ctx.restore();
        log.advance(1);
        ctx.save(); ctx.translate(80, 80); ctx.rotate(.3);
        ctx.fillStyle = '#cc5588'; ctx.beginPath(); ctx.ellipse(0, 0, 35, 16, .2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(30, 160); ctx.bezierCurveTo(50, 30, 110, 160, 190, 170); ctx.quadraticCurveTo(240, 70, 290, 170);
        ctx.strokeStyle = '#bada55'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(75, 80, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.clearRect(12, 12, 10, 10);
        const cursor = log.createCursor({ trail: replay.getContext('2d'), erase() {}, repair() {} });
        check(cursor.renderUntil(0, 1), 'timestamp zero should include first draw only');
        check(!cursor.renderUntil(2, 1), 'event budget must yield');
        while (!cursor.renderUntil(2, 2)) {}
        const meanDifference = compare(live, replay);
        check(meanDifference < .12, `draw replay differs: ${meanDifference}`);
        check(log.overflowAt === null, 'supported Canvas commands must not use snapshots');
        log.finish(); const count = log.eventCount; const duration = log.duration;
        log.advance(90); ctx.fillRect(0, 0, 10, 10);
        check(log.eventCount === count && log.duration === duration, 'finished log must be immutable');
        log.start(320, 200);
        check(log.eventCount === 0 && log.duration === 0 && !log.hasContent, 'new runs must clear old data');

        const guardLog = new StrokeLog(); guardLog.start(900, 600);
        const guard = new DefensePainting(canvas(900, 600), 900, 600);
        const guardReplay = new DefensePainting(canvas(900, 600), 900, 600);
        guard.beginBuiltInPainting(); guardReplay.beginBuiltInPainting();
        guard.onErase = (...args) => guardLog.recordErase(...args);
        guard.onRepair = (...args) => guardLog.recordRepair(...args);
        guardLog.advance(1); guard.eraseAt(450, 300, 100, .4);
        guardLog.advance(1); guard.repairStroke(350, 300, 0, 200, 40, .25);
        const guardCursor = guardLog.createCursor({ trail: canvas(900, 600).getContext('2d'), erase: (...args) => guardReplay.eraseAt(...args), repair: (...args) => guardReplay.repairStroke(...args) });
        guardCursor.renderUntil(2);
        check(compare(guard.canvas, guardReplay.canvas) < .1, 'guard erasure/repair must reproduce the real mask');
        guardLog.recordMagicDrawing({ type: 'tank', grade: 'A', width: 640, height: 360, strokes: [[{ x: 1, y: 1 }, { x: 1.1, y: 1 }, { x: 50, y: 50 }]] });
        check(guardLog.magicDrawings[0].strokes[0].length === 2, 'board points should be distance-thinned');
        check(guardLog.eventCount === 2, 'board drawings must not contaminate world commands');

        const bounded = new StrokeLog(1024); bounded.start(320, 200);
        const limited = bounded.wrapContext(canvas().getContext('2d'));
        for (let i = 0; i < 100; i++) { bounded.advance(.1); limited.fillRect(i, 0, 3, 3); }
        check(bounded.overflowAt !== null && bounded.byteLength <= 1024, 'numeric log must honor its budget');
        const recording = new ArtReplayRecording(); recording.start(320, 200, false);
        recording.log.overflowAt = 0;
        recording.captureTail(canvas(), live);
        await new Promise(resolve => setTimeout(resolve, 100));
        check(recording.snapshots.length === 1 && recording.snapshots[0].blob.size > 0, 'snapshot tail should retain heavy passages');
        recording.clear();
        check(recording.snapshots.length === 0 && recording.finalArtwork === null, 'leaving results must release the run');
        // Synthetic 20-minute drawing stream: verify timeline/chunk boundaries
        // and memory without needing to wait 20 minutes of wall-clock time.
        const longRun = new StrokeLog(); longRun.start(16, 16);
        const longCanvas = canvas(16, 16);
        const longCtx = longRun.wrapContext(longCanvas.getContext('2d'));
        const started = performance.now();
        for (let frame = 0; frame < 72000; frame++) {
            longRun.advance(1 / 60);
            for (let dot = 0; dot < 5; dot++) {
                longCtx.beginPath(); longCtx.arc((frame + dot) % 16, dot * 3, 1, 0, Math.PI * 2); longCtx.fill();
            }
        }
        const longRunResult = { seconds: longRun.duration, events: longRun.eventCount, bytes: longRun.byteLength, recordingMs: performance.now() - started };
        check(Math.abs(longRun.duration - 1200) < .01 && longRun.eventCount === 360000, '20-minute synthetic stream must retain all commands');
        check(longRun.overflowAt === null && longRun.byteLength <= 96 * 1024 * 1024, 'representative long stream should fit the budget');
        longRun.clear();
        return { meanDifference, guardEvents: guardLog.eventCount, boundedBytes: bounded.byteLength, longRun: longRunResult };
    });
    console.log('Core replay checks:', core);

    await page.locator('#create-mode-btn').click();
    await page.locator('.char-card:not(.locked)').first().click();
    await page.locator('.weap-card:not(.locked)').first().click();
    await page.locator('#start-run-btn').click();
    await page.waitForFunction(() => window.gameInstance.state === 1);
    await page.mouse.move(940, 300);
    await page.mouse.down();
    await page.keyboard.down('d');
    await page.waitForTimeout(2000);
    await page.keyboard.up('d');
    await page.mouse.up();
    // Exercise the shipped systems deterministically in this isolated test run.
    const run = await page.evaluate(async () => {
        const game = window.gameInstance;
        game.stop();
        const { Health } = await import('/src/components/Health.ts');
        const { Score } = await import('/src/components/Score.ts');
        const { Weapon, WEAPONS } = await import('/src/components/Weapon.ts');
        const player = [...game.entities.values()].find(e => e.tags.has('player'));
        const health = player.getComponent(Health); health.current = health.max = 1000000;
        // Give each weapon a short actual update period; normal purchase save is untouched.
        for (const weapon of WEAPONS) {
            const held = player.getComponent(Weapon);
            held.currentWeaponIndex = WEAPONS.indexOf(weapon);
            held.cooldown = 0;
            held.reloading = false;
            held.ammo[held.currentWeaponIndex] = weapon.magSize;
            game.inputManager.mouse.down = true;
            for (let i = 0; i < 12; i++) {
                game.artRecording.log.advance(1 / 60);
                game.isRunning = true;
                game.update(1 / 60);
            }
            // Burst weapons enqueue real timers; let them draw before switching.
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        game.stop(); game.inputManager.mouse.down = false;
        player.getComponent(Score).coins = 37;
        // Add a meaningful duration to exercise controls without a real-time 20m wait.
        game.artRecording.log.advance(120);
        const events = game.artRecording.log.eventCount;
        const fallback = game.artRecording.log.fallbackReason;
        window.dispatchEvent(new CustomEvent('game-over', { detail: { score: 100 } }));
        const save = JSON.stringify(localStorage);
        return { events, fallback, save, duration: game.artRecording.log.duration };
    });
    assert(run.events > 10, `expected actual drawing events, got ${run.events}`);
    assert.equal(run.fallback, '', 'ordinary weapons should be replayed as strokes');
    await page.locator('#replay-btn').click();
    await page.locator('#replay-pause').click();
    const frozen = await page.locator('#replay-clock').textContent();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#replay-clock').textContent(), frozen, 'pause should freeze the timeline');
    await page.locator('[data-speed="10"]').click();
    assert.equal(await page.locator('[data-speed="10"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#replay-pause').click();
    await page.locator('#replay-skip').click();
    const final = await page.evaluate(() => ({
        equal: document.querySelector('#replay-canvas').toDataURL() === window.gameInstance.artRecording.finalArtwork.toDataURL(),
        state: window.gameInstance.state,
        running: window.gameInstance.isRunning,
        save: JSON.stringify(localStorage),
    }));
    assert(final.equal, 'skip must display the exact final artwork');
    assert.equal(final.running, false, 'gameplay must remain stopped during replay');
    assert.equal(final.save, run.save, 'replay must never settle coins again');
    await page.screenshot({ path: join(output, 'create-replay.png') });
    await page.locator('#replay-restart').click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.gameInstance.state === 2);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } })));
    assert.equal(await page.evaluate(() => window.gameInstance.isRunning), false, 'stale pause events must not restart results');
    await page.locator('#replay-btn').click();
    await page.locator('[data-speed="60"]').click();
    await page.waitForFunction(() => document.querySelector('#replay-pause').disabled);
    assert(await page.evaluate(() => document.querySelector('#replay-canvas').toDataURL() === window.gameInstance.artRecording.finalArtwork.toDataURL()), 'natural completion must display the final artwork');
    await page.locator('#replay-close').click();
    await page.locator('#back-main-btn').click();
    assert.equal(await page.evaluate(() => window.gameInstance.artRecording.log.eventCount), 0);

    await page.locator('#defense-mode-btn').click();
    await page.locator('#start-run-btn').click();
    await page.locator('#skip-defense-intro').click();
    await page.waitForFunction(() => window.gameInstance.state === 1);
    await page.evaluate(() => {
        const game = window.gameInstance;
        game.stop();
        game.artRecording.log.advance(10);
        game.defensePainting.eraseAt(game.worldWidth / 2, game.worldHeight / 2, 160, .4);
        game.artRecording.log.advance(10);
        game.defensePainting.repairStroke(game.worldWidth / 2 - 150, game.worldHeight / 2, 0, 220, 48, .3);
        game.artRecording.log.recordMagicDrawing({ type: 'tank', grade: 'A', width: 640, height: 360, strokes: [[{x: 170,y:230},{x:440,y:230},{x:440,y:278},{x:170,y:278},{x:170,y:230}]] });
        game.artRecording.log.advance(100);
        window.dispatchEvent(new CustomEvent('game-over', { detail: { score: 80 } }));
    });
    const beforeResize = await page.evaluate(() => window.gameInstance.trailCanvas.toDataURL());
    await page.setViewportSize({ width: 880, height: 600 });
    assert.equal(await page.evaluate(() => window.gameInstance.trailCanvas.toDataURL()), beforeResize, 'resizing must preserve original world canvas');
    await page.locator('#replay-btn').click();
    await page.waitForFunction(() => !document.querySelector('#replay-magic').hidden);
    await page.locator('#replay-pause').click();
    await page.screenshot({ path: join(output, 'guard-replay.png') });
    await page.locator('#replay-skip').click();
    assert(await page.evaluate(() => document.querySelector('#replay-canvas').toDataURL() === window.gameInstance.artRecording.finalArtwork.toDataURL()));
    await page.locator('#replay-close').click();
    await page.locator('#restart-btn').click();
    await page.locator('#skip-defense-intro').click();
    await page.waitForFunction(() => window.gameInstance.state === 1);
    const fresh = await page.evaluate(() => ({ time: window.gameInstance.artRecording.log.duration, magic: window.gameInstance.artRecording.log.magicDrawings.length, mode: window.gameInstance.currentMode }));
    assert(fresh.time < 1 && fresh.magic === 0 && fresh.mode === 'defense', 'restart should keep mode but discard the old replay');
    assert.deepEqual(errors, [], 'browser should report no script or system errors');
    console.log('Gameplay/replay checks:', { ...run, save: '(unchanged during replay)' }, 'new run:', fresh);
    console.log('Screenshots:', output);
} finally {
    await context.close();
    await browser.close();
}
