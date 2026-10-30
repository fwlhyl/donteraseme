import { combatImpact } from '../art/CombatImpact';
import { skillVfx } from '../art/SkillVfx';
import { System } from '../core/System';
import { drawInkSplash } from '../art/InkSplash';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Projectile } from '../components/Projectile';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { PlayerControl } from '../components/PlayerControl';
import { ParticleFactory } from '../entities/ParticleFactory';
import { BulletFactory } from '../entities/BulletFactory';
import { Velocity } from '../components/Velocity'; // Import Velocity
import { Weapon } from '../components/Weapon'; // Import Weapon
import { Score } from '../components/Score'; // Import Score
import { Experience } from '../components/Experience';
import { Skill } from '../components/Skill';
import { PlayerStats } from '../components/PlayerStats';
import { DamageTextSystem } from './DamageTextSystem';
import { WaterMark } from '../components/WaterMark';
import { InkCloud } from '../components/InkCloud';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { DeathHandler } from './DeathHandler';
import { Puddle } from '../components/Puddle';
import { Paperclip } from '../components/Paperclip';
import { PlayerAnimation } from '../components/PlayerAnimation';
import { SkillVisual } from '../components/SkillVisual';
import { MagicManifestation } from '../components/MagicManifestation';
import { emitGameSound } from '../audio/AudioEvents';
import { sweptProjectileCircleTime, sweptWallTime } from './ProjectileSweep';

/** Broad phase only: the original AABB and shape tests remain authoritative. */
class EnemyCollisionIndex {
    private readonly cellSize = 128;
    private readonly cells = new Map<string, Set<number>>();
    private readonly entries = new Map<Entity, { order: number; key: string }>();
    private readonly unindexed = new Set<number>();

    constructor(private readonly enemies: Entity[]) {
        enemies.forEach((enemy, order) => {
            this.entries.set(enemy, { order, key: '' });
            this.update(enemy, enemy.getComponent(Transform));
        });
    }

    public update(enemy: Entity, transform: Transform | undefined): void {
        const entry = this.entries.get(enemy);
        if (!entry) return;
        const key = transform && Number.isFinite(transform.x) && Number.isFinite(transform.y)
            ? `${Math.floor(transform.x / this.cellSize)},${Math.floor(transform.y / this.cellSize)}` : '';
        if (entry.key === key && key) return;
        if (entry.key) this.cells.get(entry.key)?.delete(entry.order);
        this.unindexed.delete(entry.order);
        entry.key = key;
        if (!key) {
            this.unindexed.add(entry.order);
            return;
        }
        let cell = this.cells.get(key);
        if (!cell) this.cells.set(key, cell = new Set());
        cell.add(entry.order);
    }

    public query(x: number, y: number, range: number): Entity[] {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(range)) return this.enemies;
        const minX = Math.floor((x - range) / this.cellSize);
        const maxX = Math.floor((x + range) / this.cellSize);
        const minY = Math.floor((y - range) / this.cellSize);
        const maxY = Math.floor((y + range) / this.cellSize);
        if (![minX, maxX, minY, maxY].every(Number.isSafeInteger)) return this.enemies;
        // A long beam can span most of the world; visiting every cell then
        // sorting would cost more than the original ordered scan.
        if ((maxX - minX + 1) * (maxY - minY + 1) >= this.enemies.length) return this.enemies;
        const orders = [...this.unindexed];
        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const cell = this.cells.get(`${cx},${cy}`);
                if (cell) {
                    // A packed mob has little to cull; avoid copying/sorting
                    // most of the list for every shot into the same crowd.
                    if (orders.length + cell.size > this.enemies.length / 2) return this.enemies;
                    for (const order of cell) orders.push(order);
                }
            }
        }
        // Piercing, shields, chain effects and random rolls depend on the
        // original entity insertion order, not on spatial bucket order.
        orders.sort((a, b) => a - b);
        return orders.map(order => this.enemies[order]);
    }
}

type SeparationEntry = {
    entity: Entity;
    behavior: EnemyBehavior | undefined;
    transform: Transform | undefined;
    render: Renderable | undefined;
};

type SeparationNeighborhood = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    /** null means the original sequential scan is cheaper/safer. */
    orders: number[] | null;
};

/** Live, ordered broad phase for the sequential pairwise separation solver. */
class EnemySeparationIndex {
    private readonly cellSize = 128;
    private readonly cells = new Map<string, Set<number>>();
    private readonly keys: string[] = [];
    private maxRadius = 0;
    private supported = true;

    constructor(private readonly entries: SeparationEntry[]) {
        entries.forEach((entry, order) => {
            if (!entry.transform || !entry.render) return;
            const radius = entry.render.radius || 15;
            // Keep legacy handling for malformed/non-positive radii and very
            // large coordinates, including the coincident-center random push.
            if (!(radius > 0) || !Number.isFinite(radius)) this.supported = false;
            this.maxRadius = Math.max(this.maxRadius, radius);
            this.update(order);
        });
    }

    public update(order: number): void {
        const transform = this.entries[order].transform;
        if (!transform) return;
        const cx = Math.floor(transform.x / this.cellSize);
        const cy = Math.floor(transform.y / this.cellSize);
        if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) {
            this.supported = false;
            return;
        }
        const key = `${cx},${cy}`;
        if (key === this.keys[order]) return;
        const previous = this.keys[order];
        if (previous) this.cells.get(previous)?.delete(order);
        this.keys[order] = key;
        let cell = this.cells.get(key);
        if (!cell) this.cells.set(key, cell = new Set());
        cell.add(order);
    }

    public query(transform: Transform, radius: number, after: number): SeparationNeighborhood {
        // A little extra coverage avoids rebuilding after every tiny push.
        // covers() checks the true collision radius against these bucket bounds.
        const range = radius + this.maxRadius + this.cellSize / 4;
        const minX = Math.floor((transform.x - range) / this.cellSize);
        const maxX = Math.floor((transform.x + range) / this.cellSize);
        const minY = Math.floor((transform.y - range) / this.cellSize);
        const maxY = Math.floor((transform.y + range) / this.cellSize);
        const result: SeparationNeighborhood = { minX, maxX, minY, maxY, orders: null };
        const remaining = this.entries.length - after - 1;
        if (!this.supported || ![minX, maxX, minY, maxY].every(Number.isSafeInteger)
            || (maxX - minX + 1) * (maxY - minY + 1) >= remaining) return result;
        const orders: number[] = [];
        for (let cy = minY; cy <= maxY; cy++) {
            for (let cx = minX; cx <= maxX; cx++) {
                const cell = this.cells.get(`${cx},${cy}`);
                if (!cell) continue;
                for (const order of cell) {
                    if (order <= after) continue;
                    orders.push(order);
                    // Sorting a packed crowd is more work than the old loop.
                    if (orders.length * 2 > remaining) return result;
                }
            }
        }
        orders.sort((a, b) => a - b);
        result.orders = orders;
        return result;
    }

    public covers(neighborhood: SeparationNeighborhood, transform: Transform, radius: number): boolean {
        const range = radius + this.maxRadius;
        return this.supported
            && Math.floor((transform.x - range) / this.cellSize) >= neighborhood.minX
            && Math.floor((transform.x + range) / this.cellSize) <= neighborhood.maxX
            && Math.floor((transform.y - range) / this.cellSize) >= neighborhood.minY
            && Math.floor((transform.y + range) / this.cellSize) <= neighborhood.maxY;
    }
}

// removed Physics import
export class CollisionSystem extends System {
    constructor(
        private addEntityCallback?: (entity: Entity) => void,
        private trailCtx?: CanvasRenderingContext2D // Add trailCtx
    ) {
        super();
    }
    private frame: number = 0;
    private enemyContactCooldown: Map<string, number> = new Map();
    // Per enemy, separate from damage dealt to the player; weak keys do not
    // retain dead enemies or carry cooldowns into a later run.
    private vehicleRamCooldown = new WeakMap<Entity, number>();

    private drawSplash(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number): void {
        drawInkSplash(ctx, x, y, radius, color, 0.6);
    }

    private handleEnemyDeath(enemy: Entity, player: Entity | null, x: number, y: number, color: string): void {
        DeathHandler.handleEnemyDeath(enemy, player, x, y, color, this.entities, this.addEntityCallback);
    }

    private handlePlayerHit(player: Entity, pTransform: Transform, sourceTransform: Transform) {
        const pStats = player.getComponent(PlayerStats);
        if (pStats && pStats.hasInkPassive && this.addEntityCallback) {
            // 水墨画家：受击喷射致盲水墨团，持续3秒，半径300
            // 觉醒1：【深渊墨池】致盲范围扩大一倍（半径600）
            const isAwakened1 = pStats.getSkillLevel('awakening_ink_1') > 0;
            const inkRadius = isAwakened1 ? 600 : 300;
            
            const ink = new Entity();
            ink.addComponent(new Transform(pTransform.x, pTransform.y));
            ink.addComponent(new Renderable('rgba(0, 0, 0, 0.8)', inkRadius, 0, 0, 'circle'));
            ink.addComponent(new InkCloud(inkRadius, 180, 'rgba(0, 0, 0, 0.8)'));
            this.addEntityCallback(ink);
        }

        // 防御/受击触发系：刺猬装甲 (defense_hedgehog)
        if (pStats) {
            const hedgehogLevel = pStats.getSkillLevel('defense_hedgehog');
            if (hedgehogLevel > 0 && pStats.hedgehogCooldownFrames <= 0 && this.addEntityCallback) {
                // 冷却时间: 3秒 (180帧), 2.5秒 (150帧), 2秒 (120帧)
                const cooldowns = [180, 150, 120];
                pStats.hedgehogCooldownFrames = cooldowns[hedgehogLevel - 1] || 180;

                const projCount = hedgehogLevel === 1 ? 8 : (hedgehogLevel === 2 ? 16 : 24);
                const projDamage = 20 * pStats.totalDamageMultiplier;
                const isPiercing = hedgehogLevel >= 3;
                
                for (let i = 0; i < projCount; i++) {
                    const angle = (Math.PI * 2 / projCount) * i;
                    const proj = new Entity();
                    proj.addComponent(new Transform(pTransform.x, pTransform.y));
                    proj.addComponent(new Renderable('#b9b5ce', 8, 0, 0, 'circle'));
                    proj.addComponent(new SkillVisual('pencil_shard'));
                    proj.addComponent(new Velocity(Math.cos(angle) * 10, Math.sin(angle) * 10));
                    proj.addComponent(new Projectile('standard', projDamage, player.id, 60, isPiercing ? 999 : 1));
                    proj.tags.add('projectile');
                    this.addEntityCallback(proj);
                }
            }
        }
    }

    private applyDamageToPlayer(player: Entity, amount: number, pTransform: Transform, isBoss: boolean, sourceTransform: Transform): void {
        const pHealth = player.getComponent(Health);
        const pStats = player.getComponent(PlayerStats);
        if (!pHealth || !pStats) return;

        // 1. Classical Shield Check
        if (pStats.characterId === 'classical' && (pStats.hasClassicalShield || pStats.classicalShieldStacks > 0)) {
            
            // 古典油画家觉醒1：不朽名作 (破盾时恢复 10% 最大生命值)
            if (pStats.hasSkill('awakening_classical_1')) {
                pHealth.current = Math.min(pHealth.max, pHealth.current + pHealth.max * 0.1);
                DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 40, pHealth.max * 0.1, '#00ff00', false, "+HP");
            }
            
            // 古典油画家觉醒2：荆棘画框 (破盾时全屏毁灭打击)
            if (pStats.hasSkill('awakening_classical_2') && this.addEntityCallback) {
                window.dispatchEvent(new CustomEvent('shake', { detail: { mag: 20, frames: 15 } }));
                const explosion = ParticleFactory.createExplosion(pTransform.x, pTransform.y, '#ffffff', 50);
                explosion.forEach(p => this.addEntityCallback!(p));
                
                // 改为屏幕范围内打击 (600像素半径)，而不是真正的“全屏”无视距离
                const blastRadius = 600;
                
                // 增加一个震荡波光圈来增强破盾时的视觉表现
                const shockwave = new Entity();
                shockwave.addComponent(new Transform(pTransform.x, pTransform.y));
                shockwave.addComponent(new Renderable('rgba(255, 204, 0, 0.8)', 10, 0, 0, 'shockwave'));
                const fxProj = new Projectile('shockwave_fx', 0, player.id, 20); // 存活20帧
                (fxProj as any).maxRadius = blastRadius;
                shockwave.addComponent(fxProj);
                this.addEntityCallback(shockwave);
                
                for (const enemy of this.entities) {
                    if (!enemy.tags.has('enemy') || !enemy.active) continue;
                    
                    const eTransform = enemy.getComponent(Transform);
                    if (!eTransform) continue;
                    
                    const dx = eTransform.x - pTransform.x;
                    const dy = eTransform.y - pTransform.y;
                    
                    if (Math.sqrt(dx*dx + dy*dy) <= blastRadius) {
                        const eHealth = enemy.getComponent(Health);
                        if (eHealth) {
                            const damage = 200 * pStats.totalDamageMultiplier;
                            eHealth.current -= damage;
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 20, damage, '#ffffff', true, "粉碎!");
                            
                            // 增加怪物受击视觉表现：爆出白色碎片
                            const hitParticles = ParticleFactory.createExplosion(eTransform.x, eTransform.y, '#ffffff', 8);
                            hitParticles.forEach(p => this.addEntityCallback!(p));
                            
                            if (eHealth.current <= 0) {
                                enemy.active = false;
                            }
                        }
                    }
                }
            }

