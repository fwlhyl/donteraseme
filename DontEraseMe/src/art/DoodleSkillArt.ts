import type { AtlasFrame } from './AtlasFrame';
import { neutralArtImage } from './NeutralArtImage';
import type { DoodlePose } from './DoodleMotion';
import type { Entity } from '../core/Entity';
import { Summon } from '../components/Summon';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { SkillVisual } from '../components/SkillVisual';
import { Projectile } from '../components/Projectile';
import { Velocity } from '../components/Velocity';
import { MagicManifestation } from '../components/MagicManifestation';
import { drawMagicTank } from './MagicTankArt';
import { drawMagicRobot } from './MagicRobotArt';
import { drawMagicBomber } from './MagicBomberArt';

export type SkillSprite = 'digital_pen' | 'stickman' | 'palette' | 'scythe' | 'drone' | 'turret'
    | 'paperclip' | 'ink_dummy' | 'tank' | 'robot' | 'bomber' | 'paper_shard';

/** Display-only enlargement. Renderable dimensions and gameplay aim stay authoritative. */
export const DOODLE_VEHICLE_SCALE = 1.4;
const uprightFacing = new WeakMap<Entity, -1 | 1>();
export function getDoodleUprightFacing(entity: Entity, angle: number): -1 | 1 {
    const horizontal = Math.cos(angle);
    let facing = uprightFacing.get(entity) ?? 1;
    // Keep the last side when aiming almost vertically, avoiding rapid flip jitter.
    if (horizontal > .12) facing = 1;
    else if (horizontal < -.12) facing = -1;
    uprightFacing.set(entity, facing);
    return facing;
}
const KINDS: readonly SkillSprite[] = ['digital_pen','stickman','palette','scythe','drone','turret','paperclip','ink_dummy','tank','robot','bomber','paper_shard'];
export const SKILL_FRAMES: Readonly<Record<SkillSprite, AtlasFrame>> = Object.fromEntries(
    KINDS.map(kind => [kind,{x:0,y:0,width:64,height:64}])) as Record<SkillSprite, AtlasFrame>;
export function getDoodleSkills(): HTMLImageElement { return neutralArtImage('skill'); }

/** Simple monochrome stand-ins retain each skill's readable silhouette. */
export function drawDoodleSkillSprite(ctx: CanvasRenderingContext2D, kind: SkillSprite,
    size: number, angle = 0): boolean {
    if (!KINDS.includes(kind) || !Number.isFinite(size) || size <= 0 || !Number.isFinite(angle)) return false;
    ctx.save();ctx.shadowBlur=0;ctx.rotate(angle);ctx.scale(size/32,size/32);
    ctx.fillStyle='#d7dbce';ctx.strokeStyle='#30382b';ctx.lineWidth=1.2;ctx.lineJoin='miter';ctx.setLineDash([]);
    const box=(x:number,y:number,w:number,h:number)=>{ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);};
    const polygon=(points:readonly (readonly [number,number])[])=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();};
    switch(kind){
        case 'digital_pen':
        case 'bomber':
            polygon([[15,0],[-12,-5],[-6,0],[-12,5]]);polygon([[0,-11],[7,0],[0,11],[-2,0]]);break;
        case 'stickman':
            ctx.fillStyle='#30382b';box(-4,-8,8,14);box(-4,-15,8,6);
            ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-3,-5);ctx.lineTo(-8,1);ctx.moveTo(3,-5);ctx.lineTo(9,-1);ctx.stroke();break;
        case 'palette':
            polygon([[0,-14],[12,-7],[12,7],[0,14],[-12,7],[-12,-7]]);
            ctx.fillStyle='#30382b';box(-3,-3,6,6);break;
        case 'scythe':
            ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-10,11);ctx.lineTo(7,-9);ctx.stroke();
            polygon([[3,-11],[12,-10],[15,-3],[6,-6],[-4,-7]]);break;
        case 'drone':
            box(-8,-4,16,10);ctx.fillStyle='#30382b';box(4,-1,5,4);
            ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,-8);ctx.lineTo(-6,-2);ctx.moveTo(12,-8);ctx.lineTo(6,-2);ctx.stroke();
            ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-16,-8);ctx.lineTo(-7,-8);ctx.moveTo(7,-8);ctx.lineTo(16,-8);ctx.stroke();break;
        case 'turret':
            polygon([[-11,9],[11,9],[7,3],[-7,3]]);box(-8,-5,15,10);box(4,-2,12,4);break;
        case 'paperclip':
            ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(5,8);ctx.lineTo(5,-9);ctx.quadraticCurveTo(5,-15,-1,-15);ctx.quadraticCurveTo(-8,-15,-8,-8);ctx.lineTo(-8,9);ctx.quadraticCurveTo(-8,16,0,16);ctx.quadraticCurveTo(8,16,8,9);ctx.lineTo(8,-7);ctx.stroke();break;
        case 'ink_dummy':
            ctx.fillStyle='#30382b';polygon([[-5,-14],[5,-14],[6,-5],[11,13],[-11,13],[-6,-5]]);break;
        case 'tank':
            ctx.fillStyle='#30382b';box(-15,5,29,8);ctx.fillStyle='#d7dbce';box(-13,-2,25,9);box(-6,-8,15,7);box(5,-6,12,3);
            ctx.strokeStyle='#8d9683';for(let x=-10;x<12;x+=6){ctx.beginPath();ctx.arc(x,9,2,0,Math.PI*2);ctx.stroke();}break;
        case 'robot':
            ctx.fillStyle='#30382b';box(-10,6,7,9);box(3,6,7,9);ctx.fillStyle='#d7dbce';box(-10,-7,20,16);box(-6,-14,12,7);box(10,-3,6,4);break;
        case 'paper_shard':
            polygon([[-10,-12],[9,-8],[6,10],[-8,13],[-5,1]]);ctx.beginPath();ctx.moveTo(-5,1);ctx.lineTo(6,10);ctx.stroke();break;
    }
    ctx.restore();return true;
}

