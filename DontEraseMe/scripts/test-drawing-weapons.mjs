// Isolated browser harness: never loads or modifies the developer's saved game.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const url = process.env.DRAWING_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.route('**/drawing-weapons-harness', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Drawing weapon tests</title><body></body>',
}));

try {
    await page.goto(`${url}/drawing-weapons-harness`);
    const results = await page.evaluate(async () => {
        const [{ WeaponSystem }, { MovementSystem }, { InputManager }, { Entity }, { Weapon, WEAPONS },
            { PlayerStats }, { Transform }, { Renderable }, { Velocity }, { StrokeLog }, { Projectile }] = await Promise.all([
            import('/src/systems/WeaponSystem.ts'), import('/src/systems/MovementSystem.ts'),
            import('/src/core/InputManager.ts'), import('/src/core/Entity.ts'), import('/src/components/Weapon.ts'),
            import('/src/components/PlayerStats.ts'), import('/src/components/Transform.ts'),
            import('/src/components/Renderable.ts'), import('/src/components/Velocity.ts'),
            import('/src/core/StrokeLog.ts'), import('/src/components/Projectile.ts'),
        ]);
        const check = (ok, message) => { if (!ok) throw new Error(message); };
        const game = window.gameInstance = { currentMode: 'drawing', state: 1, isRunning: true, autoAttackEnabled: true };
        const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200;
        const native = canvas.getContext('2d');
        const log = new StrokeLog(); const ctx = log.wrapContext(native);
        const input = new InputManager();
        const results = [];
        const harness = (id, drawing = true) => {
            const entities = new Set();
            const add = entity => { entities.add(entity); weaponSystem.addEntity(entity); movement.addEntity(entity); };
            const weaponSystem = new WeaponSystem(input, add, undefined, ctx);
            const movement = new MovementSystem(1800, 1200, add, undefined, ctx);
            const player = new Entity(); player.tags.add('player'); if (drawing) player.tags.add('drawing_mode');
            player.addComponent(new Transform(300, 600));
            player.addComponent(new Renderable('#c82e68', 20));
            player.addComponent(new Velocity());
            player.addComponent(new PlayerStats()); // No infinity buff: drawing mode must still be infinite.
            const weapon = player.addComponent(new Weapon(id)); weapon.unlocked = new Set(WEAPONS.map(item => item.id));
            add(player);
            const tick = () => {
                movement.update(1 / 60); weaponSystem.update(1 / 60); log.advance(1 / 60);
                for (const entity of entities) if (!entity.active) {
                    entities.delete(entity); weaponSystem.removeEntity(entity); movement.removeEntity(entity);
                }
            };
            return { player, weapon, weaponSystem, entities, tick };
        };

        for (const config of WEAPONS) {
            native.clearRect(0, 0, canvas.width, canvas.height); log.start(canvas.width, canvas.height);
            const h = harness(config.id);
            input.mouse.down = true; h.tick(); input.mouse.down = false;
            for (let frame = 0; frame < 650; frame++) h.tick();
            const pixels = native.getImageData(0, 0, canvas.width, canvas.height).data;
            let paintedPixels = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) paintedPixels++;
            check(paintedPixels > 20, `${config.type} leaves no paint without enemies`);
            check(log.eventCount > 0 && log.overflowAt === null, `${config.type} is not replayable`);
            check(h.weapon.ammo[config.id] === config.magSize && !h.weapon.reloading, `${config.type} consumes paint`);
            check([...h.entities].filter(entity => entity.hasComponent(Projectile)).length === 0, `${config.type} leaks projectiles`);
            const replay = document.createElement('canvas'); replay.width = canvas.width; replay.height = canvas.height;
            const replayCtx = replay.getContext('2d');
            const cursor = log.createCursor({ trail: replayCtx, erase() {}, repair() {} });
            while (!cursor.renderUntil(log.duration, 2000)) {}
            const replayPixels = replayCtx.getImageData(0, 0, canvas.width, canvas.height).data;
            let difference = 0; for (let i = 0; i < pixels.length; i++) difference += Math.abs(pixels[i] - replayPixels[i]);
            check(difference / pixels.length < 0.15, `${config.type} replay differs from the drawing`);
            results.push({ id: config.id, type: config.type, paintedPixels, replayEvents: log.eventCount });
        }

        const h = harness(0);
        input.mouse.down = true; input.keys.set('r', true);
        for (let frame = 0; frame < 450; frame++) h.tick();
        check(h.weapon.ammo[0] === WEAPONS[0].magSize && !h.weapon.reloading, 'holding fire/R must not reload');
        input.clear();
        h.weapon.unlocked = new Set([0, 1, 2]);
        input.keys.set('4', true); h.tick(); check(h.weapon.currentWeaponIndex === 0, 'locked numeric switch was allowed');
        input.clear(); input.keys.set('2', true); h.tick(); check(h.weapon.currentWeaponIndex === 1, 'unlocked switch failed');
        input.clear(); h.weapon.ammo[1] = 0; h.weapon.reloading = true; h.tick();
        check(h.weapon.ammo[1] === WEAPONS[1].magSize && !h.weapon.reloading, 'empty switched tool did not refill');

        let lateAttack = false;
        h.weaponSystem.queueAttack(h.player, () => { lateAttack = true; }, 10);
        game.isRunning = false;
        await new Promise(resolve => setTimeout(resolve, 40));
        check(!lateAttack, 'paused/finished drawing accepted a late attack');
        game.isRunning = true;
        h.weaponSystem.queueAttack(h.player, () => { lateAttack = true; }, 10);
        h.weaponSystem.removeEntity(h.player);
        await new Promise(resolve => setTimeout(resolve, 40));
        check(!lateAttack, 'old drawing owner leaked an attack into a new run');

        for (const tag of ['button', 'input', 'select', 'textarea']) {
            const control = document.createElement(tag); document.body.append(control);
            control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
            check(!input.mouse.down, `${tag} click shoots through the HUD`);
            control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'w' }));
            check(input.isKeyDown('w') === (tag === 'button'), `${tag} incorrectly captures movement/typing`);
            input.clear(); control.remove();
        }
        const swatch = document.createElement('div'); swatch.className = 'palette-swatch'; document.body.append(swatch);
        swatch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        check(!input.mouse.down, 'palette click shoots through'); swatch.remove();
        window.dispatchEvent(new MouseEvent('mousedown', { button: 2 })); check(!input.mouse.down, 'right mouse shoots');
        window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); check(input.mouse.down, 'left mouse does not shoot');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })); check(input.isKeyDown('w'), 'movement key not held');
        window.dispatchEvent(new Event('blur')); check(!input.mouse.down && !input.isKeyDown('w'), 'blur left stuck input');

        // Combat still respects auto-attack, magazine consumption, and reload.
        game.currentMode = 'endless'; game.autoAttackEnabled = true;
        const combat = harness(0, false); input.mouse.down = true; combat.tick();
        check(combat.weapon.ammo[0] === 12, 'combat auto-attack fired without enemies');
        game.autoAttackEnabled = false; combat.tick();
        check(combat.weapon.ammo[0] === 11, 'combat magazine consumption changed');
        combat.weapon.cooldown = 0; combat.weapon.ammo[0] = 1; combat.tick();
        check(combat.weapon.reloading, 'combat empty magazine no longer reloads');
        await new Promise(resolve => setTimeout(resolve, 20));
        return results;
    });
    assert.equal(results.length, 12);
    console.table(results);
    console.log('PASS: all 12 enemy-free tools, replay fidelity, infinite ink, safe switches, frozen late shots, HUD/blur input, unchanged combat magazines.');
} finally {
    await context.close();
    await browser.close();
}
