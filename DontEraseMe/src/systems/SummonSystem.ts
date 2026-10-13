import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { PlayerStats } from '../components/PlayerStats';
import { Summon } from '../components/Summon';
import type { SummonType } from '../components/Summon';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { Projectile } from '../components/Projectile';
import { ParticleFactory } from '../entities/ParticleFactory';
import { DamageTextSystem } from './DamageTextSystem';
import { emitGameSound } from '../audio/AudioEvents';

export class SummonSystem extends System {
    private addEntityCallback: (entity: Entity) => void;

    constructor(addEntityCallback: (entity: Entity) => void) {
        super();
        this.addEntityCallback = addEntityCallback;
    }

    public update(dt: number): void {
        const players = Array.from(this.entities).filter(e => e.tags.has('player'));
        if (players.length === 0) return;
        const player = players[0];
        const pStats = player.getComponent(PlayerStats);
        const pTransform = player.getComponent(Transform);
        if (!pStats || !pTransform) return;

        this.syncSummons(player, pStats, pTransform);
        this.updateSummons(player, pTransform, dt);
    }

    private syncSummons(player: Entity, stats: PlayerStats, pTransform: Transform): void {
        const currentSummons = Array.from(this.entities).filter(e => e.hasComponent(Summon) && e.getComponent(Summon)!.ownerId === player.id);
        
        // 1. Stickman (火柴人助手)
        const stickmanLevel = stats.getSkillLevel('summon_stickman');
        const expectedStickmen = stickmanLevel > 0 ? (stickmanLevel >= 2 ? 2 : 1) : 0;
        this.balanceSummons(currentSummons, player, 'stickman', expectedStickmen, stickmanLevel, pTransform);

        // 2. Palette (调色盘卫星)
        const paletteLevel = stats.getSkillLevel('summon_palette');
        const expectedPalettes = paletteLevel > 0 ? (paletteLevel === 1 ? 2 : (paletteLevel === 2 ? 3 : 4)) : 0;
        this.balanceSummons(currentSummons, player, 'palette', expectedPalettes, paletteLevel, pTransform);

        // 3. Scythe (吸血镰刀)
        const scytheLevel = stats.getSkillLevel('summon_scythe');
        const expectedScythes = scytheLevel > 0 ? 1 : 0;
        this.balanceSummons(currentSummons, player, 'scythe', expectedScythes, scytheLevel, pTransform);

        // 4. Drone (无人机)
        const droneLevel = stats.getSkillLevel('summon_drone');
        const expectedDrones = droneLevel > 0 ? (droneLevel >= 2 ? 2 : 1) : 0;
        this.balanceSummons(currentSummons, player, 'drone', expectedDrones, droneLevel, pTransform);
    }

    private balanceSummons(currentSummons: Entity[], player: Entity, type: SummonType, expectedCount: number, level: number, pTransform: Transform): void {
        const typeSummons = currentSummons.filter(e => e.getComponent(Summon)!.type === type);
        
        const countChanged = typeSummons.length !== expectedCount;

        // Remove excess
        while (typeSummons.length > expectedCount) {
            const e = typeSummons.pop()!;
            e.active = false;
        }

        // Update levels and angles for existing
        for (let i = 0; i < typeSummons.length; i++) {
            const sum = typeSummons[i].getComponent(Summon)!;
            sum.level = level;
            sum.index = i;
            if (type === 'palette' || type === 'scythe') {
                if (countChanged) {
                    sum.angle = (i / expectedCount) * Math.PI * 2; // Distribute evenly only when count changes
                }
                if (type === 'palette') sum.speed = level >= 3 ? 3 : 1.5;
                if (type === 'scythe') sum.distance = level >= 2 ? 120 : 80;
            }
            if (type === 'stickman') {
                sum.maxFireTimer = level >= 3 ? 30 : 60;
                sum.distance = 60 + i * 20;
            }
            if (type === 'drone') {
                sum.maxFireTimer = level >= 3 ? 40 : 80;
            }
        }

        // Add missing
        while (typeSummons.length < expectedCount) {
            const i = typeSummons.length;
            const newSummon = this.createSummon(player, type, level, i, expectedCount, pTransform);
            typeSummons.push(newSummon);
            this.addEntityCallback(newSummon);
        }
    }

