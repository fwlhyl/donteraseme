import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { EnemyBehavior } from '../components/EnemyBehavior';
import type { EnemyType } from '../components/EnemyBehavior';

import { Renderable } from '../components/Renderable';
import { Puddle } from '../components/Puddle';
import { Health } from '../components/Health';
import { EnemyFactory } from '../entities/EnemyFactory';
import { BulletFactory } from '../entities/BulletFactory';
import { Projectile } from '../components/Projectile';
import { Stunned } from '../components/Stunned';
import { Summon } from '../components/Summon';
import { DeathHandler } from './DeathHandler';
import { DamageTextSystem } from './DamageTextSystem';
import type { DefensePainting } from '../core/DefensePainting';
import { signalDoodleAttack } from '../art/DoodleMotion';

export class EnemySystem extends System {
    private player: Entity | null = null;

    constructor(
        private addEntityCallback: (entity: Entity) => void,
        private trailCtx?: CanvasRenderingContext2D,
        private getDefensePainting: () => DefensePainting | null = () => null
    ) {
        super();
    }

    // We need to find the player to chase
    public update(dt: number): void {
        // Debug: Log entity count occasionally
        // if (Math.random() < 0.01) console.log('EnemySystem entities:', this.entities.size);

        // Find player if not cached (or re-find if lost)
        // We MUST verify if the cached player is still in the active entities list
        // because when restarting a game, the old player might still be 'active' but not in the new world
        let isPlayerValid = false;
        if (this.player && this.player.active) {
            for (const entity of this.entities) {
                if (entity === this.player) {
                    isPlayerValid = true;
                    break;
                }
            }
        }

        if (!isPlayerValid) {
            this.player = null;
            // Search for player in current entities
            for (const entity of this.entities) {
                if (entity.tags.has('player') && entity.active) {
                    this.player = entity;
                    // console.log('EnemySystem found player!');
                    break;
                }
            }
        }

        if (!this.player) {
            // console.warn('EnemySystem: No player found!');
            return;
        }

        const pTransform = this.player.getComponent(Transform);
        if (!pTransform) return;

        // Find the canvas eye if it exists
        let canvasEyeTransform: Transform | null = null;
        for (const entity of this.entities) {
            if (entity.tags.has('canvas_eye')) {
                canvasEyeTransform = entity.getComponent(Transform) || null;
                break;
            }
        }

        const defensePainting = this.getDefensePainting();

        // Find active ink dummies for taunt aura
        const tauntingTargets: { entity: Entity, transform: Transform, radiusSq: number }[] = [];
        const walls: Entity[] = [];
        
        for (const entity of this.entities) {
            if (entity.tags.has('ink_dummy') && entity.active) {
                const st = entity.getComponent(Transform);
                const hp = entity.getComponent(Health);
                if (st && hp && hp.current > 0) {
                    tauntingTargets.push({ entity, transform: st, radiusSq: 1000 * 1000 }); // Large taunt radius for dummy
                }
            }
            if (entity.tags.has('wall') && entity.active) {
                walls.push(entity);
            }
        }

        for (const entity of this.entities) {
            const enemy = entity.getComponent(EnemyBehavior);
            const transform = entity.getComponent(Transform);
            
            // Allow dummy and wall to tick down life timer even without a Velocity component
            if (enemy && transform && (entity.tags.has('ink_dummy') || entity.tags.has('wall'))) {
                if (enemy.lifeTimer > 0) {
                    enemy.lifeTimer--;
                    if (enemy.lifeTimer <= 0) {
                        const hp = entity.getComponent(Health);
                        if (hp) hp.current = 0; // CollisionSystem handles death and explosion
                        else entity.active = false;
                    }
                }
                continue; // Dummy/Wall doesn't move or attack
            }

            const velocity = entity.getComponent(Velocity);

            if (enemy && transform && velocity) {
                if (enemy.lifeTimer > 0) {
                    enemy.lifeTimer--;
                    if (enemy.lifeTimer <= 0) {
                        const hp = entity.getComponent(Health);
                        if (hp) hp.current = 0;
                        else entity.active = false;
                    }
                }

                let currentSpeed = velocity.speed;
                if (enemy.slowFrames > 0) {
                    enemy.slowFrames--;
                    currentSpeed *= enemy.slowFactor;
                }

                // 元素附魔系：燃烧伤害
                if (enemy.burnFrames > 0) {
                    enemy.burnFrames--;
                    const hp = entity.getComponent(Health);
                    if (hp) {
                        hp.current -= enemy.burnDamagePerFrame;
                        // 每 30 帧显示一次跳字伤害，并处理燃烧蔓延
                        if (enemy.burnFrames % 30 === 0 && enemy.burnDamagePerFrame > 0) {
                            DamageTextSystem.addDamageText(transform.x, transform.y - 15, Math.ceil(enemy.burnDamagePerFrame * 30), '#ffaa00', false);
                            
                            // 燃烧蔓延逻辑 (fireLevel 3)
                            if (enemy.burnSpread) {
                                const spreadRadius = 100;
                                for (const other of this.entities) {
                                    if (other === entity || !other.active) continue;
                                    const otherBeh = other.getComponent(EnemyBehavior);
                                    const otherTrans = other.getComponent(Transform);
                                    if (otherBeh && otherTrans && otherBeh.burnFrames === 0) {
                                        const dx = otherTrans.x - transform.x;
                                        const dy = otherTrans.y - transform.y;
                                        if (dx * dx + dy * dy < spreadRadius * spreadRadius) {
                                            otherBeh.burnFrames = enemy.burnFrames;
                                            otherBeh.burnDamagePerFrame = enemy.burnDamagePerFrame * 0.5; // 蔓延伤害减半
                                            otherBeh.burnSpread = false; // 防止无限蔓延
                                        }
                                    }
                                }
                            }
                        }
                        if (hp.current <= 0 && entity.active) {
                            const eRender = entity.getComponent(Renderable);
                            DeathHandler.handleEnemyDeath(entity, this.player, transform.x, transform.y, eRender?.color || '#ffffff', this.entities, this.addEntityCallback);
                            continue; // 已死亡，不继续更新行为
                        }
                    }
                }

                if (enemy.frozenFrames > 0) {
                    enemy.frozenFrames--;
                    velocity.x = 0;
                    velocity.y = 0;
                    continue;
                }

                const st = entity.getComponent(Stunned);
                if (st && st.frames > 0) {
                    st.frames -= 1;
                    velocity.x = 0;
                    velocity.y = 0;
                    continue;
                }

                if (enemy.blindFrames > 0) {
                    enemy.blindFrames--;
                    velocity.x = 0;
                    velocity.y = 0;
                    // Optionally skip attacking
                    continue;
                }
                
                // Determine target. Story's canvas eye remains a separate legacy
                // objective; Guard Mode uses the actual painting surface instead.
                let targetX = pTransform.x;
                let targetY = pTransform.y;
                
                if (canvasEyeTransform) {
                    // For now, make enemies in story mode always target the canvas eye
                    targetX = canvasEyeTransform.x;
                    targetY = canvasEyeTransform.y;
                }

                const isPaintingEraser = !!defensePainting && enemy.type === 'eraser';
                if (isPaintingEraser) {
                    enemy.defenseRetargetFrames--;
                    const needsTarget = enemy.defenseTargetX === null
                        || enemy.defenseTargetY === null
                        || enemy.defenseRetargetFrames <= 0;

                    if (needsTarget) {
                        const target = defensePainting.getRandomInkTarget();
                        if (target) {
                            enemy.defenseTargetX = target.x;
                            enemy.defenseTargetY = target.y;
                            // A stable target creates readable intent; a little
                            // variance prevents every eraser synchronizing.
                            enemy.defenseRetargetFrames = 150 + Math.floor(Math.random() * 120);
                        }
                    }

                    if (enemy.defenseTargetX !== null && enemy.defenseTargetY !== null) {
                        targetX = enemy.defenseTargetX;
                        targetY = enemy.defenseTargetY;
                    }
                }

                // Check for taunting targets (Overrides normal targeting if within range)
                if (tauntingTargets.length > 0 && !isPaintingEraser) {
                    let nearestTarget = null;
                    let minDistSq = Infinity;
                    for (const t of tauntingTargets) {
                        const dSq = Math.pow(t.transform.x - transform.x, 2) + Math.pow(t.transform.y - transform.y, 2);
                        if (dSq < t.radiusSq && dSq < minDistSq) {
                            minDistSq = dSq;
                            nearestTarget = t.transform;
                        }
                    }
                    if (nearestTarget) {
                        targetX = nearestTarget.x;
                        targetY = nearestTarget.y;
                    }
                }

                // 觉醒2：致幻水彩 - 混乱状态
                if (enemy.confusedFrames > 0) {
                    enemy.confusedFrames--;
                    // Find nearest other enemy
                    let nearest = null;
                    let nearestEntity = null;
                    let minDistSq = Infinity;
                    for (const other of this.entities) {
                        if (other === entity || !other.active || !other.hasComponent(EnemyBehavior) || other.tags.has('boss')) continue;
                        const ot = other.getComponent(Transform);
                        if (ot) {
                            const dSq = Math.pow(ot.x - transform.x, 2) + Math.pow(ot.y - transform.y, 2);
                            if (dSq < minDistSq) {
                                minDistSq = dSq;
                                nearest = ot;
                                nearestEntity = other;
                            }
                        }
                    }
                    if (nearest && nearestEntity) {
                        targetX = nearest.x;
                        targetY = nearest.y;
                        // 额外增加“自相残杀”逻辑：如果距离足够近，直接对目标造成伤害
                        if (minDistSq < 1600 && Math.random() < 0.1) { // 40px, approx 10% chance per frame to hit
                            const hp = nearestEntity.getComponent(Health);
                            if (hp) {
                                hp.current -= 10; // 基础互殴伤害
                                DamageTextSystem.addDamageText(nearest.x, nearest.y - 20, 10, '#ffffff', true, "互殴!");
                                if (hp.current <= 0) {
                                    nearestEntity.active = false;
                                    // Could trigger handleEnemyDeath, but active=false handles it implicitly except for xp/gold drops.
                                    // For MVP, just dying is fine or we can call DeathHandler if we had access to addEntityCallback
                                }
                            }
                        }
                    } else {
                        // Wander aimlessly
                        targetX = transform.x + (Math.random() - 0.5) * 100;
                        targetY = transform.y + (Math.random() - 0.5) * 100;
                    }
                }

                if (enemy.type === 'chaser') {
                    // Simple chase logic
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist > 0) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                        transform.rotation = Math.atan2(dy, dx);
                    }
                } else if (enemy.type === 'eraser') {
                    // Eraser logic: Move randomly or towards nearest trail?
                    // For MVP: Chase target slowly
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist > 0) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                        // The visual rig mirrors its damaged front toward the chase target.
                        transform.rotation = Math.atan2(dy, dx);
                    }

