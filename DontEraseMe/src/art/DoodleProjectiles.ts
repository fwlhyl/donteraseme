import type { Entity } from '../core/Entity';
import { Projectile } from '../components/Projectile';
import { Renderable } from '../components/Renderable';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { SkillVisual } from '../components/SkillVisual';
import { Weapon, type WeaponType } from '../components/Weapon';
import { PlayerStats } from '../components/PlayerStats';
import type { DoodlePose } from './DoodleMotion';

/** Drawing-only stamps. Collision dimensions, projectiles and paint history are never mutated. */
export const DOODLE_PROJECTILE_TYPES: readonly WeaponType[] = [
    'standard', 'shotgun', 'melee', 'chain', 'ruler', 'ribbon', 'gravity', 'rocket',
    'sniper', 'flamethrower', 'compass', 'mine',
];
type StampKind = WeaponType | 'slash';
const INK = '#171d29', PAPER = '#fff0cb';
const PALETTE = ['#f3d754','#ef9151','#e85564','#ac78dc','#647beb','#55b8e1',
    '#66d3cc','#60b975','#dfdfcc','#303c58','#de7fc3','#ba9970'];
const paletteRGB = PALETTE.map(p=>[1,3,5].map(i=>parseInt(p.slice(i,i+2),16)));
const pigments = new Map<string,string>();
const named: Record<string,string> = {yellow:'#ffff00',orange:'#ffa500',red:'#ff0000',
    blue:'#0000ff',green:'#00ff00',cyan:'#00ffff',magenta:'#ff00ff',white:'#ffffff',black:'#000000'};
const cache = new Map<string,HTMLCanvasElement>();
let builds = 0;
export function getDoodleProjectileCacheStats(): { size:number; builds:number; limit:number } {
    return {size:cache.size,builds,limit:192};
}

