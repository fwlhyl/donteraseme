import type { WeaponType } from '../components/Weapon';
import type { AtlasFrame } from './AtlasFrame';
import type { DoodlePose } from './DoodleMotion';
import { neutralArtImage } from './NeutralArtImage';

const TYPES: readonly WeaponType[] = ['standard','shotgun','melee','chain','ruler','ribbon','gravity','rocket','sniper','flamethrower','compass','mine'];
export const WEAPON_FRAMES: Readonly<Partial<Record<WeaponType, AtlasFrame>>> = Object.fromEntries(TYPES.map(type => [type,{x:0,y:0,width:64,height:64}]));
export function getDoodleWeapons(): HTMLImageElement { return neutralArtImage('weapon'); }
export interface DoodleWeaponStyle {
    detachedHand?: boolean;
    drawGrip?: (ctx: CanvasRenderingContext2D, ratio: number) => void;
    /** Visual progress from the existing reload timer; never changes ammunition. */
    reloadProgress?: number;
    /** Reuse the body rig’s horizontal hysteresis for a stable shoulder near vertical aim. */
    facingLeft?: boolean;
}

const INK = '#272c28', STEEL = '#4e584e', EDGE = '#7c8775';
const GRIP = '#77735c', GLOVE = '#505a48', SEAM = '#929b83';
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
function smoothRange(a: number, b: number, v: number): number {
    const t = clamp((v-a)/(b-a));
    return t*t*(3-2*t);
}

/** Short articulated sleeves. Integer stamps keep diagonals from looking like ropes. */
function sleeve(ctx: CanvasRenderingContext2D, shoulderX: number, shoulderY: number,
    handX: number, handY: number, behind = false): void {
    const elbowX = shoulderX+(handX-shoulderX)*.46;
    const elbowY = shoulderY+(handY-shoulderY)*.46+1.5;
    const segment=(ax:number,ay:number,bx:number,by:number,width:number,color:string)=>{
        ctx.fillStyle=color;
        const count=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))));
        for(let i=0;i<=count;i++){
            const t=i/count;
            ctx.fillRect(Math.round(ax+(bx-ax)*t)-Math.floor(width/2),Math.round(ay+(by-ay)*t)-Math.floor(width/2),width,width);
        }
    };
    segment(shoulderX,shoulderY,elbowX,elbowY,6,INK);
    segment(elbowX,elbowY,handX,handY,5,INK);
    segment(shoulderX,shoulderY-1,elbowX,elbowY-1,3,behind?'#3e473e':STEEL);
    segment(elbowX,elbowY-1,handX,handY-1,3,behind?'#3e473e':STEEL);
}
function glove(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    x=Math.round(x);y=Math.round(y);
    ctx.fillStyle=INK;ctx.fillRect(x-3,y-2,6,6);
    ctx.fillStyle=GLOVE;ctx.fillRect(x-2,y-1,4,4);
    ctx.fillStyle=SEAM;ctx.fillRect(x-2,y-1,3,1);
}

