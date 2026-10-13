import type { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Health } from '../components/Health';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { getEnemyGait } from './DoodleEnemyGait';

export interface DoodlePose {
    x: number; y: number; angle: number; scaleX: number; scaleY: number;
    attack: number; hit: number; shadowScale: number;
    /** Signed foot stride, already weighted by movement; opposite legs use opposite signs. */
    step: number;
    /** Smoothed actual travel speed, normalized to 0..1. */
    moving: number;
}
export interface DoodleSample {
    x: number; y: number; hp: number; attackSerial: number; frozen?: boolean; kind?: string;
}
const TAU = Math.PI * 2;
const neutral = (): DoodlePose => ({x:0,y:0,angle:0,scaleX:1,scaleY:1,attack:0,hit:0,shadowScale:1,step:0,moving:0});

/** Simulation-time cutout animation. Never writes back to combat components. */
export class DoodleMotion {
    private previous?: DoodleSample;
    private time = 0;
    private gait = 0;
    private moving = 0;
    private attackAge = 1;
    private hitAge = 1;
    private pose = neutral();
    constructor(private readonly seed = 0, initial?: DoodleSample) { this.previous=initial; }

    update(sample: DoodleSample, dt: number): DoodlePose {
        if (dt <= 0 || !Number.isFinite(dt)) return this.pose;
        dt = Math.min(dt, .1);
        this.time += dt; this.attackAge += dt; this.hitAge += dt;
        const prev = this.previous;
        if (sample.attackSerial > (prev?.attackSerial ?? 0)) this.attackAge = 0;
        if (prev && sample.hp < prev.hp) this.hitAge = 0;
        const distance = prev ? Math.hypot(sample.x-prev.x,sample.y-prev.y) : 0;
        // Ignore spawn and teleport displacement; walls use actual movement, not held input.
        const speed = sample.frozen || distance > 80 ? 0 : Math.min(1, distance / dt / 190);
        const attack = Math.max(0,1-this.attackAge/.16);
        const hit = Math.max(0,1-this.hitAge/.2);
        if (sample.kind === 'player') {
            // The torso stays upright: only separate feet stride. Advance phase by travel,
            // not elapsed time, so a blocked/stopped player never keeps walking in place.
            const travel = sample.frozen || distance > 80 ? 0 : distance;
            this.moving += (speed-this.moving) * (1-Math.exp(-dt*24));
            if (sample.frozen || distance > 80 || this.moving < .005) this.moving = 0;
            this.gait = (this.gait + travel/108*TAU) % TAU;
            const step = this.moving === 0 ? 0 : Math.sin(this.gait)*this.moving;
            const bounce = .65 * this.moving * Math.sin(this.gait)**2;
            const breathing = sample.frozen ? 0 : .1*(1-this.moving)*Math.sin(this.time*2.8+this.seed);
            this.pose = {
                x: 0, y: -bounce+breathing-hit*.12, angle: 0, scaleX: 1, scaleY: 1,
                attack, hit, shadowScale: 1-bounce*.035, step, moving: this.moving,
            };
            this.previous = {...sample};
            return this.pose;
        }
        const enemyGait = getEnemyGait(sample.kind);
        if (enemyGait) {
            const travel = sample.frozen || distance > 80 ? 0 : distance;
            const walkingSpeed = travel === 0 ? 0 : Math.min(1, distance / dt / 95);
            this.moving += (walkingSpeed-this.moving) * (1-Math.exp(-dt*24));
            if (sample.frozen || distance > 80 || this.moving < .005) this.moving = 0;
            this.gait = (this.gait + travel/enemyGait.cycleDistance*TAU) % TAU;
            const step = this.moving === 0 ? 0 : Math.sin(this.gait+this.seed)*this.moving;
            const bounce = .65 * this.moving * Math.sin(this.gait+this.seed)**2;
            const breathing = sample.frozen ? 0 : .1*(1-this.moving)*Math.sin(this.time*2.8+this.seed);
            this.pose = {
                x: hit > 0 ? hit*Math.sin(this.time*47+1)*1.2 : 0,
                y: -bounce+breathing-hit*.12,
                angle: 0, scaleX: 1, scaleY: 1,
                attack, hit, shadowScale: 1-bounce*.035, step, moving: this.moving,
            };
            this.previous = {...sample};
            return this.pose;
        }
        this.moving += (speed-this.moving) * Math.min(1,dt*18);
        if (sample.frozen) this.moving = 0;
        if (!sample.frozen) this.gait += dt * (9 + 7*this.moving);
        const t = Math.floor(this.time*12)/12;
        const step = Math.sin(Math.floor(this.gait*12/TAU)/12*TAU + this.seed);
        const breathing = sample.frozen ? 0 : Math.sin(t*2.8+this.seed)*.012;
        const flying = sample.kind==='paper_plane' || sample.kind==='boss_prism' || sample.kind==='blackhole';
        const heavy = sample.kind==='eraser' || sample.kind==='boss_roller' || sample.kind==='boss_eraser';
        const bounce = this.moving * Math.abs(step) * (heavy?1.1:2.6);
        this.pose = {
            x: hit*Math.sin(t*47+1)*2.5,
            y: -bounce - (flying&&!sample.frozen?Math.sin(t*4+this.seed)*1.4:0),
            angle: step*this.moving*(heavy?.022:.055) + hit*.045*Math.sin(t*61),
            scaleX: 1-breathing + this.moving*Math.abs(step)*.025 + attack*.075 - hit*.055,
            scaleY: 1+breathing - this.moving*Math.abs(step)*.025 - attack*.065 + hit*.07,
            attack, hit, shadowScale: 1-bounce*.035, step: step*this.moving, moving: this.moving,
        };
        this.previous = {...sample};
        return this.pose;
    }
}