            pStats.classicalShieldStacks--;
            if (pStats.classicalShieldStacks <= 0) {
                pStats.hasClassicalShield = false;
                pStats.classicalShieldStacks = 0;
            }
            
            if (pStats.shieldCooldownFrames <= 0) {
                pStats.shieldCooldownFrames = pStats.maxShieldCooldownFrames;
            }
            
            DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 20, 0, '#00ffff', true, "免疫!");
            emitGameSound('shield', { x: pTransform.x, y: pTransform.y });
            pHealth.invincibleFrames = 60; // Give some i-frames anyway to prevent instant multi-hit
            this.handlePlayerHit(player, pTransform, sourceTransform);
            return;
        }

        // 2. Origami Shield Check (defense_shield)
        const shieldLevel = pStats.getSkillLevel('defense_shield');
        if (shieldLevel > 0 && pStats.hasOrigamiShield) {
            pStats.hasOrigamiShield = false;
            const cooldowns = [3600, 2700, 1800]; // 60s, 45s, 30s
            pStats.origamiShieldCooldownFrames = cooldowns[shieldLevel - 1] || 3600;
            DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 20, 0, '#ffffff', true, "折纸盾!");
            emitGameSound('shield', { x: pTransform.x, y: pTransform.y });
            pHealth.invincibleFrames = 60;
            
            if (shieldLevel >= 3 && this.addEntityCallback) {
                // 护盾破裂时发射追踪纸屑
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const proj = new Entity();
                    proj.addComponent(new Transform(pTransform.x, pTransform.y));
                    proj.addComponent(new Renderable('#dddddd', 6, 6, 6, 'rect'));
                    proj.addComponent(new SkillVisual('paper_shard'));
                    proj.addComponent(new Velocity(Math.cos(angle) * 8, Math.sin(angle) * 8));
                    // 给予较高的伤害和较长的存活时间以追踪
                    proj.addComponent(new Projectile('standard', 30 * pStats.totalDamageMultiplier, player.id, 120, 1));
                    proj.tags.add('projectile');
                    this.addEntityCallback(proj);
                }
            }
            this.handlePlayerHit(player, pTransform, sourceTransform);
            return;
        }

        // 3. Apply base damage
        let actualDamage = amount;
        pHealth.current -= actualDamage;
        if (actualDamage > 0) emitGameSound('hurt', { x: pTransform.x, y: pTransform.y });
        DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 15, actualDamage, '#ff0000', false);
        pHealth.invincibleFrames = 60; // 1 second of i-frames
        
        // 触发受击动画
        const pAnim = player.getComponent(PlayerAnimation);
        if (pAnim) {
            pAnim.hitTimer = 20; // 4帧 * 5 tick/帧 = 20帧 (缩短受击僵直)
        }

        // 4. Ink Dummy (defense_dummy) Fatal Damage Prevention
        const dummyLevel = pStats.getSkillLevel('defense_dummy');
        if (pHealth.current <= 0 && dummyLevel > 0 && pStats.dummyCooldownFrames <= 0) {
            pHealth.current = 1; // Prevent death
            const cooldowns = [3600, 2700, 1800];
            pStats.dummyCooldownFrames = cooldowns[dummyLevel - 1] || 3600;
            pHealth.invincibleFrames = 180; // 3 seconds invincible
            pStats.speedMultiplier += 0.5; // temporary speed up
            pStats.dummySpeedBuffFrames = 180; // 3 seconds speed up buff
            DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 30, 0, '#888888', true, "替身!");
            
            if (this.addEntityCallback) {
                const dummy = new Entity();
                dummy.addComponent(new Transform(pTransform.x, pTransform.y));
                dummy.addComponent(new Renderable('#444444', 20, 0, 0, 'circle'));
                dummy.addComponent(new Health(100)); // Give dummy some health
                // Add a special tag or component so enemies target it
                dummy.tags.add('ink_dummy');
                // Store the dummy's level to know if it should explode on death/expire
                const dummyBehavior = new EnemyBehavior('ink_dummy');
                dummyBehavior.lifeTimer = 180; // 3 seconds life (reverted)
                dummyBehavior.damageFactor = dummyLevel; // Store level here temporarily to use in EnemySystem
                dummy.addComponent(dummyBehavior);
                this.addEntityCallback(dummy);
            }
        }

        // 5. Desperate Explosion (defense_desperate_explosion)
        const exploLevel = pStats.getSkillLevel('defense_desperate_explosion');
        // Add a debug log to track cooldowns
        if (pHealth.current / pStats.maxHp <= 0.20 && exploLevel > 0 && pStats.explosionCooldownFrames <= 0) {
            const cooldowns = [3600, 2700, 1800];
            pStats.explosionCooldownFrames = cooldowns[exploLevel - 1] || 3600;
            
            if (exploLevel >= 3) {
                const heal = Math.floor(pStats.maxHp * 0.1);
                pHealth.current = Math.min(pStats.maxHp, Math.max(0, pHealth.current) + heal);
                DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 30, heal, '#00ff00', false, "+HP");
            }
            
            if (this.addEntityCallback) {
                const explosion = new Entity();
                explosion.addComponent(new Transform(pTransform.x, pTransform.y));
                explosion.addComponent(new Renderable('rgba(255, 50, 50, 0.6)', 150, 0, 0, 'circle'));
                explosion.addComponent(new SkillVisual('desperate_burst'));
                // Use a short-lived projectile that deals massive damage to surrounding enemies
                const proj = new Projectile('standard', 200 * pStats.totalDamageMultiplier, player.id, 10, 999);
                explosion.addComponent(proj);
                explosion.tags.add('projectile');
                this.addEntityCallback(explosion);
                
                // Particle effects
                const particles = ParticleFactory.createExplosion(pTransform.x, pTransform.y, '#ff3333', 40);
                for (const p of particles) this.addEntityCallback(p);
            }
        }

        this.handlePlayerHit(player, pTransform, sourceTransform);

        // Knockback
        const dx = pTransform.x - sourceTransform.x;
        const dy = pTransform.y - sourceTransform.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const kb = 22;
            pTransform.x += nx * kb;
            pTransform.y += ny * kb;
        }

        // Screen shake
        window.dispatchEvent(new CustomEvent('shake', { detail: { mag: isBoss ? 18 : 12, frames: isBoss ? 12 : 10 } }));

        // 6. Collector Awakening 2: 散财消灾 (awakening_collector_2)
        if (pHealth.current <= 0 && pStats.hasSkill('awakening_collector_2')) {
            if (pStats.gold >= 100 && pStats.collectorAwaken2Triggers < 3) {
                pStats.collectorAwaken2Triggers++;
                const cost = Math.floor(pStats.gold * 0.5);
                pStats.gold -= cost;
                
                // 【修复】：同步扣除 Score 组件里的 coins，防止 UI 和局外结算不一致
                const pScore = player.getComponent(Score);
                if (pScore) {
                    pScore.coins = pStats.gold;
                }
                
                pHealth.current = 1; // 锁血
                pHealth.invincibleFrames = 180; // 3秒无敌
                
                DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 40, cost, '#ffd700', true, "-$$$");
                
                // 全屏击退 (修正位移算法)
                for (const entity of this.entities) {
                    if (entity.tags.has('enemy') && entity.active) {
                        if (entity.tags.has('boss') || entity.tags.has('ink_dummy')) continue;
                        const t = entity.getComponent(Transform);
                        if (t) {
                            const ex = t.x - pTransform.x;
                            const ey = t.y - pTransform.y;
                            let edist = Math.sqrt(ex*ex + ey*ey);
                            if (edist === 0) {
                                edist = 1; // 防止除 0
                            }
                            
                            const pushForce = 150000 / (edist + 100); 
                            const finalPush = Math.min(pushForce, 800); 
                            t.x += (ex / edist) * finalPush;
                            t.y += (ey / edist) * finalPush;
                        }
                    }
                }
                
                window.dispatchEvent(new CustomEvent('shake', { detail: { mag: 25, frames: 20 } }));
                return; // 防止后续执行 Game Over
            }
        }

        if (pHealth.current <= 0) {
            console.log('GAME OVER! Player died.');
            player.active = false;
            const score = player.getComponent(Score)?.value || 0;
            window.dispatchEvent(new CustomEvent('game-over', { detail: { score } }));
        }
    }

    public update(dt: number): void {
        this.frame += 1;
        const projectiles: Entity[] = [];
        const enemies: Entity[] = [];
        const watermarks: Entity[] = [];
        const inkClouds: Entity[] = [];
        const xpOrbs: Entity[] = [];
        const puddles: Entity[] = [];
        const paperclips: Entity[] = [];
        const walls: Entity[] = [];
        let player: Entity | null = null;

        // 1. Filter entities into categories
        let canvasEye: Entity | null = null;
        for (const entity of this.entities) {
            if (entity.getComponent(Projectile)) {
                projectiles.push(entity);
            } else if (entity.tags.has('wall')) {
                walls.push(entity);
            } else if (entity.getComponent(EnemyBehavior)) {
                enemies.push(entity);
            } else if (entity.getComponent(WaterMark)) {
                watermarks.push(entity);
            } else if (entity.getComponent(InkCloud)) {
                inkClouds.push(entity);
            } else if (entity.tags.has('xp_orb')) {
                xpOrbs.push(entity);
            } else if (entity.tags.has('player')) {
                player = entity;
                const landingStats = player.getComponent(PlayerStats);
                if (landingStats && landingStats.mirrorLandingFrames > 0) landingStats.mirrorLandingFrames--;
                const pHealth = player.getComponent(Health);
                if (pHealth && pHealth.invincibleFrames > 0) {
                    pHealth.invincibleFrames -= 1;
                }
            } else if (entity.tags.has('canvas_eye')) {
                canvasEye = entity;
            } else if (entity.hasComponent(Puddle)) {
                puddles.push(entity);
            } else if (entity.hasComponent(Paperclip)) {
                paperclips.push(entity);
            }
        }

        // Small encounters are cheaper to scan directly. Build once per frame;
        // knockback below updates the index before the next projectile sees it.
        const enemyIndex = enemies.length >= 48 && projectiles.length > 0 ? new EnemyCollisionIndex(enemies) : null;

        // Non-piercing fast shots stop at the first wall, even if the endpoint lies beyond it.
        const blockingWalls = new Map<Entity, Entity>();

        // 2. Projectile vs Enemy
        for (const projectile of projectiles) {
            if (!projectile.active) continue;
            const pTransform = projectile.getComponent(Transform)!;
            const pRender = projectile.getComponent(Renderable)!;
            const pData = projectile.getComponent(Projectile)!;
            const pVel = projectile.getComponent(Velocity);

            if (!pTransform || !pRender) continue;

            // Team check: only player's子弹参与“子弹 vs 敌人”判定，避免敌人被友军或自身子弹误伤
            if (player && pData.ownerId !== player.id) {
                continue;
            }

            // These bounds deliberately match the existing broad phase, including
            // special weapon overrides. Hoist their calculation out of the pair loop.
            let aabbRange = 50;
            if (pRender.radius) aabbRange = Math.max(aabbRange, pRender.radius * 2);
            if (pRender.width) aabbRange = Math.max(aabbRange, pRender.width * 1.5);
            if (pRender.height) aabbRange = Math.max(aabbRange, pRender.height * 1.5);
            if (pData.type === 'gravity') aabbRange = 300;
            else if (pRender.shape === 'line') aabbRange = 1500;
            else if (pData.type === 'rocket' || pData.type === 'mine') aabbRange = 200;
            else if (pData.type === 'compass' && (pData as any).isAwakened) aabbRange = 200;

            const swept = pData.sweptCollision && Number.isFinite(pData.previousX) && Number.isFinite(pData.previousY);
            const fromX = swept ? pData.previousX! : pTransform.x;
            const fromY = swept ? pData.previousY! : pTransform.y;
            const queryX = (fromX + pTransform.x) / 2;
            const queryY = (fromY + pTransform.y) / 2;
            // Index the whole travelled segment, including fast upgraded bullets.
            aabbRange += Math.max(Math.abs(pTransform.x-fromX), Math.abs(pTransform.y-fromY)) / 2;

            // Awakened mines move other enemies during this same loop. Keep
            // their live ordered scan; all other shapes only move their current target.
            let candidates = pData.type === 'mine' && (pData as any).isAwakened
                ? enemies : enemyIndex?.query(queryX, queryY, aabbRange) ?? enemies;
            const sweepHits = new Map<Entity, number>();
            if (swept) {
                let wallTime = Infinity;
                if (pData.pierceCount <= 0) {
                    const bodyRadius = pRender.shape === 'circle' ? (pRender.radius || 5)
                        : Math.max(pRender.radius || 10, Math.max(pRender.width || 10, pRender.height || 10) / 2);
                    for (const wall of walls) {
                        const wt = wall.getComponent(Transform), wr = wall.getComponent(Renderable), wh = wall.getComponent(Health);
                        if (!wall.active || !wt || !wr || !wh || wh.current <= 0) continue;
                        const time = sweptWallTime(fromX, fromY, pTransform.x, pTransform.y, wt.x, wt.y,
                            wr.shape === 'wall_line' ? (wr.width || wt.x) : wt.x,
                            wr.shape === 'wall_line' ? (wr.height || wt.y) : wt.y, bodyRadius + (wr.radius || 25));
                        if (time !== null && time < wallTime) { wallTime = time; blockingWalls.set(projectile, wall); }
                    }
                }
                // Sort only contacted targets, so a non-piercing shot hits the first
                // physical body along the path rather than entity insertion order.
                candidates = candidates.filter(enemy => {
                    const et = enemy.getComponent(Transform), er = enemy.getComponent(Renderable);
                    if (!enemy.active || !et || !er || pData.hitEnemies?.has(enemy.id)) return false;
                    if (Math.abs(queryX-et.x) > aabbRange || Math.abs(queryY-et.y) > aabbRange) return false;
                    const time = sweptProjectileCircleTime(fromX, fromY, pTransform.x, pTransform.y,
                        pTransform.rotation, pRender.shape, pRender.width, pRender.height, pRender.radius,
                        et.x, et.y, er.radius || 15);
                    if (time === null || time >= wallTime) return false;
                    sweepHits.set(enemy, time);
                    return true;
                }).sort((a, b) => sweepHits.get(a)! - sweepHits.get(b)!);
            }
            for (const enemy of candidates) {
                if (!enemy.active) continue;

                // 替身免疫玩家子弹伤害
                if (enemy.tags.has('ink_dummy')) continue;
                
                const eTransform = enemy.getComponent(Transform)!;
                if (!eTransform) continue;
                if (Math.abs(queryX - eTransform.x) > aabbRange || Math.abs(queryY - eTransform.y) > aabbRange) {
                    continue; // 距离太远直接跳过所有复杂计算
                }
                const eBeh = enemy.getComponent(EnemyBehavior);
                const eRender = enemy.getComponent(Renderable)!;
                const eHealth = enemy.getComponent(Health)!;
                if (!eRender || !eHealth) continue;

                // Check collision based on projectile shape
                let hit = false;

                if (swept) {
                    hit = sweepHits.has(enemy);
                    // Preserve the existing small forward shove on rectangular shots.
                    if (hit && (pRender.shape === 'rect' || pRender.shape === 'crescent')) {
                        eTransform.x += Math.cos(pTransform.rotation) * 8;
                        eTransform.y += Math.sin(pTransform.rotation) * 8;
                        enemyIndex?.update(enemy, eTransform);
                    }
                }
                // Gravity Gun: Check if enemy is in range of black hole
                else if (pData.type === 'gravity') {
                    const isAwakened = (pData as any).isAwakened;
                    // 如果觉醒，引力范围扩大3倍（基础250 -> 750）
                    const gravityRadius = isAwakened ? 750 : 250; 
                    
                    const dx = pTransform.x - eTransform.x;
                    const dy = pTransform.y - eTransform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < gravityRadius) {
                        // Suck enemy in!
                        // 觉醒后吸力也相应增强，使得远处的敌人也能被快速扯入中心
                        const pullFactor = isAwakened ? 8.0 : 3.0; 
                        eTransform.x += (dx / dist) * pullFactor;
                        eTransform.y += (dy / dist) * pullFactor;
                        enemyIndex?.update(enemy, eTransform);
                        
                        // 中心伤害范围（黑洞核心区域）
                        const damageRadius = isAwakened ? 100 : 40;
                        if (dist < damageRadius) {
                            if (this.frame % 10 === 0) { // Deal damage every 10 frames
                                // 觉醒后中心伤害翻倍
                                const dmg = isAwakened ? 10 : 5;
                                eHealth.current -= dmg; 
                                DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, dmg, '#ffffff', false);
                                
                                // ================= 觉醒：事件视界 (即死) =================
                                if (isAwakened && enemy.getComponent(EnemyBehavior)?.type !== 'boss') {
                                    // 每次判定有 5% 概率触发即死 (0.05 * 6次/秒 = 约30%秒杀率，更明显)
                                    if (Math.random() < 0.05) { 
                                        eHealth.current = 0;
                                        // 夸张的粉碎飘字效果，使用极大的伤害数字和特殊颜色
                                        DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 20, 999999, '#ff00ff', true, "抹除!");
                                    }
                                }
                            }
                            // Check death here for gravity kill
                            if (eHealth.current <= 0) {
                                hit = true; // Trigger death logic
                            }
                        }
                    }
                } 
                else if (pRender.shape === 'line') {
                    // raycast logic for sniper beam
                    // In RenderSystem, beam end point is stored in pRender.width and pRender.height
                    hit = this.lineCircleCollision(
                        pTransform.x, pTransform.y, 
                        pRender.width, pRender.height, 
                        eTransform.x, eTransform.y, 
                        eRender.radius || 15 
                    );
                }  
                else if (pData.type === 'melee' && pRender.shape === 'rect') {
                    // 对于近战刮刀，使用扇形判定
                    const dx = eTransform.x - pTransform.x;
                    const dy = eTransform.y - pTransform.y;
                    const dist = Math.hypot(dx, dy);
                    // 攻击范围: 宽度的1.2倍作为扇形半径
                    const attackRadius = pRender.width * 1.2 + (eRender.radius || 15);

                    if (dist <= attackRadius) {
                        // 计算角度差
                        const angleToEnemy = Math.atan2(dy, dx);
                        // pTransform.rotation 记录了玩家攻击的方向
                        let angleDiff = angleToEnemy - pTransform.rotation;
                        // 归一化到 [-PI, PI]
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        
                        // 扇形张角为120度 (左右各60度)
                        if (Math.abs(angleDiff) <= Math.PI / 3) {
                            hit = true;
                            // 附加击退效果
                            const kbForce = 15;
                            eTransform.x += Math.cos(angleToEnemy) * kbForce;
                            eTransform.y += Math.sin(angleToEnemy) * kbForce;
                            enemyIndex?.update(enemy, eTransform);
                        }
                    }
                }
                else if ((pRender.shape === 'rect' || pRender.shape === 'crescent') && pData.type !== 'melee') {
                    // 针对发射出去的剑气波（带厚度和宽度的旋转矩形/月牙）进行精确 OBB vs Circle 碰撞检测
                    const dx = eTransform.x - pTransform.x;
                    const dy = eTransform.y - pTransform.y;
                    
                    // 将敌人的坐标逆时针旋转，转换到矩形的局部坐标系
                    const cos = Math.cos(-pTransform.rotation);
                    const sin = Math.sin(-pTransform.rotation);
                    const localX = dx * cos - dy * sin;
                    const localY = dx * sin + dy * cos;
                    
                    // 找到矩形上距离圆心最近的点
                    const halfW = (pRender.width || 40) / 2;
                    const halfH = (pRender.height || 10) / 2;
                    const closestX = Math.max(-halfW, Math.min(localX, halfW));
                    const closestY = Math.max(-halfH, Math.min(localY, halfH));
                    
                    // 计算最近点到圆心的距离
                    const distSq = (localX - closestX) * (localX - closestX) + (localY - closestY) * (localY - closestY);
                    const eRad = eRender.radius || 15;
                    
                    if (distSq < eRad * eRad) {
                        hit = true;
                        // 附加向前的推力
                        const kbForce = 8;
                        eTransform.x += Math.cos(pTransform.rotation) * kbForce;
                        eTransform.y += Math.sin(pTransform.rotation) * kbForce;
                        enemyIndex?.update(enemy, eTransform);
                    }
                }
                // Normal Collision Logic (Circles, Sprites, Triangles...)
                else {
                    const dx = pTransform.x - eTransform.x;
                    const dy = pTransform.y - eTransform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const minDist = (pRender.radius || 5) + (eRender.radius || 15);
                    
                    if (dist < minDist) {
                        hit = true;
                    }
                }

                    if (hit && pData.type === 'compass') {
                        const isAwakened = (pData as any).isAwakened;
                        
                        if (isAwakened) {
                            // ================= 觉醒圆规：弹射连击逻辑 =================
                            if ((pData as any).lastHitId === enemy.id) {
                                hit = false; // 刚打过这个怪，在弹射到下一个怪之前，忽略它（防止鞭尸）
                            } else {
                                // 命中新目标！
                                (pData as any).hitCount = ((pData as any).hitCount || 0) + 1;
                                (pData as any).lastHitId = enemy.id;
                                
                                // 切割特效
                                if (this.addEntityCallback) {
                                    const particles = ParticleFactory.createExplosion(eTransform.x, eTransform.y, pRender.color, 5);
                                    for (const p of particles) this.addEntityCallback(p);
                                }
                                
                                // 检查是否达到了 10 次最大弹射上限
                                if ((pData as any).hitCount >= 10) {
                                    (pData as any).returning = true; // 次数用尽，回家！
                                }
                            }
                            
                            // 觉醒圆规不消耗普通子弹的 pierceCount，它的寿命由 10 次弹射决定
                            // 所以这里我们手动 continue 跳过后面的 pierceCount 衰减逻辑
                            
                            // 造成伤害 (复用底下的实际扣血代码，但跳过后续的 pierceCount 减除)
                            let finalDamage = pData.damage;
                            eHealth.current -= finalDamage;
                            if (hit && finalDamage > 0) emitGameSound(pData.isCrit || pData.isSuperCrit ? 'hit-heavy' : 'hit', { x: eTransform.x, y: eTransform.y });
                            const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#ffffff');
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, finalDamage, textColor, pData.isCrit || pData.isSuperCrit);
                            
                            if (eHealth.current <= 0) {
                                this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);
                                if (this.trailCtx) {
                                    this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#000000', (eRender.radius || 15) * 2);
                                }
                            }
                            
                            continue; // 必须 continue，跳过普通的子弹扣除和 pierceCount 计算！

                        } else {
                            // ================= 普通圆规：冷却标签逻辑 =================
                            if (!(pData as any).hitTags) {
                                (pData as any).hitTags = new Set<string>();
                            }
                            
                            // We need a cooldown so compass doesn't hit the same enemy 60 times a second
                            if (!(pData as any).hitTags.has(`hit_${enemy.id}`)) {
                                (pData as any).hitTags.add(`hit_${enemy.id}`);
                                const hitCooldown = 200;
                                
                                setTimeout(() => {
                                    if (pData && (pData as any).hitTags) {
                                        (pData as any).hitTags.delete(`hit_${enemy.id}`);
                                    }
                                }, hitCooldown); 
                            } else {
                                hit = false; // Ignore this collision frame
                            }
                        }
                    }

                    if (hit) {
                        if (eBeh && eBeh.type === 'shield' && eBeh.shield > 0 && pData.type !== 'gravity') {
                        let vx = 0, vy = 0;
                        if (pRender.shape === 'line') {
                            vx = pRender.width - pTransform.x;
                            vy = pRender.height - pTransform.y;
                            const d = Math.hypot(vx, vy) || 1;
                            vx /= d; vy /= d;
                        } else if (pVel) {
                            const d = Math.hypot(pVel.x, pVel.y) || 1;
                            vx = pVel.x / d; vy = pVel.y / d;
                        }
                        const fx = Math.cos(eTransform.rotation);
                        const fy = Math.sin(eTransform.rotation);
                        const dot = vx * fx + vy * fy;
                        if (dot > Math.cos(Math.PI / 3)) {
                            eBeh.shield -= pData.damage;
                            if (pData.damage > 0) emitGameSound('shield', { x: eTransform.x, y: eTransform.y, gain: 0.65 });
                            const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#66ccff');
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, pData.damage, textColor, pData.isCrit || pData.isSuperCrit);
                            if (this.trailCtx) {
                                this.trailCtx.save();
                                this.trailCtx.globalAlpha = 0.6;
                                this.trailCtx.strokeStyle = '#66ccff';
                                this.trailCtx.beginPath();
                                this.trailCtx.arc(eTransform.x, eTransform.y, (eRender.radius || 20) + 6, eTransform.rotation - Math.PI/3, eTransform.rotation + Math.PI/3);
                                this.trailCtx.stroke();
                                this.trailCtx.restore();
                            }
                            if (pRender.shape !== 'line') {
                                if (pData.pierceCount && pData.pierceCount > 0) {
                                    pData.pierceCount -= 1;
                                } else {
                                    projectile.active = false;
                                }
                            }
                            continue;
                        }
                    }
                    // Special logic for Rocket and Mine (AOE)
                    if (pData.type === 'rocket' || pData.type === 'mine') {
                        emitGameSound('explosion', { x: eTransform.x, y: eTransform.y });
                        // Explosion radius
                        let explosionRadius = Math.floor(100 * (pData.explosionRadiusScale || 1));
                        if (projectile.tags.has('magic-tank-shell') || projectile.tags.has('magic-bomber-shell')) {
                            const bomber = projectile.tags.has('magic-bomber-shell');
                            this.addEntityCallback?.(skillVfx(eTransform.x,eTransform.y,bomber?'bomber_wave':'tank_wave',explosionRadius,bomber?'#968578':'#8b9274',bomber?28:22));
                        }

                        
                        if (pData.type === 'mine' && (pData as any).isAwakened) {
                            explosionRadius *= 3; // 爆炸范围扩大3倍
                            // 极强全屏击退效果
                            for (const otherEnemy of enemies) {
                                if (!otherEnemy.active || otherEnemy.tags.has('ink_dummy') || otherEnemy.tags.has('boss')) continue;
                                const t = otherEnemy.getComponent(Transform);
                                if (t) {
                                    const ex = t.x - eTransform.x;
                                    const ey = t.y - eTransform.y;
                                    const edist = Math.sqrt(ex*ex + ey*ey) || 1;
                                    
                                    // 只有在爆炸范围内的敌人才会被击退，距离越近击退越猛
                                    // 玩家希望击退范围再大一点，大概击退半个屏幕
                                    if (edist <= explosionRadius * 2.5) { // 冲击波范围比伤害范围大2.5倍
                                        // 调整推力基数，平滑分母，使击退距离大概在 400-800 像素左右（半屏）
                                        const pushForce = 150000 / (edist + 100); 
                                        // 最高封顶在 800 像素，确保不会飞出十万八千里
                                        const finalPush = Math.min(pushForce, 800); 
                                        t.x += (ex / edist) * finalPush;
                                        t.y += (ey / edist) * finalPush;
                                        enemyIndex?.update(otherEnemy, t);
                                    }
                                }
                            }
                        }
                        
                        const explosionDamage = (pData.type === 'rocket' ? 50 : 40) + (pData.damage || 0);
                        
                        // Find all enemies in range
                        for (const otherEnemy of enemies) {
                            if (!otherEnemy.active) continue;
                            const t = otherEnemy.getComponent(Transform)!;
                            const h = otherEnemy.getComponent(Health)!;
                            
                            const ex = t.x - eTransform.x;
                            const ey = t.y - eTransform.y;
                            const edist = Math.sqrt(ex*ex + ey*ey);
                            
                            if (edist <= explosionRadius) {
                                h.current -= explosionDamage;
                                const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#ffffff');
                                DamageTextSystem.addDamageText(t.x, t.y - 15, explosionDamage, textColor, pData.isCrit || pData.isSuperCrit);
                                // Visuals handled below if dead
                                if (h.current <= 0) {
                                    if (otherEnemy.active) { // Check again to avoid double kill logic
                                        this.handleEnemyDeath(otherEnemy, player, t.x, t.y, otherEnemy.getComponent(Renderable)!.color);
                                        if (this.trailCtx) {
                                            this.drawSplash(this.trailCtx, t.x, t.y, '#000000', otherEnemy.getComponent(Renderable)!.radius * 2);
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Create big explosion effect
                        if (this.addEntityCallback) {
                            // 根据爆炸范围动态调整粒子数量，觉醒地雷爆出超多粒子！
                            // 玩家反映视觉效果不明显，我们可以用多个图层/多次爆炸来增强
                            if (pData.type === 'mine' && (pData as any).isAwakened) {
                                // 核心亮色爆炸
                                const pCore = ParticleFactory.createExplosion(eTransform.x, eTransform.y, '#ffffff', 20);
                                // 外围主色爆炸
                                const pOuter = ParticleFactory.createExplosion(eTransform.x, eTransform.y, pRender.color, 60);
                                // 添加冲击波光圈
                                const shockwave = new Entity();
                                shockwave.addComponent(new Transform(eTransform.x, eTransform.y));
                                shockwave.addComponent(new Renderable('rgba(255,255,255,0.8)', 10, 0, 0, 'shockwave')); // Custom shockwave
                                shockwave.addComponent(new Projectile('shockwave_fx', 0, player ? player.id : '', 20)); // Life 20
                                (shockwave.getComponent(Projectile) as any).maxRadius = explosionRadius * 2.0;
                                
                                for (const p of pCore) this.addEntityCallback(p);
                                for (const p of pOuter) this.addEntityCallback(p);
                                this.addEntityCallback(shockwave);
                                
                                // 地面留下巨大焦痕
                                if (this.trailCtx) {
                                    this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, pRender.color, explosionRadius * 1.5);
                                    this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#000000', explosionRadius * 0.8);
                                }
                                
                            } else {
                                const particles = ParticleFactory.createExplosion(eTransform.x, eTransform.y, pRender.color, 20);
                                for (const p of particles) this.addEntityCallback(p);
                            }
                            
                            // ================= 觉醒：颜料桶炸弹集束轰炸 =================
                            if (pData.type === 'rocket' && (pData as any).isAwakened) {
                                const clusterCount = 5;
                                for (let i = 0; i < clusterCount; i++) {
                                    const ang = Math.random() * Math.PI * 2;
                                    const dist = 30 + Math.random() * 50;
                                    const cx = eTransform.x + Math.cos(ang) * dist;
                                    const cy = eTransform.y + Math.sin(ang) * dist;
                                    
                                    // 延迟产生连环爆炸
                                    setTimeout(() => {
                                        if (this.addEntityCallback) {
                                            const subParticles = ParticleFactory.createExplosion(cx, cy, pRender.color, 15);
                                            for (const p of subParticles) this.addEntityCallback(p);
                                        }
                                        // 处理子爆炸伤害
                                        for (const otherEnemy of enemies) {
                                            if (!otherEnemy.active) continue;
                                            const t = otherEnemy.getComponent(Transform);
                                            const h = otherEnemy.getComponent(Health);
                                            if (t && h) {
                                                if (Math.hypot(t.x - cx, t.y - cy) <= explosionRadius * 0.6) {
                                                    const subDmg = Math.floor(pData.damage * 0.4);
                                                    h.current -= subDmg;
                                                    DamageTextSystem.addDamageText(t.x, t.y - 10, subDmg, '#ff8800', false);
                                                    if (h.current <= 0) {
                                                        this.handleEnemyDeath(otherEnemy, player, t.x, t.y, otherEnemy.getComponent(Renderable)?.color || '#ffffff');
                                                    }
                                                }
                                            }
                                        }
                                        // 绘制子爆炸痕迹
                                        if (this.trailCtx) {
                                            this.drawSplash(this.trailCtx, cx, cy, pRender.color, explosionRadius * 1.2);
                                        }
                                    }, 100 + Math.random() * 200);
                                }
                            }

                            // Mine leaves a puddle
                            if (pData.type === 'mine') {
                                const puddle = new Entity();
                                puddle.addComponent(new Transform(eTransform.x, eTransform.y));
                                puddle.addComponent(new WaterMark(0.5, explosionRadius, 300, 'rgba(34, 255, 34, 0.4)')); // Green swamp
                                this.addEntityCallback(puddle);
                            }
                        }
                        
                        // Rocket Splash on Trail
                        if (this.trailCtx) {
                             // Add extra splash for rocket
                             // User: "Rocket didn't leave explosion splash on enemy".
                             // This block runs when Rocket hits (AOE).
                             // We are looping through enemies.
                             // But this block is OUTSIDE the enemy loop. It uses `eTransform` which is the PRIMARY target.
                             // We want to splash on ALL enemies hit? Or just the center?
                             // "Rocket didn't make enemy leave splash".
                             // The splash should be at the explosion center.
                             // And maybe splashes for all victims?
                              
                             // Let's draw a BIG splash at the center of explosion.
                             this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, pRender.color, 60);
                        }

                        projectile.active = false; // Rocket/Mine destroyed on impact
                        break; // Stop checking other enemies for this rocket/mine
                    }

                    // 记录已经命中过的敌人，防止穿透时重复计算
                    if (!pData.hitEnemies) {
                        pData.hitEnemies = new Set<string>();
                    }
                    if (pData.hitEnemies.has(enemy.id)) {
                        continue;
                    }
                    pData.hitEnemies.add(enemy.id);

                    // 书法家被动：每穿透一个敌人，子弹伤害增加50%
                    if (pData.calligrapherBonus) {
                        pData.damage *= 1.5;
                    }
                    
                    // 水墨画家觉醒2：【墨影杀阵】
                    // 处于致盲状态的敌人受到的所有伤害增加 100%
                    if (eBeh && eBeh.blindFrames > 0 && player) {
                        const pStats = player.getComponent(PlayerStats);
                        if (pStats && pStats.getSkillLevel('awakening_ink_2') > 0) {
                            pData.damage *= 2.0;
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 30, 0, '#000000', false, "破防!");
                        }
                    }

                    let finalDamage = pData.damage;

                    // 元素附魔系处理
                    if (player && eBeh) {
                        const stats = player.getComponent(PlayerStats);
                        if (stats) {
                            // 腐蚀：计算额外伤害
                            if (eBeh.corrosiveStacks > 0) {
                                finalDamage *= (1 + eBeh.corrosiveStacks * eBeh.corrosiveFactor);
                            }
                            
                            // 冰霜：概率冻结
                            const iceLevel = stats.getSkillLevel('element_ice');
                            if (iceLevel > 0) {
                                const freezeProb = iceLevel === 1 ? 0.2 : (iceLevel === 2 ? 0.3 : 0.4);
                                const freezeFrames = iceLevel === 3 ? 90 : 60; // 1.5s or 1s
                                if (Math.random() < freezeProb) {
                                    eBeh.frozenFrames = freezeFrames;
                                }
                            }
                            
                            // 腐蚀：叠加新层数
                            const corrosiveLevel = stats.getSkillLevel('element_corrosive');
                            if (corrosiveLevel > 0) {
                                const maxStacks = 3;
                                const factor = corrosiveLevel === 1 ? 0.1 : (corrosiveLevel === 2 ? 0.15 : 0.2);
                                if (eBeh.corrosiveStacks < maxStacks) {
                                    eBeh.corrosiveStacks++;
                                }
                                eBeh.corrosiveFactor = factor;
                            }
                            
                            // 燃烧：附加状态
                            const fireLevel = stats.getSkillLevel('element_fire');
                            if (fireLevel > 0) {
                                eBeh.burnFrames = 180; // 3 seconds
                                const dmgScale = fireLevel === 1 ? 0.2 : (fireLevel === 2 ? 0.35 : 0.5);
                                let tickDamage = (finalDamage * dmgScale) / 2; // 每半秒(30帧)的伤害
                                if (tickDamage < 1) tickDamage = 1; // 最小伤害为1
                                eBeh.burnDamagePerFrame = tickDamage / 30; 
                                eBeh.burnSpread = (fireLevel === 3);
                            }
                            
                            // 导电：弹射
                            const electricLevel = stats.getSkillLevel('element_electric');
                            if (electricLevel > 0) {
                                const jumpCount = electricLevel;
                                const jumpDmgScale = electricLevel === 3 ? 0.75 : 0.5;
                                const jumpRadius = 150;
                                const candidates = [];
                                for (const other of enemies) {
                                    if (!other.active || other === enemy) continue;
                                    const t = other.getComponent(Transform);
                                    if (!t) continue;
                                    const d = Math.hypot(t.x - eTransform.x, t.y - eTransform.y);
                                    if (d <= jumpRadius) candidates.push({enemy: other, dist: d});
                                }
                                candidates.sort((a,b) => a.dist - b.dist);
                                for (let i = 0; i < Math.min(jumpCount, candidates.length); i++) {
                                    const target = candidates[i].enemy;
                                    const th = target.getComponent(Health);
                                    const tt = target.getComponent(Transform);
                                    if (th && tt) {
                                        const elecDamage = finalDamage * jumpDmgScale;
                                        th.current -= elecDamage;
                                        DamageTextSystem.addDamageText(tt.x, tt.y - 15, elecDamage, '#ffff00', false);
                                        this.addEntityCallback?.(skillVfx(eTransform.x,eTransform.y,'electric_arc',Math.hypot(tt.x-eTransform.x,tt.y-eTransform.y),'#ffe66b',16,Math.atan2(tt.y-eTransform.y,tt.x-eTransform.x)));
                                        // 绘制闪电连线
                                        if (this.trailCtx) {
                                            this.trailCtx.save();
                                            this.trailCtx.strokeStyle = '#ffff00';
                                            this.trailCtx.lineWidth = 2;
                                            this.trailCtx.beginPath();
                                            this.trailCtx.moveTo(eTransform.x, eTransform.y);
                                            this.trailCtx.lineTo(tt.x, tt.y);
                                            this.trailCtx.stroke();
                                            this.trailCtx.restore();
                                        }
                                        if (th.current <= 0) {
                                            this.handleEnemyDeath(target, player, tt.x, tt.y, target.getComponent(Renderable)?.color || '#ffffff');
                                        }
                                    }
                                }
                            }

                            // 双生·冰火两重天 (synergy_ice_fire)
                            if (stats.getSkillLevel('synergy_ice_fire') > 0) {
                                if (eBeh.frozenFrames > 0 && eBeh.burnFrames > 0) {
                                    const explodeRadius = 150;
                                    // 造成最大生命值 15% 真实伤害
                                    const maxHpDamage = Math.max(1, Math.floor(eHealth.max * 0.15));
                                    
                                    for (const other of enemies) {
                                        if (!other.active) continue;
                                        const tt = other.getComponent(Transform);
                                        const th = other.getComponent(Health);
                                        if (tt && th) {
                                            if (Math.hypot(tt.x - eTransform.x, tt.y - eTransform.y) <= explodeRadius) {
                                                th.current -= maxHpDamage;
                                                DamageTextSystem.addDamageText(tt.x, tt.y - 20, maxHpDamage, '#ff00ff', true); // 紫色真伤
                                                if (th.current <= 0) {
                                                    this.handleEnemyDeath(other, player, tt.x, tt.y, other.getComponent(Renderable)?.color || '#ffffff');
                                                }
                                            }
                                        }
                                    }
                                    
                                    // 解除冰冻
                                    eBeh.frozenFrames = 0;
                                    
                                    this.addEntityCallback?.(skillVfx(eTransform.x,eTransform.y,'ice_steam',explodeRadius,'#bceaf3',32));
                                    // 冰火爆破特效
                                    if (this.addEntityCallback) {
                                        const p1 = ParticleFactory.createExplosion(eTransform.x, eTransform.y, '#ff4444', 20);
                                        const p2 = ParticleFactory.createExplosion(eTransform.x, eTransform.y, '#00ffff', 20);
                                        for (const p of p1) this.addEntityCallback(p);
                                        for (const p of p2) this.addEntityCallback(p);
                                    }
                                    
                                    // 在地上留下粒子的痕迹 (Draw splash on trail canvas)
                                    if (this.trailCtx) {
                                        this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#ff4444', explodeRadius * 0.8);
                                        this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#00ffff', explodeRadius * 0.8);
                                    }
                                }
                            }
                        }
                    }

                    // Apply damage (for non-AOE or direct hit)
                    if (eBeh || pData.ownerId === (player ? player.id : '')) {
                         eHealth.current -= finalDamage;
                         if (finalDamage > 0 && pData.ownerId === player?.id) {
                             combatImpact(enemy, projectile);
                             enemyIndex?.update(enemy, eTransform);
                             if (projectile.tags.has('magic-robot-pulse')) {
                                 this.addEntityCallback?.(skillVfx(eTransform.x,eTransform.y,'robot_wave',62,'#7d9ca9',18));
                             }
                         }
                         if (finalDamage > 0) emitGameSound(pData.isCrit || pData.isSuperCrit ? 'hit-heavy' : 'hit', { x: eTransform.x, y: eTransform.y });
                         const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#ffffff');
                         DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, finalDamage, textColor, pData.isCrit || pData.isSuperCrit);
                    }
                    
                    // ================== 命中/暴击触发系 ==================
                    if (player) {
                        const stats = player.getComponent(PlayerStats);
                        if (stats) {
                            // 1. 命中触发：素描分身 (hit_sketch_clone)
                            const cloneLevel = stats.getSkillLevel('hit_sketch_clone');
                            if (cloneLevel > 0 && pData.type !== 'clone_bullet') { // 防止无限分裂
                                const cloneProb = pData.reaperStrike ? 1.0 : (cloneLevel === 1 ? 0.30 : (cloneLevel === 2 ? 0.40 : 0.50));
                                const cloneCount = cloneLevel >= 3 ? 4 : 2;
                                if (Math.random() < cloneProb && this.addEntityCallback) {
                                    const candidates = [];
                                    for (const other of enemies) {
                                        if (!other.active || other === enemy) continue;
                                        const tt = other.getComponent(Transform);
                                        if (tt) candidates.push({ enemy: other, dist: Math.hypot(tt.x - eTransform.x, tt.y - eTransform.y) });
                                    }
                                    candidates.sort((a,b) => a.dist - b.dist);
                                    
                                    for (let i = 0; i < Math.min(cloneCount, candidates.length); i++) {
                                        const target = candidates[i].enemy.getComponent(Transform)!;
                                        const cloneBullet = new Entity();
                                        cloneBullet.addComponent(new Transform(eTransform.x, eTransform.y));
                                        cloneBullet.addComponent(new Renderable(pRender.color, 4, 0, 0, 'circle'));
                                        // A missed clone must expire instead of living indefinitely.
                                        const cProj = new Projectile('clone_bullet', pData.damage * 0.5, player.id, 90);
                                        cProj.isCrit = pData.isCrit;
                                        cloneBullet.addComponent(cProj);
                                        
                                        const angle = Math.atan2(target.y - eTransform.y, target.x - eTransform.x);
                                        const speed = 10;
                                        cloneBullet.addComponent(new Velocity(Math.cos(angle) * speed, Math.sin(angle) * speed));
                                        this.addEntityCallback(cloneBullet);
                                    }
                                }
                            }

                            if (pData.isCrit || pData.reaperStrike) {
                                // 2. 暴击触发：色彩爆炸 (hit_explosion)
                                const explosionLevel = stats.getSkillLevel('hit_explosion');
                                if (explosionLevel > 0) {
                                    const radius = explosionLevel >= 2 ? 120 : 80;
                                    const damageMultiplier = explosionLevel >= 3 ? 2 : 1;
                                    const explodeDamage = Math.floor(finalDamage * damageMultiplier * 0.5);
                                    this.addEntityCallback?.(skillVfx(eTransform.x,eTransform.y,'paint_bloom',radius,'#f5a64d',24));
                                    
                                    for (const other of enemies) {
                                        if (!other.active || other === enemy) continue;
                                        const tt = other.getComponent(Transform);
                                        const th = other.getComponent(Health);
                                        const tr = other.getComponent(Renderable);
                                        if (tt && th) {
                                            if (Math.hypot(tt.x - eTransform.x, tt.y - eTransform.y) <= radius) {
                                                th.current -= explodeDamage;
                                                DamageTextSystem.addDamageText(tt.x, tt.y - 15, explodeDamage, '#ffaa00', false);
                                                if (th.current <= 0) {
                                                    if (other.active) {
                                                        this.handleEnemyDeath(other, player, tt.x, tt.y, tr?.color || '#ffffff');
                                                        if (this.trailCtx) {
                                                            this.drawSplash(this.trailCtx, tt.x, tt.y, '#000000', (tr?.radius || 15) * 2);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if (this.addEntityCallback) {
                                        const particles = ParticleFactory.createExplosion(eTransform.x, eTransform.y, '#ffaa00', 30);
                                        for (const p of particles) this.addEntityCallback(p);
                                    }
                                    // 在爆炸中心留下专属画痕特效
                                    if (this.trailCtx) {
                                        this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#ffaa00', radius * 0.8);
                                    }
                                }

                                // 3. 暴击触发：吸血鬼之触 (crit_vampire)
                                const vampireLevel = stats.getSkillLevel('crit_vampire');
                                if (vampireLevel > 0) {
                                    const vampProb = pData.reaperStrike ? 1.0 : (vampireLevel === 1 ? 0.30 : (vampireLevel === 2 ? 0.40 : 0.50));
                                    const healAmount = vampireLevel >= 3 ? 2 : 1;
                                    if (Math.random() < vampProb) {
                                        const php = player.getComponent(Health);
                                        if (php && php.current < php.max) {
                                            php.current = Math.min(php.max, php.current + healAmount);
                                            DamageTextSystem.addDamageText(player.getComponent(Transform)!.x, player.getComponent(Transform)!.y - 20, healAmount, '#00ff00', false);
                                        }
                                    }
                                }

                                // 4. 双生·军团降临 (synergy_legion)：火柴人暴击吸血
                                if (stats.getSkillLevel('synergy_legion') > 0 && projectile.tags.has('summon_bullet_stickman')) {
                                    const php = player.getComponent(Health);
                                    if (php && php.current < php.max) {
                                        php.current = Math.min(php.max, php.current + 1);
                                        DamageTextSystem.addDamageText(player.getComponent(Transform)!.x, player.getComponent(Transform)!.y - 20, 1, '#00ff00', false);
                                    }
                                }
                            }
                        }
                    }

                    if (pData.type === 'chain') {
                        const chainRadius = 220;
                        const isAwakened = (pData as any).isAwakened;
                        
                        if (isAwakened) {
                            let currentDamage = pData.damage;
                            let currentPos = { x: eTransform.x, y: eTransform.y };
                            let hitSet = new Set<string>();
                            hitSet.add(enemy.id);
                            
                            while (true) {
                                let nextTarget: Entity | null = null;
                                let minDist = chainRadius;
                                
                                for (const other of enemies) {
                                    if (!other.active || hitSet.has(other.id) || other.tags.has('ink_dummy')) continue;
                                    const t = other.getComponent(Transform)!;
                                    const dist = Math.hypot(t.x - currentPos.x, t.y - currentPos.y);
                                    if (dist < minDist) {
                                        minDist = dist;
                                        nextTarget = other;
                                    }
                                }
                                
                                if (!nextTarget) break;
                                
                                hitSet.add(nextTarget.id);
                                currentDamage *= 0.95; // 递减 5%
                                const chainDamage = Math.max(1, Math.floor(currentDamage));
                                
                                const tt = nextTarget.getComponent(Transform)!;
                                const th = nextTarget.getComponent(Health)!;
                                const tr = nextTarget.getComponent(Renderable)!;
                                
                                th.current -= chainDamage;
                                const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#ffffff');
                                DamageTextSystem.addDamageText(tt.x, tt.y - 15, chainDamage, textColor, pData.isCrit || pData.isSuperCrit);
                                
                                if (this.trailCtx) {
                                    this.trailCtx.save();
                                    this.trailCtx.strokeStyle = pRender.color;
                                    this.trailCtx.globalAlpha = 0.7;
                                    this.trailCtx.lineWidth = 2;
                                    this.trailCtx.beginPath();
                                    this.trailCtx.moveTo(currentPos.x, currentPos.y);
                                    this.trailCtx.lineTo(tt.x, tt.y);
                                    this.trailCtx.stroke();
                                    this.trailCtx.restore();
                                }
                                
                                if (th.current <= 0) {
                                    this.handleEnemyDeath(nextTarget, player, tt.x, tt.y, tr.color);
                                }
                                
                                currentPos = { x: tt.x, y: tt.y };
                            }
                        } else {
                            let remaining = pData.pierceCount || 0;
                            const candidates: { enemy: Entity, dist: number }[] = [];
                            for (const otherEnemy of enemies) {
                                if (!otherEnemy.active || otherEnemy === enemy) continue;
                                const t = otherEnemy.getComponent(Transform)!;
                                const dxx = t.x - eTransform.x;
                                const dyy = t.y - eTransform.y;
                                const dd = Math.sqrt(dxx*dxx + dyy*dyy);
                                if (dd <= chainRadius) {
                                    candidates.push({ enemy: otherEnemy, dist: dd });
                                }
                            }
                            candidates.sort((a, b) => a.dist - b.dist);
                            for (let i = 0; i < Math.min(remaining, candidates.length); i++) {
                                const target = candidates[i].enemy;
                                const th = target.getComponent(Health)!;
                                const tt = target.getComponent(Transform)!;
                                const tr = target.getComponent(Renderable)!;
                                const chainDamage = Math.floor(pData.damage * 0.8);
                                th.current -= chainDamage;
                                const textColor = pData.isSuperCrit ? '#ff0000' : (pData.isCrit ? '#ff4444' : '#ffffff');
                                DamageTextSystem.addDamageText(tt.x, tt.y - 15, chainDamage, textColor, pData.isCrit || pData.isSuperCrit);
                                if (this.trailCtx) {
                                    this.trailCtx.save();
                                    this.trailCtx.strokeStyle = pRender.color;
                                    this.trailCtx.globalAlpha = 0.7;
                                    this.trailCtx.lineWidth = 2;
                                    this.trailCtx.beginPath();
                                    this.trailCtx.moveTo(eTransform.x, eTransform.y);
                                    this.trailCtx.lineTo(tt.x, tt.y);
                                    this.trailCtx.stroke();
                                    this.trailCtx.restore();
                                }
                                if (th.current <= 0) {
                                    this.handleEnemyDeath(target, player, tt.x, tt.y, tr.color);
                                }
                            }
                        }
                        projectile.active = false;
                    }
                    
                    // Shrink enemy if it's a chaser
                    if (enemy.getComponent(EnemyBehavior)?.type === 'chaser') {
                         if (eRender.shape === 'circle') {
                             eRender.radius = Math.max(5, eRender.radius - (pData.damage / 5));
                         }
                    }
                    
                    // ================== 暴击穿透判定 (crit_pierce) ==================
                    let isCritPiercing = false;
                    const infinitePierceTypes = ['sniper', 'ruler', 'flamethrower', 'gravity', 'compass', 'melee'];
                    if (player && pData.isCrit && !infinitePierceTypes.includes(pData.type)) {
                        const stats = player.getComponent(PlayerStats);
                        if (stats) {
                            const pierceLevel = stats.getSkillLevel('crit_pierce');
                            if (pierceLevel > 0) {
                                const prob = pData.reaperStrike ? 1.0 : (pierceLevel === 1 ? 0.3 : (pierceLevel === 2 ? 0.6 : 1.0));
                                if (Math.random() < prob) {
                                    isCritPiercing = true;
                                }
                            }
                        }
                    }

                    // Remove projectile unless piercing or special
                    if (!infinitePierceTypes.includes(pData.type)) {
                        if (isCritPiercing) {
                            // 触发暴击穿透，不消耗 pierceCount，也不销毁子弹
                        } else if (pData.pierceCount && pData.pierceCount > 0) {
                            pData.pierceCount -= 1;
                        } else {
                            projectile.active = false;
                            
                            // ================= 觉醒：手枪分裂 =================
                            if (pData.type === 'standard' && (pData as any).isAwakened && this.addEntityCallback) {
                                // 限制分裂层级，防止无限分裂
                                if (!(pData as any).isSplit) {
                                    const splitCount = 4;
                                    for (let i = 0; i < splitCount; i++) {
                                        const ang = Math.PI * 2 * (i / splitCount);
                                        const splitProj = BulletFactory.create(
                                            { name: "Pistol Split", id: 0, fireRate: 0, speed: 12, damage: Math.max(1, Math.floor(pData.damage * 0.5)), count: 1, spread: 0, color: pRender.color, radius: 3, type: 'standard', range: 200, magSize: 1, reloadTime: 1 },
                                            eTransform.x, eTransform.y,
                                            ang,
                                            pRender.color,
                                            player ? player.id : '',
                                            1.0,
                                            1.0
                                        );
                                        const spRender = splitProj.getComponent(Renderable);
                                        if (spRender) { spRender.radius = 3; }
                                        const spData = splitProj.getComponent(Projectile);
                                        if (spData) {
                                            spData.pierceCount = 1; // 具有一次穿透效果
                                            (spData as any).isSplit = true;
                                        }
                                        this.addEntityCallback(splitProj);
                                    }
                                }
                            }
                        // 觉醒手枪分裂逻辑
                        }
                    }

                    // Check enemy death
                    if (eHealth.current <= 0) {
                        this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);

                        // Splash effect on death
                        if (this.trailCtx) {
                            // Only Gravity(Blackhole?) causes splash on death here
                            if (pData.type === 'gravity') {
                                // Draw Enemy Splash
                                this.drawSplash(this.trailCtx, eTransform.x, eTransform.y, '#000000', eRender.radius * 2);
                            }
                        }
                    }
                    
                    // If projectile is not piercing, break loop (only hit one enemy)
                    if (!infinitePierceTypes.includes(pData.type)) {
                        if (isCritPiercing) {
                            // 触发暴击穿透，继续判定其他敌人
                        } else if (!(pData.pierceCount && pData.pierceCount > 0)) {
                            // 书法家觉醒2：【铁画银钩】
                            // 子弹穿透完或打到人消失时，如果还没折返过，就折返
                            const pStats = player ? player.getComponent(PlayerStats) : null;
                            if (pStats && pStats.getSkillLevel('awakening_calligrapher_2') > 0 && !pData.calligrapherBoomerang) {
                                pData.calligrapherBoomerang = true;
                                projectile.active = true; // 复活子弹
                                pData.hitEnemies.clear(); // 清空命中记录，允许二次伤害
                                pData.pierceCount = 999;  // 折返时无限穿透
                                pData.life = 120; // 额外续命120帧
                                
                                // 计算飞向玩家的速度向量
                                const pTrans = player!.getComponent(Transform);
                                const pVel = projectile.getComponent(Velocity);
                                if (pTrans && pVel) {
                                    const angle = Math.atan2(pTrans.y - eTransform.y, pTrans.x - eTransform.x);
                                    const speed = Math.hypot(pVel.x, pVel.y) * 1.5; // 飞回时速度加快 1.5 倍
                                    pVel.x = Math.cos(angle) * speed;
                                    pVel.y = Math.sin(angle) * speed;
                                    projectile.getComponent(Transform)!.rotation = angle;
                                }
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 2.5 Watermark vs Enemy
        for (const watermark of watermarks) {
            if (!watermark.active) continue;
            const wData = watermark.getComponent(WaterMark)!;
            const wTransform = watermark.getComponent(Transform)!;

            wData.durationFrames -= 1;
            if (wData.durationFrames <= 0) {
                watermark.active = false;
                continue;
            }

            for (const enemy of enemies) {
                if (!enemy.active) continue;
                const eTransform = enemy.getComponent(Transform)!;
                const eRender = enemy.getComponent(Renderable)!;
                const eHealth = enemy.getComponent(Health)!;
                const eBeh = enemy.getComponent(EnemyBehavior)!;

                const dx = wTransform.x - eTransform.x;
                const dy = wTransform.y - eTransform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = wData.radius + (eRender.radius || 15);

                if (dist < minDist) {
                    if (eBeh.type === 'eraser') {
                        // 橡皮擦可以擦掉接触部分的痕迹
                        // 避免每帧都添加过多的重叠圆，检查距离上一个记录点的距离
                        const eraseRadius = (eRender.radius || 15) + 5; // 稍微扩大一点擦除范围
                        let shouldAdd = true;
                        if (wData.erasedParts.length > 0) {
                            const last = wData.erasedParts[wData.erasedParts.length - 1];
                            const lx = last.x - eTransform.x;
                            const ly = last.y - eTransform.y;
                            if (lx * lx + ly * ly < eraseRadius * eraseRadius * 0.25) {
                                shouldAdd = false; // 距离太近，不重复添加
                            }
                        }
                        if (shouldAdd) {
                            wData.erasedParts.push({ x: eTransform.x, y: eTransform.y, radius: eraseRadius });
                        }
                        
                        // 如果被擦除的面积太大，可以直接销毁
                        if (wData.erasedParts.length > 30) {
                            watermark.active = false;
                            break;
                        }
                    } else {
                        // 普通敌人造成持续伤害 (每帧)
                        // 检查敌人是否在擦除区域内
                        let inErasedArea = false;
                        for (const part of wData.erasedParts) {
                            const px = part.x - eTransform.x;
                            const py = part.y - eTransform.y;
                            // 如果敌人的中心点在擦除区域内，就不受伤害
                            if (Math.sqrt(px * px + py * py) < part.radius) {
                                inErasedArea = true;
                                break;
                            }
                        }
                        
                        if (!inErasedArea) {
                            eHealth.current -= wData.damagePerFrame;
                            
                            // 觉醒2：致幻水彩 (混乱状态)
                            const pStats = player ? player.getComponent(PlayerStats) : null;
                            if (pStats && pStats.hasSkill('awakening_watercolor_2')) {
                                // 混乱状态对 BOSS 和 精英怪 (如 eraser) 不生效
                                if (eBeh && !enemy.tags.has('boss') && (eBeh.type as string) !== 'eraser' && !enemy.tags.has('giant_eraser')) {
                                    eBeh.confusedFrames = 60; // 陷入混乱1秒，只要踩在上面就会一直刷新
                                }
                            }

                            // 为了避免满屏伤害数字，可以降低伤害数字的频率，或者不显示持续伤害的数字
                            // 如果需要显示，可以用帧数取模
                            if (this.frame % 30 === 0) {
                                DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, Math.max(1, Math.floor(wData.damagePerFrame * 30)), '#0096ff', false);
                            }
                            
                            if (eHealth.current <= 0) {
                                this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);
                            }
                        }
                    }
                }
            }
        }

        // 2.6 InkCloud vs Enemy
        for (const ink of inkClouds) {
            if (!ink.active) continue;
            const inkData = ink.getComponent(InkCloud)!;
            const inkTransform = ink.getComponent(Transform)!;
            const inkRender = ink.getComponent(Renderable)!;

            inkData.durationFrames -= 1;
            if (inkData.durationFrames <= 0) {
                ink.active = false;
                
                // 水墨画家觉醒2：【墨影杀阵】
                // 墨水消失时，引发小型墨水爆炸（全局AOE，仅对刚刚处于其中的敌人有效，或者直接做个AOE）
                const pStats = player ? player.getComponent(PlayerStats) : null;
                if (pStats && pStats.getSkillLevel('awakening_ink_2') > 0) {
                    const explosionRadius = inkData.radius * 0.8;
                    const explosionDamage = 150 * pStats.totalDamageMultiplier;
                    
                    for (const enemy of enemies) {
                        if (!enemy.active || !enemy.tags.has('enemy')) continue;
                        const eTransform = enemy.getComponent(Transform);
                        const eHealth = enemy.getComponent(Health);
                        if (eTransform && eHealth) {
                            const dist = Math.hypot(eTransform.x - inkTransform.x, eTransform.y - inkTransform.y);
                            if (dist <= explosionRadius) {
                                eHealth.current -= explosionDamage;
                                DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 20, explosionDamage, '#333333', true);
                                if (eHealth.current <= 0) {
                                    this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, enemy.getComponent(Renderable)?.color || '#ffffff');
                                }
                            }
                        }
                    }
                    
                    if (this.addEntityCallback) {
                        const explosion = ParticleFactory.createExplosion(inkTransform.x, inkTransform.y, '#222222', 40);
                        explosion.forEach(p => this.addEntityCallback!(p));
                    }
                    if (this.trailCtx) {
                        this.drawSplash(this.trailCtx, inkTransform.x, inkTransform.y, 'rgba(0,0,0,0.8)', explosionRadius);
                    }
                }
                continue;
            }

            // Fade out effect
            if (inkRender && inkData.durationFrames < 60) {
                const alpha = (inkData.durationFrames / 60) * 0.8;
                inkRender.color = `rgba(0, 0, 0, ${alpha})`;
            }

            for (const enemy of enemies) {
                if (!enemy.active) continue;
                const eTransform = enemy.getComponent(Transform)!;
                const eRender = enemy.getComponent(Renderable)!;
                const eBeh = enemy.getComponent(EnemyBehavior)!;

                const dx = inkTransform.x - eTransform.x;
                const dy = inkTransform.y - eTransform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = inkData.radius + (eRender.radius || 15);

                if (dist < minDist) {
                    // Enemy is inside ink cloud -> blind them
                    eBeh.blindFrames = 2; // Keep blinding them as long as they are inside, plus 1 extra frame
                }
            }
            
            // 水墨画家觉醒1：【深渊墨池】
            // 玩家处于水墨团内，获得极高闪避率（直接在受击判定里处理）和生命回复
            if (player && player.active) {
                const pStats = player.getComponent(PlayerStats);
                if (pStats && pStats.getSkillLevel('awakening_ink_1') > 0) {
                    const pTrans = player.getComponent(Transform);
                    if (pTrans) {
                        const dist = Math.hypot(pTrans.x - inkTransform.x, pTrans.y - inkTransform.y);
                        if (dist <= inkData.radius) {
                            // 每秒回血 1 点 (每 60 帧触发一次)
                            if (this.frame % 60 === 0) {
                                const pHealth = player.getComponent(Health);
                                if (pHealth && pHealth.current < pHealth.max) {
                                    pHealth.current = Math.min(pHealth.max, pHealth.current + 1);
                                    DamageTextSystem.addDamageText(pTrans.x, pTrans.y - 20, 1, '#00ff00', false);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Enemy vs Canvas Eye
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            const eTransform = enemy.getComponent(Transform)!;
            const eRender = enemy.getComponent(Renderable)!;
            if (canvasEye && canvasEye.active) {
                const cTransform = canvasEye.getComponent(Transform);
                const cRender = canvasEye.getComponent(Renderable);
                const cHealth = canvasEye.getComponent(Health);
                if (cTransform && cRender && cHealth) {
                    const dx = eTransform.x - cTransform.x;
                    const dy = eTransform.y - cTransform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const minDist = (eRender.radius || 15) + (cRender.radius || 40);
                    if (dist < minDist) {
                        if (this.frame % 30 === 0) { 
                            cHealth.current -= 5;
                            DamageTextSystem.addDamageText(cTransform.x, cTransform.y - 15, 5, '#ff0000', false);
                            const nx = dx / dist;
                            const ny = dy / dist;
                            eTransform.x += nx * 10;
                            eTransform.y += ny * 10;
                            cRender.color = 'rgba(255, 100, 100, 0.8)';
                            setTimeout(() => {
                                if (canvasEye && canvasEye.active && cRender) cRender.color = 'rgba(255, 255, 255, 0.8)';
                            }, 100);
                            if (cHealth.current <= 0) {
                                canvasEye.active = false;
                                window.dispatchEvent(new CustomEvent('announce', { detail: { text: '画眼被摧毁！防守失败。' } }));
                                const score = player ? (player.getComponent(Score)?.value || 0) : 0;
                                setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent('game-over', { detail: { score } }));
                                }, 2000);
                            }
                        }
                    }
                }
            }
        }

        // 4. Enemy vs Player
        if (player && player.active) {
            const pTransform = player.getComponent(Transform)!;
            const pRender = player.getComponent(Renderable)!;
            const pSkill = player.getComponent(Skill);
            const pHealth = player.getComponent(Health);
            const ramType = player.tags.has('magic_piloting_tank') ? 'tank'
                : player.tags.has('magic_piloting_robot') ? 'robot' : null;
            const vehicle = ramType ? Array.from(this.entities).find(entity => {
                const m = entity.getComponent(MagicManifestation);
                return entity.active && m?.ownerId === player!.id && m.type === ramType;
            })?.getComponent(MagicManifestation) : undefined;

            for (const enemy of enemies) {
                if (!enemy.active) continue;

                const eTransform = enemy.getComponent(Transform)!;
                const eRender = enemy.getComponent(Renderable)!;

                const dx = pTransform.x - eTransform.x;
                const dy = pTransform.y - eTransform.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = (pRender.radius || 20) + (eRender.radius || 15);

                if (dist < minDist) {
                    const landing = player.getComponent(PlayerStats);
                    if (landing && landing.mirrorLandingFrames > 0) {
                        const nx = dist > .001 ? -dx / dist : Math.cos(pTransform.rotation);
                        const ny = dist > .001 ? -dy / dist : Math.sin(pTransform.rotation);
                        const push = minDist - dist + 24;
                        eTransform.x += nx * push;
                        eTransform.y += ny * push;
                        enemyIndex?.update(enemy, eTransform);
                        continue;
                    }
                    // Flying avoids body contact only; hostile projectiles and
                    // other damage sources still run in their normal branches.
                    if (player.tags.has('magic_piloting_bomber')) continue;
                    if (vehicle && enemy.tags.has('enemy') && !enemy.tags.has('ink_dummy') && this.frame >= (this.vehicleRamCooldown.get(enemy) ?? 0)) {
                        this.vehicleRamCooldown.set(enemy, this.frame + 30);
                        const behavior = enemy.getComponent(EnemyBehavior);
                        const health = enemy.getComponent(Health);
                        const directionX = dist > .001 ? -dx / dist : Math.cos(pTransform.rotation);
                        const directionY = dist > .001 ? -dy / dist : Math.sin(pTransform.rotation);
                        const damage = Math.round((ramType === 'tank' ? 50 : 42) * vehicle.damageMultiplier);
                        const shielded = behavior?.type === 'shield' && behavior.shield > 0
                            && directionX * Math.cos(eTransform.rotation) + directionY * Math.sin(eTransform.rotation) > Math.cos(Math.PI / 3);
                        const invulnerableBoss = behavior?.type === 'boss_eraser' && behavior.bossTimer % 600 >= 400;
                        if (shielded && behavior) {
                            behavior.shield -= damage;
                            emitGameSound('shield', { x: eTransform.x, y: eTransform.y, gain: .65 });
                        } else if (health && health.current > 0 && !invulnerableBoss) {
                            health.current -= damage;
                            emitGameSound('hit-heavy', { x: eTransform.x, y: eTransform.y });
                            if (health.current <= 0) this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);
                        }
                        if (!invulnerableBoss) {
                            eTransform.x += directionX * 18;
                            eTransform.y += directionY * 18;
                            enemyIndex?.update(enemy, eTransform);
                            if (health && damage > 0) DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, damage, shielded ? '#66ccff' : '#ffffff', false);
                        }
                    }
                    if (pSkill && pSkill.eraserShieldFrames > 0) {
                        if (dist > 0) {
                            const nx = (pTransform.x - eTransform.x) / dist;
                            const ny = (pTransform.y - eTransform.y) / dist;
                            const kb = 14;
                            eTransform.x -= nx * kb;
                            eTransform.y -= ny * kb;
                        }
                        continue;
                    }
                    if (pHealth && pHealth.invincibleFrames > 0) {
                        continue;
                    }
                    const nextAllowed = this.enemyContactCooldown.get(enemy.id) || 0;
                    if (this.frame < nextAllowed) {
                        continue;
                    }
                    this.enemyContactCooldown.set(enemy.id, this.frame + 30);
                    
                    const pStats = player.getComponent(PlayerStats);
                    if (pStats && Date.now() < (pStats.invincibleUntil || 0)) {
                        continue;
                    }
                    
                    let totalDodge = pStats ? pStats.totalDodgeChance : 0;
                    
                    // 速写漫画家觉醒2：极限截稿 (换弹期间 100% 闪避)
                    if (pStats && pStats.hasSkill('awakening_sketcher_2')) {
                        const pWeapon = player.getComponent(Weapon);
                        if (pWeapon && pWeapon.reloading) {
                            totalDodge = 1.0;
                        }
                    }

                    if (Math.random() < totalDodge) {
                        DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 20, 0, '#88ccff', true, "闪避!");
                        continue;
                    }

                    if (pHealth) {
                        // 古典油画家觉醒2：荆棘画框 (护盾存在时对碰撞敌人造成高额反伤，并免疫击退)
                        let preventKnockback = false;
                        if (pStats && pStats.hasSkill('awakening_classical_2') && (pStats.hasClassicalShield || pStats.classicalShieldStacks > 0)) {
                            const eHealth = enemy.getComponent(Health);
                            if (eHealth) {
                                const reflectDamage = 150 * pStats.totalDamageMultiplier;
                                eHealth.current -= reflectDamage;
                                DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 20, reflectDamage, '#ffaa00', true, "反伤!");
                                if (eHealth.current <= 0) {
                                    enemy.active = false;
                                }
                            }
                            preventKnockback = true;
                        }

                        this.applyDamageToPlayer(player, 50, pTransform, enemy.getComponent(EnemyBehavior)?.type === 'boss', eTransform);
                        
                        if (preventKnockback) {
                            // 消除刚在 applyDamageToPlayer 中 handlePlayerHit 产生的击退
                            pTransform.x = player.getComponent(Transform)!.x;
                            pTransform.y = player.getComponent(Transform)!.y;
                        }
                    }
                }
            }

            for (const projectile of projectiles) {
                const pData2 = projectile.getComponent(Projectile)!;
                if (!pData2) continue;
                if (pData2.ownerId === player.id) continue;
                const t2 = projectile.getComponent(Transform)!;
                const r2 = projectile.getComponent(Renderable)!;
                if (!t2 || !r2) continue;
                const dx = t2.x - pTransform.x;
                const dy = t2.y - pTransform.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = (r2.radius || 5) + (pRender.radius || 20);
                if (dist < minDist) {
                    if (pSkill && pSkill.eraserShieldFrames > 0) {
                        projectile.active = false;
                        emitGameSound('shield', { x: pTransform.x, y: pTransform.y, gain: 0.6 });
                        continue;
                    }
                    if (pHealth && pHealth.invincibleFrames > 0) {
                        continue;
                    }
                    
                    const pStats = player.getComponent(PlayerStats);
                    if (pStats && Date.now() < (pStats.invincibleUntil || 0)) {
                        continue;
                    }
                    
                    let totalDodge = pStats ? pStats.totalDodgeChance : 0;
                    
                    // 速写漫画家觉醒2：极限截稿 (换弹期间 100% 闪避)
                    if (pStats && pStats.hasSkill('awakening_sketcher_2')) {
                        const pWeapon = player.getComponent(Weapon);
                        if (pWeapon && pWeapon.reloading) {
                            totalDodge = 1.0;
                        }
                    }

                    if (Math.random() < totalDodge) {
                        DamageTextSystem.addDamageText(pTransform.x, pTransform.y - 20, 0, '#88ccff', true, "闪避!");
                        projectile.active = false;
                        continue;
                    }

                    if (pHealth) {
                        const ownerIsBoss = Array.from(this.entities).some(e => e.id === pData2.ownerId && e.getComponent(EnemyBehavior)?.type === 'boss');
                        this.applyDamageToPlayer(player, 50, pTransform, ownerIsBoss, t2);
                    }
                    projectile.active = false;
                }
            }
        }
        
        // 3. Enemy vs Enemy separation to avoid complete overlap
        if (enemies.length > 1) {
            // Retain the original i/j order: each push affects the next pair.
            // Components themselves are stable during this phase; read them once.
            const separation = enemies.map(entity => ({
                entity,
                behavior: entity.getComponent(EnemyBehavior),
                transform: entity.getComponent(Transform),
                render: entity.getComponent(Renderable),
            }));
            const separationIndex = enemies.length >= 48 ? new EnemySeparationIndex(separation) : null;
            for (let i = 0; i < enemies.length; i++) {
                const { entity: e1, behavior: beh1, transform: t1, render: r1 } = separation[i];
                if (!e1.active) continue;
                
                // 【修改点】：如果 e1 是正在冲锋的巨型滚刷，则不参与与其他小怪的互相碰撞排斥
                if (beh1 && beh1.type === 'boss_roller') {
                    const stateCycle = beh1.bossTimer % 360;
                    if (stateCycle >= 180 && stateCycle < 210) {
                        continue; // 冲锋阶段无视碰撞阻挡
                    }
                }

                if (!t1 || !r1) continue;
                let neighborhood = separationIndex?.query(t1, r1.radius || 15, i);
                let candidateCursor = 0;
                for (let j = i + 1; j < enemies.length; j++) {
                    if (neighborhood?.orders) {
                        if (candidateCursor >= neighborhood.orders.length) break;
                        j = neighborhood.orders[candidateCursor++];
                    }
                    const { entity: e2, behavior: beh2, transform: t2, render: r2 } = separation[j];
                    if (!e2.active) continue;

                    // 【修改点】：同样检查 e2 是否为冲锋中的滚刷
                    if (beh2 && beh2.type === 'boss_roller') {
                        const stateCycle2 = beh2.bossTimer % 360;
                        if (stateCycle2 >= 180 && stateCycle2 < 210) {
                            continue;
                        }
                    }
                    if (!e2.active) continue;
                    if (!t2 || !r2) continue;
                    const dx = t2.x - t1.x;
                    const dy = t2.y - t1.y;
                    const minDist = (r1.radius || 15) + (r2.radius || 15);
                    if (minDist > 0 && (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist)) continue;
                    let dist = Math.hypot(dx, dy);
                    let moved = false;
                    if (dist === 0) {
                        const angle = Math.random() * Math.PI * 2;
                        const push = minDist * 0.5;
                        t1.x -= Math.cos(angle) * push;
                        t1.y -= Math.sin(angle) * push;
                        t2.x += Math.cos(angle) * push;
                        t2.y += Math.sin(angle) * push;
                        moved = true;
                    } else if (dist < minDist) {
                        const overlap = minDist - dist;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const push = overlap * 0.5;
                        t1.x -= nx * push;
                        t1.y -= ny * push;
                        t2.x += nx * push;
                        t2.y += ny * push;
                        moved = true;
                    }
                    if (moved && separationIndex) {
                        separationIndex.update(i);
                        separationIndex.update(j);
                        // A static candidate snapshot misses neighbors that a
                        // previous collision has just pushed us toward. Refresh
                        // only the unvisited tail, and only on leaving coverage.
                        if (neighborhood?.orders && !separationIndex.covers(neighborhood, t1, r1.radius || 15)) {
                            neighborhood = separationIndex.query(t1, r1.radius || 15, j);
                            candidateCursor = 0;
                        }
                    }
                }
            }
        }

        // 4. Player vs XP Orb
        if (player && player.active) {
            const pTransform = player.getComponent(Transform);
            const pRender = player.getComponent(Renderable);
            const pStats = player.getComponent(PlayerStats);
            if (pTransform && pRender) {
                const baseMagnetRange = pStats ? pStats.pickupRange : 30; // 初始磁吸范围较小
                const magnetRadius = (pRender.radius || 20) + baseMagnetRange;
                for (const orb of xpOrbs) {
                    if (!orb.active) continue;
                    const oTransform = orb.getComponent(Transform);
                    const oData = orb.getComponent(ExperienceOrb);
                    if (!oTransform || !oData) continue;
                    
                    const dx = pTransform.x - oTransform.x;
                    const dy = pTransform.y - oTransform.y;
                    const dist = Math.hypot(dx, dy);
                    
                    // Simple magnet effect
                    if (dist < magnetRadius) {
                        const speed = 10;
                        oTransform.x += (dx / dist) * speed;
                        oTransform.y += (dy / dist) * speed;
                    }
                    
                    // Actual pickup logic (touching the player)
                    if (dist < (pRender.radius || 20) + 10) {
                        orb.active = false;
                        const exp = player.getComponent(Experience);
                        if (exp) {
                            exp.xp += oData.amount;
                            emitGameSound('pickup', { x: pTransform.x, y: pTransform.y });
                        }
                    }
                }
            }
        }

        // Puddle 处理 (持续伤害 + 减速)
        for (const puddle of puddles) {
            if (!puddle.active) continue;
            const pTransform = puddle.getComponent(Transform);
            const pData = puddle.getComponent(Puddle);
            if (!pTransform || !pData) continue;

            pData.durationFrames--;
            if (pData.durationFrames <= 0) {
                puddle.active = false;
                continue;
            }

            // Update alpha to fade out
            const pRender = puddle.getComponent(Renderable);
            if (pRender) {
                // Since Renderable color is a string, we might need to parse it, 
                // but actually we can just leave it or use global alpha if RenderSystem supports it.
                // However, Puddle uses 'rgba' string. We can re-generate the color string.
                // e.g. 'rgba(128, 0, 128, 0.4)'
                const baseAlpha = 0.4;
                const currentAlpha = (pData.durationFrames / pData.maxDuration) * baseAlpha;
                // replace the alpha part in rgba
                const rgbMatch = pData.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
                if (rgbMatch) {
                    pRender.color = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${currentAlpha.toFixed(2)})`;
                }
            }

            for (const enemy of enemies) {
                if (!enemy.active || enemy.tags.has('ink_dummy')) continue;
                const eTransform = enemy.getComponent(Transform);
                const eHealth = enemy.getComponent(Health);
                const eBeh = enemy.getComponent(EnemyBehavior);
                const eRender = enemy.getComponent(Renderable);
                if (!eTransform || !eHealth || !eBeh) continue;

                const dx = pTransform.x - eTransform.x;
                const dy = pTransform.y - eTransform.y;
                const dist = Math.hypot(dx, dy);

                if (dist <= pData.radius) {
                    // Apply slow
                    eBeh.slowFrames = 2;
                    eBeh.slowFactor = Math.min(eBeh.slowFactor, pData.slowFactor);

                    // Apply damage
                    if (pData.damagePerFrame > 0) {
                        eHealth.current -= pData.damagePerFrame;
                        if (this.frame % 30 === 0) {
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, Math.max(1, Math.floor(pData.damagePerFrame * 30)), '#8800ff', false);
                        }
                        if (eHealth.current <= 0) {
                            this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender?.color || '#ffffff');
                        }
                    }
                }
            }
        }

        // 5. 元素状态结算
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            const eBeh = enemy.getComponent(EnemyBehavior);
            const eHealth = enemy.getComponent(Health);
            const eTransform = enemy.getComponent(Transform);
            const eRender = enemy.getComponent(Renderable);
            
            if (eBeh && eHealth && eTransform && eRender) {
                // Check if lifeTimer killed it
                if (eHealth.current <= 0) {
                    this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);
                    continue;
                }

                // 燃烧结算
                if (eBeh.burnFrames > 0) {
                    eBeh.burnFrames--;
                    eHealth.current -= eBeh.burnDamagePerFrame;
                    if (this.frame % 30 === 0) {
                        DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 15, Math.floor(eBeh.burnDamagePerFrame * 30), '#ff8800', false);
                    }
                    if (eHealth.current <= 0) {
                        this.handleEnemyDeath(enemy, player, eTransform.x, eTransform.y, eRender.color);
                    }
                    
                    // 燃烧蔓延
                    if (eBeh.burnSpread && eBeh.burnFrames % 30 === 0) {
                        for (const other of enemies) {
                            if (!other.active || other === enemy || other.tags.has('ink_dummy')) continue;
                            const otherT = other.getComponent(Transform);
                            if (otherT) {
                                const d = Math.hypot(otherT.x - eTransform.x, otherT.y - eTransform.y);
                                if (d < 100) {
                                    const otherBeh = other.getComponent(EnemyBehavior);
                                    if (otherBeh && otherBeh.burnFrames <= 0) {
                                        otherBeh.burnFrames = eBeh.burnFrames;
                                        otherBeh.burnDamagePerFrame = eBeh.burnDamagePerFrame;
                                        otherBeh.burnSpread = false; // 只蔓延一次
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 9. Paperclip connections and damage
        if (player) {
            const pStats = player.getComponent(PlayerStats);
            if (pStats && pStats.getSkillLevel('gadget_paperclip') > 0) {
                const paperclipLevel = pStats.getSkillLevel('gadget_paperclip');
                const damage = paperclipLevel === 3 ? 40 * pStats.totalDamageMultiplier : 20 * pStats.totalDamageMultiplier;
                
                // Find unconnected paperclips to pair up
                const unconnected = paperclips.filter(c => !c.getComponent(Paperclip)!.isConnected);
                for (let i = 0; i < unconnected.length - 1; i += 2) {
                    const p1 = unconnected[i];
                    const p2 = unconnected[i+1];
                    const comp1 = p1.getComponent(Paperclip)!;
                    const comp2 = p2.getComponent(Paperclip)!;
                    comp1.isConnected = true;
                    comp1.connectedToId = p2.id;
                    comp2.isConnected = true;
                    comp2.connectedToId = p1.id;
                }

                // Check connected pairs for collision with enemies
                const handledPairs = new Set<string>();
                for (const clip of paperclips) {
                    if (!clip.active) continue;
                    const comp = clip.getComponent(Paperclip)!;
                    if (!comp.isConnected || !comp.connectedToId) continue;
                    
                    if (handledPairs.has(clip.id) || handledPairs.has(comp.connectedToId)) continue;
                    
                    const otherClip = paperclips.find(c => c.id === comp.connectedToId);
                    if (!otherClip || !otherClip.active) continue;
                    
                    handledPairs.add(clip.id);
                    handledPairs.add(otherClip.id);
                    
                    const t1 = clip.getComponent(Transform);
                    const t2 = otherClip.getComponent(Transform);
                    if (!t1 || !t2) continue;

                    // Draw electric line
                    if (this.trailCtx) {
                        this.trailCtx.save();
                        this.trailCtx.strokeStyle = '#00ffff';
                        this.trailCtx.lineWidth = 3;
                        this.trailCtx.setLineDash([5, 5]);
                        this.trailCtx.beginPath();
                        this.trailCtx.moveTo(t1.x, t1.y);
                        this.trailCtx.lineTo(t2.x, t2.y);
                        this.trailCtx.stroke();
                        this.trailCtx.restore();
                    }

                    // Check collision
                    let hitAny = false;
                    for (const enemy of enemies) {
                        if (!enemy.active || enemy.tags.has('ink_dummy')) continue;
                        const eT = enemy.getComponent(Transform);
                        const eR = enemy.getComponent(Renderable);
                        if (!eT || !eR) continue;

                        if (this.lineCircleCollision(t1.x, t1.y, t2.x, t2.y, eT.x, eT.y, eR.radius + 5)) {
                            // Damage enemy
                            const eH = enemy.getComponent(Health);
                            if (eH) {
                                eH.current -= damage;
                                DamageTextSystem.addDamageText(eT.x, eT.y - 15, damage, '#00ffff', false);
                                if (eH.current <= 0) {
                                    this.handleEnemyDeath(enemy, player, eT.x, eT.y, eR.color);
                                }
                            }
                            hitAny = true;
                        }
                    }

                    if (hitAny) {
                        clip.active = false;
                        otherClip.active = false;
                        if (this.addEntityCallback) {
                            const p1 = ParticleFactory.createExplosion(t1.x, t1.y, '#00ffff', 10);
                            const p2 = ParticleFactory.createExplosion(t2.x, t2.y, '#00ffff', 10);
                            for (const p of p1) this.addEntityCallback(p);
                            for (const p of p2) this.addEntityCallback(p);
                        }
                    }
                }
            }
        }

        // ================== WALL COLLISIONS ==================
        for (const wall of walls) {
            if (!wall.active) continue;
            const wT = wall.getComponent(Transform);
            const wR = wall.getComponent(Renderable);
            const wH = wall.getComponent(Health);
            if (!wT || !wR || !wH) continue;
            
            // Check if lifeTimer killed it
            if (wH.current <= 0) {
                wall.active = false;
                continue;
            }
            
            const wRadius = wR.radius || 25;
            const wX1 = wT.x;
            const wY1 = wT.y;
            const wX2 = wR.shape === 'wall_line' ? (wR.width || wT.x) : wT.x;
            const wY2 = wR.shape === 'wall_line' ? (wR.height || wT.y) : wT.y;

            // 1. Wall vs Player
            if (player && player.active) {
                const pT = player.getComponent(Transform);
                const pR = player.getComponent(Renderable);
                if (pT && pR) {
                    const pRadius = pR.radius || 20;
                    const closest = this.getClosestPointOnSegment(pT.x, pT.y, wX1, wY1, wX2, wY2);
                    const dx = pT.x - closest.x;
                    const dy = pT.y - closest.y;
                    const dist = Math.hypot(dx, dy);
                    const minDist = pRadius + wRadius;
                    if (dist < minDist && dist > 0) {
                        // Push player out
                        const overlap = minDist - dist;
                        pT.x += (dx / dist) * overlap;
                        pT.y += (dy / dist) * overlap;
                    }
                }
            }

            // 2. Wall vs Enemies (and Bosses)
            for (const enemy of enemies) {
                if (!enemy.active || enemy.tags.has('ink_dummy')) continue;
                const eT = enemy.getComponent(Transform);
                const eR = enemy.getComponent(Renderable);
                if (!eT || !eR) continue;

                const eRadius = eR.radius || 15;
                const closest = this.getClosestPointOnSegment(eT.x, eT.y, wX1, wY1, wX2, wY2);
                const dx = eT.x - closest.x;
                const dy = eT.y - closest.y;
                const dist = Math.hypot(dx, dy);
                const minDist = eRadius + wRadius;

                if (dist < minDist && dist > 0) {
                    if (enemy.tags.has('boss')) {
                        // Boss instantly destroys wall
                        wH.current = 0;
                        wall.active = false;
                        if (this.addEntityCallback) {
                            const particles = ParticleFactory.createExplosion(closest.x, closest.y, wR.color, 20);
                            particles.forEach(p => this.addEntityCallback!(p));
                        }
                    } else {
                        // Normal enemy gets pushed out
                        const overlap = minDist - dist;
                        eT.x += (dx / dist) * overlap;
                        eT.y += (dy / dist) * overlap;
                        
                        // Enemy damages the wall (slowly breaking it)
                        wH.current -= 1.5; // Deals 1.5 damage per frame per enemy
                        
                        // Occasionally spawn small particle effects to show the wall is being damaged
                        if (Math.random() < 0.05 && this.addEntityCallback) {
                            const particles = ParticleFactory.createExplosion(closest.x, closest.y, wR.color, 2);
                            particles.forEach(p => this.addEntityCallback!(p));
                        }

                        // If wall is broken by enemies
                        if (wH.current <= 0) {
                            wall.active = false;
                            if (this.addEntityCallback) {
                                const particles = ParticleFactory.createExplosion(closest.x, closest.y, wR.color, 20);
                                particles.forEach(p => this.addEntityCallback!(p));
                            }
                        }
                    }
                }
            }

            // 3. Wall vs Projectiles (Player only for now, to let player break it)
            for (const proj of projectiles) {
                if (!proj.active || (blockingWalls.has(proj) && blockingWalls.get(proj) !== wall)) continue;
                const projData = proj.getComponent(Projectile);
                if (!projData || (player && projData.ownerId !== player.id)) continue;

                const pT = proj.getComponent(Transform);
                const pR = proj.getComponent(Renderable);
                if (!pT || !pR) continue;

                let hit = false;
                let hitX = wT.x;
                let hitY = wT.y;
                
                if (projData.sweptCollision && Number.isFinite(projData.previousX) && Number.isFinite(projData.previousY)) {
                    const fromX = projData.previousX!, fromY = projData.previousY!;
                    const radius = (pR.shape === 'circle' ? (pR.radius || 5)
                        : Math.max(pR.radius || 10, Math.max(pR.width || 10, pR.height || 10) / 2)) + wRadius;
                    const time = sweptWallTime(fromX, fromY, pT.x, pT.y, wX1, wY1, wX2, wY2, radius);
                    hit = time !== null;
                    if (time !== null) {
                        hitX = fromX + (pT.x - fromX) * time;
                        hitY = fromY + (pT.y - fromY) * time;
                    }
                } else if (pR.shape === 'line') {
                    // raycast logic for sniper beam against wall line
                    hit = this.segmentsIntersect(pT.x, pT.y, pR.width, pR.height, wX1, wY1, wX2, wY2) ||
                          this.lineCircleCollision(pT.x, pT.y, pR.width, pR.height, wX1, wY1, wRadius) ||
                          this.lineCircleCollision(pT.x, pT.y, pR.width, pR.height, wX2, wY2, wRadius) ||
                          this.lineCircleCollision(wX1, wY1, wX2, wY2, pT.x, pT.y, wRadius) ||
                          this.lineCircleCollision(wX1, wY1, wX2, wY2, pR.width, pR.height, wRadius);
                    hitX = (wX1 + wX2) / 2;
                    hitY = (wY1 + wY2) / 2;
                } else {
                    const pRadius = pR.shape === 'circle' ? (pR.radius || 5) : Math.max(pR.radius || 10, Math.max(pR.width || 10, pR.height || 10) / 2);
                    const closest = this.getClosestPointOnSegment(pT.x, pT.y, wX1, wY1, wX2, wY2);
                    if (Math.hypot(pT.x - closest.x, pT.y - closest.y) < pRadius + wRadius) {
                        hit = true;
                        hitX = closest.x;
                        hitY = closest.y;
                    }
                }

                if (hit) {
                    // 对于墙体这种密集的实体，如果是直线型穿透武器（如狙击笔、直尺），
                    // 不要因为撞到第一堵墙就把 pierceCount 消耗光，而是允许它顺着墙体“切开”一条线。
                    // 否则子弹会被墙体内部密集的锚点瞬间吸干穿透次数。
                    if (!projData.hitEnemies) projData.hitEnemies = new Set();
                    if (projData.hitEnemies.has(wall.id)) continue;
                    projData.hitEnemies.add(wall.id);

                    // Apply damage
                    wH.current -= projData.damage;
                    DamageTextSystem.addDamageText(hitX, hitY - 15, projData.damage, '#ffffff', false);

                    // 只有非无限穿透武器才在这里消耗 pierceCount
                    // 对于拥有 hitEnemies 记录的子弹，我们依赖 hitEnemies 去重，而不是瞬间扣光 pierceCount
                    if (!['sniper', 'ruler', 'flamethrower', 'blackhole', 'eraser_bomb'].includes(projData.type)) {
                         if (projData.pierceCount > 0) projData.pierceCount--;
                         if (projData.pierceCount <= 0) proj.active = false;
                    }

                    if (wH.current <= 0) {
                        wall.active = false;
                        if (this.addEntityCallback) {
                            // Wall broken by player, paint it with projectile color
                            const pColor = pR.color || '#ffffff';
                            const particles = ParticleFactory.createExplosion(hitX, hitY, pColor, 30);
                            particles.forEach(p => this.addEntityCallback!(p));
                            
                            // Leave a permanent colored mark on the trail canvas
                            if (this.trailCtx) {
                                this.trailCtx.save();
                                this.trailCtx.lineCap = 'round';
                                this.trailCtx.lineJoin = 'round';
                                this.trailCtx.strokeStyle = pColor;
                                this.trailCtx.globalAlpha = 0.8;
                                this.trailCtx.lineWidth = wRadius * 2 + 10;
                                this.trailCtx.beginPath();
                                this.trailCtx.moveTo(wX1, wY1);
                                this.trailCtx.lineTo(wX2, wY2);
                                this.trailCtx.stroke();
                                this.trailCtx.restore();
                            }
                        }
                    }
                }
            }
        }
    }

    // Helper: Line Segment vs Circle collision
    private lineCircleCollision(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
        // Vector from start to end
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        // Vector from start to circle center
        const fx = cx - x1;
        const fy = cy - y1;
        
        const len2 = dx*dx + dy*dy;
        // Dot product to find projection of center onto line
        const dot = fx*dx + fy*dy;
        
        // Find closest point on line segment
        let t = dot / len2;
        
        // Clamp t to segment [0, 1]
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        
        // Closest point coordinates
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        
        // Distance from closest point to circle center
        const distX = closestX - cx;
        const distY = closestY - cy;
        const dist2 = distX*distX + distY*distY;
        
        return dist2 <= r*r;
    }

    // Helper: Get closest point on a line segment to a point
    private getClosestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): {x: number, y: number} {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx*dx + dy*dy;
        if (len2 === 0) return {x: x1, y: y1};
        
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
    }

    // Helper: Check if two line segments intersect
    private segmentsIntersect(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number): boolean {
        const det = (c - a) * (s - q) - (d - b) * (r - p);
        if (det === 0) return false;
        const lambda = ((p - a) * (s - q) - (q - b) * (r - p)) / det;
        const gamma = ((p - a) * (d - b) - (q - b) * (c - a)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
}