function shadow(ctx: CanvasRenderingContext2D, width: number, y: number): void {
    ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(12,17,24,.24)';
    ctx.beginPath(); ctx.ellipse(0,y,width,.18*width,0,0,Math.PI*2); ctx.fill(); ctx.restore();
}

/** Called in entity-local upright coordinates. Replaces only existing bodies. */
export function drawDoodleSkillEntity(ctx: CanvasRenderingContext2D, entity: Entity,
    time: number, pose?: DoodlePose): boolean {
    const r = entity.getComponent(Renderable), t = entity.getComponent(Transform);
    if (!r || !t) return false;
    const summon = entity.getComponent(Summon), visual = entity.getComponent(SkillVisual);
    const vehicle = r.shape === 'magic_tank' ? 'tank' : r.shape === 'magic_robot' ? 'robot' : r.shape === 'magic_bomber' ? 'bomber' : null;
    const kind = summon?.type ?? (entity.tags.has('ink_dummy') ? 'ink_dummy'
        : entity.tags.has('paperclip') ? 'paperclip' : vehicle ?? visual?.kind);
    if (!kind) return drawSkillBullet(ctx, entity, r, t);
    // Procedural stand-ins are immediately available and never request retired atlases.
    ctx.save(); ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    if (kind === 'stickman') {
        shadow(ctx, 8, 16);
        const facing = Math.cos(t.rotation - Math.PI/2) < -.12 ? -1 : 1;
        const step = pose?.step ?? 0;
        // Straight torso; only legs stride and the body bobs by less than a pixel.
        ctx.translate(0, (pose?.y ?? 0) * .7); ctx.scale(facing,1);
        for (const side of [-1,1]) {
            const s = step * side;
            ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(side*3+s*1.3,11);
            ctx.lineTo(side*5+s*2.1,16-Math.max(0,s)*1.5); ctx.lineTo(side*5+s*2.1+2,16-Math.max(0,s)*1.5);
            ctx.strokeStyle = '#131b24'; ctx.lineWidth = 3.7; ctx.stroke();
            ctx.strokeStyle = '#d9d5c7'; ctx.lineWidth = 1.15; ctx.stroke();
        }
        drawDoodleSkillSprite(ctx,'stickman',30);
    } else if (kind === 'palette') {
        shadow(ctx,9,8); drawDoodleSkillSprite(ctx,'palette',25,t.rotation);
    } else if (kind === 'scythe') {
        drawDoodleSkillSprite(ctx,'scythe',34,t.rotation);
    } else if (kind === 'drone') {
        shadow(ctx,10,13); ctx.translate(0,-1.2*Math.sin(time*4));
        // SummonSystem stores the old nose-up triangle heading (+PI/2).
        // Read the actual movement heading, but only mirror the upright artwork.
        const aim = t.rotation-Math.PI/2;
        ctx.scale(getDoodleUprightFacing(entity,aim),1);
        drawDoodleSkillSprite(ctx,'drone',32);
        // Short rotor ticks animate without rotating or shaking the whole vehicle.
        ctx.strokeStyle = '#79846e'; ctx.lineWidth = 1.2;
        const blade = 2+Math.abs(Math.sin(time*24))*2;
        ctx.beginPath(); ctx.moveTo(-10-blade,-5); ctx.lineTo(-10+blade,-5);
        ctx.moveTo(10-blade,-9); ctx.lineTo(10+blade,-9); ctx.stroke();
    } else if (kind === 'ink_dummy') {
        shadow(ctx,14,17); ctx.translate(0,-.4*Math.sin(time*3)); drawDoodleSkillSprite(ctx,'ink_dummy',r.radius*2);
    } else if (kind === 'paperclip') {
        drawDoodleSkillSprite(ctx,'paperclip',20,t.rotation);
    } else if (kind === 'paper_shard') {
        const v=entity.getComponent(Velocity);
        drawDoodleSkillSprite(ctx,'paper_shard',Math.max(r.width,r.height,r.radius*2),v?Math.atan2(v.y,v.x):t.rotation);
    } else if (kind === 'pencil_shard') {
        const v=entity.getComponent(Velocity);
        drawPencilShard(ctx,r.radius,v?Math.atan2(v.y,v.x):t.rotation);
    } else if (kind === 'desperate_burst') {
        // A brief irregular paint burst, rather than a circular range marker.
        // Fixed shapes avoid flicker; the existing projectile lifetime drives the expansion.
        const life = entity.getComponent(Projectile)?.life ?? 10;
        const remaining = Math.max(0, Math.min(1, life / 10));
        ctx.save(); ctx.scale(r.radius, r.radius); ctx.globalAlpha *= .28 * remaining;
        ctx.fillStyle = '#f28774'; ctx.strokeStyle = '#f28774';
        ctx.beginPath();
        ctx.moveTo(-.31,-.18); ctx.quadraticCurveTo(-.38,-.39,-.13,-.35);
        ctx.quadraticCurveTo(-.04,-.51,.12,-.32); ctx.quadraticCurveTo(.33,-.38,.31,-.17);
        ctx.quadraticCurveTo(.48,-.05,.32,.11); ctx.quadraticCurveTo(.38,.32,.16,.29);
        ctx.quadraticCurveTo(.01,.46,-.12,.29); ctx.quadraticCurveTo(-.35,.35,-.33,.13);
        ctx.quadraticCurveTo(-.46,-.02,-.31,-.18); ctx.closePath(); ctx.fill();
        const streaks = [
            [-.2,-.22,-.5,-.47,-.79,-.56,.065], [.08,-.3,.16,-.54,.11,-.84,.045],
            [.25,-.17,.48,-.39,.75,-.42,.055], [.31,.03,.54,.04,.85,.18,.06],
            [.18,.24,.35,.46,.49,.73,.05], [-.05,.3,-.16,.54,-.11,.75,.06],
            [-.27,.17,-.48,.29,-.76,.32,.048], [-.31,-.02,-.54,-.11,-.7,-.17,.038],
        ];
        const expansion = .65 + .35 * (1 - remaining);
        ctx.scale(expansion, expansion);
        for (const [x,y,cx,cy,endX,endY,width] of streaks) {
            // Each streak tapers into an uneven pointed tongue of paint.
            const length = Math.hypot(endX-x, endY-y) || 1;
            const nx = -(endY-y) / length * width, ny = (endX-x) / length * width;
            ctx.beginPath(); ctx.moveTo(x+nx,y+ny);
            ctx.quadraticCurveTo(cx+nx*.55,cy+ny*.55,endX,endY);
            ctx.quadraticCurveTo(cx-nx*.25,cy-ny*.25,x-nx*.7,y-ny*.7);
            ctx.closePath(); ctx.fill();
        }
        for (const [x,y,rx,ry,angle] of [[-.85,-.61,.037,.022,-.4],[.16,-.91,.027,.039,.2],
            [.83,-.48,.035,.023,-.6],[.92,.21,.035,.022,.3],[.56,.81,.03,.043,-.5],
            [-.15,.86,.035,.025,.4],[-.84,.39,.028,.042,.9]]) {
            ctx.beginPath(); ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    } else if (vehicle) {
        const size = Math.max(r.width,r.height) * DOODLE_VEHICLE_SCALE;
        shadow(ctx,size*.34,size*.35);
        // All piloted cutouts remain upright. Only flip X; never rotate the hull
        // or mirror Y. The untouched transform still aims actual attacks in 360°.
        ctx.scale(getDoodleUprightFacing(entity,t.rotation),1);
        const manifestation = entity.getComponent(MagicManifestation);
        const moving = manifestation?.visualMoving ?? 0;
        const attack = Math.max(0, Math.min(1, (manifestation?.visualAttackFrames ?? 0) / 12));
        if (vehicle === 'tank') drawMagicTank(ctx, size, time, moving, attack, manifestation?.visualAim ?? 0);
        else if (vehicle === 'robot') drawMagicRobot(ctx, size, time * 7, moving, attack, manifestation?.visualAim ?? 0);
        else drawMagicBomber(ctx, size, time, moving, attack);
    }
    ctx.restore(); return true;
}

function drawPencilShard(ctx: CanvasRenderingContext2D, radius: number, angle: number): void {
    ctx.save(); ctx.rotate(angle); ctx.strokeStyle = '#151c24'; ctx.fillStyle = '#e8d6af'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(radius,0); ctx.lineTo(-radius,-radius*.45); ctx.lineTo(-radius,radius*.45); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(radius,0); ctx.lineTo(radius*.25,-radius*.25); ctx.lineTo(radius*.25,radius*.25); ctx.fillStyle = '#394350'; ctx.fill(); ctx.restore();
}

/** Uses existing provenance tags; generic weapon/paint particles are untouched. */
function drawSkillBullet(ctx: CanvasRenderingContext2D, entity: Entity, r: Renderable, t: Transform): boolean {
    const stickman = entity.tags.has('summon_bullet_stickman');
    const drone = entity.tags.has('summon_bullet_drone');
    const magic = entity.tags.has('magic-pen-projectile');
    if (!stickman && !drone && !magic) return false;
    ctx.save(); ctx.shadowBlur = 0;
    if (stickman) drawPencilShard(ctx,r.radius,t.rotation);
    else {
        ctx.rotate(t.rotation); ctx.lineWidth = 1.2; ctx.strokeStyle = '#18212b';
        ctx.fillStyle = drone ? '#9adce4' : entity.tags.has('magic-robot-pulse') ? '#b2d8f3' : '#eed6a3';
        ctx.beginPath(); ctx.moveTo(r.radius,0); ctx.lineTo(0,-r.radius*.65); ctx.lineTo(-r.radius,0); ctx.lineTo(0,r.radius*.65); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore(); return true;
}

/** Stationary base art with readable lifetime arc; aim follows existing turret.rotation. */
export function drawDoodleTurret(ctx: CanvasRenderingContext2D, angle: number, life: number): boolean {
    ctx.save(); ctx.rotate(angle); ctx.scale(1,Math.cos(angle)<0?-1:1);
    const drawn = drawDoodleSkillSprite(ctx,'turret',42);
    ctx.restore();
    if (!drawn) return false;
    ctx.save(); ctx.shadowBlur=0; ctx.strokeStyle='#79846e'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.arc(0,0,30,-Math.PI/2,-Math.PI/2+Math.max(0,Math.min(1,life/300))*Math.PI*2); ctx.stroke(); ctx.restore();
    return true;
}
