import { drawWeaponShapeA } from './WeaponShapesA';
import { drawWeaponShapeB } from './WeaponShapesB';
import { drawWeaponShapeC } from './WeaponShapesC';
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
    /** Smaller arms and equipment for the compact collector silhouette. */
    compact?: boolean;
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
    // Pull in, spin the held tool once, insert the magazine and snap back to aim.
    // Every phase is sampled from the real reload timer, including speed upgrades.
    const lowered=reloading?smoothRange(0,.14,reload)*(1-smoothRange(.83,1,reload)):0;
    const spin=reloading?smoothRange(.12,.56,reload):0;
    const magazineShift=reloading?Math.sin(Math.PI*smoothRange(.55,.87,reload))*9:0;
    const flourish=reloading?smoothRange(.14,.23,reload)*(1-smoothRange(.48,.57,reload)):0;
    const seat=reloading?smoothRange(.82,.87,reload)*(1-smoothRange(.87,.94,reload)):0;
    const movement=clamp(pose?.moving??0), phase=pose?.gaitPhase??0;
    // Heavy tools visibly kick back and lift, then settle as the same attack
    // signal decays. This affects the held art only, never projectile aim.
    const heavyKick = type === 'rocket' || type === 'gravity' || type === 'shotgun' || type === 'sniper';
    const recoilStrength = heavyKick ? 9 : (style?.compact ? 3.1 : 2.4);
    const recoil=attack*attack*recoilStrength+Math.sin((1-attack)*Math.PI*1.5)*attack*.35;
    const recoilAngle = type === 'melee' ? 0 : attack*attack*(heavyKick ? .22 : .045);
    // Chest-level grip keeps elbows tucked in. Rear aims raise it beside the
    // shoulder so the barrel clears the head while still following full aim.
    const upward=Math.max(0,-Math.sin(aim));
    const handX=Math.cos(aim)*(11-recoil-lowered*2)+facing*13*upward**4;
    const handY=3+Math.sin(aim)*(8-recoil)-upward*upward*5+lowered*3+Math.sin(phase*2)*movement*.35;
    // Wind up, sweep through aim, then settle: both ends return to the held stance.
    const slashPhase = 1 - attack;
    const swing = type === 'melee' ? Math.sin(Math.PI * slashPhase) *
        (-2.2 + 4.4 * smoothRange(.12, .78, slashPhase)) * facing : 0;
    const angle=aim+swing+(lowered*.48+spin*Math.PI*2)*facing-recoilAngle*facing;
    const longWeapon=type!=='standard'&&type!=='melee'&&type!=='compass';
    const support=longWeapon||reloading;
    const supportX=reloading && type==='standard'?2:9;
    const supportY=reloading?(type==='standard'?15:10)+magazineShift:5;
    const cosine=Math.cos(angle),sine=Math.sin(angle);
    const offhandX=handX+cosine*supportX-sine*supportY*facing;
    const offhandY=handY+sine*supportX+cosine*supportY*facing;
    // Scale the complete held rig around the body anchor: hands, weapon, recoil,
    // and magazine stay connected at every aim and reload angle.
    const heldScale=ratio*(style?.compact ? .78 : 1);
    ctx.save();ctx.scale(heldScale,heldScale);ctx.shadowBlur=0;ctx.setLineDash([]);
    ctx.imageSmoothingEnabled=false;ctx.lineJoin='miter';ctx.lineCap='square';
    if (!style?.detachedHand) {
        if(support)sleeve(ctx,-facing*4,3,offhandX,offhandY,true);
        sleeve(ctx,facing*8,2,handX,handY);
    }
    // Small ink dashes make the spin legible without covering the canvas artwork.
    if (flourish > 0) {
        ctx.save(); ctx.globalAlpha *= flourish * .65; ctx.fillStyle=EDGE;
        ctx.fillRect(Math.round(handX-facing*14),Math.round(handY-14),4,1);
        ctx.fillRect(Math.round(handX+facing*13),Math.round(handY+13),3,1);
        ctx.restore();
    }
    ctx.translate(handX,handY);ctx.rotate(angle);ctx.scale(1,facing);
    const rect=(x:number,y:number,w:number,h:number,color=INK)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    drawWeaponShapeA(ctx, type, reloading, magazineShift) ||
        drawWeaponShapeB(ctx, type, reloading, magazineShift) ||
        drawWeaponShapeC(ctx, type, reloading, magazineShift);
    // A tiny three-frame ignition belongs at the muzzle, not around the player.
    if(!reloading && attack>.75 && ['standard','shotgun','sniper','chain','ruler','rocket'].includes(type)){
        const muzzle=type==='standard'?25:type==='sniper'?38:type==='rocket'||type==='ruler'?33:29;
        const reach=attack>.9?6:4;
        rect(muzzle+1,-2,reach,4,'#ad9870');
        rect(muzzle+2,-1,reach-2,2,'#e3d9b9');
        rect(muzzle+2,-3,2,1,'#ad9870');
        rect(muzzle+2,2,2,1,'#ad9870');
    }
    if (seat > 0) {
        ctx.save(); ctx.globalAlpha *= seat; ctx.fillStyle=SEAM;
        ctx.fillRect(5,15,3,1); ctx.fillRect(9,12,1,3);
        ctx.restore();
    }
    if(support && !style?.detachedHand)glove(ctx,supportX,supportY);
    if(style?.drawGrip)style.drawGrip(ctx,1);
    else glove(ctx,0,3);
    ctx.restore();return true;
}
