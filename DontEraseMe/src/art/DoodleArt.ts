import type { AtlasFrame } from './AtlasFrame';
import type { EnemyType } from '../components/EnemyBehavior';
import { drawDoodleAccent, type DoodlePose } from './DoodleMotion';
import { getEnemyGait } from './DoodleEnemyGait';
import { neutralArtImage } from './NeutralArtImage';

const neutralFrame: AtlasFrame = {x:0,y:0,width:64,height:64};
export const HERO_FRAMES: Readonly<Record<string, AtlasFrame>> = Object.fromEntries(
    ['collector','graffiti','classical','sketcher','watercolor','digital','calligrapher','ink'].map(id=>[id,neutralFrame]));
const TYPES: readonly EnemyType[] = ['chaser','eraser','shield','shooter','summoner','paper_plane','boss','boss_roller','boss_prism','boss_slime','boss_eraser','blackhole'];
export const ENEMY_FRAMES: Readonly<Partial<Record<EnemyType, AtlasFrame>>> = Object.fromEntries(TYPES.map(type=>[type,neutralFrame]));
export function getDoodleHeroes(): HTMLImageElement { return neutralArtImage('player'); }
export function getDoodleEnemies(): HTMLImageElement { return neutralArtImage('enemy'); }
export function hasDoodleEnemyArtwork(type: EnemyType | undefined): boolean { return !!type && TYPES.includes(type); }

/** Lightweight transitional silhouettes; collision sizes and hostile telegraphs are unchanged. */
export function drawDoodleEnemy(ctx: CanvasRenderingContext2D, type: EnemyType | undefined, radius: number,
    rotation: number, pose?: DoodlePose, bossTimer?: number): boolean {
    if (!hasDoodleEnemyArtwork(type)) return false;
    const size=radius*2.5, ratio=size/64, step=pose?.step??0;
    ctx.save();ctx.shadowBlur=0;ctx.setLineDash([]);ctx.scale(ratio,ratio);
    ctx.strokeStyle='#30332e';ctx.fillStyle='#d9dbd1';ctx.lineWidth=1.6;ctx.lineJoin='miter';
    const facing=Math.cos(rotation)<-.12?-1:1;
    if (type==='paper_plane') {
        ctx.rotate(rotation);ctx.beginPath();ctx.moveTo(30,0);ctx.lineTo(-23,-14);ctx.lineTo(-13,0);ctx.lineTo(-23,14);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(30,0);ctx.stroke();
    } else if (type==='blackhole'||type==='boss_slime') {
        const n=type==='blackhole'?10:7;
        ctx.beginPath();
        for(let i=0;i<n*2;i++){const angle=i*Math.PI/n;const r=i%2?19:26;const x=Math.cos(angle)*r,y=Math.sin(angle)*r*(type==='boss_slime'?.7:1);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
        ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#30332e';ctx.beginPath();ctx.ellipse(0,0,13,7,0,0,Math.PI*2);ctx.fill();
    } else {
        ctx.scale(facing,1);
        if (getEnemyGait(type)) {
            ctx.fillStyle='#30332e';
            for(const side of [-1,1]){const stride=step*side*2.3;ctx.beginPath();ctx.moveTo(side*16-4,8);ctx.lineTo(side*16+3,11);ctx.lineTo(side*16+stride,21-Math.max(0,step*side)*2);ctx.lineTo(side*16-4+stride,16);ctx.closePath();ctx.fill();}
        }
        ctx.translate(0,(pose?.y??0)*.6);ctx.fillStyle='#d9dbd1';
        ctx.beginPath();ctx.moveTo(-25,-15);ctx.lineTo(21,-15);ctx.lineTo(27,-9);ctx.lineTo(24,14);ctx.lineTo(-22,16);ctx.lineTo(-15,6);ctx.lineTo(-25,2);ctx.lineTo(-17,-6);ctx.lineTo(-26,-9);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#656c60';ctx.beginPath();ctx.moveTo(9,-15);ctx.lineTo(21,-15);ctx.lineTo(27,-9);ctx.lineTo(24,14);ctx.lineTo(9,15);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#30332e';ctx.beginPath();ctx.moveTo(-24,-7);ctx.lineTo(-8,-4);ctx.lineTo(-16,1);ctx.lineTo(-6,5);ctx.lineTo(-21,12);ctx.lineTo(-15,5);ctx.lineTo(-25,1);ctx.lineTo(-17,-3);ctx.closePath();ctx.fill();
        if(type==='shield'){ctx.fillStyle='#babfb1';ctx.beginPath();ctx.moveTo(-28,-17);ctx.lineTo(-17,-13);ctx.lineTo(-18,13);ctx.lineTo(-29,17);ctx.closePath();ctx.fill();ctx.stroke();}
        if(type==='shooter'||type==='summoner'){ctx.strokeStyle='#30332e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-4,-14);ctx.lineTo(2,-23);ctx.lineTo(7,-15);ctx.stroke();}
        if(type?.startsWith('boss')){ctx.fillStyle='#30332e';ctx.beginPath();ctx.moveTo(-9,-15);ctx.lineTo(-5,-24);ctx.lineTo(0,-15);ctx.lineTo(5,-24);ctx.lineTo(9,-15);ctx.fill();}
        if(type==='boss_roller'){ctx.fillStyle='#30332e';ctx.fillRect(-18,14,38,6);}
        if(type==='boss_prism'){ctx.fillStyle='#30332e';ctx.beginPath();ctx.moveTo(-2,-10);ctx.lineTo(6,0);ctx.lineTo(-2,10);ctx.lineTo(-10,0);ctx.closePath();ctx.fill();}
    }
    ctx.restore();ctx.save();ctx.shadowBlur=0;
    drawDoodleAccent(ctx,pose,size,rotation);
    if(bossTimer!==undefined)drawDoodleWarning(ctx,type,radius,rotation,bossTimer);
    ctx.restore();return true;
}

function drawDoodleWarning(ctx:CanvasRenderingContext2D,type:EnemyType|undefined,r:number,heading:number,timer:number):void {
    const roller=type==='boss_roller' && timer%360<210;
    const eraser=type==='boss_eraser' && timer%600>=400;
    if (!roller&&!eraser) return;
    ctx.save();ctx.strokeStyle=Math.floor(timer/6)%2?'#fff1c0':'#f06a6a';ctx.lineWidth=3;
    ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(0,0,r*1.35,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    if (roller) {
        ctx.rotate(heading);ctx.beginPath();ctx.moveTo(r*1.4,-9);ctx.lineTo(r*1.4+18,0);ctx.lineTo(r*1.4,9);ctx.stroke();
    } else {
        ctx.beginPath();ctx.moveTo(0,-r*1.5);ctx.lineTo(0,-r*1.5-10);ctx.moveTo(0,-r*1.5-15);ctx.lineTo(0,-r*1.5-18);ctx.stroke();
    }
    ctx.restore();
}
