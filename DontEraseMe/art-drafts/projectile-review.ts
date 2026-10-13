import { Entity } from '../src/core/Entity';
import { Transform } from '../src/components/Transform';
import { Renderable } from '../src/components/Renderable';
import { Projectile } from '../src/components/Projectile';
import { Weapon,WEAPONS } from '../src/components/Weapon';
import { BulletFactory } from '../src/entities/BulletFactory';
import { drawDoodleProjectile,drawDoodleProjectileLine,drawDoodleRulerShot,getDoodleProjectileCacheStats } from '../src/art/DoodleProjectiles';
const names=['画笔 · 颜料弹','喷漆 · 飞溅墨点','刮刀 · 刮痕弧光','墨链 · 连环墨结','直尺 · 刻度笔线','丝带 · 折叠彩带','搅拌器 · 螺旋墨涡','颜料桶 · 飞溅胶囊','钢笔 · 笔尖墨线','喷枪 · 火舌颜料','圆规 · 双脚回旋','滴管 · 落地墨滴'];
const gallery=document.getElementById('gallery')!;
const actors=WEAPONS.map((config,i)=>{
    const card=document.createElement('section');card.className='card';const title=document.createElement('h2');title.textContent=names[i];
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=180;canvas.setAttribute('aria-label',names[i]);card.append(title,canvas);gallery.append(card);
    const entity=BulletFactory.create(config,0,0,0,'#55b8e1','preview');
    if(config.type==='melee'){const r=entity.getComponent(Renderable)!;r.width=70;r.color='transparent';}
    if(config.type==='sniper'){const r=entity.getComponent(Renderable)!;r.shape='line';r.width=90;r.height=0;}
    const player=new Entity();player.tags.add('player');player.addComponent(new Transform());player.addComponent(new Renderable('#55b8e1',20));player.addComponent(new Weapon(config.id));
    return {config,entity,player,ctx:canvas.getContext('2d')!};
});
let playing=true,time=0;
const pause=document.getElementById('pause')!;pause.onclick=()=>{playing=!playing;pause.textContent=playing?'暂停动画':'继续动画';};
function render(){
    const color=(document.getElementById('color') as HTMLSelectElement).value,awakened=(document.getElementById('awake') as HTMLInputElement).checked;
    for(const {entity,config,ctx,player}of actors){
        ctx.fillStyle='#2c3747';ctx.fillRect(0,0,360,180);ctx.fillStyle='#9cacbc';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('局内尺寸',85,158);ctx.fillText('放大审阅',263,158);
        const r=entity.getComponent(Renderable)!,p=entity.getComponent(Projectile)!,t=entity.getComponent(Transform)!;
        r.color=config.type==='melee'?'transparent':color;(p as Projectile & {isAwakened:boolean}).isAwakened=awakened;t.rotation=config.type==='compass'?time*3:0;
        player.getComponent(Renderable)!.color=color;
        for(const [x,scale]of [[85,1],[263,2.5]]){
            ctx.save();ctx.translate(x,85);ctx.scale(scale,scale);
            if(config.type==='ruler'){
                ctx.scale(.13,.65);ctx.translate(-300,0);
                drawDoodleRulerShot(ctx,player,{x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:.65+.35*Math.sin(time*5),hit:0,shadowScale:1,step:0,moving:0});
            }else if(config.type==='sniper'){ctx.scale(.7,.7);ctx.translate(-45,0);drawDoodleProjectileLine(ctx,entity,'preview');}
            else if(config.type==='melee'){ctx.scale(.65,.65);ctx.translate(-35,0);drawDoodleProjectile(ctx,entity,'preview');}
            else drawDoodleProjectile(ctx,entity,'preview');
            ctx.restore();
        }
    }
    const cache=getDoodleProjectileCacheStats();document.getElementById('status')!.textContent=`${playing?'动画运行中':'已暂停'} · ${cache.size} 个缓存印章 / 上限 ${cache.limit} · 不写入游戏存档`;
}
let last=performance.now(),raf=0;function tick(now:number){if(playing&&!document.hidden)time+=Math.min(.1,(now-last)/1000);last=now;render();raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
