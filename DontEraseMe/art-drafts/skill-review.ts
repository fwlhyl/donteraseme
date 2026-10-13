import { Entity } from '../src/core/Entity';
import { PlayerFactory } from '../src/entities/PlayerFactory';
import { Transform } from '../src/components/Transform';
import { Velocity } from '../src/components/Velocity';
import { Renderable } from '../src/components/Renderable';
import { PlayerStats } from '../src/components/PlayerStats';
import { Skill } from '../src/components/Skill';
import { Summon } from '../src/components/Summon';
import { RenderSystem } from '../src/systems/RenderSystem';
import { SummonSystem } from '../src/systems/SummonSystem';
import { getDoodleSkills, SKILL_FRAMES, drawDoodleSkillSprite, drawDoodleSkillEntity } from '../src/art/DoodleSkillArt';
import type { SkillSprite } from '../src/art/DoodleSkillArt';
import { drawDoodlePlayerEffects } from '../src/art/DoodleSkillEffects';
import { DoodleMotion } from '../src/art/DoodleMotion';
import { getDoodleHeroes, HERO_FRAMES } from '../src/art/DoodleArt';
import { getDoodleWeapons } from '../src/art/DoodleWeapons';
import { drawPlayerArtwork } from '../src/ui/drawPlayerArtwork';
import { PlayerArtwork } from '../src/components/PlayerArtwork';
import { sceneBounds, sceneCameraAxis } from '../src/world/SceneLayout';
import { drawBlendedDoodleFloor as drawDoodleFloor } from '../src/world/DoodleFloor';
import { drawDoodleLights } from '../src/world/DoodleLights';
import atelierUrl from '../src/assets/doodle/atelier-v1.png';
import ruinsUrl from '../src/assets/doodle/ruins-v2.png';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('scene'),ctx=canvas.getContext('2d')!,camera={x:0,y:0};
let ruins=false,playing=true,moving=true,time=0,last=0;
const renderer=new RenderSystem(ctx,camera,2700,1800,()=>true,()=>ruins);
const summons=new SummonSystem(e=>{renderer.addEntity(e);summons.addEntity(e);});
let player=PlayerFactory.create(1670,540,'digital');
const backgrounds=[new Image(),new Image()];backgrounds[0].src=atelierUrl;backgrounds[1].src=ruinsUrl;
const ghost=new Entity();ghost.tags.add('ink_dummy');ghost.addComponent(new Transform());ghost.addComponent(new Renderable('#444',20));
const clip=new Entity();clip.tags.add('paperclip');clip.addComponent(new Transform());clip.addComponent(new Renderable('#ccc',0,8,16,'rect'));
const vehicles=['tank','robot','bomber'].map((id,i)=>{const e=new Entity();e.addComponent(new Transform());e.addComponent(new Renderable('#ccc',[24,26,30][i],[58,44,70][i],[38,56,42][i],`magic_${id}` as 'magic_tank'));return e;});
const sceneCenter=()=>({x:ruins?1390:1670,y:ruins?180:540});
function reset(){
 for(const e of renderer.entities)renderer.removeEntity(e);for(const e of summons.entities)summons.removeEntity(e);
 const preset=$<HTMLSelectElement>('preset').value;
 const center=sceneCenter();
 player=PlayerFactory.create(center.x,center.y,preset==='shields'?'classical':'digital');
 const stats=player.getComponent(PlayerStats)!;
 stats.hasDigitalPassive=preset==='digital'||preset==='turret';stats.classicalShieldStacks=0;stats.hasClassicalShield=false;
 if(preset==='legion')Object.assign(stats.acquiredSkills,{summon_stickman:3,summon_palette:3,summon_scythe:3,summon_drone:3,synergy_legion:1});
 if(preset==='digital')stats.acquiredSkills.awakening_digital_1=1;
 if(preset==='turret'){stats.acquiredSkills.awakening_digital_2=1;stats.digitalTurrets=[{x:center.x-120,y:center.y+30,lifeTimer:240,rotation:0},{x:center.x+100,y:center.y-20,lifeTimer:110,rotation:Math.PI}];}
 if(preset==='shields'){stats.hasClassicalShield=true;stats.classicalShieldStacks=3;stats.hasOrigamiShield=true;player.getComponent(Skill)!.eraserShieldFrames=120;}
 if(preset==='vehicles'){player.getComponent(Renderable)!.visible=false;for(const e of vehicles)renderer.addEntity(e);}
 renderer.addEntity(player);summons.addEntity(player);renderer.addEntity(ghost);renderer.addEntity(clip);
 summons.update(0);time=0;
}
function stage(dt:number){
 const w=ruins?1800:2700,h=ruins?1200:1800,t=player.getComponent(Transform)!;
 const center=sceneCenter();
 if(moving){t.x=center.x+Math.sin(time*.8)*90;t.y=center.y+Math.cos(time*.8)*25;t.rotation=Math.cos(time*.8)<0?Math.PI:0;}
 const cw=canvas.clientWidth,ch=canvas.clientHeight,dpr=devicePixelRatio||1;
 if(canvas.width!==Math.round(cw*dpr)||canvas.height!==Math.round(ch*dpr)){canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#243244';ctx.fillRect(0,0,cw,ch);
 const b=sceneBounds(w,h,ruins?'ruins':'atelier');camera.x=sceneCameraAxis(t.x,cw,w,-b.x);camera.y=sceneCameraAxis(t.y,ch,h,-b.y);
 ctx.save();ctx.translate(-camera.x,-camera.y);ctx.drawImage(backgrounds[ruins?1:0],b.x,b.y,b.width,b.height);drawDoodleLights(ctx,w,h,ruins?'ruins':'atelier',time);drawDoodleFloor(ctx,w,h,ruins?'ruins':'atelier');
 ctx.lineCap='round';['#e4b541','#ba6677','#51b2cc'].forEach((c,i)=>{ctx.strokeStyle=c;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(center.x-250,center.y+80+i*20);ctx.bezierCurveTo(center.x-140,center.y+35+i*20,center.x+100,center.y+180+i*20,center.x+230,center.y+90+i*20);ctx.stroke();});ctx.restore();
 if(dt>0){summons.update(dt);for(const e of summons.entities){const v=e.getComponent(Velocity),et=e.getComponent(Transform);if(v&&et){et.x+=v.x*60*dt;et.y+=v.y*60*dt;}}}
 Object.assign(ghost.getComponent(Transform)!,{x:center.x-210,y:center.y+50});Object.assign(clip.getComponent(Transform)!,{x:center.x+185,y:center.y+100});
 const vehicleAim=$<HTMLSelectElement>('vehicle-aim').value;
 const heading=vehicleAim==='auto'?time*.8:Number(vehicleAim)*Math.PI/180;
 vehicles.forEach((e,i)=>Object.assign(e.getComponent(Transform)!,{x:t.x+(i-1)*145,y:t.y,rotation:heading}));
 renderer.update(dt);
 $('status').textContent=`${playing?'演示中':'已暂停'} · ${ruins?'守卫废墟':'创造街区'} · 正式渲染器 · 召唤实体 ${[...renderer.entities].filter(e=>e.hasComponent(Summon)).length} 个 · 未写入存档`;
}
const labels=['浮游数位笔','火柴人助手','调色盘卫星','吸血镰刀','橡皮擦猎手机','Ctrl+V 炮台','磁力曲别针','墨水替身','神笔 · 坦克','神笔 · 机器人','神笔 · 轰炸机','折纸盾碎片'];
const mannequin=new Entity();mannequin.addComponent(new Transform());mannequin.addComponent(new Summon('stickman','preview'));mannequin.addComponent(new Renderable('#fff',0,15,30,'rect'));
const motion=new DoodleMotion();let travel=0;
function sheets(dt:number){
 if(moving)travel+=dt*100;
 const pose=motion.update({x:travel,y:0,hp:100,attackSerial:0,kind:'player'},dt);
 const c=$<HTMLCanvasElement>('atlas').getContext('2d')!;c.fillStyle='#2c3747';c.fillRect(0,0,1068,486);
 (Object.keys(SKILL_FRAMES) as SkillSprite[]).forEach((kind,i)=>{
   const x=133.5+i%4*267,y=68+Math.floor(i/4)*162;
   c.save();c.translate(x,y);
   if(kind==='stickman'){c.scale(2.7,2.7);drawDoodleSkillEntity(c,mannequin,time,pose);}
   else drawDoodleSkillSprite(c,kind,88);
   c.restore();c.fillStyle='#eee4cf';c.font='15px system-ui';c.textAlign='center';c.fillText(labels[i],x,y+68);
 });
 const f=$<HTMLCanvasElement>('effects').getContext('2d')!;f.fillStyle='#2c3747';f.fillRect(0,0,1068,220);
 const effectNames=['厚涂盾 · 3 层','折纸盾','橡皮盾 · 60px','书法家 · +40%','绝境爆炸反馈'];
 for(let i=0;i<5;i++){
  const s=new PlayerStats(),sk=new Skill();s.classicalShieldStacks=0;
  if(i===0){s.characterId='classical';s.classicalShieldStacks=3;s.hasClassicalShield=true;}
  if(i===1)s.hasOrigamiShield=true;if(i===2)sk.eraserShieldFrames=120;
  if(i===3){s.hasCalligrapherPassive=true;s.calligrapherDamageStacks=20;}
  if(i===4){s.acquiredSkills.defense_desperate_explosion=1;s.explosionCooldownFrames=3600;}
  f.save();f.translate(107+i*213,100);f.scale(1.5,1.5);drawPlayerArtwork(f,new PlayerArtwork(getDoodleHeroes(),64,20,HERO_FRAMES.collector,true),20,0,undefined,null);drawDoodlePlayerEffects(f,20,s,sk,time);f.restore();
  f.fillStyle='#eee4cf';f.font='14px system-ui';f.textAlign='center';f.fillText(effectNames[i],107+i*213,205);
 }
}
Promise.all([getDoodleSkills(),getDoodleHeroes(),getDoodleWeapons(),...backgrounds].map(im=>im.decode())).then(()=>{
 reset();$('preset').onchange=reset;
 $('move').onclick=()=>{moving=!moving;$('move').textContent=moving?'停止移动':'开始移动';};
 $('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'暂停演示':'继续演示';};
 $('theme').onclick=()=>{ruins=!ruins;renderer.setWorldSize(ruins?1800:2700,ruins?1200:1800);$('theme').textContent=ruins?'切换创造街区':'切换守卫废墟';reset();};
 let raf=0;function tick(now:number){const dt=playing&&!document.hidden?Math.min(.05,(now-last)/1000||0):0;last=now;time+=dt;stage(dt);sheets(dt);raf=requestAnimationFrame(tick);}
 raf=requestAnimationFrame(tick);window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
}).catch(e=>{$('status').textContent=`素材加载失败：${e}`;});
