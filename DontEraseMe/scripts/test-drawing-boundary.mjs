// Isolated browser saves only. Keep a viewport larger than the board so native
// screen clipping cannot hide a world-boundary regression (including Retina).
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = await mkdtemp(join(tmpdir(), 'dont-erase-me-boundary-'));
try {
    for (const dpr of [1, 2]) {
        const context = await browser.newContext({ viewport: { width: 2000, height: 1400 }, deviceScaleFactor: dpr });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.DRAWING_TEST_URL || 'http://127.0.0.1:5174');
        await page.waitForFunction(() => window.gameInstance);
        await page.click('#drawing-mode-btn');
        const result = await page.evaluate(async () => {
            const [{ Entity }, { Transform }, { Renderable }, { Projectile }, { Weapon }] = await Promise.all([
                import('/src/core/Entity.ts'), import('/src/components/Transform.ts'), import('/src/components/Renderable.ts'),
                import('/src/components/Projectile.ts'), import('/src/components/Weapon.ts'),
            ]);
            const check = (ok, message) => { if (!ok) throw Error(message); };
            const game = window.gameInstance; game.stop();
            const render = game.systems.find(s => s.constructor.name === 'RenderSystem');
            const player = [...game.entities.values()].find(e => e.tags.has('player'));
            const transform = player.getComponent(Transform);
            const w = game.worldWidth, h = game.worldHeight, dpr = window.devicePixelRatio;
            const renderDpr = game.gameCtx.getTransform().a;
            check(renderDpr === Math.min(dpr, 1), 'game rendering must cap DPR at 1');
            check(game.gameCanvas.width === Math.floor(game.width * renderDpr)
                && game.gameCanvas.height === Math.floor(game.height * renderDpr), 'game backing size must use capped DPR');
            // Preserve scenery as the reference: only *new ink/effects* must not
            // spill beyond the board, not its decorative outline.
            const draw = () => { game.gameCtx.clearRect(0, 0, game.gameCanvas.width, game.gameCanvas.height); render.update(0); };
            const pixels = () => game.gameCtx.getImageData(0, 0, game.gameCanvas.width, game.gameCanvas.height).data;
            draw(); const baseline = pixels();
            for (const [x, y, rotation] of [[6, h / 2, Math.PI], [w - 6, h / 2, 0], [w / 2, 6, -Math.PI / 2], [w / 2, h - 6, Math.PI / 2]]) {
                const line = new Entity();
                line.addComponent(new Transform(x, y, rotation));
                line.addComponent(new Renderable('#ff00ee', 24, 500, 48, 'line'));
                line.addComponent(new Projectile('sniper', 0, player.id, 60));
                game.addEntity(line);
                const circle = new Entity();
                circle.addComponent(new Transform(x, y));
                circle.addComponent(new Renderable('#ff00ee', 65));
                circle.tags.add('particle'); game.addEntity(circle);
            }
            draw(); const painted = pixels();
            let outsideChanges = 0, insideChanges = 0;
            const pxW = game.gameCanvas.width;
            for (let i = 0; i < painted.length; i += 4) {
                if (painted[i] === baseline[i] && painted[i + 1] === baseline[i + 1] && painted[i + 2] === baseline[i + 2] && painted[i + 3] === baseline[i + 3]) continue;
                const x = (i / 4 % pxW + .5) / renderDpr + game.camera.x;
                const y = (Math.floor(i / 4 / pxW) + .5) / renderDpr + game.camera.y;
                if (x < 0 || y < 0 || x >= w || y >= h) outsideChanges++;
                else insideChanges++;
            }
            check(insideChanges > 50, 'edge effects should remain visible inside the map');
            check(outsideChanges === 0, `${outsideChanges} live effect pixels overflow the drawing map at DPR ${dpr}`);

            // Exercise the actual weapon brush with rotations at every corner.
            for (const e of [...game.entities.values()]) if (e !== player) game.removeEntity(e.id);
            const weapon = player.getComponent(Weapon);
            weapon.unlocked = new Set(Array.from({ length: 12 }, (_, id) => id));
            const weaponSystem = game.systems.find(s => s.constructor.name === 'WeaponSystem');
            for (const [x, y, rotation] of [[5, 5, -Math.PI / 4], [w - 5, 5, -.2], [w - 5, h - 5, .7], [5, h - 5, Math.PI]]) {
                Object.assign(transform, { x, y, rotation });
                for (const id of [2, 4, 8]) {
                    weapon.currentWeaponIndex = id; weapon.cooldown = 0;
                    game.isRunning = true; game.inputManager.mouse.down = true;
                    weaponSystem.update(1 / 60);
                    game.inputManager.mouse.down = false; game.isRunning = false;
                    game.artRecording.log.advance(.1);
                }
            }
            const replay = document.createElement('canvas'); replay.width = w + 150; replay.height = h + 150;
            const ctx = replay.getContext('2d');
            const cursor = game.artRecording.log.createCursor({ trail: ctx, erase() {}, repair() {} });
            while (!cursor.renderUntil(game.artRecording.log.duration, 4000)) {}
            const right = ctx.getImageData(w, 0, 150, replay.height).data;
            const bottom = ctx.getImageData(0, h, replay.width, 150).data;
            check(!right.some((value, i) => i % 4 === 3 && value), 'replay ink escaped the right border');
            check(!bottom.some((value, i) => i % 4 === 3 && value), 'replay ink escaped the bottom border');
            check(game.artRecording.log.overflowAt === null, 'boundary must remain vector replayable');
            const live = game.trailCtx.getImageData(0, 0, w, h).data;
            const recorded = ctx.getImageData(0, 0, w, h).data;
            let difference = 0;
            for (let i = 0; i < live.length; i++) difference += Math.abs(live[i] - recorded[i]);
            check(difference / live.length < .15, 'clipped replay and live painting disagree');
            game.gameOver(0, true);
            const final = game.getExportCanvas();
            check(final.width === w && final.height === h, 'PNG/gallery export must retain the map bounds');
            return { dpr, renderDpr, outsideChanges, insideChanges, replayDifference: difference / live.length, export: [final.width, final.height] };
        });
        await page.evaluate(() => { document.getElementById('game-over').style.display = 'none'; });
        await page.screenshot({ path: join(output, `boundary-${dpr}x.png`) });
        assert.deepEqual(errors, []);
        console.log(result);
        await context.close();
    }
    console.log('PASS: four-edge live effects, rotated brushes, replay/export and DPR 1/2.', output);
} finally { await browser.close(); }
