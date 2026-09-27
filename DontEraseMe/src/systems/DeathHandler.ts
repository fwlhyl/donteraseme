import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { PlayerStats } from '../components/PlayerStats';
import { ParticleFactory } from '../entities/ParticleFactory';
import { DamageTextSystem } from './DamageTextSystem';
import { Score } from '../components/Score';
import { Experience } from '../components/Experience';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { WaterMark } from '../components/WaterMark';
import { Projectile } from '../components/Projectile';
import { XPOrbFactory } from '../entities/XPOrbFactory';

export class DeathHandler {
    public static handleEnemyDeath(
        enemy: Entity, 
        player: Entity | null, 
        x: number, 
        y: number, 
        color: string, 
        entities: Set<Entity>, 
        addEntityCallback?: (entity: Entity) => void
    ): void {
        if (!enemy.active) return;
        enemy.active = false;

        // --- 替身爆炸 (Ink Dummy Explosion) ---
        if (enemy.tags.has('ink_dummy') && player) {
            const eBeh = enemy.getComponent(EnemyBehavior);
            const pStats = player.getComponent(PlayerStats);
            if (eBeh && eBeh.damageFactor >= 3 && pStats && addEntityCallback) {
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: `替身爆炸！` } }));
                const explosion = new Entity();
                explosion.addComponent(new Transform(x, y));
                explosion.addComponent(new Renderable('rgba(100, 100, 100, 0.6)', 150, 0, 0, 'circle'));
                // 基础伤害或武器伤害的倍数
                const proj = new Projectile('standard', 150 * pStats.totalDamageMultiplier, player.id, 10, 999);
                explosion.addComponent(proj);
                explosion.tags.add('projectile');
                addEntityCallback(explosion);
                
                const particles = ParticleFactory.createExplosion(x, y, '#888888', 30);
                for (const p of particles) addEntityCallback(p);
            }
        }

        // --- 击杀触发系技能 (Kill Trigger Skills) ---
        if (player && enemy.hasComponent(Health)) {
            const stats = player.getComponent(PlayerStats);
            const eHealth = enemy.getComponent(Health)!;
            
            if (stats) {
                // kill_bloom: 颜料绽放
                const bloomLevel = stats.getSkillLevel('kill_bloom');
                if (bloomLevel > 0) {
                    const damagePercent = bloomLevel === 1 ? 0.05 : (bloomLevel === 2 ? 0.10 : 0.15);
                    const bloomDamage = Math.max(1, Math.ceil(eHealth.max * damagePercent));
                    const bloomRadius = bloomLevel === 1 ? 60 : (bloomLevel === 2 ? 80 : 100);
                    
                    if (addEntityCallback) {
                        const explosion = ParticleFactory.createExplosion(x, y, color, 15);
                        for (const p of explosion) addEntityCallback(p);
                    }

                    for (const other of entities) {
                        if (!other.active || other === enemy) continue;
                        const otherBeh = other.getComponent(EnemyBehavior);
                        const otherTransform = other.getComponent(Transform);
                        const otherHealth = other.getComponent(Health);
                        
                        if (otherBeh && otherTransform && otherHealth) {
                            const dx = otherTransform.x - x;
                            const dy = otherTransform.y - y;
                            if (Math.sqrt(dx * dx + dy * dy) <= bloomRadius) {
                                otherHealth.current -= bloomDamage;
                                DamageTextSystem.addDamageText(otherTransform.x, otherTransform.y - 15, bloomDamage, '#ff00ff', true);
                            }
                        }
                    }
                }

                // kill_frenzy: 墨滴狂热
                const frenzyLevel = stats.getSkillLevel('kill_frenzy');
                if (frenzyLevel > 0) {
                    const bonus = frenzyLevel === 1 ? 0.10 : (frenzyLevel === 2 ? 0.15 : 0.20);
                    const durationMs = frenzyLevel === 3 ? 3000 : 2000;
                    stats.killFrenzyStacks.push({ amount: bonus, expireTime: Date.now() + durationMs });
                }
                
                // kill_reaper: 死神收割
                const reaperLevel = stats.getSkillLevel('kill_reaper');
                if (reaperLevel > 0) {
                    const requiredKills = reaperLevel === 1 ? 15 : (reaperLevel === 2 ? 10 : 5);
                    stats.killReaperCount = (stats.killReaperCount || 0) + 1;
                    if (stats.killReaperCount >= requiredKills) {
                        stats.killReaperReady = true;
                        stats.killReaperCount = 0;
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `死神收割就绪！` } }));
                    }
                }
            }
        }

        // 1. Score and XP
        if (player && player.active) {
            const score = player.getComponent(Score);
            const stats = player.getComponent(PlayerStats);
            
            if (score) {
                score.value += 10; // Default points
                if (enemy.getComponent(EnemyBehavior)?.type === 'eraser') {
                    score.value += 40; // Bonus for eraser
                }
                
                const t = enemy.getComponent(EnemyBehavior)?.type || 'chaser';
                let baseGold = 1; // 杂兵
                let baseExp = 20; // 基础经验值
                
                if (t.startsWith('boss')) {
                    baseGold = 100; // Boss
                    baseExp = 500;
                } else if (t === 'chaser' || t === 'paper_plane') {
                    baseGold = 1; // 杂兵
                    baseExp = 20;
                } else {
                    baseGold = 5; // 精英怪 (包含 eraser 等)
                    baseExp = 100;
                }
                
                // 应用收藏家被动：存活时间增加金币获取
                let goldMultiplier = 1;
                let expMultiplier = 1;
                
                if (stats) {
                    if (stats.characterId === 'collector') {
                        goldMultiplier += stats.survivalTime * 0.005; 
                    }
                    // 经验值随存活时间缩放：每分钟增加 20%
                    expMultiplier += Math.floor(stats.survivalTime / 60) * 0.2;
                    
                    const finalGold = Math.ceil(baseGold * goldMultiplier);
                    score.coins += finalGold;
                    stats.gold += finalGold;

                    // 水彩插画师被动：击杀留水痕
                    if (stats.hasWatercolorPassive && addEntityCallback) {
                        let radius = 60;
                        if (stats.hasSkill('awakening_watercolor_1')) {
                            radius *= 1.5; // 水痕面积扩大 50%
                        }
                        const mark = new Entity();
                        mark.addComponent(new Transform(x, y));
                        mark.addComponent(new Renderable('rgba(0, 150, 255, 0.4)', radius, 0, 0, 'circle'));
                        mark.addComponent(new WaterMark(0.5, radius, 300, 'rgba(0, 150, 255, 0.4)'));
                        addEntityCallback(mark);
                    }
                } else {
                    score.coins += baseGold;
                }
                
                const finalExp = Math.ceil(baseExp * expMultiplier);
            }
            
            const exp = player.getComponent(Experience);
            if (exp && addEntityCallback) {
                const t = enemy.getComponent(EnemyBehavior)?.type || 'chaser';
                let baseExp = 20;
                if (t.startsWith('boss')) baseExp = 500;
                else if (t === 'chaser' || t === 'paper_plane') baseExp = 20;
                else baseExp = 100; // 精英怪 (包含 eraser 等)
                
                let expMultiplier = 1;
                if (stats) {
                    expMultiplier += Math.floor(stats.survivalTime / 60) * 0.2;
                }
                const finalExp = Math.ceil(baseExp * expMultiplier);

                // Drop experience orb instead of direct gain
                let absorbed = false;
                if (stats) {
                    const magnetLevel = stats.getSkillLevel('kill_magnet');
                    if (magnetLevel > 0) {
                        const chance = magnetLevel === 1 ? 0.10 : (magnetLevel === 2 ? 0.20 : 0.40);
                        if (Math.random() < chance) {
                            absorbed = true;
                            exp.xp += finalExp; // Absorb directly
                            if (magnetLevel === 3) {
                                const pHealth = player.getComponent(Health);
                                if (pHealth) {
                                    pHealth.current = Math.min(pHealth.max, pHealth.current + 1);
                                }
                            }
                        }
                    }
                }

                if (!absorbed) {
                    XPOrbFactory.drop(x, y, finalExp, entities, addEntityCallback);
                }
            }

            // --- BOSS 死亡掉落专属觉醒技能与通关判定 ---
            const enemyType = enemy.getComponent(EnemyBehavior)?.type;
            if (enemyType?.startsWith('boss')) {
                if (enemyType === 'boss_eraser') {
                    // 第四阶段终极 BOSS 击杀，触发通关
                    const score = player?.getComponent(Score)?.value || 0;
                    window.dispatchEvent(new CustomEvent('game-over', { detail: { score, victory: true } }));
                } else {
                    let bossPhase = 1;
                    if (enemyType === 'boss_prism') bossPhase = 1;
                    if (enemyType === 'boss_roller') bossPhase = 2;
                    if (enemyType === 'boss_slime') bossPhase = 3;
                    window.dispatchEvent(new CustomEvent('boss-killed', { detail: { x, y, bossPhase } }));
                }
            }
        }

        // 2. Particles
        if (addEntityCallback) {
            const particles = ParticleFactory.createExplosion(x, y, color, 10);
            for (const p of particles) {
                addEntityCallback(p);
            }
        }
    }
}