                    // Guard Mode erasers make a soft, tick-based pass over the
                    // pre-existing art. They keep the ordinary trail erasure as
                    // a visual scar, but no longer delete the objective in one
                    // frame.
                    if (defensePainting) {
                        enemy.defenseEraseCooldown--;
                        if (enemy.defenseEraseCooldown <= 0) {
                            const renderable = entity.getComponent(Renderable);
                            const radius = enemy.eraseRadius ?? (renderable ? renderable.radius : 30);
                            defensePainting.eraseAt(transform.x, transform.y, radius + 8, 0.045);
                            enemy.defenseEraseCooldown = 9;
                            signalDoodleAttack(entity);
                        }
                    }

                    // Erase player trail
                    if (this.trailCtx) {
                        // Only erase if it's active and alive
                        if (entity.active) {
                            const renderable = entity.getComponent(Renderable);
                            const radius = enemy.eraseRadius ?? (renderable ? renderable.radius : 30);
                            
                            this.trailCtx.save();
                            this.trailCtx.globalCompositeOperation = 'destination-out';
                            this.trailCtx.beginPath();
                            this.trailCtx.arc(transform.x, transform.y, radius + 5, 0, Math.PI * 2);
                            this.trailCtx.fillStyle = defensePainting ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,1)';
                            this.trailCtx.fill();
                            this.trailCtx.restore();
                        }
                    }
                } else if (enemy.type === 'shield') {
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                        transform.rotation = Math.atan2(dy, dx);
                    }
                } else if (enemy.type === 'shooter') {
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const desired = 550;
                    if (dist > desired + 50) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                    } else if (dist < desired - 50) {
                        velocity.x = -(dx / dist) * currentSpeed;
                        velocity.y = -(dy / dist) * currentSpeed;
                    } else {
                        velocity.x = 0;
                        velocity.y = 0;
                    }
                    transform.rotation = Math.atan2(dy, dx);
                    if (enemy.shootCooldown > 0) enemy.shootCooldown -= 1;
                    if (enemy.shootCooldown <= 0 && dist < 1200) {
                        const angle = Math.atan2(dy, dx);
                        const bullet = new Entity();
                        const spawnOffset = 14;
                        const bx = transform.x + Math.cos(angle) * spawnOffset;
                        const by = transform.y + Math.sin(angle) * spawnOffset;
                        bullet.addComponent(new Transform(bx, by, angle));
                        const speed = 0.8; // Slow, readable shots
                        bullet.addComponent(new Renderable('#ffffff', 10, 0, 0, 'circle', 10));
                        bullet.addComponent(new Projectile('standard', 50, entity.id, Math.ceil(800 / speed)));
                        bullet.addComponent(new Velocity(Math.cos(angle) * speed, Math.sin(angle) * speed, speed));
                        this.addEntityCallback(bullet);
                        enemy.shootCooldown = 360; // Six seconds at 60 FPS
                        signalDoodleAttack(entity);
                    }
                } else if (enemy.type === 'summoner') {
                    const dx = pTransform.x - transform.x;
                    const dy = pTransform.y - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 800) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                    } else {
                        velocity.x = 0;
                        velocity.y = 0;
                    }
                    transform.rotation = Math.atan2(dy, dx);
                    if (enemy.summonCooldown > 0) enemy.summonCooldown -= 1;
                    if (enemy.summonCooldown <= 0) {
                    for (let i = 0; i < 2; i++) {
                            const ox = (Math.random() - 0.5) * 120;
                            const oy = (Math.random() - 0.5) * 120;
                            const minion = new Entity();
                            minion.addComponent(new Transform(transform.x + ox, transform.y + oy));
                            minion.addComponent(new Velocity(0, 0, 1.2)); // 降低母体召唤的小怪移速 (原来是3)
                            minion.addComponent(new Renderable('#66ff66', 34, 0, 0, 'circle', 5));
                            minion.addComponent(new Health(30, 30));
                            minion.addComponent(new EnemyBehavior('chaser'));
                            minion.tags.add('enemy');
                            this.addEntityCallback(minion);
                        }
                        enemy.summonCooldown = 360;
                        signalDoodleAttack(entity);
                        if (this.trailCtx) {
                            this.trailCtx.save();
                            this.trailCtx.globalAlpha = 0.5;
                            this.trailCtx.strokeStyle = '#bb88ff';
                            this.trailCtx.lineWidth = 3;
                            this.trailCtx.beginPath();
                            this.trailCtx.arc(transform.x, transform.y, 30, 0, Math.PI * 2);
                            this.trailCtx.stroke();
                            this.trailCtx.restore();
                        }
                    }
                } else if (enemy.type === 'paper_plane') {
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        const baseAngle = Math.atan2(dy, dx);
                        // 波浪形移动
                        const waveAngle = baseAngle + Math.sin(Date.now() / 150) * 1.2;
                        velocity.x = Math.cos(waveAngle) * currentSpeed;
                        velocity.y = Math.sin(waveAngle) * currentSpeed;
                        transform.rotation = waveAngle;
                    }
                } else if (enemy.type === 'blackhole') {
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                        transform.rotation += 0.05; // 旋转动画
                    }

                    // 吸附玩家 (直接修改Transform，因为Velocity会在InputSystem被重置)
                    if (dist < 600 && this.player) {
                        const pTrans = this.player.getComponent(Transform);
                        if (pTrans) {
                            const suctionForce = 200 / Math.max(dist, 50); // 距离越近吸力越强
                            pTrans.x -= (dx / dist) * suctionForce * 0.1;
                            pTrans.y -= (dy / dist) * suctionForce * 0.1;
                        }
                    }

                    // 吸附子弹
                    for (const other of Array.from(this.entities)) {
                        if (!other.active || !other.tags.has('projectile')) continue;
                        const projTrans = other.getComponent(Transform);
                        const projVel = other.getComponent(Velocity);
                        if (projTrans && projVel) {
                            const pdx = transform.x - projTrans.x;
                            const pdy = transform.y - projTrans.y;
                            const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                            if (pdist < 500) {
                                const pull = 50 / Math.max(pdist, 20);
                                projVel.x += (pdx / pdist) * pull;
                                projVel.y += (pdy / pdist) * pull;
                            }
                        }
                    }
                } else if (enemy.type === 'boss_roller') {
                    // 第5分钟 BOSS: 清道夫·巨型滚刷
                    enemy.bossTimer++;
                    
                    const stateCycle = enemy.bossTimer % 360; // 6秒一个周期
                    if (stateCycle < 180) {
                        // 阶段1：瞄准并准备冲锋 (3秒)
                        const dx = targetX - transform.x;
                        const dy = targetY - transform.y;
                        transform.rotation = Math.atan2(dy, dx);
                        velocity.x = 0;
                        velocity.y = 0;
                        
                        // 冲锋前摇特效：抖动和变红预警
                        const renderable = entity.getComponent(Renderable);
                        if (renderable) {
                            renderable.color = (stateCycle % 20 < 10) ? '#ff0000' : '#555555';
                        }
                    } else if (stateCycle < 210) {
                        if (stateCycle === 180) signalDoodleAttack(entity);
                        // 阶段2：极致的横冲直撞 (0.5秒内跨越约半个屏幕)
                        // 将 dashSpeed 调为 35，持续 30 帧 (0.5秒)，冲刺距离约 1050 像素
                        const dashSpeed = 35;
                        velocity.x = Math.cos(transform.rotation) * dashSpeed;
                        velocity.y = Math.sin(transform.rotation) * dashSpeed;
                        
                        const renderable = entity.getComponent(Renderable);
                        if (renderable) {
                            renderable.color = '#ff0000'; // 冲锋期间保持红色
                        }

                        // 冲锋路径留下涂白轨迹（隐身区域）
                        if (this.trailCtx && entity.active) {
                            const radius = renderable ? renderable.radius : 40;
                            this.trailCtx.save();
                            // 用白色覆盖背景，形成“白纸”区域
                            this.trailCtx.globalCompositeOperation = 'source-over';
                            this.trailCtx.beginPath();
                            this.trailCtx.arc(transform.x, transform.y, radius + 30, 0, Math.PI * 2);
                            this.trailCtx.fillStyle = 'rgba(255,255,255,0.8)';
                            this.trailCtx.fill();
                            this.trailCtx.restore();
                        }
                    } else {
                        // 阶段3：冲锋后僵直 (2秒)
                        velocity.x = 0;
                        velocity.y = 0;
                        const renderable = entity.getComponent(Renderable);
                        if (renderable) {
                            renderable.color = '#555555'; // 恢复本色
                        }
                    }
                } else if (enemy.type === 'boss_prism') {
                    // 第10分钟 BOSS: 色彩剥夺者·多面棱镜
                    // 行为：围绕玩家缓慢公转，不断发射折射激光（子弹）
                    enemy.bossTimer++;
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.hypot(dx, dy);
                    
                    // 保持距离 300，绕圈移动
                    const idealDist = 300;
                    const speed = 2;
                    if (dist > idealDist + 20) {
                        velocity.x = (dx / dist) * speed;
                        velocity.y = (dy / dist) * speed;
                    } else if (dist < idealDist - 20) {
                        velocity.x = -(dx / dist) * speed;
                        velocity.y = -(dy / dist) * speed;
                    } else {
                        // 切线运动（绕圈）
                        velocity.x = -(dy / dist) * speed;
                        velocity.y = (dx / dist) * speed;
                    }
                    transform.rotation += 0.05; // 持续自转

                    // 发射激光弹幕
                    if (enemy.bossTimer % 60 === 0 && this.addEntityCallback) {
                        signalDoodleAttack(entity);
                        // 十字形发射四发子弹
                        for (let i = 0; i < 4; i++) {
                            const ang = transform.rotation + (Math.PI / 2) * i;
                            const bullet = new Entity();
                            bullet.tags.add('enemy_bullet');
                            // 在 BOSS 外围生成，防止直接贴脸判定
                            const spawnX = transform.x + Math.cos(ang) * 45;
                            const spawnY = transform.y + Math.sin(ang) * 45;
                            bullet.addComponent(new Transform(spawnX, spawnY, ang));
                            const bSpeed = 3.5; // 降低子弹速度
                            // 增大子弹尺寸，使其更显眼
                            bullet.addComponent(new Renderable('#00ffff', 20, 25, 25, 'rect', 15));
                            // 给激光子弹一个明确的生命周期（180帧/3秒）和穿透次数（1次）
                            const proj = new Projectile('standard', 40, entity.id, 180, 1);
                            bullet.addComponent(proj);
                            bullet.addComponent(new Velocity(Math.cos(ang) * bSpeed, Math.sin(ang) * bSpeed, bSpeed));
                            this.addEntityCallback(bullet);
                        }
                    }
                    
                    // 召唤棱镜分身护盾
                    if (enemy.bossTimer % 400 === 0 && this.addEntityCallback) {
                        signalDoodleAttack(entity);
                        for (let i = 0; i < 3; i++) {
                            const ang = (Math.PI * 2 / 3) * i;
                            const spawnX = transform.x + Math.cos(ang) * 100;
                            const spawnY = transform.y + Math.sin(ang) * 100;
                            const subPrism = EnemyFactory.create('shield', spawnX, spawnY);
                            this.addEntityCallback(subPrism);
                        }
                    }
                } else if (enemy.type === 'boss_slime') {
                    // 第15分钟 BOSS: 混沌污染源·泼墨巨兽
                    // 行为：像泥石流一样缓慢逼近，并在地上留下大面积毒沼，受击分裂
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 150) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                    } else {
                        velocity.x = 0;
                        velocity.y = 0;
                    }
                    
                    enemy.bossTimer++;
                    // 频繁抛射毒沼
                    if (enemy.bossTimer % 90 === 0) {
                        signalDoodleAttack(entity);
                        if (this.trailCtx && entity.active && this.addEntityCallback) {
                            const targetPuddleX = targetX + (Math.random() * 300 - 150);
                            const targetPuddleY = targetY + (Math.random() * 300 - 150);
                            
                            const puddle = new Entity();
                            puddle.addComponent(new Transform(targetPuddleX, targetPuddleY));
                            puddle.addComponent(new Renderable('rgba(100, 0, 100, 0.6)', 120, 0, 0, 'circle', -1));
                            puddle.addComponent(new Puddle(120, 300, 300, 15, 0.5, 'rgba(100, 0, 100, 0.6)')); // 5秒存活，15伤害，减速50%
                            puddle.tags.add('enemy_puddle');
                            this.addEntityCallback(puddle);
                        }
                    }
                    
                    // 周期性分裂大量小怪
                    if (enemy.bossTimer % 300 === 0 && this.addEntityCallback) {
                        signalDoodleAttack(entity);
                        for(let i=0; i<6; i++) {
                            const minion = EnemyFactory.create('chaser', transform.x + Math.random()*100-50, transform.y + Math.random()*100-50);
                            const mRender = minion.getComponent(Renderable);
                            if (mRender) mRender.color = '#111111'; // 变黑
                            this.addEntityCallback(minion);
                        }
                    }
                } else if (enemy.type === 'boss_eraser') {
                    // 第20分钟 BOSS: 空白法则·终极橡皮擦
                    // 行为：缓慢移动，极度压迫。定时开启无敌护盾，并全屏扫射擦除弹幕
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    enemy.bossTimer++;
                    const stateCycle = enemy.bossTimer % 600; // 10秒一个周期
                    
                    if (stateCycle < 400) {
                        // 常规追击阶段
                        if (dist > 300) {
                            velocity.x = (dx / dist) * currentSpeed;
                            velocity.y = (dy / dist) * currentSpeed;
                        } else {
                            velocity.x = 0;
                            velocity.y = 0;
                        }
                        const renderable = entity.getComponent(Renderable);
                        if (renderable) renderable.color = '#ffffff';
                        
                        // 召唤精英怪
                        if (enemy.bossTimer % 200 === 0 && this.addEntityCallback) {
                            signalDoodleAttack(entity);
                            const eliteTypes: EnemyType[] = ['shield', 'shooter', 'summoner'];
                            const type = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
                            const elite = EnemyFactory.create(type, transform.x + 100, transform.y + 100);
                            this.addEntityCallback(elite);
                        }
                    } else {
                        // 狂暴/无敌弹幕阶段 (约3.3秒)
                        velocity.x = 0;
                        velocity.y = 0;
                        transform.rotation += 0.1; // 快速旋转
                        
                        const renderable = entity.getComponent(Renderable);
                        if (renderable) {
                            // 闪烁表示无敌/高危
                            renderable.color = (stateCycle % 10 < 5) ? '#ff0000' : '#ffffff';
                        }
                        
                        // 疯狂发射弹幕 (类似螺旋丸)
                        if (stateCycle % 5 === 0 && this.addEntityCallback) {
                            signalDoodleAttack(entity);
                            for(let i=0; i<3; i++) {
                                const ang = transform.rotation + (Math.PI*2/3)*i;
                                const bullet = new Entity();
                                bullet.tags.add('enemy_bullet');
                                bullet.addComponent(new Transform(transform.x, transform.y, ang));
                                const bSpeed = 8;
                                bullet.addComponent(new Renderable('#ffffff', 8, 0, 0, 'rect', 20));
                                bullet.addComponent(new Projectile('standard', 50, entity.id, 240));
                                bullet.addComponent(new Velocity(Math.cos(ang) * bSpeed, Math.sin(ang) * bSpeed, bSpeed));
                                this.addEntityCallback(bullet);
                            }
                        }
                    }
                } else if (enemy.type === 'boss') {
                    const dx = pTransform.x - transform.x;
                    const dy = pTransform.y - transform.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 700) {
                        velocity.x = (dx / dist) * currentSpeed;
                        velocity.y = (dy / dist) * currentSpeed;
                    } else {
                        velocity.x = 0;
                        velocity.y = 0;
                    }
                    transform.rotation = Math.atan2(dy, dx);
                    enemy.bossTimer += 1;
                    if (enemy.bossTimer % 180 === 0) {
                        signalDoodleAttack(entity);
                        for (let i = 0; i < 12; i++) {
                            const ang = (Math.PI * 2 * i) / 12;
                            const bullet = new Entity();
                            bullet.addComponent(new Transform(transform.x, transform.y, ang));
                            const speed = 5;
                            bullet.addComponent(new Renderable('#ffcc00', 4, 0, 0, 'circle', 5));
                            bullet.addComponent(new Projectile('standard', 50, entity.id, Math.ceil(900 / speed)));
                            bullet.addComponent(new Velocity(Math.cos(ang) * speed, Math.sin(ang) * speed, speed));
                            this.addEntityCallback(bullet);
                        }
                    }
                    if (enemy.bossTimer % 420 === 0) {
                        signalDoodleAttack(entity);
                        for (let i = 0; i < 4; i++) {
                            const minion = new Entity();
                            const ang = (Math.PI / 2) * i;
                            minion.addComponent(new Transform(transform.x + Math.cos(ang) * 180, transform.y + Math.sin(ang) * 180));
                            minion.addComponent(new Velocity(0, 0, 2.5));
                            minion.addComponent(new Renderable('#ffaa00', 25, 0, 0, 'circle', 5));
                            minion.addComponent(new Health(60, 60));
                            minion.addComponent(new EnemyBehavior('shooter'));
                            minion.tags.add('enemy');
                            this.addEntityCallback(minion);
                        }
                    }
                }

                // --- Obstacle Avoidance removed: Enemies now directly attack the walls ---
            }
        }
    }

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
}