/** Pixel equipment remains a separate rig: aiming, recoil and reload never rotate the body. */
export function drawDoodleWeapon(
    ctx: CanvasRenderingContext2D, type: WeaponType | undefined | null, size: number,
    aim: number, pose?: DoodlePose, reloading = false, style?: DoodleWeaponStyle,
): boolean {
    if (!type || !TYPES.includes(type) || !Number.isFinite(size) || size <= 0 || !Number.isFinite(aim)) return false;
    const ratio=size/64, attack=clamp(pose?.attack??0);
    const facing=style?.facingLeft===undefined ? (Math.cos(aim)<0?-1:1) : (style.facingLeft?-1:1);
    const reload=clamp(style?.reloadProgress??.5);
    const lowered=reloading?smoothRange(0,.2,reload)*(1-smoothRange(.72,1,reload)):0;
    const magazineShift=reloading?Math.sin(Math.PI*smoothRange(.22,.72,reload))*9:0;
    const movement=clamp(pose?.moving??0), phase=pose?.gaitPhase??0;
    // An immediate short kick, then a damped return; aim variation remains under four degrees.
    const recoil=attack*attack*2.4+Math.sin((1-attack)*Math.PI*1.5)*attack*.35;
    // Chest-level grip keeps elbows tucked in. Rear aims raise it beside the
    // shoulder so the barrel clears the head while still following full aim.
    const upward=Math.max(0,-Math.sin(aim));
    const handX=Math.cos(aim)*(11-recoil-lowered*2)+facing*13*upward**4;
    const handY=3+Math.sin(aim)*(8-recoil)-upward*upward*5+lowered*3+Math.sin(phase*2)*movement*.35;
    const swing=type==='melee'?Math.sin(attack*Math.PI)*.52*facing:0;
    const angle=aim+swing+lowered*.48*facing-(type==='melee'?0:attack*attack*.045*facing);
    const longWeapon=type!=='standard'&&type!=='melee'&&type!=='compass';
    const support=longWeapon||reloading;
    const supportX=reloading?7:9, supportY=reloading?9+magazineShift:5;
    const cosine=Math.cos(angle),sine=Math.sin(angle);
    const offhandX=handX+cosine*supportX-sine*supportY*facing;
    const offhandY=handY+sine*supportX+cosine*supportY*facing;
    ctx.save();ctx.scale(ratio,ratio);ctx.shadowBlur=0;ctx.setLineDash([]);
    ctx.imageSmoothingEnabled=false;ctx.lineJoin='miter';ctx.lineCap='square';
    if (!style?.detachedHand) {
        if(support)sleeve(ctx,-facing*4,3,offhandX,offhandY,true);
        sleeve(ctx,facing*8,2,handX,handY);
    }
    ctx.translate(handX,handY);ctx.rotate(angle);ctx.scale(1,facing);
    const rect=(x:number,y:number,w:number,h:number,color=INK)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    if(type==='melee'){
        rect(-6,-2,11,5);rect(-4,-1,7,2,GRIP);rect(3,-5,3,10,EDGE);
        ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(5,-6);ctx.lineTo(31,-5);ctx.lineTo(25,6);ctx.lineTo(5,6);ctx.closePath();ctx.fill();
        ctx.fillStyle=EDGE;ctx.beginPath();ctx.moveTo(7,-4);ctx.lineTo(28,-3);ctx.lineTo(24,3);ctx.lineTo(7,3);ctx.closePath();ctx.fill();
        rect(7,3,16,1,'#afb5a2');
    }else if(type==='compass'){
        ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(19,-11);ctx.lineTo(29,1);ctx.lineTo(20,-3);ctx.lineTo(0,7);ctx.closePath();ctx.fill();
        ctx.fillStyle=STEEL;ctx.beginPath();ctx.moveTo(-1,0);ctx.lineTo(18,-8);ctx.lineTo(22,-5);ctx.lineTo(0,4);ctx.closePath();ctx.fill();
        rect(-3,-1,5,4,GRIP);
    }else if(type==='standard'){
        // Squared receiver, separate slide and trigger void read even at native 64px.
        rect(-6,-5,27,9);rect(20,-3,5,5);rect(23,-2,2,3,EDGE);
        rect(-4,-4,23,3,STEEL);rect(-3,-4,20,1,EDGE);
        rect(8,-3,5,2,INK);rect(17,-6,3,2);rect(-3,-6,3,2);
        rect(-3,3,7,10);rect(-2,4,4,7,GRIP);rect(-1,5,1,5,STEEL);
        rect(3,3,7,2);rect(8,4,2,4);rect(3,8,7,2);rect(4,4,2,3);
        if(reloading){rect(0,12+Math.round(magazineShift),4,7);rect(1,13+Math.round(magazineShift),2,4,STEEL);}
    }else{
        const heavy=type==='rocket'||type==='gravity'||type==='flamethrower';
        const length=type==='sniper'?36:type==='rocket'||type==='ruler'?31:27;
        const height=heavy?12:9,top=heavy?-7:-5;
        rect(-8,top,length,height);rect(-9,-2,6,8);rect(-8,-1,3,5,GRIP);
        rect(-5,top+1,length-5,3,STEEL);rect(-4,top+1,length-9,1,EDGE);
        rect(2,3,5,8);rect(3,4,3,5,GRIP);
        rect(length-8,-3,10,5);rect(length, -2,2,3,EDGE);
        rect(9,1,8,5,GRIP);rect(10,2,6,1,EDGE);
        if(type==='shotgun'){rect(length-7,2,9,3);rect(9,1,2,4);rect(13,1,2,4);}
        else if(type==='sniper'){rect(3,-10,13,4);rect(5,-9,8,1,EDGE);rect(7,-6,3,2);rect(26,-3,10,3);}
        else if(type==='rocket'){rect(17,-8,9,15);rect(18,-7,3,13,EDGE);rect(-9,-6,5,9,STEEL);}
        else if(type==='gravity'){rect(8,-6,8,9,EDGE);rect(10,-4,4,5,INK);rect(21,-6,3,10,EDGE);}
        else if(type==='flamethrower'){rect(-4,4,7,7,STEEL);rect(-3,5,5,1,EDGE);rect(20,-4,6,7,GRIP);}
        else if(type==='ruler'){rect(2,-4,23,2,EDGE);for(let x=5;x<24;x+=4)rect(x,-4,1,2,INK);}
        else if(type==='ribbon'){rect(8,-3,7,6,GRIP);rect(10,-2,3,3,INK);}
        else if(type==='mine'){rect(8,-7,10,10,STEEL);rect(9,-6,8,2,EDGE);rect(12,-6,2,8,GRIP);}
        else if(type==='chain'){for(let x=10;x<22;x+=4){rect(x,-4,2,1,EDGE);rect(x,3,2,3,GRIP);}}
        // Magazine remains attached until the off-hand begins the insertion phase.
        rect(6,6+Math.round(magazineShift),6,8);rect(7,7+Math.round(magazineShift),3,5,STEEL);
    }
    // A tiny three-frame ignition belongs at the muzzle, not around the player.
    if(!reloading && attack>.75 && ['standard','shotgun','sniper','chain','ruler','rocket'].includes(type)){
        const muzzle=type==='standard'?25:type==='sniper'?38:type==='rocket'||type==='ruler'?33:29;
        const reach=attack>.9?6:4;
        rect(muzzle+1,-2,reach,4,'#ad9870');
        rect(muzzle+2,-1,reach-2,2,'#e3d9b9');
        rect(muzzle+2,-3,2,1,'#ad9870');
        rect(muzzle+2,2,2,1,'#ad9870');
    }
    if(support && !style?.detachedHand)glove(ctx,supportX,supportY);
    if(style?.drawGrip)style.drawGrip(ctx,1);
    else glove(ctx,0,3);
    ctx.restore();return true;
}
