// Isolated browser smoke test. Requires a running Vite server and Playwright.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Game.update catches and logs system exceptions instead of raising pageerror.
page.on('console', message => { if (message.type() === 'error' && message.text().includes('System update failed')) errors.push(message.text()); });
try {
    await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173/index.html');
    await page.waitForFunction(() => !!window.gameInstance);
    const results = await page.evaluate(async () => {
        const { EnemyFactory } = await import('/src/entities/EnemyFactory.ts');
        const { drawDoodleEnemy } = await import('/src/art/DoodleArt.ts');
        const { DoodleMotion } = await import('/src/art/DoodleMotion.ts');
        const sizes = { chaser:34, eraser:35, shield:35, shooter:25, summoner:35, paper_plane:21,
            boss_prism:40, boss_roller:60, boss_slime:60, boss_eraser:80 };
        const result = {};
        const draw = (type, radius, time, timer) => {
            const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 600;
            const ctx = canvas.getContext('2d'); ctx.translate(300, 300);
            const pose = {x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:0,hit:0,shadowScale:1,
                step:0,moving:1,gaitPhase:time*7,time};
            const rendered = drawDoodleEnemy(ctx,type,radius,0,pose,timer);
            const data = ctx.getImageData(0,0,600,600).data;
            let count=0, hash=2166136261;
            for (let i=0;i<data.length;i+=4) if (data[i+3]) {
                count++; hash=Math.imul(hash ^ i,16777619); hash=Math.imul(hash ^ data[i],16777619);
                hash=Math.imul(hash ^ data[i+1],16777619); hash=Math.imul(hash ^ data[i+2],16777619);
            }
            return {rendered,count,hash:hash>>>0};
        };
        for (const [type,radius] of Object.entries(sizes)) {
            const entity=EnemyFactory.create(type,0,0), render=[...entity.components.values()].find(c=>c.constructor.name==='Renderable'), behavior=[...entity.components.values()].find(c=>c.constructor.name==='EnemyBehavior');
            const a=draw(type,radius,.05), b=draw(type,radius,.29);
            const motion=new DoodleMotion(0,{x:0,y:0,hp:100,attackSerial:0,kind:type});
            const moving=motion.update({x:4,y:0,hp:100,attackSerial:0,kind:type},1/60);
            result[type]={radius:render.radius,behavior:behavior.type,tag:entity.tags.has('boss'),a,b,time:moving.time};
        }
        result.rollerWarning=[draw('boss_roller',60,.2,0),draw('boss_roller',60,.2,220)];
        result.eraserWarning=[draw('boss_eraser',80,.2,400),draw('boss_eraser',80,.2,0)];
        return result;
    });
    const sizes={chaser:34,eraser:35,shield:35,shooter:25,summoner:35,paper_plane:21,
        boss_prism:40,boss_roller:60,boss_slime:60,boss_eraser:80};
    for(const [type,radius] of Object.entries(sizes)) {
        const entry=results[type]; assert.equal(entry.radius,radius,`${type} collision radius`);
        assert.equal(entry.behavior,type,`${type} behavior`); assert(entry.a.rendered && entry.a.count>10,`${type} drawn`);
        assert.notEqual(entry.a.hash,entry.b.hash,`${type} animation changes pixels`);
        if(type.startsWith('boss')) assert.equal(entry.tag,true,`${type} retains boss tag`);
        assert(Number.isFinite(entry.time),`${type} simulation clock available`);
    }
    for(const type of ['rollerWarning','eraserWarning']) assert.notEqual(results[type][0].hash,results[type][1].hash,`${type} renders`);
    // Run both modes in this private, ephemeral browser context.  Place each
    // enemy near the player so real systems and canvas rendering exercise them.
    const populate = async () => page.evaluate(async () => {
        const { EnemyFactory } = await import('/src/entities/EnemyFactory.ts');
        const g=window.gameInstance;
        const player=[...g.entities.values()].find(e=>e.tags.has('player'));
        const transform=[...player.components.values()].find(c=>c.constructor.name==='Transform');
        const types=['chaser','eraser','shield','shooter','summoner','paper_plane','boss_prism','boss_roller','boss_slime','boss_eraser'];
        for (let i=0;i<types.length;i++) g.addEntity(EnemyFactory.create(types[i],transform.x+200+(i%5)*50,transform.y-120+Math.floor(i/5)*240));
    });
    await page.evaluate(()=>window.gameInstance.startGame('endless'));
    await page.waitForFunction(()=>window.gameInstance.state===1 && window.gameInstance.isRunning);
    await populate(); await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>window.gameInstance.state),1,'creation mode continues with all types');
    await page.evaluate(()=>window.gameInstance.startGame('defense'));
    await page.locator('#skip-defense-intro').click();
    await page.waitForFunction(()=>window.gameInstance.state===1 && window.gameInstance.isRunning);
    await populate(); await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>window.gameInstance.state),1,'guard mode continues with all types');
    assert.deepEqual(errors,[]);
    console.log('PASS: 6 regular enemies and 4 bosses: factory, rendering, motion, warnings and isolated creation/guard smoke tests.');
} finally { await browser.close(); }
