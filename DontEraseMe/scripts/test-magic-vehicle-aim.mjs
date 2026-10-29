// Isolated browser checks for aim limits, attack direction and visual alignment.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
try {
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173/index.html');
    const result = await page.evaluate(async () => {
        const { MagicPenSystem } = await import('/src/systems/MagicPenSystem.ts');
        const { MagicManifestation } = await import('/src/components/MagicManifestation.ts');
        const { Entity } = await import('/src/core/Entity.ts');
        const { Transform } = await import('/src/components/Transform.ts');
        const { Renderable } = await import('/src/components/Renderable.ts');
        const { Health } = await import('/src/components/Health.ts');
        const { Velocity } = await import('/src/components/Velocity.ts');
        const { PlayerControl } = await import('/src/components/PlayerControl.ts');
        const { InputSystem } = await import('/src/systems/InputSystem.ts');
        const { drawDoodleSkillEntity } = await import('/src/art/DoodleSkillArt.ts');
        const imageHash = vehicle => {
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.translate(128,128); drawDoodleSkillEntity(ctx,vehicle,1);
            const pixels = ctx.getImageData(0,0,256,256).data;
            let hash=2166136261; for (let i=0;i<pixels.length;i++) hash=Math.imul(hash ^ pixels[i],16777619);
            return hash >>> 0;
        };
        const run = (type, mouseDegrees, enemyDegrees, facing=1) => {
            const spawned=[]; const system=new MagicPenSystem(e=>spawned.push(e),()=>true);
            const player=new Entity(); player.tags.add('player');
            const angle=mouseDegrees*Math.PI/180, playerT=new Transform(100,100,angle);
            player.addComponent(playerT); player.addComponent(new Renderable()); system.addEntity(player);
            const vehicle=system.createManifestation(player,type,'B',1); system.addEntity(vehicle);
            const m=vehicle.getComponent(MagicManifestation) || [...vehicle.components.values()].find(c=>c.constructor.name==='MagicManifestation');
            m.visualFacing=facing;
            const target=new Entity(); target.tags.add('enemy'); const a=enemyDegrees*Math.PI/180;
            target.addComponent(new Transform(100+100*Math.cos(a),100+100*Math.sin(a)));
            target.addComponent(new Health(100,100)); system.addEntity(target);
            system.updateManifestations(player,playerT,1);
            const v=spawned[0]?.getComponent(Velocity);
            const hash=imageHash(vehicle), prior=m.visualAim; m.visualAim=0; const neutral=imageHash(vehicle); m.visualAim=prior;
            return { shots:spawned.length, x:v?.x, y:v?.y, aim:m.visualAim, facing:m.visualFacing, hash, neutral };
        };
        const oldAuto=window.gameInstance.autoAttackEnabled; window.gameInstance.autoAttackEnabled=true;
        const inputResult={};
        for (const type of ['tank','robot']) {
            const p=new Entity(); p.tags.add('player');p.tags.add('magic_piloting_'+type);
            const transform=new Transform(100,100,0);p.addComponent(transform);p.addComponent(new Velocity());p.addComponent(new PlayerControl());
            const input=new InputSystem({ mouse:{x:200,y:50,down:false},isKeyDown:()=>false },{x:0,y:0}); input.addEntity(p);input.update(1/60);
            inputResult[type]=transform.rotation;
        }
        window.gameInstance.autoAttackEnabled=oldAuto;
        const output={ inputResult };
        for(const type of ['tank','robot']) output[type]={right:run(type,20,10), left:run(type,160,170), up:run(type,-89,0), down:run(type,89,0), outside:run(type,0,70), behind:run(type,0,180), leftUp:run(type,-91,180,-1)};
        return output;
    });
    const epsilon=1e-6, radians=d=>d*Math.PI/180;
    for(const type of ['tank','robot']) {
        assert(Math.abs(result.inputResult[type]-Math.atan2(-50,100))<epsilon,`${type} reads mouse with auto attack on`);
        const r=result[type];
        for(const key of ['right','left','up','down','leftUp']) {
            const shot=r[key];assert.equal(shot.shots,1,`${type} ${key} fires`);
            assert(Math.abs(Math.atan2(shot.y,Math.abs(shot.x))-shot.aim)<epsilon,`${type} ${key} visual and bullet aim agree`);
            assert.equal(Math.sign(shot.x),shot.facing,`${type} ${key} facing matches shot`);
            assert(Math.abs(shot.aim)<=radians(35)+epsilon,`${type} ${key} aim limited`);
        }
        assert(Math.abs(r.up.aim+radians(35))<epsilon && Math.abs(r.down.aim-radians(35))<epsilon,`${type} near-vertical aim clamps`);
        assert.notEqual(r.right.hash,r.right.neutral,`${type} aim changes visible barrel/arm`);
        assert.equal(r.outside.shots,0,`${type} target outside vertical arc does not trigger`);
        assert.equal(r.behind.shots,0,`${type} target behind does not trigger`);
    }
    console.log('PASS: ground vehicles use mouse aim with auto attack, clamp both sides, align visible arms and bullets, and gate out-of-arc targets.');
} finally { await browser.close(); }