// Visual attack signal: monotonic and private, never affects ammo/cooldowns or logs.
const attackSerials = new WeakMap<Entity, number>();
export function signalDoodleAttack(entity: Entity): void {
    attackSerials.set(entity,(attackSerials.get(entity) ?? 0)+1);
}
export function sampleDoodleMotion(entity: Entity, dt: number, cache: WeakMap<Entity,DoodleMotion>): DoodlePose {
    const t=entity.getComponent(Transform), h=entity.getComponent(Health), e=entity.getComponent(EnemyBehavior);
    const sample={x:t?.x??0,y:t?.y??0,hp:h?.current??0,attackSerial:attackSerials.get(entity)??0,frozen:(e?.frozenFrames??0)>0,kind:entity.tags.has('player')?'player':e?.type};
    let motion = cache.get(entity);
    if (!motion) {
        let hash=0; for (const ch of entity.id) hash=(hash*31+ch.charCodeAt(0))>>>0;
        motion = new DoodleMotion(hash%628/100,{...sample,attackSerial:0}); cache.set(entity,motion);
    }
    return motion.update(sample,dt);
}

/** Local body transforms only; the caller's hitbox/skill overlays stay anchored. */
export function applyDoodlePose(ctx: CanvasRenderingContext2D, pose: DoodlePose | undefined, size: number, heading = 0): void {
    if (!pose) return;
    const ratio=size/64, recoil=pose.attack*2*ratio;
    ctx.translate(pose.x*ratio-Math.cos(heading)*recoil,pose.y*ratio-Math.sin(heading)*recoil);
    // Stretch around the feet rather than letting the feet slide through the floor.
    ctx.translate(0,size*.42);ctx.rotate(pose.angle);ctx.scale(pose.scaleX,pose.scaleY);ctx.translate(0,-size*.42);
}

export function drawDoodleAccent(ctx: CanvasRenderingContext2D, pose: DoodlePose | undefined, size: number, heading: number): void {
    if (!pose || (pose.attack<=0 && pose.hit<=0)) return;
    ctx.save();ctx.shadowBlur=0;
    const hit=pose.hit>0;
    ctx.strokeStyle=hit?'#ffdd90':'#fff1bd';ctx.lineWidth=1.7;ctx.lineCap='round';
    ctx.globalAlpha *= hit?pose.hit:pose.attack;
    ctx.rotate(hit?-.6:heading);
    const r=size*(hit?.47:.52);
    ctx.beginPath();
    for(let i=-1;i<=1;i++) {
        const a=i*.5;ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
        ctx.lineTo(Math.cos(a)*(r+4+size*.04),Math.sin(a)*(r+4+size*.04));
    }
    ctx.stroke();ctx.restore();
}