/** A bounded palette also prevents changing flame RGBA/alpha from generating a stamp per frame. */
function pigment(color:string, base?:{r:number;g:number;b:number}):string {
    // Ignore lifetime opacity in the key, and cache the tiny set of actual shot colors.
    const key=base?`${base.r},${base.g},${base.b}`:color.startsWith('rgba(')?color.slice(0,color.lastIndexOf(',')):color;
    const cached=pigments.get(key);if(cached)return cached;
    let rgb = base ? [base.r,base.g,base.b] : undefined;
    const value = named[color.toLowerCase()] ?? color;
    if (!rgb && /^#[0-9a-f]{3}$/i.test(value)) rgb=[1,2,3].map(i=>parseInt(value[i]+value[i],16));
    if (!rgb && /^#[0-9a-f]{6}$/i.test(value)) rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
    if (!rgb && /^rgba?\(/.test(value)) rgb=value.match(/[\d.]+/g)?.slice(0,3).map(Number);
    if (!rgb || rgb.length!==3 || !rgb.every(Number.isFinite)) return PALETTE[4];
    let nearest=PALETTE[0], distance=Infinity;
    for(let i=0;i<PALETTE.length;i++) {
        const p=paletteRGB[i];
        const next=(p[0]-rgb[0])**2+(p[1]-rgb[1])**2+(p[2]-rgb[2])**2;
        if(next<distance) {distance=next;nearest=PALETTE[i];}
    }
    if(pigments.size>=256)pigments.delete(pigments.keys().next().value!);
    pigments.set(key,nearest);
    return nearest;
}
function polygon(c:CanvasRenderingContext2D, points:readonly number[], fill:string, visibleEdge=false):void {
    c.beginPath();c.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);
    c.closePath();c.fillStyle=fill;c.fill();
    if(visibleEdge) { c.strokeStyle=PAPER;c.lineWidth=8.5;c.stroke();c.strokeStyle=INK;c.lineWidth=4.5; }
    c.stroke();
    if(visibleEdge) c.lineWidth=2.4;
}
function line(c:CanvasRenderingContext2D, points:readonly number[], color:string, width:number):void {
    c.beginPath();c.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);
    c.strokeStyle=color;c.lineWidth=width;c.stroke();c.strokeStyle=INK;c.lineWidth=2.4;
}
function dot(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string):void {
    c.beginPath();c.ellipse(x,y,r,r*.8,-.2,0,Math.PI*2);c.fillStyle=color;c.fill();c.stroke();
}
function paintStamp(c:CanvasRenderingContext2D, kind:StampKind, color:string, awakened:boolean):void {
    c.lineCap='round';c.lineJoin='round';c.strokeStyle=INK;c.lineWidth=2.4;
    switch(kind) {
        case 'mine':
            // Grounded ink drop: pointed upright crown, dark body, colored edge and pooled ink.
            polygon(c,[-27,16,-20,12,-8,13,1,10,15,12,28,18,22,23,6,24,-13,22,-27,20],color);
            c.beginPath();c.moveTo(2,-29);c.bezierCurveTo(-2,-16,-18,-10,-18,5);
            c.bezierCurveTo(-18,23,17,24,19,5);c.bezierCurveTo(20,-9,8,-15,2,-29);
            c.closePath();c.fillStyle=INK;c.fill();c.strokeStyle=color;c.lineWidth=2.8;c.stroke();
            line(c,[-7,-7,-10,0,-9,5],PAPER,3);dot(c,12,19,2.5,color);
            break;
        case 'standard':
            polygon(c,[-29,-6,-14,-15,7,-16,26,-8,30,2,18,16,-3,15,-18,9,-28,11],color,true);
            line(c,[-12,-7,7,-8,19,-3],PAPER,3.5);break;
        case 'shotgun':
            polygon(c,[-17,-10,-4,-18,12,-13,20,0,9,15,-9,13,-20,2],color,true);
            dot(c,-26,17,3.7,color);dot(c,24,-17,3,color);line(c,[-7,-9,4,-10],PAPER,3);break;
        case 'chain':
            polygon(c,[-31,-3,-13,-12,2,-8,16,-12,29,-3,22,10,7,12,-8,7,-22,11],color,true);
            c.beginPath();c.ellipse(-9,0,10,5,-.23,0,Math.PI*2);c.ellipse(10,0,10,5,.18,0,Math.PI*2);
            c.strokeStyle=INK;c.lineWidth=3;c.stroke();line(c,[-4,-7,12,-8],PAPER,2);break;
        case 'ribbon':
            polygon(c,[-31,-13,-12,-7,4,-14,26,-7,31,1,12,1,2,13,-17,15,-7,4,-28,1],color,true);
            line(c,[-24,-7,-10,-1,4,-8,20,-3],PAPER,2.4);line(c,[-7,4,3,8,11,1],INK,2);break;
        case 'rocket':
            polygon(c,[-29,-12,-13,-8,-14,9,-29,15,-23,1],color);
            polygon(c,[-15,-14,17,-12,30,-1,19,13,-15,15,-20,1],color);
            polygon(c,[14,-11,28,0,17,11,14,4],PAPER);
            line(c,[-9,-7,5,-7],PAPER,3);line(c,[-27,-18,-34,-20],color,3);break;
        case 'gravity':
            polygon(c,[-27,-9,-19,-25,0,-28,18,-21,28,-3,22,19,2,27,-20,21,-29,4],color);
            line(c,[17,-10,6,-17,-10,-12,-18,0,-10,13,5,16,16,5,8,-3,-2,-2,-4,5],INK,5);
            line(c,[-16,-17,-5,-22,7,-21],PAPER,2.8);break;
        case 'flamethrower':
            polygon(c,[-29,-4,-18,-14,-5,-9,4,-20,17,-13,30,0,16,14,1,9,-11,20,-17,7],color,true);
            polygon(c,[-12,-1,-1,-6,7,-3,19,0,4,7,-5,4],PAPER);break;
        case 'compass':
            polygon(c,[-14,-27,-4,-25,5,3,28,20,23,27,-3,12,-14,-17],color);
            polygon(c,[-14,-27,-5,-23,-6,8,-17,29,-23,26,-16,5],PAPER);
            dot(c,-9,-21,5,color);line(c,[-3,4,10,11],INK,2);break;
        case 'melee': case 'slash':
            polygon(c,[-17,-29,1,-23,19,-10,28,6,21,27,23,8,10,-5,-2,-15,-23,-22],color);
            line(c,[-8,-22,6,-15,17,-4,23,7],PAPER,2.8);
            line(c,[-20,-13,-10,-10],color,3);break;
        case 'sniper': case 'ruler':
            // Cached strip; long beams need only one blit, never per-pixel/per-enemy paths.
            polygon(c,[-31,-3,-22,-4,21,-3,31,0,23,4,-22,3,-31,5],color);
            line(c,[-26,-.5,22,.5],PAPER,1.1);
            if(kind==='ruler') for(let x=-24;x<=24;x+=8)line(c,[x,2,x,6+(x%16===0?2:0)],INK,1.2);
            break;
    }
    if(awakened && kind!=='mine' && kind!=='ruler' && kind!=='sniper') {
        line(c,[-29,-24,-25,-28],PAPER,2);line(c,[23,25,29,22],PAPER,2);
    }
}
function stamp(kind:StampKind,color:string,awakened:boolean):HTMLCanvasElement|null {
    const key=`${kind}/${color}/${awakened?1:0}`;
    const existing=cache.get(key);if(existing)return existing;
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.translate(64,64);ctx.scale(1.8,1.8);paintStamp(ctx,kind,color,awakened);
    if(cache.size>=192)cache.delete(cache.keys().next().value!);
    cache.set(key,canvas);builds++;return canvas;
}
function drawStamp(ctx:CanvasRenderingContext2D,kind:StampKind,color:string,width:number,height:number,angle:number,awakened=false):boolean {
    if(![width,height,angle].every(Number.isFinite)||width<=0||height<=0)return false;
    const image=stamp(kind,color,awakened);if(!image)return false;
    ctx.save();ctx.shadowBlur=0;ctx.imageSmoothingEnabled=true;ctx.rotate(angle);
    // The 64-unit artwork sits within a 71-unit transparent source square.
    ctx.drawImage(image,-width*.556,-height*.556,width*1.112,height*1.112);
    ctx.restore();return true;
}
function weaponProjectile(entity:Entity,playerId?:string):Projectile|undefined {
    const p=entity.getComponent(Projectile);
    if(!playerId || p?.ownerId!==playerId || !DOODLE_PROJECTILE_TYPES.includes(p.type)
        ||entity.hasComponent(SkillVisual)||entity.tags.has('magic-pen-projectile')
        ||entity.tags.has('summon_bullet_stickman')||entity.tags.has('summon_bullet_drone'))return;
    return p;
}
/** Call in upright entity-local coordinates, before generic geometric bodies. */
export function drawDoodleProjectile(ctx:CanvasRenderingContext2D,entity:Entity,playerId?:string):boolean {
    const p=weaponProjectile(entity,playerId), r=entity.getComponent(Renderable),t=entity.getComponent(Transform);
    if(!p||!r||!t||r.shape==='line'||r.shape==='shockwave'||r.shape==='wall_line')return false;
    const v=entity.getComponent(Velocity);
    const angle=p.type==='mine'?0:p.type==='compass'?t.rotation:(v && (v.x!==0||v.y!==0)?Math.atan2(v.y,v.x):t.rotation);
    const radius=Math.max(2,r.radius),color=pigment(r.color,p.baseColorRGB);
    const awakened=Boolean((p as Projectile & {isAwakened?:boolean}).isAwakened);
    let kind:StampKind=p.type,width=radius*2.4,height=radius*2.1;
    if(r.shape==='crescent') {kind='slash';width=radius*1.4;height=radius*2;}
    else if(p.type==='melee') {width=Math.max(24,r.width);height=width*1.25;}
    else if(p.type==='mine') {width=radius*2.8;height=radius*3.1;}
    else if(p.type==='standard'||p.type==='chain'||p.type==='ribbon')width=radius*3.5;
    else if(p.type==='compass')width=height=radius*2.8;
    else if(p.type==='gravity')width=height=radius*2.5;
    else if(p.type==='rocket')width=radius*3.4;
    // Small projectile stamps need enough screen pixels to remain legible;
    // this changes presentation only, never collision radii or painted paths.
    if(p.type==='shotgun') {width=Math.max(width,25);height=Math.max(height,22);}
    else if(p.type==='standard') {width=Math.max(width,32);height=Math.max(height,26);}
    else if(p.type==='chain'||p.type==='ribbon') {
        width=Math.max(width,23);height=Math.max(height,20);
    } else if(p.type==='flamethrower') {width=Math.max(width,18);height=Math.max(height,17);}
    ctx.save();
    if(p.type==='melee') {ctx.translate(Math.cos(angle)*r.width*.55,Math.sin(angle)*r.width*.55);ctx.globalAlpha*=Math.min(1,Math.max(.3,p.life/5));}
    // Flame fade already lives in Renderable.color; preserve its existing life opacity.
    if(p.type==='flamethrower') {
        const match=r.color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
        if(match)ctx.globalAlpha*=Math.max(0,Math.min(1,Number(match[1])));
    }
    const drawn=drawStamp(ctx,kind,color,width,height,angle,awakened);ctx.restore();return drawn;
}
/** Sniper beams use world-space endpoints, preserving the raycast exactly. */
export function drawDoodleProjectileLine(ctx:CanvasRenderingContext2D,entity:Entity,playerId?:string):boolean {
    const p=weaponProjectile(entity,playerId),r=entity.getComponent(Renderable),t=entity.getComponent(Transform);
    if(!p||!r||!t||r.shape!=='line'||(p.type!=='sniper'&&p.type!=='ruler'))return false;
    const dx=r.width-t.x,dy=r.height-t.y,len=Math.hypot(dx,dy);if(len<=0)return false;
    ctx.save();ctx.translate(t.x+dx*.5,t.y+dy*.5);ctx.globalAlpha*=.85;
    const drawn=drawStamp(ctx,p.type,pigment(r.color),len,25,Math.atan2(dy,dx));ctx.restore();return drawn;
}
/** Ruler is hitscan paint, not a projectile. Reuse the actual weapon attack pulse. */
export function drawDoodleRulerShot(ctx:CanvasRenderingContext2D,entity:Entity,pose?:DoodlePose):boolean {
    const weapon=entity.getComponent(Weapon),t=entity.getComponent(Transform),r=entity.getComponent(Renderable);
    if(!entity.tags.has('player')||weapon?.config?.type!=='ruler'||!pose||pose.attack<=0||!t||!r)return false;
    const stats=entity.getComponent(PlayerStats),awakened=Boolean(stats?.hasSkill('mastery_ruler'));
    const len=awakened?1000:600,thickness=12*(stats?.trailWidthMultiplier??1)*(awakened?3:1);
    ctx.save();ctx.translate(Math.cos(t.rotation)*len*.5,Math.sin(t.rotation)*len*.5);ctx.globalAlpha*=pose.attack*.8;
    const drawn=drawStamp(ctx,'ruler',pigment(r.color),len,Math.max(25,thickness*3),t.rotation,awakened);
    ctx.restore();return drawn;
}
