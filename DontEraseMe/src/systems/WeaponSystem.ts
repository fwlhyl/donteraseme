import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Weapon } from '../components/Weapon';
import { InputManager } from '../core/InputManager';
import { PlayerControl } from '../components/PlayerControl';
import { Renderable } from '../components/Renderable';
import { BulletFactory } from '../entities/BulletFactory';
import { WEAPONS } from '../components/Weapon';
import { Projectile } from '../components/Projectile';
import { Velocity } from '../components/Velocity';
import { Skill } from '../components/Skill';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { PlayerStats } from '../components/PlayerStats';
import { DamageTextSystem } from './DamageTextSystem';
import { ParticleFactory } from '../entities/ParticleFactory';
import { Score } from '../components/Score';
import { Experience } from '../components/Experience';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { Puddle } from '../components/Puddle';
// removed Physics import
import { DeathHandler } from './DeathHandler';
import { signalDoodleAttack } from '../art/DoodleMotion';
import { emitGameSound, type SoundCue } from '../audio/AudioEvents';

const WEAPON_SHOT_SOUNDS: readonly SoundCue[] = [
    'shot-brush', 'shot-spray', 'shot-scrape', 'shot-chain',
    'shot-ruler', 'shot-ribbon', 'shot-vortex', 'shot-bucket',
    'shot-pen', 'shot-airbrush', 'shot-compass', 'shot-dropper'
];

export class WeaponSystem extends System {
    constructor(
        private input: InputManager,
        private addEntityCallback: (entity: Entity) => void,
        private gameCtx?: CanvasRenderingContext2D,
        private trailCtx?: CanvasRenderingContext2D
    ) {
        super();
    }

    public update(dt: number): void {
        for (const entity of this.entities) {
            const weapon = entity.getComponent(Weapon);
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            const stats = entity.getComponent(PlayerStats);
            
            if (weapon && transform && renderable) {
                // Magic Pen manifestations are piloted vehicles. Their combat
                // system owns the temporary attack while the player's equipped
                // shop weapon is fully frozen, then resumes untouched on expiry.
                if (entity.tags.has('player') && entity.tags.has('magic_piloting')) {
                    entity.attacking = false;
                    continue;
                }

                // Handle cooldown
                if (weapon.cooldown > 0) {
                    weapon.cooldown -= 1; // Assuming 60fps frame based cooldown
                }

                // Only player controls weapon for now
                if (entity.tags.has('player')) {
                    this.handlePlayerInput(entity, weapon, transform, renderable);
                    
                    // 数字板绘师：浮游炮逻辑
                    if (stats && stats.hasDigitalPassive) {
                        this.handleDigitalPen(entity, stats, transform, renderable);
                    }
                }
            }
        }
    }

    private handlePlayerInput(player: Entity, weapon: Weapon, transform: Transform, renderable: Renderable): void {
        // Weapon switching
        if (this.input.isKeyDown('1')) this.switchWeapon(weapon, 0);
        if (this.input.isKeyDown('2')) this.switchWeapon(weapon, 1);
        if (this.input.isKeyDown('3')) this.switchWeapon(weapon, 2);
        if (this.input.isKeyDown('4')) this.switchWeapon(weapon, 3);
        if (this.input.isKeyDown('5')) this.switchWeapon(weapon, 4);
        if (this.input.isKeyDown('6')) this.switchWeapon(weapon, 5);
        if (this.input.isKeyDown('7')) this.switchWeapon(weapon, 6);
        if (this.input.isKeyDown('8')) this.switchWeapon(weapon, 7);
        if (this.input.isKeyDown('9')) this.switchWeapon(weapon, 8);
        if (this.input.isKeyDown('0')) {
            // Find the last weapon in the array, assuming 0 equips the newest fused weapon
            if (weapon.unlocked.size > 0) {
                const lastWeaponId = Math.max(...Array.from(weapon.unlocked));
                this.switchWeapon(weapon, lastWeaponId);
            }
        }
        
        // If weapon index is -1, it means unarmed (like in Prologue)
        if (weapon.currentWeaponIndex === -1) return;
        const stats = player.getComponent(PlayerStats);
        
        if (this.input.isKeyDown('r') || this.input.isKeyDown('R')) {
            const cfg = weapon.config;
            if (cfg && weapon.ammo[weapon.currentWeaponIndex] < cfg.magSize) {
                this.startReload(player, weapon, stats);
            }
        }

        // Handle auto-attack setting
        const autoAttack = (window as any).gameInstance?.autoAttackEnabled || false;
        
        let isTryingToShoot = false;
        let nearestEnemy: Entity | null = null;
        let minDist = Infinity;

        if (autoAttack) {
            // Find nearest enemy
            for (const e of Array.from(this.entities)) {
                if (!e.active || !e.tags.has('enemy')) continue;
                const eTrans = e.getComponent(Transform);
                const eHp = e.getComponent(Health);
                if (eTrans && eHp && eHp.current > 0) {
                    const dist = Math.sqrt(Math.pow(eTrans.x - transform.x, 2) + Math.pow(eTrans.y - transform.y, 2));
                    // 只有在屏幕内（或者一定范围内）才攻击
                    if (dist < minDist && dist < 800) {
                        minDist = dist;
                        nearestEnemy = e;
                    }
                }
            }

            if (nearestEnemy) {
                isTryingToShoot = true;
                const eTrans = nearestEnemy.getComponent(Transform);
                if (eTrans) {
                    // Auto aim: rotate player to face enemy
                    transform.rotation = Math.atan2(eTrans.y - transform.y, eTrans.x - transform.x);
                }
            }
        } else {
            isTryingToShoot = this.input.mouse.down;
        }

        // Update attacking state based on input or auto-attack
        player.attacking = isTryingToShoot;

        // Handle reloading timer
        if (weapon.reloading) {
            if (weapon.reloadTimer > 0) {
                weapon.reloadTimer -= 1;
            } else {
                const cfg = weapon.config;
                if (cfg) {
                    weapon.ammo[weapon.currentWeaponIndex] = cfg.magSize;
                }
                weapon.reloading = false;
            }
        }
        
        const config = weapon.config;
        if (!config) return;

        // Special continuous tool: Roller
        if (isTryingToShoot && config.type === 'roller' && this.trailCtx) {
            signalDoodleAttack(player);
            weapon.cooldown = 2;
            this.trailCtx.save();
            this.trailCtx.fillStyle = renderable.color;
            this.trailCtx.globalAlpha = 0.8;
            this.trailCtx.beginPath();
            this.trailCtx.arc(transform.x, transform.y, 28, 0, Math.PI * 2);
            this.trailCtx.fill();
            this.trailCtx.restore();
            window.dispatchEvent(new CustomEvent('player-painted', {
                detail: {
                    x: transform.x,
                    y: transform.y,
                    rotation: transform.rotation,
                    range: 56,
                    width: 56,
                    type: config.type
                }
            }));
        }
        // Shooting
        if (isTryingToShoot && weapon.cooldown <= 0 && !weapon.reloading) {
            const idx = weapon.currentWeaponIndex;
            const cfg = config;
            if (cfg.type === 'melee') {
                this.shoot(player, weapon, transform, renderable.color, stats);
                // Melee不消耗子弹
            } else {
                if (weapon.ammo[idx] > 0) {
                    this.shoot(player, weapon, transform, renderable.color, stats);
                    
                    // 速写漫画家觉醒1：残影连击 (50%概率额外发射免费子弹)
                    let freeShot = false;
                    if (stats && stats.hasSkill('awakening_sketcher_1') && Math.random() < 0.5) {
                        freeShot = true;
                        // 稍微延迟一丁点发射免费子弹，形成“残影连击”视觉效果
                        setTimeout(() => {
                            if (player.active && !player.tags.has('magic_piloting')) {
                                this.shoot(player, weapon, transform, renderable.color, stats);
                            }
                        }, 50);
                    }
                    
                    if (!stats || Date.now() >= (stats.infiniteAmmoUntil || 0)) {
                        weapon.ammo[idx] -= 1;
                    }
                    if (weapon.ammo[idx] <= 0) {
                        this.startReload(player, weapon, stats);
                    }
                } else {
                    this.startReload(player, weapon, stats);
                }
            }
        }
    }