    private createSummon(player: Entity, type: SummonType, level: number, index: number, total: number, pTransform: Transform): Entity {
        const entity = new Entity();
        entity.tags.add('summon');
        
        let angle = 0;
        let distance = 50;
        let speed = 0;
        let maxFireTimer = 60;

        if (type === 'stickman') {
            distance = 60 + index * 20;
            maxFireTimer = level >= 3 ? 30 : 60;
            entity.addComponent(new Renderable('#ffffff', 0, 15, 30, 'rect')); // Simple stickman placeholder
        } else if (type === 'palette') {
            angle = (index / total) * Math.PI * 2;
            distance = 80;
            speed = level >= 3 ? 3 : 1.5; // rad per second roughly
            entity.addComponent(new Renderable('#ff8800', 0, 20, 16, 'rect')); // Orange palette satellite
        } else if (type === 'scythe') {
            angle = 0;
            distance = level >= 2 ? 120 : 80;
            speed = 2;
            entity.addComponent(new Renderable('#aa0000', 0, 30, 10, 'rect')); // Scythe placeholder
        } else if (type === 'drone') {
            distance = 50;
            maxFireTimer = level >= 3 ? 40 : 80;
            // 设定半径15，使用三角形绘制
            entity.addComponent(new Renderable('#00ffff', 15, 0, 0, 'triangle'));
        }

        entity.addComponent(new Transform(pTransform.x, pTransform.y));
        entity.addComponent(new Velocity(0, 0, 0, 0.9));
        entity.addComponent(new Summon(type, player.id, level, index, angle, distance, speed, 0, maxFireTimer));

        return entity;
    }

