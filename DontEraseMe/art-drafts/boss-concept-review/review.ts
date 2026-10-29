import { drawBossPrismDraft } from '../../src/art/BossPrismArt';
import { drawBossRollerDraft } from '../../src/art/BossRollerArt';
import { drawBossSlimeDraft } from '../../src/art/BossSlimeArt';
import { drawBossEraserDraft } from '../../src/art/BossEraserArt';
import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { Weapon } from '../../src/components/Weapon';

const image = getPaperCollector(), weapon = new Weapon(0);
const motion = document.getElementById('motion') as HTMLButtonElement;
const background = document.getElementById('background') as HTMLButtonElement;
let active = true, painted = false, phase = 0, weight = 1, last = performance.now();
motion.onclick = () => { active = !active; motion.textContent = active ? '动作' : '待机'; motion.setAttribute('aria-pressed', String(active)); };
background.onclick = () => { painted = !painted; background.textContent = painted ? '切换到空白纸面' : '切换到彩色笔迹背景'; background.setAttribute('aria-pressed', String(painted)); };
const bosses = {prism:{draw:drawBossPrismDraft,size:100},roller:{draw:drawBossRollerDraft,size:140},slime:{draw:drawBossSlimeDraft,size:140},eraser:{draw:drawBossEraserDraft,size:200}};
function draw(canvas:HTMLCanvasElement, type:keyof typeof bosses) {
    const ctx = canvas.getContext('2d')!, {draw:boss,size} = bosses[type];
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#faf9f5';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(painted){ctx.lineCap='round';ctx.globalAlpha=.75;for(const [color,y] of [['#f4d451',120],['#ed6f86',205],['#6cbfd2',285]] as const){ctx.strokeStyle=color;ctx.lineWidth=28;ctx.beginPath();ctx.moveTo(12,y);ctx.bezierCurveTo(190,y-45,420,y+35,708,y-15);ctx.stroke();}ctx.globalAlpha=1;}
    ctx.fillStyle='#686c60';ctx.font='14px system-ui';ctx.fillText('放大比较',16,24);ctx.fillText('尺寸参考',460,24);
    ctx.strokeStyle='#c9c9c0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(16,322);ctx.lineTo(704,322);ctx.stroke();
    const at=(x:number,y:number,fn:()=>void)=>{ctx.save();ctx.translate(x,y);fn();ctx.restore();};
    at(72,290,()=>drawPaperCollector(ctx,image,73,false,0,undefined,weapon));
    at(268,322-size*.7,()=>boss(ctx,size*1.4,phase,weight));
    at(474,299,()=>drawPaperCollector(ctx,image,52,false,0,undefined,weapon));
    at(622,322-size*.5,()=>boss(ctx,size,phase,weight));
}
function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;weight+=((active?1:0)-weight)*(1-Math.exp(-dt*12));phase+=dt*(2+5*weight);for(const type of Object.keys(bosses) as (keyof typeof bosses)[])draw(document.getElementById(type) as HTMLCanvasElement,type);requestAnimationFrame(loop);}
requestAnimationFrame(loop);
