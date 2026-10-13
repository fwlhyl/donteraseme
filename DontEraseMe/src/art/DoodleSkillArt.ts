import skillsUrl from '../assets/doodle/skills-v1.png';
import type { AtlasFrame } from './AtlasFrame';
import { drawAtlasFrame } from './AtlasFrame';
import type { DoodlePose } from './DoodleMotion';
import type { Entity } from '../core/Entity';
import { Summon } from '../components/Summon';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { SkillVisual } from '../components/SkillVisual';
import { Velocity } from '../components/Velocity';

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
const frame = (x: number, y: number, width: number, height: number, pivotY = .5): AtlasFrame =>
    ({ x: x - 2, y: y - 2, width: width + 4, height: height + 4, pivotY });
/** Measured alpha bounds, not assumed uniform cells. */
export const SKILL_FRAMES: Readonly<Record<SkillSprite, AtlasFrame>> = {
    digital_pen: frame(36,47,344,252), stickman: frame(428,39,292,259,.68),
    palette: frame(806,43,294,259), scythe: frame(1156,22,349,301),
    drone: frame(32,358,336,229), turret: frame(431,393,334,239),
    paperclip: frame(833,350,300,286), ink_dummy: frame(1191,357,298,287),
    // Adjacent silhouettes meet the cell divider: no padding across x=414.
    tank: {x:24,y:686,width:390,height:272}, robot: {x:414,y:668,width:349,height:323},
    bomber: frame(797,673,372,300), paper_shard: frame(1232,698,237,281),
};
let atlas: HTMLImageElement | undefined;
export function getDoodleSkills(): HTMLImageElement {
    if (!atlas) { atlas = new Image(); atlas.src = skillsUrl; }
    return atlas;
}
export function drawDoodleSkillSprite(ctx: CanvasRenderingContext2D, kind: SkillSprite,
    size: number, angle = 0): boolean {
    const f = SKILL_FRAMES[kind];
    if (!f || !Number.isFinite(size) || size <= 0 || !Number.isFinite(angle)) return false;
    const image = getDoodleSkills();
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
    ctx.save(); ctx.shadowBlur = 0; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.rotate(angle); drawAtlasFrame(ctx, image, f, size); ctx.restore();
    return true;
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
    const image = getDoodleSkills();
    const ready = image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    // Keep even the drone's loading/error fallback upright instead of dropping
    // through to the old freely rotating triangle in RenderSystem.
    if (!ready && kind !== 'drone') return false;
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
        if (ready) drawDoodleSkillSprite(ctx,'drone',32);
        else {
            ctx.fillStyle='#eee3cc'; ctx.strokeStyle='#18212b'; ctx.lineWidth=1.5;
            ctx.fillRect(-10,-3,20,13); ctx.strokeRect(-10,-3,20,13);
            ctx.fillStyle='#e88b89'; ctx.fillRect(-9,-2,18,4);
            ctx.fillStyle='#18212b'; ctx.fillRect(4,4,2,3);
        }
        // Short rotor ticks animate without rotating or shaking the whole vehicle.
        ctx.strokeStyle = '#b7e6e5'; ctx.lineWidth = 1.2;
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
        ctx.save(); ctx.globalAlpha *= .35; ctx.strokeStyle = '#f28774'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,r.radius,0,Math.PI*2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = 'rgba(239,116,92,.08)'; ctx.beginPath(); ctx.arc(0,0,r.radius,0,Math.PI*2); ctx.fill();
    } else if (vehicle) {
        const size = Math.max(r.width,r.height) * DOODLE_VEHICLE_SCALE;
        shadow(ctx,size*.34,size*.35);
        // All piloted cutouts remain upright. Only flip X; never rotate the hull
        // or mirror Y. The untouched transform still aims actual attacks in 360°.
        ctx.scale(getDoodleUprightFacing(entity,t.rotation),1);
        drawDoodleSkillSprite(ctx,vehicle,size);
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
    ctx.save(); ctx.shadowBlur=0; ctx.strokeStyle='#81d1da'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.arc(0,0,30,-Math.PI/2,-Math.PI/2+Math.max(0,Math.min(1,life/300))*Math.PI*2); ctx.stroke(); ctx.restore();
    return true;
}