    private handleDigitalPen(player: Entity, stats: PlayerStats, transform: Transform, renderable: Renderable): void {
        const isAwakened1 = stats.hasSkill('awakening_digital_1');
        const isAwakened2 = stats.hasSkill('awakening_digital_2');
        
        // 觉醒1：冷却时间缩短1秒(60帧)
        const currentMaxCooldown = isAwakened1 ? stats.maxDigitalPenCooldown - 60 : stats.maxDigitalPenCooldown;
        
        // 觉醒2炮台逻辑更新
        if (isAwakened2) {
            for (let i = stats.digitalTurrets.length - 1; i >= 0; i--) {
                const turret = stats.digitalTurrets[i];
                turret.lifeTimer--;
                
                if (turret.lifeTimer <= 0) {
                    stats.digitalTurrets.splice(i, 1);
                    continue;
                }
                
                turret.burstDelay--;
                if (turret.burstDelay <= 0 && turret.burstCount > 0) {
                    turret.burstCount--;
                    turret.burstDelay = turret.config.fireRate || 20;
                    
                    const weapon = player.getComponent(Weapon);
                    if (weapon) {
                        let nearestEnemy: Entity | null = null;
                        let minDist = Infinity;
                        for (const e of Array.from(this.entities)) {
                            if (!e.active) continue;
                            const eBeh = e.getComponent(EnemyBehavior);
                            const eTrans = e.getComponent(Transform);
                            const eHp = e.getComponent(Health);
                            if (eBeh && eTrans && eHp && eHp.current > 0) {
                                const dist = Math.sqrt(Math.pow(eTrans.x - turret.x, 2) + Math.pow(eTrans.y - turret.y, 2));
                                if (dist < minDist && dist < (turret.config.range || 600) + 200) {
                                    minDist = dist;
                                    nearestEnemy = e;
                                }
                            }
                        }
                        
                        let targetAngle = 0;
                        if (nearestEnemy) {
                            const eTrans = nearestEnemy.getComponent(Transform);
                            if (eTrans) {
                                targetAngle = Math.atan2(eTrans.y - turret.y, eTrans.x - turret.x);
                                turret.rotation = targetAngle;
                            }
                        } else {
                            if (turret.rotation === undefined) {
                                turret.rotation = 0;
                            }
                            targetAngle = turret.rotation;
                        }
                        
                        // Create a dummy transform for the turret using the turret's FIXED coordinates
                        const penTransform = new Transform(turret.x, turret.y, targetAngle);
                        this.fireDigitalPenAttack(player, weapon, turret.config, penTransform, '#00ffff', stats);
                    }
                }
            }
        }

        stats.digitalPenCooldown -= 1;
        if (stats.digitalPenCooldown <= 0) {
            stats.digitalPenCooldown = currentMaxCooldown;
            if (stats.lastAttackConfig) {
                const fireRate = stats.lastAttackConfig.fireRate || 20;
                let bCount = Math.max(1, Math.floor(60 / fireRate));
                // 觉醒1：增加炮数量意味着同一时间打出的子弹翻倍，这里简化为连续发射次数翻倍（或者同时发射，我们这里用增加次数实现双持感觉）
                if (isAwakened1 && !isAwakened2) {
                    bCount *= 2; 
                }
                
                if (isAwakened2) {
                    // 觉醒2：留下炮台。注意：这里必须取当前玩家的真实世界坐标，不能用可能带了相对偏移的 transform
                    const pTrans = player.getComponent(Transform);
                    if (pTrans) {
                        stats.digitalTurrets.push({
                            x: pTrans.x,
                            y: pTrans.y,
                            lifeTimer: 300, // 5秒
                            burstCount: bCount * 5, // 5秒内持续射击
                            burstDelay: 0,
                            config: stats.lastAttackConfig
                        });
                    }
                } else {
                    stats.digitalPenBurstCount = bCount;
                    stats.digitalPenBurstDelay = 0;
                }
            }
        }

        // 非觉醒2时的普通跟随浮游炮逻辑
        if (!isAwakened2 && stats.digitalPenBurstCount > 0) {
            stats.digitalPenBurstDelay -= 1;
            if (stats.digitalPenBurstDelay <= 0) {
                stats.digitalPenBurstCount -= 1;
                if (stats.lastAttackConfig) {
                    // 觉醒1的话射速更快一点（延迟减半）
                    stats.digitalPenBurstDelay = (stats.lastAttackConfig.fireRate || 20) / (isAwakened1 ? 2 : 1);

                    const weapon = player.getComponent(Weapon);
                    if (weapon) {
                        // 获取玩家真实世界坐标
                        const pTrans = player.getComponent(Transform);
                        const baseWorldX = pTrans ? pTrans.x : transform.x;
                        const baseWorldY = pTrans ? pTrans.y : transform.y;

                        // Find nearest enemy to aim at
                        let nearestEnemy: Entity | null = null;
                        let minDist = Infinity;
                        for (const e of Array.from(this.entities)) {
                            if (!e.active) continue;
                            const eBeh = e.getComponent(EnemyBehavior);
                            const eTrans = e.getComponent(Transform);
                            const eHp = e.getComponent(Health);
                            if (eBeh && eTrans && eHp && eHp.current > 0) {
                                const dist = Math.sqrt(Math.pow(eTrans.x - baseWorldX, 2) + Math.pow(eTrans.y - baseWorldY, 2));
                                if (dist < minDist && dist < (stats.lastAttackConfig.range || 600) + 200) {
                                    minDist = dist;
                                    nearestEnemy = e;
                                }
                            }
                        }
                        
                        // Orbit offset logic (same as RenderSystem)
                        const time = Date.now() / 300;
                        const orbitRadius = renderable.radius + 20;
                        
                        // 如果是觉醒1，有两把浮游炮，这里根据发射次数奇偶决定位置，或者直接固定两个位置
                        // 为了简单，我们让它快速在玩家两侧切换发射
                        const offsetAngle = (stats.digitalPenBurstCount % 2 === 0 && isAwakened1) ? Math.PI : 0;
                        
                        const penX = baseWorldX + Math.cos(time + offsetAngle) * orbitRadius;
                        const penY = baseWorldY + Math.sin(time + offsetAngle) * orbitRadius;
                        
                        let targetAngle = transform.rotation;
                        if (nearestEnemy) {
                            const eTrans = nearestEnemy.getComponent(Transform);
                            if (eTrans) {
                                targetAngle = Math.atan2(eTrans.y - penY, eTrans.x - penX);
                            }
                        }
                        
                        const penTransform = new Transform(penX, penY, targetAngle);
                        this.fireDigitalPenAttack(player, weapon, stats.lastAttackConfig, penTransform, '#00ffff', stats);
                    }
                }
            }
        }
    }

