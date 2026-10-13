import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { ControlPoint } from '../components/ControlPoint';
import { Renderable } from '../components/Renderable';
import { PlayerStats } from '../components/PlayerStats';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { ParticleFactory } from '../entities/ParticleFactory';
import { PlayerControl } from '../components/PlayerControl';

export class ObjectiveSystem extends System {
    constructor(
        private worldWidth: number,
        private worldHeight: number,
        private addEntityCallback: (e: Entity) => void
    ) {
        super();
    }
    
    public override setWorldSize(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
    }

    public update(dt: number): void {
        let player: Entity | undefined;
        for (const e of this.entities) {
            if (e.tags.has('player')) { player = e; break; }
        }
        if (!player) return;
        
        const pT = player.getComponent(Transform);
        if (!pT) return;
        
        for (const e of this.entities) {
            const cp = e.getComponent(ControlPoint);
            const t = e.getComponent(Transform);
            if (!cp || !t || !cp.active) continue;
            
            const dist = Math.hypot(t.x - pT.x, t.y - pT.y);
            if (dist <= cp.radius) {
                cp.progress += 1;
                if (cp.progress >= cp.required) {
                    cp.active = false;
                    this.applyReward(player);
                    this.spawnNext();
                    e.active = false;
                }
            } else {
                cp.progress = Math.max(0, cp.progress - 0.5);
            }
        }
        
        if (![...this.entities].some(e => e.getComponent(ControlPoint) && e.active)) {
            this.spawnNext();
        }
    }
    
    private applyReward(player: Entity) {
        // 随机三种奖励之一
        const rand = Math.random();
        const pStats = player.getComponent(PlayerStats);
        const pHealth = player.getComponent(Health);
        let announcement = "";

        if (rand < 0.33) {
            // 奖励 1：全屏炸弹
            announcement = "获得奖励：全屏炸弹！小怪已被清空！";
            for (const e of this.entities) {
                if (!e.active) continue;
                const eb = e.getComponent(EnemyBehavior);
                const hp = e.getComponent(Health);
                const t = e.getComponent(Transform);
                const r = e.getComponent(Renderable);
                
                // 'chaser' and 'shooter' are small mobs, others might be elite/boss
                if (eb && hp && (eb.type === 'chaser' || eb.type === 'shooter')) {
                    hp.current = 0;
                    e.active = false;
                    if (t && r && this.addEntityCallback) {
                        const particles = ParticleFactory.createExplosion(t.x, t.y, r.color, 10);
                        particles.forEach(p => this.addEntityCallback!(p));
                    }
                }
            }
        } else if (rand < 0.66) {
            // 奖励 2：额外宝箱（这里触发一次升级技能抽取，并回满血）
            announcement = "获得奖励：医疗宝箱！生命已回满！";
            if (pHealth) {
                pHealth.current = pHealth.max;
            }
            window.dispatchEvent(new CustomEvent('level-up'));
        } else {
            // 奖励 3：短时Buff (10秒无敌或无限子弹)
            if (Math.random() < 0.5) {
                announcement = "获得奖励：短时Buff！10秒内无敌！";
                if (pStats) {
                    pStats.invincibleUntil = Date.now() + 10000;
                }
            } else {
                announcement = "获得奖励：短时Buff！10秒内无限子弹！";
                if (pStats) {
                    pStats.infiniteAmmoUntil = Date.now() + 10000;
                }
            }
        }

        // 发送提示
        window.dispatchEvent(new CustomEvent('announce', { detail: { text: announcement } }));
    }
    
    private spawnNext() {
        const e = new Entity();
        const x = Math.random() * (this.worldWidth - 400) + 200;
        const y = Math.random() * (this.worldHeight - 400) + 200;
        e.addComponent(new Transform(x, y));
        e.addComponent(new ControlPoint(80, 0, 300, true));
        e.addComponent(new Renderable('rgba(0, 200, 255, 0.2)', 80, 0, 0, 'circle', 5));
        e.tags.add('control_point');
        this.addEntityCallback(e);
    }
}
