// Isolated real-browser integration checks. Start Vite first; set
// PLAYWRIGHT_MODULE_PATH if Playwright is outside this project.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173/index.html');
    const results = await page.evaluate(async () => {
        const { MagicPenSystem } = await import('/src/systems/MagicPenSystem.ts');
        const { MagicManifestation } = await import('/src/components/MagicManifestation.ts');
        const { Entity } = await import('/src/core/Entity.ts');
        const { Transform } = await import('/src/components/Transform.ts');
        const { Renderable } = await import('/src/components/Renderable.ts');
        const { Health } = await import('/src/components/Health.ts');
        const { Projectile } = await import('/src/components/Projectile.ts');
        const { Velocity } = await import('/src/components/Velocity.ts');
        const { drawDoodleSkillEntity } = await import('/src/art/DoodleSkillArt.ts');
        const snapshot = (entity, time) => {
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.translate(128, 128);
            const drawn = drawDoodleSkillEntity(ctx, entity, time);
            const bytes = ctx.getImageData(0, 0, 256, 256).data;
            let h = 2166136261, count = 0;
            for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3]) {
                count++; h = Math.imul(h ^ i, 16777619);
                h = Math.imul(h ^ bytes[i], 16777619); h = Math.imul(h ^ bytes[i + 1], 16777619);
            }
            return { drawn, count, hash: h >>> 0 };
        };
        const fixture = type => {
            const spawned = [];
            const system = new MagicPenSystem(e => spawned.push(e), () => true);
            const player = new Entity(); player.tags.add('player');
            player.addComponent(new Transform(100, 100, 0)); player.addComponent(new Renderable());
            system.addEntity(player);
            const vehicle = system.createManifestation(player, type, 'B', 1);
            system.addEntity(vehicle);
            // Vite HMR can load the edited component at a versioned URL while
            // this test's direct import uses the original URL.
            const m = vehicle.getComponent(MagicManifestation) || [...vehicle.components.values()].find(c => c.constructor.name === 'MagicManifestation');
            return { system, player, vehicle, spawned, m };
        };
        const output = {};
        for (const type of ['tank', 'robot', 'bomber']) {
            const f = fixture(type), position = f.player.getComponent(Transform);
            const idle = snapshot(f.vehicle, .75);
            for (let i = 0; i < 25; i++) { position.x += 3; f.system.updateManifestations(f.player, position, 1); }
            const following = f.vehicle.getComponent(Transform).x === position.x;
            const moving = f.m.visualMoving, walk = snapshot(f.vehicle, .75);
            for (let i = 0; i < 35; i++) f.system.updateManifestations(f.player, position, 1);
            const stopped = f.m.visualMoving;
            const enemy = new Entity(); enemy.tags.add('enemy'); enemy.addComponent(new Transform(position.x + 60, position.y)); enemy.addComponent(new Health(100, 100)); f.system.addEntity(enemy);
            f.m.attackCooldown = 0; f.system.updateManifestations(f.player, position, 1);
            const fired = f.m.visualAttackFrames, projectile = f.spawned.at(-1);
            const projectileStats = projectile && { damage: projectile.getComponent(Projectile)?.damage, x: projectile.getComponent(Transform)?.x, vx: projectile.getComponent(Velocity)?.x, tags: [...projectile.tags].sort() };
            f.m.visualAttackFrames = 6; const attacking = snapshot(f.vehicle, .75);
            f.m.visualAttackFrames = 0; const neutral = snapshot(f.vehicle, .75);
            const afterRender = { cooldown: f.m.attackCooldown, remaining: f.m.remainingFrames, x: f.vehicle.getComponent(Transform).x, projectile: projectile && { damage: projectile.getComponent(Projectile)?.damage, x: projectile.getComponent(Transform)?.x, vx: projectile.getComponent(Velocity)?.x, tags: [...projectile.tags].sort() } };
            const cooldown = f.m.attackCooldown, remaining = f.m.remainingFrames;
            f.m.visualAttackFrames = 10; snapshot(f.vehicle, .75);
            const visualOnly = f.m.attackCooldown === cooldown && f.m.remainingFrames === remaining && JSON.stringify(projectileStats) === JSON.stringify(afterRender.projectile);
            // Same combat state with two different pre-existing visual pulse
            // values must produce identical attacks and cooldowns.
            const simulate = pulse => {
                const g = fixture(type), p = g.player.getComponent(Transform);
                const target = new Entity(); target.tags.add('enemy');
                target.addComponent(new Transform(p.x + 60, p.y)); target.addComponent(new Health(100, 100)); g.system.addEntity(target);
                g.m.visualAttackFrames = pulse; g.m.attackCooldown = 0;
                g.system.updateManifestations(g.player, p, 1);
                const shot = g.spawned.at(-1);
                return { count: g.spawned.length, cooldown: g.m.attackCooldown,
                    damage: shot?.getComponent(Projectile)?.damage, speedX: shot?.getComponent(Velocity)?.x };
            };
            const combatIndependent = JSON.stringify(simulate(0)) === JSON.stringify(simulate(9));
            output[type] = { idle, walk, attacking, neutral, following, moving, stopped, fired, projectileStats, visualOnly, combatIndependent };
        }
        return output;
    });
    for (const type of ['tank', 'robot', 'bomber']) {
        const r = results[type];
        assert(r.idle.drawn && r.idle.count > 20, `${type} renders`);
        assert(r.following && r.moving > .8 && r.stopped < .01, `${type} follows actual movement and stops`);
        assert.notEqual(r.walk.hash, r.idle.hash, `${type} walk differs from idle`);
        assert.equal(r.fired, 12, `${type} attack triggers visual signal`);
        assert(r.projectileStats?.damage > 0 && r.projectileStats.tags.includes('magic-pen-projectile'), `${type} preserves attack projectile`);
        assert.notEqual(r.attacking.hash, r.neutral.hash, `${type} attack pose is visible`);
        assert(r.visualOnly, `${type} rendering/visual signal does not mutate combat`);
        assert(r.combatIndependent, `${type} attack result is independent of visual pulse`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: tank, robot, bomber follow movement, settle, show firing poses and retain combat projectiles.');
} finally { await browser.close(); }