    private fireDigitalPenAttack(owner: Entity, weapon: Weapon, config: any, transform: Transform, bulletColor: string, stats: PlayerStats): void {
        emitGameSound(WEAPON_SHOT_SOUNDS[config.id] ?? 'shot-pen', { x: transform.x, y: transform.y, gain: 0.45 });
        let isReaperStrike = false;
        if (stats && stats.killReaperReady) {
            isReaperStrike = true;
            stats.killReaperReady = false;
        }

        // A simplified version of shoot()
        const getDamage = (baseDamage: number, weaponBonus: number) => {
            let dmg = baseDamage + weaponBonus;
            let isCrit = false;
            let isSuperCrit = false;
            let bonusPierce = 0;
            
            dmg *= stats.totalDamageMultiplier;
            if (stats.speedOverflow > 0) {
                dmg *= (1.0 + (stats.speedOverflow * 0.10));
            }
            if (stats.hasCalligrapherPassive && stats.calligrapherDamageStacks > 0) {
                dmg *= (1.0 + stats.calligrapherDamageStacks * 0.02);
            }
            let critC = weapon.critChance + stats.totalCritChance;
            let critM = weapon.critMultiplier + (stats.totalCritDamage - 1.5);

            if (isReaperStrike) {
                critC = Math.max(critC, 1.0); // 必定暴击，但保留溢出的暴击率
            }

            if (Math.random() < critC) {
                if (stats && stats.getSkillLevel('synergy_crit_overflow') > 0) {
                    if (critC > 1.0) {
                        critM += (critC - 1.0) * 2.0;
                    }
                    const superCritProb = Math.min(0.5, 0.2 + Math.max(0, critC - 1.0) * 0.5);
                    if (Math.random() < superCritProb) {
                        isSuperCrit = true;
                    }
                }
                dmg = Math.floor(dmg * critM);
                isCrit = true;
                if (isSuperCrit) {
                    dmg *= 3;
                }
            }
            return { damage: dmg, isCrit, isSuperCrit, bonusPierce };
        };

        if (config.type === 'ruler' && this.trailCtx) {
            const len = 600;
            const endX = transform.x + Math.cos(transform.rotation) * len;
            const endY = transform.y + Math.sin(transform.rotation) * len;
            this.trailCtx.save();
            this.trailCtx.strokeStyle = bulletColor;
            this.trailCtx.lineWidth = 8 * (stats ? stats.trailWidthMultiplier : 1);
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(transform.x, transform.y);
            this.trailCtx.lineTo(endX, endY);
            this.trailCtx.stroke();
            this.trailCtx.restore();
            // Damage enemies along the line
            const ax = transform.x, ay = transform.y;
            const bx = endX, by = endY;
            const thickness = 12 * (stats ? stats.trailWidthMultiplier : 1);
            const idx = weapon.currentWeaponIndex;
            const bonus = weapon.damageBonus[idx] || 0;
            let rulerDmgResult = getDamage(config.damage, bonus);
            let baseRulerDmg = rulerDmgResult.damage;
            let isCrit = rulerDmgResult.isCrit;
            let isSuperCrit = rulerDmgResult.isSuperCrit;
            let pierceCount = 0;
            
            // Sort enemies by distance to player
            const enemiesHit = [];
            for (const e of this.entities) {
                if (!e.active || e === owner || e.tags.has('ink_dummy')) continue;
                const eb = e.getComponent(EnemyBehavior);
                const tt = e.getComponent(Transform);
                const hp = e.getComponent(Health);
                if (!eb || !tt || !hp) continue;
                const dx = bx - ax, dy = by - ay;
                const t = Math.max(0, Math.min(1, ((tt.x - ax) * dx + (tt.y - ay) * dy) / (dx*dx + dy*dy + 1e-6)));
                const px = ax + dx * t, py = ay + dy * t;
                const d = Math.hypot(tt.x - px, tt.y - py);
                if (d <= thickness) {
                    const distToPlayer = Math.hypot(tt.x - ax, tt.y - ay);
                    enemiesHit.push({ e, hp, distToPlayer });
                }
            }
            
            enemiesHit.sort((a, b) => a.distToPlayer - b.distToPlayer);
            
            for (const hit of enemiesHit) {
                let dmg = baseRulerDmg;
                if (stats && stats.hasCalligrapherPassive) {
                    dmg *= (1 + pierceCount * 0.5); // 每次穿透伤害增加50%
                }
                hit.hp.current -= dmg;
                const textColor = isSuperCrit ? '#ff0000' : (isCrit ? '#ff4444' : '#ffffff');
                const hitTransform = hit.e.getComponent(Transform)!;
                if (dmg > 0) emitGameSound(isCrit || isSuperCrit ? 'hit-heavy' : 'hit', { x: hitTransform.x, y: hitTransform.y });
                DamageTextSystem.addDamageText(hit.e.getComponent(Transform)!.x, hit.e.getComponent(Transform)!.y - 15, dmg, textColor, isCrit || isSuperCrit);
                pierceCount++;
                if (hit.hp.current <= 0) {
                    this.handleEnemyDeath(hit.e, owner);
                }
            }
            return;
        }

        if (config.type === 'sniper') {
            const beam = new Entity();
            const range = config.range || 1200;
            const angle = transform.rotation;
            const endX = transform.x + Math.cos(angle) * range;
            const endY = transform.y + Math.sin(angle) * range;
            
            beam.addComponent(new Transform(transform.x, transform.y));
            const zIndex = owner.tags.has('player') ? 50 : 60;
            beam.addComponent(new Renderable(bulletColor, 0, endX, endY, 'line', zIndex));
            beam.addComponent(new Projectile('sniper', config.damage, owner.id, 5));
            
            const beamProj = beam.getComponent(Projectile);
            if (beamProj) {
                const dmgResult = getDamage(beamProj.damage, 0);
                beamProj.damage = dmgResult.damage;
                beamProj.isCrit = dmgResult.isCrit;
                beamProj.isSuperCrit = dmgResult.isSuperCrit;
                beamProj.reaperStrike = isReaperStrike;
            }
            this.addEntityCallback(beam);
            
            if (this.trailCtx) {
                const sx = transform.x;
                const sy = transform.y;
                setTimeout(() => {
                    if (this.trailCtx) {
                        this.trailCtx.save();
                        this.trailCtx.globalCompositeOperation = 'source-over';
                        this.trailCtx.beginPath();
                        this.trailCtx.moveTo(sx, sy);
                        this.trailCtx.lineTo(endX, endY);
                        this.trailCtx.strokeStyle = bulletColor;
                        this.trailCtx.lineWidth = 2 * (stats ? stats.trailWidthMultiplier : 1);
                        this.trailCtx.stroke();
                        this.trailCtx.restore();
                    }
                }, 0);
            }
            return;
        }

        if (config.type === 'melee') {
            const reach = (config.range || 80) * (stats ? stats.trailWidthMultiplier : 1);
            const halfArc = Math.PI * 0.35;
            const base = transform.rotation;
            let dmgResult = getDamage(config.damage, 0);
            let dmg = dmgResult.damage;
            let isCrit = dmgResult.isCrit;
            let isSuperCrit = dmgResult.isSuperCrit;
            
            // Generate a 'melee' invisible projectile to be handled by CollisionSystem
            // This projectile will live for a very short time (e.g. 5 frames) to handle the sweep collision and knockback
            const sweepProj = BulletFactory.create(
                { ...config, speed: 0, type: 'melee', count: 1, spread: 0 },
                transform.x, transform.y,
                base,
                bulletColor,
                owner.id,
                1.0,
                stats ? stats.trailWidthMultiplier : 1.0
            );
            
            // Adjust renderable to act as a hitbox reference (it won't be drawn normally as it's 'melee')
            const sweepRender = sweepProj.getComponent(Renderable);
            if (sweepRender) {
                sweepRender.shape = 'rect';
                sweepRender.width = reach; // Use width as reach reference
                sweepRender.color = 'transparent'; // invisible
            }
            
            const pData = sweepProj.getComponent(Projectile);
            if (pData) {
                pData.damage = dmg;
                pData.isCrit = isCrit;
                pData.isSuperCrit = isSuperCrit;
                pData.reaperStrike = isReaperStrike;
                pData.pierceCount = 9999; // Infinite pierce for sweep
                pData.life = 5; // Very short life, just enough for CollisionSystem to process
            }
            this.addEntityCallback(sweepProj);

            if (this.trailCtx) {
                this.trailCtx.save();
                this.trailCtx.strokeStyle = bulletColor;
                this.trailCtx.globalAlpha = 0.6;
                this.trailCtx.lineWidth = 6 * (stats ? stats.trailWidthMultiplier : 1);
                this.trailCtx.beginPath();
                this.trailCtx.arc(transform.x, transform.y, reach, base - halfArc, base + halfArc);
                this.trailCtx.stroke();
                this.trailCtx.restore();
            }

            const isAwakened = stats?.hasSkill('mastery_scraper');
            if (isAwakened) {
                // 刮刀觉醒：挥出直线剑气，穿透所有敌人
                const aura = BulletFactory.create(
                    { ...config, speed: 15, type: 'standard', count: 1, spread: 0 },
                    transform.x, transform.y,
                    base,
                    bulletColor,
                    owner.id,
                    1.0,
                    stats ? stats.trailWidthMultiplier : 1.0
                );
                const renderable = aura.getComponent(Renderable);
                if (renderable) {
                    renderable.shape = 'rect';
                    renderable.width = 40;
                    renderable.height = 10;
                }
                const proj = aura.getComponent(Projectile);
                if (proj) {
                    proj.damage = dmg;
                    proj.isCrit = isCrit;
                    proj.isSuperCrit = dmgResult.isSuperCrit;
                    proj.reaperStrike = isReaperStrike;
                    proj.pierceCount = 9999;
                    (proj as any).isAwakened = true;
                }
                this.addEntityCallback(aura);
            }

            return;
        }

        let count = config.count + (stats ? stats.bulletCountBonus : 0);
        if (config.type === 'shotgun' && stats?.hasSkill('mastery_shotgun')) {
            count *= 2;
        }
        
        // 散弹枪觉醒：连续喷射 3 次
        const burstCount = (config.type === 'shotgun' && stats?.hasSkill('mastery_shotgun')) ? 3 : 1;
        const burstDelay = 100;

        for (let b = 0; b < burstCount; b++) {
            setTimeout(() => {
                if (!owner.active || owner.tags.has('magic_piloting')) return;
                
                if (config.type === 'shotgun' && burstCount > 1) {
                    const pCtrl = owner.getComponent(PlayerControl);
                    if (pCtrl) {
                        // 强制触发 5 帧的极速后坐力 (位移量较大)
                        pCtrl.recoilFrames = 5;
                        pCtrl.recoilSpeed = 12; // 极大的后坐力速度
                        pCtrl.recoilDirX = -Math.cos(transform.rotation);
                        pCtrl.recoilDirY = -Math.sin(transform.rotation);
                    } else {
                        // 兜底方案
                        const pT = owner.getComponent(Transform);
                        if (pT) {
                            pT.x -= Math.cos(transform.rotation) * 20;
                            pT.y -= Math.sin(transform.rotation) * 20;
                        }
                    }
                }

                for (let i = 0; i < count; i++) {
                    const spread = (Math.random() - 0.5) * config.spread * weapon.spreadMul;
                    const angle = transform.rotation + spread;
                    const bullet = BulletFactory.create(
                        config,
                        transform.x,
                        transform.y,
                        angle,
                        bulletColor,
                        owner.id,
                        weapon.speedMul,
                        stats.trailWidthMultiplier
                    );
                    const renderable = bullet.getComponent(Renderable);
                    if (renderable) {
                        renderable.zIndex = owner.tags.has('player') ? 50 : 60;
                        if (config.type === 'ruler' && stats?.hasSkill('mastery_ruler')) {
                            renderable.width *= 3;
                            renderable.height *= 3;
                        }
                        if (config.type === 'compass' && stats?.hasSkill('mastery_compass')) {
                            renderable.radius *= 3;
                        }
                    }
                    const proj = bullet.getComponent(Projectile);
                    if (proj) {
                        const dmgResult = getDamage(proj.damage, 0);
                        proj.damage = dmgResult.damage;
                        proj.isCrit = dmgResult.isCrit;
                        proj.isSuperCrit = dmgResult.isSuperCrit;
                        proj.reaperStrike = isReaperStrike;
                        proj.pierceCount = weapon.pierceCount + stats.pierceBonus;
                        if (config.type === 'rocket') {
                            proj.explosionRadiusScale = weapon.explosionRadiusScale;
                        }
                        if (config.type === 'chain') {
                            proj.pierceCount = 3;
                        }
                        if (config.type === 'flamethrower' && stats?.hasSkill('mastery_flamethrower')) {
                            proj.life *= 6;
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'ruler' && stats?.hasSkill('mastery_ruler')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'compass' && stats?.hasSkill('mastery_compass')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'rocket' && stats?.hasSkill('mastery_rocket')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'chain' && stats?.hasSkill('mastery_chain')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'mine' && stats?.hasSkill('mastery_mine')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.type === 'gravity' && stats?.hasSkill('mastery_vortex')) {
                            (proj as any).isAwakened = true;
                        }
                        if (config.id === 0) { // Pistol
                            proj.life = Math.floor((config.range || 600) / (config.speed * weapon.speedMul || 9));
                            if (stats?.hasSkill('mastery_pistol')) {
                                (proj as any).isAwakened = true;
                            }
                        }
                        (proj as any).isAwakened = (proj as any).isAwakened || false;
                    }
                    this.addEntityCallback(bullet);
                }
            }, b * burstDelay);
        }
    }

