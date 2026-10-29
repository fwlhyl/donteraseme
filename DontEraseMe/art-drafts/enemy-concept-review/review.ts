import { drawChaserDraft } from '../../src/art/ChaserArt';
import { drawShieldDraft } from '../../src/art/ShieldArt';
import { drawShooterDraft } from '../../src/art/ShooterArt';
import { drawPlane } from '../../src/art/PlaneArt';
import { drawSummonerDraft } from '../../src/art/SummonerArt';
import { drawEraser } from '../../src/art/EraserArt';
import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { Weapon } from '../../src/components/Weapon';

const weapon = new Weapon(0), image = getPaperCollector();
const motion = document.getElementById('motion') as HTMLButtonElement;
const background = document.getElementById('background') as HTMLButtonElement;
let moving = true, painted = false, phase = 0, elapsed = 0, moveWeight = 1, last = performance.now();
motion.onclick = () => { moving = !moving; motion.textContent = moving ? '行走' : '待机'; motion.setAttribute('aria-pressed', String(moving)); };
background.onclick = () => { painted = !painted; background.textContent = painted ? '切换到空白纸面' : '切换到彩色笔迹背景'; background.setAttribute('aria-pressed', String(painted)); };

const enemies = { chaser: {draw: drawChaserDraft, size: 68}, eraser: {draw: drawEraser, size: 70}, shield: {draw: drawShieldDraft, size: 70}, shooter: {draw: drawShooterDraft, size: 50}, summoner: {draw: drawSummonerDraft, size: 70}, plane: {draw: drawPlane, size: 42} };
function draw(canvas: HTMLCanvasElement, type: keyof typeof enemies) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#faf9f5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (painted) {
        ctx.lineCap = 'round'; ctx.globalAlpha = .75;
        for (const [color, y] of [['#f4d451',90],['#ed6f86',135],['#6cbfd2',185]] as const) {
            ctx.strokeStyle = color; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(12,y); ctx.bezierCurveTo(140,y-40,300,y+35,528,y-15); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#686c60'; ctx.font = '13px system-ui'; ctx.fillText('放大 3 倍', 16, 24); ctx.fillText('实际尺寸', 378, 24);
    ctx.strokeStyle = '#c9c9c0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(16,224); ctx.lineTo(524,224); ctx.stroke();
    const {draw: enemy, size: enemySize} = enemies[type];
    const renderEnemy = (size: number) => type === 'plane' ? drawPlane(ctx, size, phase, moveWeight, elapsed) : enemy(ctx, size, phase, moveWeight);
    const at = (x:number, y:number, drawFn:()=>void) => {ctx.save();ctx.translate(x,y);drawFn();ctx.restore();};
    at(108, 176, () => drawPaperCollector(ctx,image,156,false,0,undefined,weapon));
    at(278, 224 - enemySize * 1.5, () => renderEnemy(enemySize*3));
    at(414, 208, () => drawPaperCollector(ctx,image,52,false,0,undefined,weapon));
    at(492, 224-enemySize*.5, () => renderEnemy(enemySize));
}
function loop(now:number) {
    const dt = Math.min(.05,(now-last)/1000); last = now; elapsed += dt; moveWeight += ((moving ? 1 : 0) - moveWeight) * (1-Math.exp(-dt*12)); phase += dt * (2 + 5*moveWeight);
    for (const type of Object.keys(enemies) as (keyof typeof enemies)[]) draw(document.getElementById(type) as HTMLCanvasElement, type);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
