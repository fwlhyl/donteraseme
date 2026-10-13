import atelierUrl from '../src/assets/doodle/atelier-v1.png';
import ruinsUrl from '../src/assets/doodle/ruins-v2.png';
import { getDoodleHeroes, getDoodleEnemies, HERO_FRAMES, ENEMY_FRAMES, drawDoodleEnemy } from '../src/art/DoodleArt';
import { drawPlayerArtwork } from '../src/ui/drawPlayerArtwork';
import { PlayerArtwork } from '../src/components/PlayerArtwork';
import { HealthHud, WeaponHud } from '../src/ui/CombatHud';
import { drawBlendedDoodleFloor as drawDoodleFloor, traceDoodleFloor } from '../src/world/DoodleFloor';
import { drawDoodleLights } from '../src/world/DoodleLights';
import { sceneBounds, sceneCameraAxis, type CourtyardTheme } from '../src/world/SceneLayout';
import type { EnemyType } from '../src/components/EnemyBehavior';
import { DoodleMotion, type DoodlePose } from '../src/art/DoodleMotion';
import { getDoodleWeapons } from '../src/art/DoodleWeapons';
import { Weapon, WEAPONS } from '../src/components/Weapon';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const names = ['收藏家','涂鸦客','油画家','漫画家','水彩师','板绘师','书法家','水墨师'];
const ids = Object.keys(HERO_FRAMES);
const select = $<HTMLSelectElement>('hero');
ids.forEach((id,i) => select.add(new Option(names[i],id)));
new HealthHud($('health')).update({ id:'review', hp:800, max:800, level:1, xp:30, next:100, shield:'', zh:true },0);
const weaponHud = new WeaponHud($('weapon'));
const weaponNames = ['画笔','喷漆罐','刮刀','墨链','尺枪','缎带','旋涡搅拌器','颜料桶炮','钢笔','喷笔','圆规','滴管'];
const weaponSelect = $<HTMLSelectElement>('held-weapon');
WEAPONS.forEach((w,i)=>weaponSelect.add(new Option(weaponNames[i],String(w.id))));
weaponSelect.add(new Option('空手','-1'));
const equipped = new Weapon(0);
const galleryWeapons = WEAPONS.map(w=>new Weapon(w.id));
let aim = 0;
function updateWeaponHud() {
    const w = equipped.config;
    weaponHud.update({key:String(equipped.currentWeaponIndex),name:w?.name??'空手',type:w?.type??'unarmed',ammo:w?.magSize??0,capacity:w?.magSize??0,reloading:equipped.reloading,reloadProgress:equipped.reloading ? .45 : 0,zh:true});
}
updateWeaponHud();