    private switchWeapon(weapon: Weapon, index: number): void {
        if (!weapon.unlocked.has(index)) return;
        if (weapon.currentWeaponIndex !== index) {
            weapon.currentWeaponIndex = index;
            weapon.cooldown = 20; // Reset cooldown on switch
            console.log(`Switched to weapon: ${WEAPONS[index].name}`);
        }
    }

    private shoot(owner: Entity, weapon: Weapon, transform: Transform, ownerColorArg: string, stats?: PlayerStats): void {
        const config = weapon.config;
        if (!config) return;
        
        let ownerColor = ownerColorArg;
        let frenzySpeedBonus = 0;
        if (stats) {
            const now = Date.now();
            stats.killFrenzyStacks = stats.killFrenzyStacks.filter(stack => stack.expireTime > now);
            for (const stack of stats.killFrenzyStacks) {
                frenzySpeedBonus += stack.amount;
            }
        }
        
        const baseFrMultiplier = stats ? weapon.fireRateMul / stats.totalFireRateMultiplier : weapon.fireRateMul;
        const finalFrMultiplier = baseFrMultiplier / (1 + frenzySpeedBonus);
        weapon.cooldown = Math.max(1, Math.round(config.fireRate * finalFrMultiplier));
        signalDoodleAttack(owner);
        // One attack cue per trigger, independent of pellets, beams, or burst count.
        emitGameSound(WEAPON_SHOT_SOUNDS[config.id] ?? 'shot-brush', { x: transform.x, y: transform.y });

        // Guard Mode listens to this one semantic event rather than trying to
        // infer repair strokes from every individual projectile implementation.
        // It is harmless in other modes and keeps primary weapon marks aligned
        // with their actual firing direction.
        if (owner.tags.has('player')) {
            window.dispatchEvent(new CustomEvent('player-painted', {
                detail: {
                    x: transform.x,
                    y: transform.y,
                    rotation: transform.rotation,
                    range: Math.min(Math.max(config.range || 120, 80), 420),
                    width: Math.max(22, config.radius * 5 + 14),
                    type: config.type
                }
            }));
        }
        
        // 换弹灵感判定
        let inspLevel = 0;
        if ((weapon as any).inspirationLevel && (weapon as any).inspirationLevel > 0) {
            inspLevel = (weapon as any).inspirationLevel;
            (weapon as any).inspirationLevel = 0; // 消耗掉
        }

        let isReaperStrike = false;
        if (stats && stats.killReaperReady) {
            isReaperStrike = true;
            stats.killReaperReady = false; // 消耗掉
        }

        const getDamage = (baseDamage: number, weaponBonus: number): { damage: number, isCrit: boolean, bonusPierce: number, isSuperCrit: boolean } => {
            let dmg = baseDamage + weaponBonus;
            let isCrit = false;
            let isSuperCrit = false;
            let bonusPierce = 0;
            if (stats) {
                // 应用基础伤害倍率
                dmg *= stats.totalDamageMultiplier;
                
                // 溢出的移动速度转化为额外伤害倍率（每溢出 1 点速度增加 10% 伤害）
                if (stats.speedOverflow > 0) {
                    const extraMultiplier = 1.0 + (stats.speedOverflow * 0.10);
                    dmg *= extraMultiplier;
                }

                // 书法家被动伤害加成（每层2%）
                if (stats.hasCalligrapherPassive && stats.calligrapherDamageStacks > 0) {
                    dmg *= (1.0 + stats.calligrapherDamageStacks * 0.02);
                }
            }
            let critC = weapon.critChance + (stats ? stats.totalCritChance : 0);
            let critM = weapon.critMultiplier + (stats ? (stats.totalCritDamage - 1.5) : 0);

            // 收笔一击判定
            let isLastStrike = false;
            let lastStrikeLevel = 0;
            if (stats && owner.tags.has('player')) {
                lastStrikeLevel = stats.getSkillLevel('hit_last_strike');
                const idx = weapon.currentWeaponIndex;
                if (lastStrikeLevel > 0 && weapon.ammo[idx] === 1) {
                    isLastStrike = true;
                }
            }

            if (inspLevel > 0) {
                critC = Math.max(critC, 1.0); // 必定暴击，但保留溢出的暴击率
                const bonusDmg = inspLevel === 1 ? 1 : (inspLevel === 2 ? 2 : 3); // +100% / +200% / +300%
                dmg *= (1 + bonusDmg);
                if (inspLevel >= 3) {
                    bonusPierce = 1; // 3级才附带穿透
                }
            }

            if (isLastStrike) {
                critC = Math.max(critC, 1.0); // 必定暴击，但保留溢出的暴击率
                if (lastStrikeLevel >= 2) {
                    critM += 0.5; // +50% 暴击伤害
                }
                if (lastStrikeLevel >= 3) {
                    critM += 0.5; // 累计 +100% 暴击伤害
                    bonusPierce += 1; // 附带穿透
                }
            }

            if (isReaperStrike) {
                critC = Math.max(critC, 1.0); // 必定暴击，但保留溢出的暴击率
            }

            // 致命穿透 (crit_pierce) 转化判定：
            // 如果武器本身就是自带无限穿透的类型，致命穿透技能改为提供暴击伤害加成
            let critPierceBonusDamage = 0;
            if (stats && owner.tags.has('player')) {
                const pierceLevel = stats.getSkillLevel('crit_pierce');
                if (pierceLevel > 0) {
                    // 无限穿透类型或天生高穿透类型
                    const infinitePierceTypes = ['sniper', 'ruler', 'flamethrower', 'gravity', 'compass', 'melee'];
                    if (infinitePierceTypes.includes(config.type)) {
                        // 转化为暴击伤害加成: 30% / 60% / 100%
                        critPierceBonusDamage = pierceLevel === 1 ? 0.3 : (pierceLevel === 2 ? 0.6 : 1.0);
                        critM += critPierceBonusDamage;
                    }
                }
            }

            if (Math.random() < critC) {
                // 双生·色彩溢出 (synergy_crit_overflow) 判定
                if (stats && stats.getSkillLevel('synergy_crit_overflow') > 0) {
                    if (critC > 1.0) {
                        const overflow = critC - 1.0;
                        critM += overflow * 2.0;
                    }
                    const superCritProb = Math.min(0.5, 0.2 + Math.max(0, critC - 1.0) * 0.5);
                    if (Math.random() < superCritProb) {
                        isSuperCrit = true;
                    }
                }
                
                dmg = Math.floor(dmg * critM);
                isCrit = true;
                
                if (isSuperCrit) {
                    dmg = Math.floor(dmg * 3);
                }
            }
            return { damage: dmg, isCrit, bonusPierce, isSuperCrit };
        };
        
        // Set attack state for player
        if (owner.tags.has('player')) {
            // We now update attack state based on mouse down in handlePlayerInput
            // rather than a timeout here.
            
            // 数字板绘师：记录上一次攻击
            if (stats && stats.hasDigitalPassive) {
                stats.lastAttackConfig = config;
            }
        }
        
        // Determine bullet color
        let bulletColor = config.color;
        // All weapons except Pistol (0) should use player color
        if (config.id !== 0) {
            bulletColor = ownerColor;
        }

        // Ruler gun draws a direct line
        if (config.type === 'ruler' && this.trailCtx) {
            const isAwakened = stats?.hasSkill('mastery_ruler');
            const len = isAwakened ? 1000 : 600; // 觉醒后射程变长
            const endX = transform.x + Math.cos(transform.rotation) * len;
            const endY = transform.y + Math.sin(transform.rotation) * len;
            
            let thickness = 12 * (stats ? stats.trailWidthMultiplier : 1);
            if (isAwakened) thickness *= 3; // 觉醒后宽度变为3倍
            
            this.trailCtx.save();
            this.trailCtx.strokeStyle = ownerColor;
            this.trailCtx.lineWidth = thickness;
            // 如果觉醒了，稍微调整透明度和光效
            if (isAwakened) {
                this.trailCtx.shadowBlur = 10;
                this.trailCtx.shadowColor = ownerColor;
                this.trailCtx.globalAlpha = 0.8;
            } else {
                this.trailCtx.globalAlpha = 0.6;
            }
            
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(transform.x, transform.y);
            this.trailCtx.lineTo(endX, endY);
            this.trailCtx.stroke();
            this.trailCtx.restore();
            
            // Damage enemies along the line
            const ax = transform.x, ay = transform.y;
            const bx = endX, by = endY;
            const idx = weapon.currentWeaponIndex;
            const bonus = weapon.damageBonus[idx] || 0;
            let rulerDmgResult = getDamage(config.damage, bonus);
            let baseRulerDmg = rulerDmgResult.damage;
            let isCrit = rulerDmgResult.isCrit;
            let pierceCount = 0;
            
            // Sort enemies by distance to player
            const enemiesHit = [];
            for (const e of this.entities) {
                if (!e.active || e === owner || e.tags.has('ink_dummy')) continue;
                const eb = e.getComponent(EnemyBehavior);
                const tt = e.getComponent(Transform);
                const hp = e.getComponent(Health);
                if (!eb || !tt || !hp) continue;
                const dx = bx - ax, dy = by - ay;
                const t = Math.max(0, Math.min(1, ((tt.x - ax) * dx + (tt.y - ay) * dy) / (dx*dx + dy*dy + 1e-6)));
                const px = ax + dx * t, py = ay + dy * t;
                const d = Math.hypot(tt.x - px, tt.y - py);
                if (d <= thickness) {
                    const distToPlayer = Math.hypot(tt.x - ax, tt.y - ay);
                    enemiesHit.push({ e, hp, tt, distToPlayer });
                }
            }
            
            enemiesHit.sort((a, b) => a.distToPlayer - b.distToPlayer);
            
            for (const hit of enemiesHit) {
                let dmg = baseRulerDmg;
                // 非觉醒状态下，穿透伤害衰减 10%，最低衰减到 30% (如果不是书法家的话)
                let decay = 1.0;
                if (!isAwakened && !(stats && stats.hasCalligrapherPassive)) {
                    decay = Math.max(0.3, 1.0 - pierceCount * 0.1);
                }
                
                dmg *= decay;
                
                if (stats && stats.hasCalligrapherPassive) {
                    dmg *= (1 + pierceCount * 0.5); // 每次穿透伤害增加50%
                }
                
                hit.hp.current -= dmg;
                if (dmg > 0) emitGameSound(isCrit ? 'hit-heavy' : 'hit', { x: hit.tt.x, y: hit.tt.y });
                DamageTextSystem.addDamageText(hit.tt.x, hit.tt.y - 15, dmg, isCrit ? '#ff4444' : '#ffffff', isCrit);
                
                // 觉醒后附带极强击退效果
                if (isAwakened) {
                    const kbForce = 12;
                    hit.tt.x += Math.cos(transform.rotation) * kbForce;
                    hit.tt.y += Math.sin(transform.rotation) * kbForce;
                }
                
                pierceCount++;
                if (hit.hp.current <= 0) {
                    this.handleEnemyDeath(hit.e, owner);
                }
            }
            return;
        }

        // Ruler skill: one-shot straight line
        const sk = owner.getComponent(Skill);
        if (sk && sk.rulerArmed && this.trailCtx) {
            const len = 600;
            const endX = transform.x + Math.cos(transform.rotation) * len;
            const endY = transform.y + Math.sin(transform.rotation) * len;
            this.trailCtx.save();
            this.trailCtx.strokeStyle = ownerColor;
            this.trailCtx.lineWidth = 6;
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(transform.x, transform.y);
            this.trailCtx.lineTo(endX, endY);
            this.trailCtx.stroke();
            this.trailCtx.restore();
            sk.rulerArmed = false;
            return;
        }

        // Sniper special logic (Raycast)
        if (config.type === 'sniper') {
            const shots = stats?.hasSkill('mastery_sniper') ? 3 : 1;
            
            for (let s = 0; s < shots; s++) {
                // Create a visual beam entity
                const beam = new Entity();
                
                // Calculate beam end point (very far away)
                const range = config.range || 1200;
                let angle = transform.rotation; // Use rotation directly
                if (shots > 1) {
                    angle += (s - (shots - 1) / 2) * 0.15; // 扩散一点
                }
                const endX = transform.x + Math.cos(angle) * range;
                const endY = transform.y + Math.sin(angle) * range;
                
                // We use Transform for start point, and Renderable width/height for end point (as per RenderSystem logic)
                beam.addComponent(new Transform(transform.x, transform.y));
                const zIndex = owner.tags.has('player') ? 50 : 60;
                // Store end coordinates in width/height for line drawing
                beam.addComponent(new Renderable(bulletColor, 0, endX, endY, 'line', zIndex)); // Use bulletColor
                
                beam.addComponent(new Projectile('sniper', config.damage, owner.id, 5));
                const beamProj = beam.getComponent(Projectile);
                if (beamProj) {
                    const idx = weapon.currentWeaponIndex;
                    const bonus = weapon.damageBonus[idx] || 0;
                    const dmgResult = getDamage(beamProj.damage, bonus);
                    beamProj.damage = dmgResult.damage;
                    beamProj.isCrit = dmgResult.isCrit;
                    beamProj.pierceCount += dmgResult.bonusPierce;
                    if (stats && stats.hasCalligrapherPassive) {
                        beamProj.calligrapherBonus = true;
                    }
                }
                
                this.addEntityCallback(beam);
                
                // Draw Trail Line
                // Delay drawing the sniper trail line slightly so it happens AFTER the eraser 
                // has processed its death and stopped erasing.
                if (this.trailCtx) {
                    const sx = transform.x;
                    const sy = transform.y;
                    setTimeout(() => {
                        if (this.trailCtx) {
                            this.trailCtx.save();
                            this.trailCtx.globalCompositeOperation = 'source-over';
                            this.trailCtx.beginPath();
                            this.trailCtx.moveTo(sx, sy);
                            this.trailCtx.lineTo(endX, endY);
                            this.trailCtx.strokeStyle = bulletColor;
                            this.trailCtx.lineWidth = 2 * (stats ? stats.trailWidthMultiplier : 1);
                            this.trailCtx.stroke();
                            this.trailCtx.restore();
                        }
                    }, 0);
                }
            }
            
            return;
        }

        // Melee：前方扇形近战打击
        if (config.type === 'melee') {
            let reach = (config.range || 80) * (stats ? stats.trailWidthMultiplier : 1);
            const isAwakened = stats?.hasSkill('mastery_scraper');
            if (isAwakened) {
                reach *= 2;
            }
            const halfArc = Math.PI * 0.35; // 约40度扇形
            const base = transform.rotation;
            const idx = weapon.currentWeaponIndex;
            const bonus = weapon.damageBonus[idx] || 0;
            let dmgResult = getDamage(config.damage, bonus);
            let dmg = dmgResult.damage;
            let isCrit = dmgResult.isCrit;
            
            // Generate a 'melee' invisible projectile to be handled by CollisionSystem
            // This projectile will live for a very short time (e.g. 5 frames) to handle the sweep collision and knockback
            const sweepProj = BulletFactory.create(
                { ...config, speed: 0, type: 'melee', count: 1, spread: 0 },
                transform.x, transform.y,
                base,
                bulletColor,
                owner.id,
                1.0,
                stats ? stats.trailWidthMultiplier : 1.0
            );
            
            // Adjust renderable to act as a hitbox reference (it won't be drawn normally as it's 'melee')
            const sweepRender = sweepProj.getComponent(Renderable);
            if (sweepRender) {
                sweepRender.shape = 'rect';
                sweepRender.width = reach; // Use width as reach reference
                sweepRender.color = 'transparent'; // invisible
            }
            
            const pData = sweepProj.getComponent(Projectile);
            if (pData) {
                pData.damage = dmg;
                pData.isCrit = isCrit;
                pData.isSuperCrit = dmgResult.isSuperCrit;
                pData.reaperStrike = isReaperStrike;
                pData.pierceCount = 9999; // Infinite pierce for sweep
                pData.life = 5; // Very short life, just enough for CollisionSystem to process
            }
            this.addEntityCallback(sweepProj);

            // 视觉：在轨迹层画出短暂的弧线
            if (this.trailCtx) {
                this.trailCtx.save();
                this.trailCtx.strokeStyle = bulletColor; // changed to bulletColor for consistency
                this.trailCtx.globalAlpha = 0.6;
                this.trailCtx.lineWidth = 6 * (stats ? stats.trailWidthMultiplier : 1);
                this.trailCtx.beginPath();
                this.trailCtx.arc(transform.x, transform.y, reach, base - halfArc, base + halfArc);
                this.trailCtx.stroke();
                this.trailCtx.restore();
            }
            
            if (isAwakened) {
                // 刮刀觉醒：挥出直线剑气，穿透所有敌人，并向前方发射一段距离
                const aura = BulletFactory.create(
                    { ...config, speed: 15, type: 'standard', count: 1, spread: 0 },
                    transform.x, transform.y,
                    base,
                    bulletColor,
                    owner.id,
                    1.0,
                    stats ? stats.trailWidthMultiplier : 1.0
                );
                const renderable = aura.getComponent(Renderable);
                if (renderable) {
                    renderable.shape = 'crescent'; // 使用全新的月牙剑气形状
                    renderable.radius = reach * 0.8; // 剑气弧度半径（越大越宽广）
                    renderable.width = 25; // 剑气的厚度
                    renderable.height = reach * 1.5; // 用于碰撞判定的高度
                }
                const proj = aura.getComponent(Projectile);
                if (proj) {
                    proj.damage = dmg;
                    proj.isCrit = isCrit;
                    proj.isSuperCrit = dmgResult.isSuperCrit;
                    proj.reaperStrike = isReaperStrike;
                    proj.pierceCount = 9999;
                    proj.life = 25; // 剑气波存活时间，发射一段距离后消失
                    (proj as any).isAwakened = true;
                }
                this.addEntityCallback(aura);
            }
            
            return;
        }

        // 散弹枪觉醒：连续喷射 3 次
        let count = config.count + (stats ? stats.bulletCountBonus : 0);
        if (config.type === 'shotgun' && stats?.hasSkill('mastery_shotgun')) {
            count *= 2;
        }
        if (config.type === 'mine' && stats?.hasSkill('mastery_mine')) {
            count = 4;
        }
        
        // ================= 觉醒：丝带风暴 =================
        let ribbonSpreadOverride = 0;
        if (config.type === 'ribbon' && stats?.hasSkill('mastery_ribbon')) {
            count = 5;
            weapon.cooldown = Math.max(1, Math.floor(weapon.cooldown * 0.3)); // 射速极大提升
            ribbonSpreadOverride = 1.0; // 极宽区域
        }

        const burstCount = (config.type === 'shotgun' && stats?.hasSkill('mastery_shotgun')) ? 3 : 1;
        const burstDelay = 100;

        for (let b = 0; b < burstCount; b++) {
            setTimeout(() => {
                if (!owner.active || owner.tags.has('magic_piloting')) return;
                
                if (config.type === 'shotgun' && burstCount > 1) {
                    const pCtrl = owner.getComponent(PlayerControl);
                    if (pCtrl) {
                        pCtrl.recoilFrames = 5;
                        pCtrl.recoilSpeed = 12; 
                        pCtrl.recoilDirX = -Math.cos(transform.rotation);
                        pCtrl.recoilDirY = -Math.sin(transform.rotation);
                    } else {
                        const pT = owner.getComponent(Transform);
                        if (pT) {
                            pT.x -= Math.cos(transform.rotation) * 20;
                            pT.y -= Math.sin(transform.rotation) * 20;
                        }
                    }
                }

                for (let i = 0; i < count; i++) {
                    let spread = (Math.random() - 0.5) * config.spread * weapon.spreadMul;
                    if (ribbonSpreadOverride > 0) {
                        spread = (Math.random() - 0.5) * ribbonSpreadOverride;
                    }
            
            let angle = transform.rotation + spread;
            let spawnX = transform.x;
            let spawnY = transform.y;

            if (config.type === 'mine' && stats?.hasSkill('mastery_mine')) {
                angle = (i * Math.PI / 2);
                spawnX += Math.cos(angle) * 50;
                spawnY += Math.sin(angle) * 50;
            }

            // Create bullet entity
            const bullet = BulletFactory.create(
                config,
                spawnX,
                spawnY,
                angle,
                bulletColor, // Use bulletColor
                owner.id,
                weapon.speedMul,
                stats ? stats.trailWidthMultiplier : 1.0
            );
            const renderable = bullet.getComponent(Renderable);
            if (renderable) {
                renderable.zIndex = owner.tags.has('player') ? 50 : 60;
                if (config.type === 'ruler' && stats?.hasSkill('mastery_ruler')) {
                    renderable.width *= 3;
                    renderable.height *= 3;
                }
                if (config.type === 'compass' && stats?.hasSkill('mastery_compass')) {
                    renderable.radius *= 3;
                }
                // FIX: Flamethrower uses particle color inside factory, but shape needs to be safe
                // The factory assigns specific renderables. We don't want to break it here.
            }
            const proj = bullet.getComponent(Projectile);
            if (proj) {
                const idx = weapon.currentWeaponIndex;
                const bonus = weapon.damageBonus[idx] || 0;
                const dmgResult = getDamage(proj.damage, bonus);
                proj.damage = dmgResult.damage;
                proj.isCrit = dmgResult.isCrit;
                proj.pierceCount = weapon.pierceCount + (stats ? stats.pierceBonus : 0) + dmgResult.bonusPierce;
                if (config.type === 'rocket') {
                    proj.explosionRadiusScale = weapon.explosionRadiusScale;
                }
                if (config.type === 'chain') {
                    proj.pierceCount = 3 + dmgResult.bonusPierce;
                }
                if (config.type === 'flamethrower' && stats?.hasSkill('mastery_flamethrower')) {
                    proj.life *= 6;
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'ruler' && stats?.hasSkill('mastery_ruler')) {
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'compass' && stats?.hasSkill('mastery_compass')) {
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'rocket' && stats?.hasSkill('mastery_rocket')) {
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'chain' && stats?.hasSkill('mastery_chain')) {
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'mine' && stats?.hasSkill('mastery_mine')) {
                    (proj as any).isAwakened = true;
                }
                if (config.type === 'gravity' && stats?.hasSkill('mastery_vortex')) {
                    (proj as any).isAwakened = true;
                    proj.life *= 2; // 持续时间翻倍
                    const renderable = bullet.getComponent(Renderable);
                    if (renderable) {
                        renderable.radius *= 3; // 体型扩大3倍
                    }
                }
                if (config.id === 0) { // Pistol
                    proj.life = Math.floor((config.range || 600) / (config.speed * weapon.speedMul || 9));
                    if (stats?.hasSkill('mastery_pistol')) {
                        (proj as any).isAwakened = true;
                    }
                }
                if (config.type === 'ribbon' && stats?.hasSkill('mastery_ribbon')) {
                    (proj as any).isAwakened = true;
                }
                (proj as any).isAwakened = (proj as any).isAwakened || false;
                
                if (stats && stats.hasCalligrapherPassive) {
                    proj.calligrapherBonus = true;
                }
            }
            
            this.addEntityCallback(bullet);
        }
            }, b * burstDelay);
        }
    }
    
