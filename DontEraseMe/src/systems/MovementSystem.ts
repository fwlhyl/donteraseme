import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Projectile } from '../components/Projectile';
import { Renderable } from '../components/Renderable';
import { Skeleton } from '../components/Skeleton';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { PlayerStats } from '../components/PlayerStats';

import { ParticleFactory } from '../entities/ParticleFactory';
import { Entity } from '../core/Entity';

export class MovementSystem extends System {
    constructor(
        private worldWidth: number, 
        private worldHeight: number,
        private addEntityCallback?: (entity: Entity) => void,
        private gameCtx?: CanvasRenderingContext2D,
        private trailCtx?: CanvasRenderingContext2D
    ) {
        super();
    }

    public update(dt: number): void {
        const entitiesToRemove: Entity[] = [];
        const newEntities: Entity[] = [];

        for (const entity of this.entities) {
            const transform = entity.getComponent(Transform);
            const velocity = entity.getComponent(Velocity);
            const projectile = entity.getComponent(Projectile);
            const renderable = entity.getComponent(Renderable);

            if (transform && velocity) {
                // Gravity Bullet Logic
                if (projectile && projectile.type === 'gravity') {
                    // Check if this is already a deployed black hole
                    if (entity.tags.has('blackhole')) {
                        // This is a deployed black hole, just let the life countdown handle it
                    } else {
                        // This is a flying gravity bullet
                        velocity.x *= 0.95;
                        velocity.y *= 0.95;
                         
                        if (projectile.life <= 0 || (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1)) {
                            // Transform into Black Hole
                            if (this.addEntityCallback) {
                                // We don't have a BlackHole factory, but we can make a Particle that acts like one?
                                // Or just a stationary projectile with 'gravity' type but render as black hole?
                                // Demo: "particles.push({type: 'blackhole'...})"
                                // Let's create a special entity for BlackHole
                                const bh = new Entity();
                                bh.addComponent(new Transform(transform.x, transform.y));
                                // Black hole stays for 3 seconds (180 frames)
                               // We use Projectile component to identify it for collision (sucking)
                               bh.addComponent(new Projectile('gravity', 0.5, projectile.ownerId, 180)); 
                                bh.addComponent(new Renderable('black', 10, 0, 0, 'circle', 100)); // Render logic will handle effect?
                                // Add dummy velocity so MovementSystem iterates it and decreases life
                                bh.addComponent(new Velocity(0, 0, 0)); 
                                // Need a way to distinguish "flying gravity bullet" and "deployed black hole"
                                // Maybe 'deployed_gravity'?
                                // Let's use 'gravity' but with 0 velocity.
                                // Add a tag?
                                bh.tags.add('blackhole'); // Use tag for rendering effect
                                 
                                newEntities.push(bh);
                            }
                            entitiesToRemove.push(entity);
                            continue;
                        }
                    }
                }
                
                if (projectile && this.trailCtx) {
                    if (projectile.type === 'eraser') {
                        this.trailCtx.save();
                        this.trailCtx.globalCompositeOperation = 'destination-out';
                        this.trailCtx.beginPath();
                        this.trailCtx.arc(transform.x, transform.y, 10, 0, Math.PI * 2);
                        this.trailCtx.fillStyle = 'rgba(0,0,0,1)';
                        this.trailCtx.fill();
                        this.trailCtx.restore();
                    } else if (projectile.type === 'ribbon' && renderable) {
                        this.trailCtx.save();
                        this.trailCtx.globalAlpha = 0.8;
                        this.trailCtx.fillStyle = renderable.color;
                        const t = (projectile.life % 60) / 60;
                        const amplitude = (projectile as any).isAwakened ? 20 : 8; // 波浪幅度加大
                        const off = Math.sin(t * Math.PI * 2) * amplitude;
                        this.trailCtx.beginPath();
                        this.trailCtx.arc(transform.x - velocity.y * 0.2 + off, transform.y + velocity.x * 0.2, renderable.radius + 1, 0, Math.PI * 2);
                        this.trailCtx.fill();
                        this.trailCtx.restore();
                    }
                }

                // Flamethrower logic
                if (projectile && projectile.type === 'flamethrower' && renderable) {
                    // 觉醒后生命周期大幅延长，所以 maxLife 的判定也要动态获取
                    const isAwakened = (projectile as any).isAwakened;
                    const maxLife = isAwakened ? 180 : 30;
                    const progress = Math.max(0, Math.min(1, 1 - (projectile.life / maxLife)));
                    
                    // Expand and slow down over time
                    // 觉醒后，火焰的扩散范围更大
                    const maxRadiusExpand = isAwakened ? 40 : 12;
                    renderable.radius = 4 + (progress * maxRadiusExpand);
                    
                    // 觉醒后，火焰衰减速度变慢（射程变远），未觉醒是 0.92
                    const velocityDecay = isAwakened ? 0.98 : 0.92;
                    velocity.x *= velocityDecay;
                    velocity.y *= velocityDecay;

                    // Update projectile color to fade out
                    const projAlpha = 0.8 * (1 - progress);
                    const trailAlpha = 0.4 * (1 - progress);

                    let r = 255, g = 68, b = 0; // Default fallback
                    if (projectile.baseColorRGB) {
                        const base = projectile.baseColorRGB;
                        if (base.r === 255 && base.g === 68 && base.b === 0) {
                            // 恢复经典的 橙红 -> 黄色 渐变
                            r = 255;
                            // 觉醒后中心温度更高，更快变白/黄
                            const gTarget = isAwakened ? 255 : 150;
                            g = Math.min(255, Math.floor(68 + progress * gTarget));
                            b = isAwakened ? Math.min(255, Math.floor(progress * 100)) : 0;
                        } else {
                            // 对于自定义颜色，做一个非常明显的渐变效果！
                            r = Math.min(255, Math.floor(base.r + progress * 180));
                            g = Math.min(255, Math.floor(base.g + progress * 180));
                            b = Math.min(255, Math.floor(base.b + progress * 180));
                        }
                    }

                    renderable.color = `rgba(${r}, ${g}, ${b}, ${projAlpha})`;

                    // Draw fire trail
                    if (this.trailCtx) {
                        this.trailCtx.save();
                        // 觉醒后，留在地上的灼烧痕迹颜色更重、更持久
                        const finalTrailAlpha = isAwakened ? trailAlpha * 1.5 : trailAlpha;
                        this.trailCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalTrailAlpha})`;
                        this.trailCtx.beginPath();
                        
                        // 觉醒后，火焰的散布更宽
                        const scatter = isAwakened ? 15 : 8;
                        this.trailCtx.arc(transform.x + (Math.random()-0.5)*scatter, transform.y + (Math.random()-0.5)*scatter, renderable.radius * 0.8, 0, Math.PI * 2);
                        this.trailCtx.fill();
                        this.trailCtx.restore();
                    }
                }

                // Compass logic
                if (projectile && projectile.type === 'compass') {
                    const isAwakened = (projectile as any).isAwakened;
                    const maxLife = 90;

                    if (isAwakened) {
                        // ================= 觉醒：巨型齿轮 (弹射10次) =================
                        if ((projectile as any).returning) {
                            // 结束了10次弹射或者场上没怪了，返回玩家手里
                            let playerEntity: Entity | null = null;
                            for (const e of this.entities) {
                                if (e.tags.has('player') && e.active) {
                                    playerEntity = e;
                                    break;
                                }
                            }
                            if (playerEntity) {
                                const pT = playerEntity.getComponent(Transform);
                                if (pT) {
                                    const dx = pT.x - transform.x;
                                    const dy = pT.y - transform.y;
                                    const dist = Math.hypot(dx, dy);
                                    if (dist < 30) {
                                        entitiesToRemove.push(entity);
                                        continue;
                                    }
                                    const speed = 25;
                                    velocity.x = (dx / dist) * speed;
                                    velocity.y = (dy / dist) * speed;
                                }
                            } else {
                                entitiesToRemove.push(entity);
                            }
                            transform.rotation += 0.8;
                        } else {
                            // 飞出及弹射追踪阶段
                            // 刚发射的前 15 帧让它顺着准星直线飞一小段，表现为“丢出去”的动作
                            if (projectile.life > maxLife - 15 && !((projectile as any).hitCount > 0)) {
                                transform.rotation += 0.5;
                            } else {
                                // 开始寻找下一个猎物！
                                let targetEntity: Entity | null = null;
                                let nearestDist = 2000; // 只要在视野内(全屏)
                                
                                const lastHitId = (projectile as any).lastHitId;
                                
                                for (const e of this.entities) {
                                    if (e.tags.has('enemy') && e.active) {
                                        const eHealth = e.getComponent(Health);
                                        if (eHealth && eHealth.current <= 0) continue;
                                        
                                        // 绝对不追踪刚刚命中的那个敌人，必须弹射到其他目标上！
                                        if (e.id === lastHitId) continue;

                                        const eT = e.getComponent(Transform);
                                        if (eT) {
                                            const dist = Math.hypot(eT.x - transform.x, eT.y - transform.y);
                                            if (dist < nearestDist) {
                                                nearestDist = dist;
                                                targetEntity = e;
                                            }
                                        }
                                    }
                                }
                                
                                if (targetEntity) {
                                    const pT = targetEntity.getComponent(Transform);
                                    if (pT) {
                                        const dx = pT.x - transform.x;
                                        const dy = pT.y - transform.y;
                                        const dist = Math.hypot(dx, dy);
                                        const speed = 30; // 极快的弹射飞行速度
                                        velocity.x = (dx / dist) * speed;
                                        velocity.y = (dy / dist) * speed;
                                    }
                                    transform.rotation += 0.8;
                                    // 防止在弹射期间生命周期结束
                                    if (projectile.life < 10) projectile.life = 10;
                                } else {
                                    // 找不到除了 lastHitId 以外的任何敌人了 -> 孤狼或者全清
                                    // 直接进入返回阶段
                                    (projectile as any).returning = true;
                                }
                            }
                        }
                    } else {
                        // ================= 普通圆规逻辑 =================
                        if (projectile.life > maxLife - 30) {
                            // Forward (handled by initial velocity)
                            transform.rotation += 0.3;
                        } else if (projectile.life > maxLife - 60) {
                            // Spin in place
                            velocity.x = 0;
                            velocity.y = 0;
                            transform.rotation += 0.8; // Spin fast
                        } else {
                            // Return to player
                            if (projectile.life <= 1) {
                                projectile.life = 2; // Prevent it from being removed by lifetime
                            }
                            let targetEntity: Entity | null = null;
                            for (const e of this.entities) {
                                if (e.tags.has('player') && e.active) {
                                    targetEntity = e;
                                    break;
                                }
                            }
                            if (targetEntity) {
                                const pT = targetEntity.getComponent(Transform);
                                if (pT) {
                                    const dx = pT.x - transform.x;
                                    const dy = pT.y - transform.y;
                                    const dist = Math.hypot(dx, dy);
                                    if (dist < 30) {
                                        // Caught
                                        entitiesToRemove.push(entity);
                                        continue;
                                    }
                                    const speed = 25; // 返回和追踪速度加快
                                    if (dist > 5) {
                                        velocity.x = (dx / dist) * speed;
                                        velocity.y = (dy / dist) * speed;
                                    } else {
                                        velocity.x = 0;
                                        velocity.y = 0;
                                    }
                                }
                            }
                            transform.rotation += 0.8; // Keep spinning while returning
                        }
                    }
                }

                // Shotgun Trail Logic
                if (projectile && projectile.type === 'shotgun' && this.trailCtx && renderable) {
                    if (Math.random() < 0.2) {
                        this.trailCtx.save();
                        this.trailCtx.beginPath();
                        this.trailCtx.arc(transform.x, transform.y, renderable.radius + Math.random() * 2, 0, Math.PI * 2);
                        this.trailCtx.fillStyle = renderable.color;
                        this.trailCtx.globalAlpha = 0.8; // 增加 Shotgun 喷雾痕迹的透明度到 0.8
                        this.trailCtx.fill();
                        this.trailCtx.restore();
                    }
                }

                const enemy = entity.getComponent(EnemyBehavior);
                if (enemy && velocity.speed > 0) {
                    // 特判：如果是清道夫·巨型滚刷的冲锋阶段，无视 velocity.speed 上限限制
                    let isBossRollerDashing = false;
                    if (enemy.type === 'boss_roller') {
                        const stateCycle = enemy.bossTimer % 360;
                        if (stateCycle >= 180 && stateCycle < 210) {
                            isBossRollerDashing = true;
                        }
                    }

                    if (!isBossRollerDashing) {
                        const mag = Math.hypot(velocity.x, velocity.y);
                        if (mag > velocity.speed) {
                            velocity.x = (velocity.x / mag) * velocity.speed;
                            velocity.y = (velocity.y / mag) * velocity.speed;
                        }
                    }
                }
                
                // Laser guided logic for drones
                if (projectile && entity.tags.has('laser_guided')) {
                    // Find nearest enemy
                    let nearestDist = Infinity;
                    let nearestEnemy: Entity | null = null;
                    for (const e of this.entities) {
                        if (e.tags.has('enemy') && e.active) {
                            const eTransform = e.getComponent(Transform);
                            if (eTransform) {
                                const dist = Math.hypot(eTransform.x - transform.x, eTransform.y - transform.y);
                                if (dist < nearestDist && dist < 400) { // Max homing range
                                    nearestDist = dist;
                                    nearestEnemy = e;
                                }
                            }
                        }
                    }
                    if (nearestEnemy) {
                        const eT = nearestEnemy.getComponent(Transform)!;
                        const angle = Math.atan2(eT.y - transform.y, eT.x - transform.x);
                        const speed = Math.hypot(velocity.x, velocity.y);
                        // Turn towards enemy gradually
                        const currentAngle = Math.atan2(velocity.y, velocity.x);
                        // Shortest angle difference
                        let diff = angle - currentAngle;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        
                        const turnSpeed = 0.15;
                        const newAngle = currentAngle + Math.max(-turnSpeed, Math.min(turnSpeed, diff));
                        velocity.x = Math.cos(newAngle) * speed;
                        velocity.y = Math.sin(newAngle) * speed;
                    }
                }

                let nextX = transform.x + velocity.x;
                let nextY = transform.y + velocity.y;

                // Collision with walls
                if (entity.tags.has('player') || entity.tags.has('enemy') || entity.tags.has('citizen')) {
                    const pr = renderable?.radius || 15;
                    for (const wall of this.entities) {
                        if (wall.tags.has('wall') && wall.active) {
                            const wTransform = wall.getComponent(Transform);
                            const wRender = wall.getComponent(Renderable);
                            if (wTransform && wRender && wRender.shape === 'rect') {
                                const hw = wRender.width / 2;
                                const hh = wRender.height / 2;
                                
                                // Check X movement
                                if (nextX + pr > wTransform.x - hw && nextX - pr < wTransform.x + hw &&
                                    transform.y + pr > wTransform.y - hh && transform.y - pr < wTransform.y + hh) {
                                    nextX = transform.x; // Block X
                                }
                                
                                // Check Y movement
                                if (transform.x + pr > wTransform.x - hw && transform.x - pr < wTransform.x + hw &&
                                    nextY + pr > wTransform.y - hh && nextY - pr < wTransform.y + hh) {
                                    nextY = transform.y; // Block Y
                                }
                            }
                        }
                    }
                }

                transform.x = nextX;
                transform.y = nextY;

                // Boundary check for Player and Enemy
                if (entity.tags.has('player') || entity.tags.has('enemy')) {
                    transform.x = Math.max(0, Math.min(this.worldWidth, transform.x));
                    transform.y = Math.max(0, Math.min(this.worldHeight, transform.y));
                }

                if (renderable && (entity.tags.has('player') || entity.tags.has('enemy')) && !entity.hasComponent(Skeleton)) {
                    const speed = Math.hypot(velocity.x, velocity.y);
                    if (speed > 0.1) {
                        // Stretch in direction of movement, squash perpendicular
                        const stretch = 1 + (speed * 0.05); // Adjust multiplier for effect strength
                        const squash = 1 / stretch; // Maintain volume roughly
                        
                        // We need to smoothly interpolate this
                        renderable.scaleX = renderable.scaleX + (stretch - renderable.scaleX) * 0.2;
                        renderable.scaleY = renderable.scaleY + (squash - renderable.scaleY) * 0.2;
                        
                        // Note: For this to work perfectly, we need to rotate the canvas to align with velocity before scaling.
                        // Currently RenderSystem rotates to `transform.rotation` which for player/enemy is aim direction, not velocity direction.
                        // For a pure soft-body look, we might want to decouple movement rotation from aim rotation later.
                    } else {
                        // Return to normal shape smoothly
                        renderable.scaleX = renderable.scaleX + (1.0 - renderable.scaleX) * 0.1;
                        renderable.scaleY = renderable.scaleY + (1.0 - renderable.scaleY) * 0.1;
                    }
                }
                
                // Boundary check for Projectiles?
                // The original code removed bullets if they went off screen.
                // Here "screen" means "world".
                if (projectile) {
                     if (transform.x < 0 || transform.x > this.worldWidth || 
                         transform.y < 0 || transform.y > this.worldHeight) {
                         
                         // 书法家觉醒2：【铁画银钩】边界折返
                         if (projectile.ownerId) {
                            let player: Entity | null = null;
                            for (const e of this.entities) {
                                if (e.id === projectile.ownerId && e.tags.has('player')) {
                                    player = e;
                                    break;
                                }
                            }
                            if (player) {
                                const pStats = player.getComponent(PlayerStats);
                                if (pStats && pStats.getSkillLevel('awakening_calligrapher_2') > 0 && !projectile.calligrapherBoomerang) {
                                    projectile.calligrapherBoomerang = true;
                                    projectile.life = 120;
                                    if (projectile.hitEnemies) {
                                        projectile.hitEnemies.clear();
                                    }
                                    projectile.pierceCount = 999;
                                    
                                    const pTrans = player.getComponent(Transform);
                                    if (pTrans && transform && velocity) {
                                        const angle = Math.atan2(pTrans.y - transform.y, pTrans.x - transform.x);
                                        const speed = Math.hypot(velocity.x, velocity.y) * 1.5;
                                        velocity.x = Math.cos(angle) * speed;
                                        velocity.y = Math.sin(angle) * speed;
                                        transform.rotation = angle;
                                    }
                                    continue; // 跳过销毁
                                }
                            }
                         }

                         entitiesToRemove.push(entity);
                         // 触发分裂
                         if (projectile.type === 'standard' && (projectile as any).isAwakened && this.addEntityCallback && !(projectile as any).isSplit) {
                             const splitCount = 4;
                             for (let i = 0; i < splitCount; i++) {
                                 const ang = Math.PI * 2 * (i / splitCount);
                                 const splitProj = new Entity();
                                 splitProj.addComponent(new Transform(transform.x, transform.y, ang));
                                 splitProj.addComponent(new Velocity(Math.cos(ang) * 12, Math.sin(ang) * 12));
                                 splitProj.addComponent(new Renderable(renderable?.color || 'yellow', 3, 0, 0, 'circle'));
                                 const spData = new Projectile('standard', Math.max(1, Math.floor(projectile.damage * 0.5)), projectile.ownerId, 20);
                                 spData.pierceCount = 1;
                                 (spData as any).isSplit = true;
                                 splitProj.addComponent(spData);
                                 splitProj.tags.add('projectile');
                                 this.addEntityCallback(splitProj);
                             }
                         }
                     }
                }
            }
            
            // Handle projectile lifetime
            if (projectile && projectile.life > 0) {
                projectile.life--;
                if (projectile.life <= 0) {
                    // 书法家觉醒2：【铁画银钩】
                    // 子弹达到最大飞行距离（life <= 0）时，如果还没折返过，就折返
                    if (projectile.ownerId) {
                        let player: Entity | null = null;
                        for (const e of this.entities) {
                            if (e.id === projectile.ownerId && e.tags.has('player')) {
                                player = e;
                                break;
                            }
                        }
                        if (player) {
                            const pStats = player.getComponent(PlayerStats);
                            if (pStats && pStats.getSkillLevel('awakening_calligrapher_2') > 0 && !projectile.calligrapherBoomerang) {
                                projectile.calligrapherBoomerang = true;
                                projectile.life = 120; // 额外续命120帧
                                if (projectile.hitEnemies) {
                                    projectile.hitEnemies.clear(); // 清空命中记录，允许二次伤害
                                }
                                projectile.pierceCount = 999;  // 折返时无限穿透
                                
                                // 计算飞向玩家的速度向量
                                const pTrans = player.getComponent(Transform);
                                if (pTrans && transform && velocity) {
                                    const angle = Math.atan2(pTrans.y - transform.y, pTrans.x - transform.x);
                                    const speed = Math.hypot(velocity.x, velocity.y) * 1.5; // 飞回时速度加快 1.5 倍
                                    velocity.x = Math.cos(angle) * speed;
                                    velocity.y = Math.sin(angle) * speed;
                                    transform.rotation = angle;
                                }
                                continue; // 跳过销毁
                            }
                        }
                    }

                    // ================= 觉醒：手枪分裂 (到达最远距离) =================
                    if (projectile.type === 'standard' && (projectile as any).isAwakened && this.addEntityCallback) {
                        if (!(projectile as any).isSplit) {
                            const splitCount = 4;
                            for (let i = 0; i < splitCount; i++) {
                                const ang = Math.PI * 2 * (i / splitCount);
                                const splitProj = new Entity();
                                splitProj.addComponent(new Transform(transform!.x, transform!.y, ang));
                                splitProj.addComponent(new Velocity(Math.cos(ang) * 12, Math.sin(ang) * 12));
                                splitProj.addComponent(new Renderable(renderable?.color || 'yellow', 3, 0, 0, 'circle'));
                                const spData = new Projectile('standard', Math.max(1, Math.floor(projectile.damage * 0.5)), projectile.ownerId, 20);
                                spData.pierceCount = 1;
                                (spData as any).isSplit = true;
                                splitProj.addComponent(spData);
                                splitProj.tags.add('projectile');
                                this.addEntityCallback(splitProj);
                             }
                         }
                     }
                     entitiesToRemove.push(entity);
                 }
             } else if (projectile && projectile.type === 'sniper') {
                 // Sniper beam auto-cleanup
                 entitiesToRemove.push(entity);
            }
        }

        // Add new entities
        if (this.addEntityCallback) {
            for (const e of newEntities) {
                this.addEntityCallback(e);
            }
        }

        // Cleanup expired entities
        for (const entity of entitiesToRemove) {
            if (entity.tags.has('player')) continue;
            // Hack: we don't have access to game.removeEntity directly, but we can mark inactive?
            // System doesn't have removeEntity method on itself usually.
            // But we can set active = false, and Game loop cleans it up.
            entity.active = false;
        }
    }
}
