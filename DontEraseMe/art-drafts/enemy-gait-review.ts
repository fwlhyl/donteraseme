import { drawAtlasFrame } from '../src/art/AtlasFrame';
import { ENEMY_FRAMES, drawDoodleEnemy, getDoodleEnemies } from '../src/art/DoodleArt';
import { ENEMY_GAITS } from '../src/art/DoodleEnemyGait';
import { DoodleMotion } from '../src/art/DoodleMotion';
import type { EnemyType } from '../src/components/EnemyBehavior';

const names: Partial<Record<EnemyType,string>> = {
    chaser:'追逐者', eraser:'橡皮擦', shield:'盾卫', shooter:'射手', summoner:'召唤者',
    boss:'三角首领', boss_roller:'滚筒首领', boss_eraser:'橡皮首领',
};
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const image = getDoodleEnemies();
const actors = (Object.keys(ENEMY_GAITS) as EnemyType[]).map((type,i) => {
    const card = document.createElement('section'); card.className='card';
    const title = document.createElement('h2'); title.textContent=`${names[type]} · ${type}`;
    const canvas = document.createElement('canvas'); canvas.width=560; canvas.height=285;
    canvas.setAttribute('aria-label',`${names[type]}原图与自然步态对照`);
    card.append(title,canvas); $('gallery').append(card);
    return {type,ctx:canvas.getContext('2d')!,motion:new DoodleMotion(i*.37),travel:0};
});
let playing=true,walking=true,frozen=false,attackSerial=0,hp=100,heading=0;
$('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'暂停动画':'继续动画';};
$('walk').onclick=()=>{walking=!walking;$('walk').textContent=walking?'切换待机':'切换行走';};
$('freeze').onclick=()=>{frozen=!frozen;$('freeze').textContent=frozen?'解除冻结':'冻结';};
$('attack').onclick=()=>{attackSerial++;}; $('hit').onclick=()=>{hp-=5;};
$('heading').onchange=()=>{heading=Number($<HTMLSelectElement>('heading').value)*Math.PI/180;};

function render(dt:number) {
    for (const actor of actors) {
        const {type,ctx,motion}=actor,frame=ENEMY_FRAMES[type]!;
        if(walking&&!frozen) actor.travel+=90*dt;
        const pose=motion.update({kind:type,x:actor.travel,y:0,hp,attackSerial,frozen},dt);
        ctx.fillStyle='#e5e1d4';ctx.fillRect(0,0,560,285);
        ctx.fillStyle='#50545a';ctx.font='13px system-ui';ctx.textAlign='center';
        ctx.fillText('原始一体图',140,25);ctx.fillText('独立双腿 · 身体直立',420,25);
        const originY=type==='boss_roller'?78:140;
        ctx.strokeStyle='#a4aba9';ctx.lineWidth=1;ctx.setLineDash([4,5]);
        const config=ENEMY_GAITS[type]!;
        const footY=(config.floor-frame.y-frame.height*(frame.pivotY??.5))*192/Math.max(frame.width,frame.height)+originY;
        ctx.beginPath();ctx.moveTo(22,footY);ctx.lineTo(538,footY);ctx.stroke();ctx.setLineDash([]);
        ctx.save();ctx.translate(140,originY);drawAtlasFrame(ctx,image,frame,192);ctx.restore();
        ctx.save();ctx.translate(420,originY);ctx.scale(3,3);drawDoodleEnemy(ctx,type,25.6,heading,pose);ctx.restore();
    }
    $('status').textContent=`${playing?(frozen?'冻结':walking?'行走':'待机'):'已暂停'} · 8 种地面敌人 · 原始身体尺寸与枢轴不变`;
}
image.decode().then(()=>{
    let last=performance.now(),raf=0;
    const tick=(now:number)=>{const dt=playing&&!document.hidden?Math.min(.1,(now-last)/1000):0;last=now;render(dt);raf=requestAnimationFrame(tick);};
    render(1/60);raf=requestAnimationFrame(tick);
    window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
}).catch(error=>{$('status').textContent=`图集加载失败：${error}`;});