    private startReload(player: Entity, weapon: Weapon, stats?: PlayerStats) {
        if (weapon.reloading) return;
        const cfg = weapon.config;
        if (!cfg) return;
        weapon.reloading = true;
        const reloadTransform = player.getComponent(Transform);
        emitGameSound('reload', { x: reloadTransform?.x, y: reloadTransform?.y });
        const reloadMul = stats ? weapon.reloadTimeMul / stats.totalReloadMultiplier : weapon.reloadTimeMul;
        const rt = Math.max(1, Math.floor(cfg.reloadTime * reloadMul));
        weapon.reloadTimer = rt;
        weapon.cooldown = rt;

        if (stats) {
            const transform = player.getComponent(Transform);
            if (!transform) return;

            // 1. 图钉禁锢 (reload_thumbtack)
            const thumbtackLevel = stats.getSkillLevel('reload_thumbtack');
            if (thumbtackLevel > 0) {
                // 将自身周围小范围内的所有敌人钉住 2/3/4 秒
                const radius = thumbtackLevel === 1 ? 150 : (thumbtackLevel === 2 ? 250 : 400);
                const duration = thumbtackLevel === 1 ? 120 : (thumbtackLevel === 2 ? 180 : 240); // 2/3/4 seconds
                for (const e of this.entities) {
                    if (!e.active || !e.hasComponent(EnemyBehavior) || e.tags.has('ink_dummy')) continue;
                    const et = e.getComponent(Transform);
                    if (et) {
                        const dist = Math.hypot(et.x - transform.x, et.y - transform.y);
                        if (dist <= radius) {
                            const eb = e.getComponent(EnemyBehavior);
                            if (eb) eb.frozenFrames = duration;
                        }
                    }
                }
            }

            // 2. 颜料倾倒 (reload_pigment_dump)
            const pigmentLevel = stats.getSkillLevel('reload_pigment_dump');
            if (pigmentLevel > 0) {
                // 在脚下留下一摊毒水，持续 5 秒，造成基础伤害
                const radius = pigmentLevel === 1 ? 80 : 150;
                const damageMult = pigmentLevel >= 2 ? 1.5 : 1.0;
                const slowFactor = pigmentLevel >= 3 ? 0.5 : 1.0; // 0.5 意味着移速降低 50%
                const damagePerFrame = (cfg.damage * damageMult) / 30; // 假设每秒2次基础伤害？或者直接/30每帧伤害

                if (this.addEntityCallback) {
                    const puddleEntity = new Entity();
                    puddleEntity.addComponent(new Transform(transform.x, transform.y));
                    puddleEntity.addComponent(new Puddle(radius, 300, 300, damagePerFrame, slowFactor, 'rgba(128, 0, 128, 0.4)'));
                    puddleEntity.addComponent(new Renderable('rgba(128, 0, 128, 0.4)', radius, 0, 0, 'circle'));
                    this.addEntityCallback(puddleEntity);
                }
            }

            // 3. 圆规冲刺 (reload_compass_dash)
            const compassDashLevel = stats.getSkillLevel('reload_compass_dash');
            if (compassDashLevel > 0) {
                const idx = weapon.currentWeaponIndex;
                if (weapon.ammo[idx] <= 0) {
                    const pc = player.getComponent(PlayerControl);
                    if (pc) {
                        // 1级精确位移1个黑底像素格(100像素)，2/3级精确位移2个像素格(200像素)
                        // 极快速度：设置极短的帧数（3帧，即0.05秒），实现"唰"一下的瞬间冲刺
                        const isHighLevel = compassDashLevel >= 2;
                        pc.dashFrames = 3;
                        emitGameSound('dash', { x: transform.x, y: transform.y });
                        pc.dashSpeed = isHighLevel ? (200 / 3) : (100 / 3);
                        
                        // Determine dash direction from movement input or rotation
                        let dx = 0, dy = 0;
                        if (this.input.isKeyDown('w')) dy -= 1;
                        if (this.input.isKeyDown('s')) dy += 1;
                        if (this.input.isKeyDown('a')) dx -= 1;
                        if (this.input.isKeyDown('d')) dx += 1;
                        
                        if (dx === 0 && dy === 0) {
                            // If no input, dash towards mouse
                            dx = Math.cos(transform.rotation);
                            dy = Math.sin(transform.rotation);
                        } else {
                            const len = Math.hypot(dx, dy);
                            dx /= len; dy /= len;
                        }
                        
                        pc.dashDirX = dx;
                        pc.dashDirY = dy;
                        pc.dashInvincible = compassDashLevel >= 3;
                        
                        // 产生沿途 Puddle 造成伤害和减速 (半圆效果这里用一系列圆形 Puddle 模拟)
                        if (this.addEntityCallback) {
                            const slowFactor = compassDashLevel === 1 ? 0.7 : (compassDashLevel === 2 ? 0.5 : 0.2); // 30%, 50%, 80% reduction
                            
                            // 圈的大小也精确匹配格子大小（半径50即直径100为一个格子，半径100即直径200为两个格子）
                            const finalRadius = isHighLevel ? 100 : 50; 
                            const puddleEntity = new Entity();
                            // Transform 设置为 transform.x, transform.y (即玩家当前脚下)
                            puddleEntity.addComponent(new Transform(transform.x, transform.y));
                            puddleEntity.addComponent(new Puddle(finalRadius, 60, 60, cfg.damage / 10, slowFactor, 'rgba(0, 200, 255, 0.4)'));
                            puddleEntity.addComponent(new Renderable('rgba(0, 200, 255, 0.4)', finalRadius, 0, 0, 'circle'));
                            this.addEntityCallback(puddleEntity);
                        }
                    }
                }
            }

            // 4. 灵感爆发 (reload_inspiration)
            const inspirationLevel = stats.getSkillLevel('reload_inspiration');
            if (inspirationLevel > 0) {
                // Add a dynamic property to weapon to mark next shot as inspired
                (weapon as any).inspirationLevel = inspirationLevel;
            }
        }
    }

    private handleEnemyDeath(enemy: Entity, player: Entity): void {
        const eTransform = enemy.getComponent(Transform);
        const eRender = enemy.getComponent(Renderable);
        const x = eTransform ? eTransform.x : 0;
        const y = eTransform ? eTransform.y : 0;
        const color = eRender ? eRender.color : '#ffffff';
        DeathHandler.handleEnemyDeath(enemy, player, x, y, color, this.entities, this.addEntityCallback);
    }
}
