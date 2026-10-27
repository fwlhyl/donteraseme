import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { DoodleMotion, type DoodlePose } from '../../src/art/DoodleMotion';
import { Weapon } from '../../src/components/Weapon';
import { PLAYER_PRESENTATION } from '../../src/config/PlayerPresentation';
const source=getPaperCollector(),weapon=new Weapon(0);
const visualScale=PLAYER_PRESENTATION.displaySize / PLAYER_PRESENTATION.sourceSize;
let facingLeft=false;
let action='walk',paused=false,time=0,x=0,y=0,serial=0,hp=100;
let motion=new DoodleMotion(0,{x,y,hp,attackSerial:serial,kind:'player'});
const neutral=():DoodlePose=>({x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:0,hit:0,shadowScale:1,step:0,moving:0,gaitPhase:0,time:0,travelX:1,travelY:0,reloadProgress:0});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-action]'))button.onclick=()=>{
 action=button.dataset.action!;time=0;x=0;y=0;serial=0;hp=100;motion=new DoodleMotion(0,{x,y,hp,attackSerial:0,kind:'player'});
 document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
};
document.getElementById('pause')!.onclick=()=>{paused=!paused;document.getElementById('pause')!.textContent=paused?'播放':'暂停';};
function draw(canvas:HTMLCanvasElement,scale:number,pose:DoodlePose,aim:number){
 const direction=Math.cos(aim);if(direction < -PLAYER_PRESENTATION.facingDeadZone)facingLeft=true;else if(direction > PLAYER_PRESENTATION.facingDeadZone)facingLeft=false;
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#d3d5c9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(40,canvas.height/2+30*scale*visualScale);ctx.lineTo(canvas.width-40,canvas.height/2+30*scale*visualScale);ctx.stroke();
 ctx.save();ctx.translate(canvas.width/2-12*scale,canvas.height/2);ctx.fillStyle='#30382b18';ctx.beginPath();ctx.ellipse(0,29*scale*visualScale,17*scale*visualScale,3*scale*visualScale,0,0,Math.PI*2);ctx.fill();
 drawPaperCollector(ctx,source,PLAYER_PRESENTATION.displaySize*scale,facingLeft,aim,pose,weapon);ctx.restore();
}
let last=performance.now(),pose=neutral(),aim=0;
function loop(now:number){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(!paused){
  const before=time;time+=dt;
  if(action==='walk')x+=dt*170;if(action==='back')x-=dt*140;
  if(action==='shoot' && Math.floor(before/.55)!==Math.floor(time/.55))serial++;
  if(action==='hurt' && Math.floor(before/1.4)!==Math.floor(time/1.4))hp--;
  weapon.reloading=action==='reload';
  const progress=weapon.reloading?(time%1.8)/1.8:0;
  weapon.reloadTimer=(1-progress)*60;
  pose=motion.update({x,y,hp,attackSerial:serial,kind:'player',reloadProgress:progress,reloading:weapon.reloading},dt);
  aim=action==='turn'?time*PLAYER_PRESENTATION.turnPreviewSpeed:0;
 }
 draw(document.getElementById('large') as HTMLCanvasElement,4,pose,aim);
 draw(document.getElementById('native') as HTMLCanvasElement,1,pose,aim);
 requestAnimationFrame(loop);
}
const strip=(document.getElementById('frames') as HTMLCanvasElement).getContext('2d')!;
const states=[['待机',0,0,0,0],['右脚落地',Math.PI/2,1,0,0],['左脚落地',Math.PI*1.5,1,0,0],['射击回弹',0,0,1,0],['装填弹匣',0,0,0,.55],['背面瞄准',0,0,0,-1]] as const;
states.forEach(([label,phase,moving,attack,reload],index)=>{
 const p={...neutral(),gaitPhase:phase,moving,step:Math.sin(phase)*moving,attack,reloadProgress:Math.max(0,reload)};
 weapon.reloading=reload>0;strip.save();strip.translate(78+index*184,100);
 drawPaperCollector(strip,source,PLAYER_PRESENTATION.displaySize*2,false,reload<0?-Math.PI/2:0,p,weapon);strip.restore();
 strip.fillStyle='#57614f';strip.font='13px system-ui';strip.textAlign='center';strip.fillText(label,88+index*184,200);
});
requestAnimationFrame(loop);