function image(url: string) { const im = new Image(); im.src = url; return im; }
const backgrounds = { atelier:image(atelierUrl), ruins:image(ruinsUrl) };
let theme: CourtyardTheme = 'atelier', center = false;
let animating=true, walking=true, travel=0, attackSerial=0, sampleHp=100, artTime=0;
const motions=new Map<string,DoodleMotion>(),poses=new Map<string,DoodlePose>();
const enemyTypes=Object.keys(ENEMY_FRAMES) as EnemyType[];
const motionKeys=[...ids.map(id=>'hero:'+id),...enemyTypes];
motionKeys.forEach((key,i)=>motions.set(key,new DoodleMotion(i*.63)));
function advance(dt:number) {
    artTime+=dt;
    if(walking)travel+=180*dt;
    motionKeys.forEach(key=>poses.set(key,motions.get(key)!.update({x:travel,y:0,hp:sampleHp,attackSerial,kind:key.startsWith('hero:')?'player':key},dt)));
}
const heroImage = getDoodleHeroes(), enemyImage = getDoodleEnemies();
const ready = (im: HTMLImageElement) => im.decode();
function scene(ctx:CanvasRenderingContext2D,w:number,h:number) {
    const b=sceneBounds(w,h,theme);
    ctx.drawImage(backgrounds[theme],b.x,b.y,b.width,b.height);
    drawDoodleLights(ctx,w,h,theme,artTime);
    drawDoodleFloor(ctx,w,h,theme);
}
function actor(ctx:CanvasRenderingContext2D,x:number,y:number,id=select.value,weapon=equipped,heading=aim) {
    ctx.save();ctx.translate(x,y);drawPlayerArtwork(ctx,new PlayerArtwork(heroImage,64,20,HERO_FRAMES[id],true),20,heading,poses.get('hero:'+id),weapon);ctx.restore();
}
function render() {
    const w=theme==='atelier'?2700:1800,h=theme==='atelier'?1800:1200;
    const canvas=$<HTMLCanvasElement>('scene'),cw=canvas.clientWidth,ch=canvas.clientHeight,dpr=devicePixelRatio||1;
    canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);
    const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);
    const p=center?{x:w/2,y:h/2}:theme==='atelier'?{x:1780,y:590}:{x:1390,y:200};
    const b=sceneBounds(w,h,theme), camera={x:sceneCameraAxis(p.x,cw,w,-b.x),y:sceneCameraAxis(p.y,ch,h,-b.y)};
    ctx.fillStyle='#243244';ctx.fillRect(0,0,cw,ch);ctx.translate(-camera.x,-camera.y);scene(ctx,w,h);
    if($<HTMLInputElement>('paint').checked) {
        ctx.save();traceDoodleFloor(ctx,w,h,theme);ctx.clip();ctx.lineCap='round';ctx.globalAlpha=.8;
        ['#f1c539','#ea7478','#50c5e2'].forEach((c,i)=>{
            ctx.strokeStyle=c;ctx.lineWidth=9+i*2;ctx.beginPath();ctx.moveTo(p.x-240,p.y+60+i*27);
            ctx.bezierCurveTo(p.x-80,p.y-30+i*33,p.x+50,p.y+170+i*20,p.x+250,p.y+85+i*18);ctx.stroke();
        });ctx.restore();
    }
    actor(ctx,p.x,p.y);
    const types:EnemyType[]=['chaser','eraser','shield','shooter','summoner','paper_plane'];
    types.forEach((type,i)=>{ctx.save();ctx.translate(p.x-260+i*104,p.y+225+(i%2)*28);drawDoodleEnemy(ctx,type,type==='eraser'?27:18,0,poses.get(type));ctx.restore();});
    if($<HTMLInputElement>('boundary').checked){traceDoodleFloor(ctx,w,h,theme);ctx.strokeStyle='#81e5c1';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.stroke();ctx.setLineDash([]);}
    const overview=$<HTMLCanvasElement>('overview'),full=overview.getContext('2d')!;
    full.setTransform(1,0,0,1,0,0);full.clearRect(0,0,1080,720);full.scale(1080/b.width,720/b.height);full.translate(-b.x,-b.y);scene(full,w,h);
    traceDoodleFloor(full,w,h,theme);full.strokeStyle='#81e5c1';full.lineWidth=2;full.stroke();
    full.strokeStyle='#f3d16d';full.lineWidth=3;full.strokeRect(camera.x,camera.y,cw,ch);actor(full,p.x,p.y);
    $('status').textContent=`${theme==='atelier'?'创造街区':'守卫废墟'} · ${center?'中央':'临街'} · 64 px · ${equipped.config?weaponNames[equipped.currentWeaponIndex]:'空手'} · ${animating?(walking?'自然迈步':'待机演示'):'动画已暂停'}（非战斗实机）`;
}
function gallery() {
    const gait=$<HTMLCanvasElement>('gait').getContext('2d')!;gait.fillStyle='#2c3747';gait.fillRect(0,0,560,240);
    gait.save();gait.translate(280,120);gait.scale(3,3);actor(gait,0,0);gait.restore();
    const weapons=$<HTMLCanvasElement>('weapons').getContext('2d')!;weapons.fillStyle='#2c3747';weapons.fillRect(0,0,1080,396);
    galleryWeapons.forEach((weapon,i)=>{
        const x=135+i%4*270,y=49+Math.floor(i/4)*132;
        weapons.save();weapons.translate(x,y);weapons.scale(1.25,1.25);actor(weapons,0,0,select.value,weapon,0);weapons.restore();
        weapons.fillStyle='#e7e5db';weapons.font='15px sans-serif';weapons.textAlign='center';weapons.fillText(weaponNames[i],x,y+63);
    });
    const heroes=$<HTMLCanvasElement>('heroes').getContext('2d')!;heroes.fillStyle='#2c3747';heroes.fillRect(0,0,560,260);
    ids.forEach((id,i)=>{const x=70+i%4*140,y=55+Math.floor(i/4)*125;actor(heroes,x,y,id);heroes.fillStyle='#e7e5db';heroes.font='13px sans-serif';heroes.textAlign='center';heroes.fillText(names[i],x,y+49);});
    const enemies=$<HTMLCanvasElement>('enemies').getContext('2d')!;enemies.fillStyle='#2c3747';enemies.fillRect(0,0,560,350);
    enemyTypes.forEach((type,i)=>{enemies.save();enemies.translate(70+i%4*140,50+Math.floor(i/4)*115);drawDoodleEnemy(enemies,type,type.startsWith('boss')?28:20,0,poses.get(type));enemies.fillStyle='#e7e5db';enemies.font='11px sans-serif';enemies.textAlign='center';enemies.fillText(type,0,52);enemies.restore();});
}
Promise.all([heroImage,enemyImage,getDoodleWeapons(),...Object.values(backgrounds)].map(ready)).then(()=>{
    $('mode').onclick=()=>{theme=theme==='atelier'?'ruins':'atelier';$('mode').textContent=theme==='atelier'?'切换到守卫废墟':'切换到创造街区';render();};
    $('camera').onclick=()=>{center=!center;$('camera').textContent=center?'查看临街区域':'查看中央画板';render();};
    select.onchange=render;$('paint').onchange=render;$('boundary').onchange=render;
    weaponSelect.onchange=()=>{equipped.currentWeaponIndex=Number(weaponSelect.value);updateWeaponHud();render();};
    $('aim').onchange=()=>{aim=Number($<HTMLSelectElement>('aim').value)*Math.PI/180;render();};
    $('reload').onchange=()=>{equipped.reloading=$<HTMLInputElement>('reload').checked;updateWeaponHud();render();};
    $('animate').onclick=()=>{animating=!animating;$('animate').textContent=animating?'暂停动画':'播放动画';render();};
    $('walk').onclick=()=>{walking=!walking;$('walk').textContent=walking?'切换到待机':'切换到移动';render();};
    $('attack').onclick=()=>{attackSerial++;};$('hit').onclick=()=>{sampleHp-=5;};
    new ResizeObserver(render).observe($('scene').parentElement!);
    let last=performance.now(),raf=0;
    const tick=(now:number)=>{const dt=animating&&!document.hidden?Math.min(.1,(now-last)/1000):0;last=now;advance(dt);render();gallery();raf=requestAnimationFrame(tick);};
    advance(1/60);raf=requestAnimationFrame(tick);
    window.addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
}).catch(error=>{$('status').textContent=`素材加载失败：${error}`;});