    private updateSummons(player: Entity, pTransform: Transform, dt: number): void {
        const stats = player.getComponent(PlayerStats);
        if (!stats) return;

        const summons = Array.from(this.entities).filter(e => e.hasComponent(Summon) && e.getComponent(Summon)!.ownerId === player.id);
        const enemies = Array.from(this.entities).filter(e => e.tags.has('enemy') && e.hasComponent(Health));

        for (const entity of summons) {
            const summon = entity.getComponent(Summon)!;
            const sTransform = entity.getComponent(Transform)!;
            const sVel = entity.getComponent(Velocity);

            if (summon.type === 'palette' || summon.type === 'scythe') {
                // Orbiting summons
                summon.angle += summon.speed * dt;
                if (summon.type === 'scythe') {
                    summon.distance = summon.level >= 2 ? 120 : 80;
                    // Make scythe rotate around its own center
                    sTransform.rotation += summon.speed * dt * 2;
                } else if (summon.type === 'palette') {
                    // Make palette rotate around its own center
                    sTransform.rotation += summon.speed * dt * 1.5;
                }
                const targetX = pTransform.x + Math.cos(summon.angle) * summon.distance;
                const targetY = pTransform.y + Math.sin(summon.angle) * summon.distance;
                
                sTransform.x = targetX;
                sTransform.y = targetY;

                // Collision damage
                const radius = summon.type === 'palette' ? 12 : 20;
                const damage = summon.type === 'palette' ? 10 * stats.damageMultiplier : 20 * stats.damageMultiplier;
                
                for (const enemy of enemies) {
                    const eTransform = enemy.getComponent(Transform);
                    const eHealth = enemy.getComponent(Health);
                    if (!eTransform || !eHealth) continue;

                    const dx = eTransform.x - sTransform.x;
                    const dy = eTransform.y - sTransform.y;
                    const distSq = dx*dx + dy*dy;

                    if (distSq < (radius + 20) * (radius + 20)) { // Assuming enemy radius ~20
                        if (!enemy.hasComponent(Velocity)) continue; // quick active check
                        
                        if (!entity.tags.has(`hit_${enemy.id}`)) {
                            eHealth.current -= damage;
                            if (damage > 0) emitGameSound('hit', { x: eTransform.x, y: eTransform.y, gain: 0.5 });
                            DamageTextSystem.addDamageText(eTransform.x, eTransform.y, Math.floor(damage), '#ff0000', false);
                            entity.tags.add(`hit_${enemy.id}`);
                            setTimeout(() => {
                                if (entity) entity.tags.delete(`hit_${enemy.id}`);
                            }, 500); // Hit same enemy every 0.5s

                            if (summon.type === 'scythe') {
                                const heal = summon.level >= 3 ? 2 : 1;
                                const pHealth = player.getComponent(Health);
                                if (pHealth) {
                                    pHealth.current = Math.min(pHealth.max, pHealth.current + heal);
                                    DamageTextSystem.addDamageText(pTransform.x, pTransform.y, heal, '#00ff00', false);
                                }
                                if (summon.level >= 3) {
                                    const eBehavior = enemy.getComponent(EnemyBehavior);
                                    if (eBehavior) {
                                        eBehavior.corrosiveStacks = Math.min(10, (eBehavior.corrosiveStacks || 0) + 5);
                                        if (eBehavior.corrosiveFactor === 0) {
                                            eBehavior.corrosiveFactor = 0.1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (summon.type === 'stickman' || summon.type === 'drone') {
                // Follow player loosely
                const followOffsetX = summon.type === 'stickman' ? -summon.distance : summon.distance;
                const followOffsetY = (summon.index % 2 === 0 ? 1 : -1) * 30;
                
                const targetX = pTransform.x + followOffsetX;
                const targetY = pTransform.y + followOffsetY;

                const dx = targetX - sTransform.x;
                const dy = targetY - sTransform.y;
                
                if (sVel) {
                    sVel.x += dx * 0.05;
                    sVel.y += dy * 0.05;
                    
                    // Cap speed
                    const speed = Math.sqrt(sVel.x*sVel.x + sVel.y*sVel.y);
                    if (speed > 8) {
                        sVel.x = (sVel.x / speed) * 8;
                        sVel.y = (sVel.y / speed) * 8;
                    }
                    
                    // Rotate drone to face its movement direction
                    if (speed > 0.1) {
                        sTransform.rotation = Math.atan2(sVel.y, sVel.x) + Math.PI / 2;
                    }
                }

                // === 双生·军团降临 (synergy_legion) 微型调色盘卫星 ===
                if (summon.type === 'stickman' && stats.getSkillLevel('synergy_legion') > 0) {
                    const miniRadius = 15;
                    const miniDamage = 5 * stats.damageMultiplier;

                    for (const enemy of enemies) {
                        const eTransform = enemy.getComponent(Transform);
                        const eHealth = enemy.getComponent(Health);
                        if (!eTransform || !eHealth) continue;

                        const edx = eTransform.x - sTransform.x;
                        const edy = eTransform.y - sTransform.y;
                        const distSq = edx*edx + edy*edy;

                        if (distSq < (miniRadius + 20) * (miniRadius + 20)) {
                            if (!enemy.hasComponent(Velocity)) continue;
                            if (!entity.tags.has(`hit_mini_${enemy.id}`)) {
                                eHealth.current -= miniDamage;
                                DamageTextSystem.addDamageText(eTransform.x, eTransform.y, Math.floor(miniDamage), '#ff8800', false);
                                entity.tags.add(`hit_mini_${enemy.id}`);
                                setTimeout(() => {
                                    if (entity) entity.tags.delete(`hit_mini_${enemy.id}`);
                                }, 500);
                            }
                        }
                    }
                }

                // Shooting
                summon.fireTimer--;
                if (summon.fireTimer <= 0) {
                    summon.fireTimer = summon.maxFireTimer;
                    this.fireSummonProjectile(summon, sTransform, enemies, stats);
                }
            }
        }
    }

    private fireSummonProjectile(summon: Summon, sTransform: Transform, enemies: Entity[], stats: PlayerStats): void {
        if (enemies.length === 0) return;

        let target: Entity | null = null;
        let minDist = Infinity;

        if (summon.type === 'drone') {
            // Drone prioritizes 'eraser' enemies
            const erasers = enemies.filter(e => e.getComponent(EnemyBehavior)?.type === 'eraser');
            
            // 按照用户需求，无人机专门消灭橡皮擦敌人，如果没有橡皮擦敌人就不攻击
            if (erasers.length === 0) return;
            const targetList = erasers;
            
            for (const e of targetList) {
                const eT = e.getComponent(Transform);
                if (!eT) continue;
                const d = Math.pow(eT.x - sTransform.x, 2) + Math.pow(eT.y - sTransform.y, 2);
                if (d < minDist) {
                    minDist = d;
                    target = e;
                }
            }
        } else {
            // Stickman shoots nearest
            for (const e of enemies) {
                const eT = e.getComponent(Transform);
                if (!eT) continue;
                const d = Math.pow(eT.x - sTransform.x, 2) + Math.pow(eT.y - sTransform.y, 2);
                if (d < minDist) {
                    minDist = d;
                    target = e;
                }
            }
        }

        if (!target) return;

        const targetT = target.getComponent(Transform)!;
        const angle = Math.atan2(targetT.y - sTransform.y, targetT.x - sTransform.x);

        const bullet = new Entity();
        bullet.tags.add('player_bullet');
        bullet.tags.add(`summon_bullet_${summon.type}`);
        bullet.addComponent(new Transform(sTransform.x, sTransform.y, angle));
        
        let damage = 5 * stats.damageMultiplier;
        let color = '#ffffff';
        let speed = 10;
        let radius = 4;
        let isCrit = false;
        let isSuperCrit = false;

        // === 双生·军团降临 (synergy_legion) 火柴人暴击吸血 ===
        if (summon.type === 'stickman' && stats.getSkillLevel('synergy_legion') > 0) {
            const critChance = (stats.totalCritChance || 1.0) * 0.2; // 基础20%暴击率
            if (Math.random() < critChance) {
                isCrit = true;
                let critMult = 2.0;
                // 如果有双生色彩溢出
                if (stats.getSkillLevel('synergy_crit_overflow') > 0) {
                    if (critChance > 1.0) {
                        critMult += (critChance - 1.0) * 2.0;
                    }
                    const superCritProb = Math.min(0.5, 0.2 + Math.max(0, critChance - 1.0) * 0.5);
                    if (Math.random() < superCritProb) {
                        isSuperCrit = true;
                    }
                }
                damage = Math.floor(damage * critMult);
                if (isSuperCrit) {
                    damage *= 3;
                }
            }
        }

        if (summon.type === 'drone') {
            color = '#00ffff';
            damage = summon.level >= 3 ? 20 * stats.damageMultiplier : 10 * stats.damageMultiplier;
            speed = 15;
            if (summon.level >= 3) {
                bullet.tags.add('laser_guided'); // Pseudo tag for visual
                radius = 6;
            }
        }

        bullet.addComponent(new Velocity(Math.cos(angle) * speed, Math.sin(angle) * speed));
        bullet.addComponent(new Renderable(color, radius, 0, 0, 'circle'));
        bullet.addComponent(new Projectile('standard', damage, summon.ownerId, 60, 0, 1.0, false, undefined, isCrit, undefined, false, isSuperCrit));

        this.addEntityCallback(bullet);
    }
}
