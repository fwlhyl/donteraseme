import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { InputManager } from '../core/InputManager';
import { Transform } from '../components/Transform';
import { Skill } from '../components/Skill';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { ParticleFactory } from '../entities/ParticleFactory';
import { XPOrbFactory } from '../entities/XPOrbFactory';

import { Renderable } from '../components/Renderable';
import { Experience } from '../components/Experience';
import { Stunned } from '../components/Stunned';
import { Score } from '../components/Score';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { PlayerStats } from '../components/PlayerStats';
import { DamageTextSystem } from './DamageTextSystem';
import { Paperclip } from '../components/Paperclip';
import { emitGameSound } from '../audio/AudioEvents';

export class SkillSystem extends System {
    constructor(
        private input: InputManager,
        private trailCtx: CanvasRenderingContext2D,
        private camera: { x: number, y: number, shakeX: number, shakeY: number, shakeTimer: number },
        private addEntityCallback: (entity: Entity) => void,
        private worldWidth: number = 3200,
        private worldHeight: number = 2400
    ) {
        super();
        window.addEventListener('tool-select', (e: any) => {
            const id = e.detail?.id as ('curve'|'symmetry'|'eraser'|'pin'|'explosion');
            if (!id) return;
            for (const ent of this.entities) {
                if (!ent.tags.has('player')) continue;
                const sk = ent.getComponent(Skill);
                const ex = ent.getComponent(Experience);
                const lvl = ex ? ex.level : 0;
                const conf = this.getToolSettings(id);
                if (lvl < conf.unlock) {
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：${this.getToolName(id)} Lv${conf.unlock}` } }));
                    continue;
                }
                if (sk) {
                    sk.activeTool = id;
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: `已选择：${this.getToolName(id)}（F触发）` } }));
                }
            }
        });

        window.addEventListener('skill-trigger', (e: any) => {
            const { skill, dirX, dirY, x, y, entityId } = e.detail;
            if (skill === 'move_mirror') {
                this.triggerMoveMirror(dirX, dirY, x, y, entityId);
            }
        });
    }

    public override setWorldSize(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
    }

    public update(dt: number): void {
        // 1. Update Camera Shake
        if (this.camera.shakeTimer > 0) {
            this.camera.shakeTimer -= dt;
            if (this.camera.shakeTimer <= 0) {
                this.camera.shakeX = 0;
                this.camera.shakeY = 0;
            } else {
                this.camera.shakeX = (Math.random() - 0.5) * 20;
                this.camera.shakeY = (Math.random() - 0.5) * 20;
            }
        }

        // 2. Handle Skill Logic
        for (const entity of this.entities) {
            const skill = entity.getComponent(Skill);
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            const exp = entity.getComponent(Experience);
            const stats = entity.getComponent(PlayerStats);

            if (stats && stats.characterId === 'classical' && !stats.hasClassicalShield) {
                if (stats.shieldCooldownFrames > 0) {
                    stats.shieldCooldownFrames--;
                    if (stats.shieldCooldownFrames <= 0) {
                        stats.hasClassicalShield = true;
                        
                        // 古典油画家觉醒1：不朽名作 (护盾最高可达3层，冷却缩短至10秒)
                        if (stats.hasSkill('awakening_classical_1')) {
                            stats.maxShieldCooldownFrames = 600; // 10秒
                            stats.maxClassicalShieldStacks = 3;
                            
                            if (stats.classicalShieldStacks < stats.maxClassicalShieldStacks) {
                                stats.classicalShieldStacks++;
                                // 如果没满，继续冷却下一层
                                if (stats.classicalShieldStacks < stats.maxClassicalShieldStacks) {
                                    stats.shieldCooldownFrames = stats.maxShieldCooldownFrames;
                                    stats.hasClassicalShield = false; // 只有在满层或有层数时才是 true，这里我们用层数逻辑
                                }
                            }
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `厚涂护盾 +1！(当前 ${stats.classicalShieldStacks} 层)` } }));
                        } else {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `厚涂护盾已就绪！` } }));
                        }
                    }
                }
            } else if (stats && stats.characterId === 'classical' && stats.hasClassicalShield) {
                // 如果已经有护盾，且学了觉醒1，检查是否需要继续叠加层数
                if (stats.hasSkill('awakening_classical_1') && stats.classicalShieldStacks < stats.maxClassicalShieldStacks) {
                    stats.maxShieldCooldownFrames = 600;
                    if (stats.shieldCooldownFrames > 0) {
                        stats.shieldCooldownFrames--;
                    } else {
                        stats.classicalShieldStacks++;
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `厚涂护盾 +1！(当前 ${stats.classicalShieldStacks} 层)` } }));
                        if (stats.classicalShieldStacks < stats.maxClassicalShieldStacks) {
                            stats.shieldCooldownFrames = stats.maxShieldCooldownFrames;
                        }
                    }
                }
            }

            if (stats) {
                // gadget_paperclip logic
                const paperclipLevel = stats.getSkillLevel('gadget_paperclip');
                if (paperclipLevel > 0 && transform) {
                    if (stats.paperclipTimer > 0) {
                        stats.paperclipTimer--;
                    } else {
                        // Drop a paperclip
                        const interval = paperclipLevel === 1 ? 600 : (paperclipLevel === 2 ? 480 : 300); // 10s, 8s, 5s at 60fps
                        stats.paperclipTimer = interval;
                        
                        if (this.addEntityCallback) {
                            const clip = new Entity();
                            clip.tags.add('paperclip');
                            clip.addComponent(new Transform(transform.x, transform.y));
                            // Paperclip is a small rect
                            clip.addComponent(new Renderable('#cccccc', 0, 8, 16, 'rect'));
                            clip.addComponent(new Paperclip());
                            // Add some specific paperclip component if needed, or just tags
                            this.addEntityCallback(clip);
                        }
                    }
                }

                // defense_shield cooldown
                if (!stats.hasOrigamiShield && stats.hasSkill('defense_shield')) {
                    if (stats.origamiShieldCooldownFrames > 0) {
                        stats.origamiShieldCooldownFrames--;
                    } else {
                        stats.hasOrigamiShield = true;
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `折纸盾牌已生成！` } }));
                    }
                }

                // defense_dummy cooldown and buff
                if (stats.dummyCooldownFrames > 0) {
                    stats.dummyCooldownFrames--;
                }
                if (stats.dummySpeedBuffFrames > 0) {
                    stats.dummySpeedBuffFrames--;
                    if (stats.dummySpeedBuffFrames <= 0) {
                        stats.speedMultiplier -= 0.5; // remove temporary speed up
                    }
                }

                // defense_desperate_explosion cooldown
                if (stats.explosionCooldownFrames > 0) {
                    stats.explosionCooldownFrames--;
                }

                if (stats.hedgehogCooldownFrames > 0) {
                    stats.hedgehogCooldownFrames--;
                }
            }

            if (!skill || !transform) continue;

            // Reduce cooldown
            if (skill.cooldown > 0) {
                skill.cooldown -= 1; // Decrement per frame (approx 60fps)
            }

            // Shared tool cooldown
            if (skill.toolCooldown > 0) skill.toolCooldown -= 1;
            
            // Unified tool trigger: F
            if (this.input.isKeyDown('f') || this.input.isKeyDown('F')) {
                const level = exp?.level ?? 0;
                if (skill.activeTool === 'curve') {
                    const conf = this.getToolSettings('curve');
                    if (level < conf.unlock) {
                        if (skill.toolCooldown <= 0) {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：画圆 Lv${conf.unlock}` } }));
                            skill.toolCooldown = 45;
                        }
                    } else if (skill.toolCooldown <= 0) {
                        const mx = this.input.mouse.x + this.camera.x;
                        const my = this.input.mouse.y + this.camera.y;
                        const r = Math.max(12, Math.hypot(mx - transform.x, my - transform.y));
                        this.trailCtx.save();
                        this.trailCtx.strokeStyle = renderable ? renderable.color : '#ffffff';
                        this.trailCtx.lineWidth = 6;
                        this.trailCtx.beginPath();
                        this.trailCtx.arc(transform.x, transform.y, r, 0, Math.PI * 2);
                        this.trailCtx.stroke();
                        this.trailCtx.restore();
                        // Damage enemies touching the ring at the instant
                        const thickness = 12;
                        for (const target of this.entities) {
                            if (!target.active || target.tags.has('player') || target.tags.has('ink_dummy')) continue;
                            const eb = target.getComponent(EnemyBehavior);
                            const tt = target.getComponent(Transform);
                            const hp = target.getComponent(Health);
                            if (!eb || !tt || !hp) continue;
                            const d = Math.hypot(tt.x - transform.x, tt.y - transform.y);
                            if (Math.abs(d - r) <= thickness) {
                                hp.current -= 40;
                                emitGameSound('hit-heavy', { x: tt.x, y: tt.y });
                                if (hp.current <= 0) {
                                    target.active = false;
                                    emitGameSound('kill', { x: tt.x, y: tt.y });
                                    const exp = entity.getComponent(Experience);
                                    if (exp && this.addEntityCallback) {
                                        XPOrbFactory.drop(tt.x, tt.y, 20, this.entities, this.addEntityCallback);
                                    }
                                    const score = entity.getComponent(Score);
                                    if (score) {
                                        score.value += 10;
                                        score.coins += 5;
                                    }
                                }
                            }
                        }
                        skill.curveStage = 0;
                        skill.toolCooldown = conf.cd;
                        emitGameSound('skill', { x: transform.x, y: transform.y });
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `画圆（命中伤害）` } }));
                    }
                } else if (skill.activeTool === 'symmetry') {
                    const conf = this.getToolSettings('symmetry');
                    if (level < conf.unlock) {
                        if (skill.toolCooldown <= 0) {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：对称镜像 Lv${conf.unlock}` } }));
                            skill.toolCooldown = 45;
                        }
                    } else if (skill.toolCooldown <= 0) {
                        skill.symmetryFrames = 180;
                        skill.symmetryAxisX = transform.x;
                        skill.toolCooldown = conf.cd;
                        emitGameSound('skill', { x: transform.x, y: transform.y });
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `对称镜像启动` } }));
                    }
                } else if (skill.activeTool === 'eraser') {
                    const conf = this.getToolSettings('eraser');
                    if (level < conf.unlock) {
                        if (skill.toolCooldown <= 0) {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：橡皮盾 Lv${conf.unlock}` } }));
                            skill.toolCooldown = 45;
                        }
                    } else if (skill.toolCooldown <= 0) {
                        skill.eraserShieldFrames = 240;
                        skill.toolCooldown = conf.cd;
                        emitGameSound('shield', { x: transform.x, y: transform.y });
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `橡皮盾开启` } }));
                    }
                } else if (skill.activeTool === 'pin') {
                    const conf = this.getToolSettings('pin');
                    if (level < conf.unlock) {
                        if (skill.toolCooldown <= 0) {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：定点钉住 Lv${conf.unlock}` } }));
                            skill.toolCooldown = 45;
                        }
                    } else if (skill.toolCooldown <= 0) {
                        const radius = 220;
                        for (const target of this.entities) {
                            if (!target.active || target === entity) continue;
                            const eb = target.getComponent(EnemyBehavior);
                            const tt = target.getComponent(Transform);
                            if (!eb || !tt) continue;
                            const d = Math.hypot(tt.x - transform.x, tt.y - transform.y);
                            if (d <= radius) {
                                target.addComponent(new Stunned(120));
                            }
                        }
                        skill.toolCooldown = conf.cd;
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `定点钉住` } }));
                        emitGameSound('skill', { x: transform.x, y: transform.y });
                    }
                } else if (skill.activeTool === 'explosion') {
                    const conf = this.getToolSettings('explosion');
                    if (level < conf.unlock) {
                        if (skill.toolCooldown <= 0) {
                            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `未解锁：爆炸 Lv${conf.unlock}` } }));
                            skill.toolCooldown = 45;
                        }
                    } else if (skill.toolCooldown <= 0) {
                        const prev = skill.cooldown;
                        this.activateSkill(entity, skill, transform, renderable ? renderable.color : '#ffffff');
                        skill.cooldown = prev; // keep Space cooldown unaffected; use tools' shared cooldown
                        skill.toolCooldown = conf.cd;
                        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `爆炸` } }));
                    }
                }
            }

            // Per-frame tool effects
            if (skill.symmetryFrames > 0 && renderable) {
                // Decrement frames and draw mirrored trail point
                skill.symmetryFrames -= 1;
                const mx = skill.symmetryAxisX - (transform.x - skill.symmetryAxisX);
                this.trailCtx.save();
                this.trailCtx.globalAlpha = 0.6;
                this.trailCtx.fillStyle = renderable.color;
                this.trailCtx.beginPath();
                this.trailCtx.arc(mx, transform.y, 6, 0, Math.PI * 2);
                this.trailCtx.fill();
                this.trailCtx.restore();
                // Record latest mirrored position for teleport
                skill.symmetryLastX = mx;
                skill.symmetryLastY = transform.y;
                // When timer ends, teleport player to the end of mirrored path
                if (skill.symmetryFrames === 0) {
                    transform.x = skill.symmetryLastX;
                    transform.y = skill.symmetryLastY;
                    emitGameSound('dash', { x: transform.x, y: transform.y });
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: `镜像位移` } }));
                }
            }
            if (skill.eraserShieldFrames > 0) {
                skill.eraserShieldFrames -= 1;
                this.trailCtx.save();
                this.trailCtx.globalCompositeOperation = 'destination-out';
                this.trailCtx.beginPath();
                this.trailCtx.arc(transform.x, transform.y, 60, 0, Math.PI * 2);
                this.trailCtx.fillStyle = 'rgba(0,0,0,1)';
                this.trailCtx.fill();
                this.trailCtx.restore();
            }

            // Check Input（Space爆炸已移除，保留Tab圆盘的爆炸 via F）
        }
    }

    private getToolName(id: 'curve'|'symmetry'|'eraser'|'pin'|'explosion'): string {
        if (id === 'curve') return '画圆';
        if (id === 'symmetry') return '对称镜像';
        if (id === 'eraser') return '橡皮盾';
        if (id === 'explosion') return '爆炸';
        return '定点钉住';
    }

    private triggerMoveMirror(dirX: number, dirY: number, startX: number, startY: number, entityId: string): void {
        const player = Array.from(this.entities).find(e => e.id === entityId);
        if (!player) return;
        
        const stats = player.getComponent(PlayerStats);
        const transform = player.getComponent(Transform);
        if (!stats || !transform) return;

        const level = stats.getSkillLevel('move_mirror');
        if (level === 0) return;

        // 传送距离
        // 向后反穿（回马枪）：因为是在风筝身后的敌人，所以位移方向改为与当前移动方向相反 (-dirX, -dirY)
        const distance = 400;
        let endX = startX - dirX * distance;
        let endY = startY - dirY * distance;

        // 边界检测 - 改为“镜像”反弹，完美契合“镜像位移”的主题！
        // 如果玩家在地图边缘触发，向外传送的部分会折射回地图内
        if (endX < 0) {
            endX = -endX;
        } else if (endX > this.worldWidth) {
            endX = this.worldWidth - (endX - this.worldWidth);
        }

        if (endY < 0) {
            endY = -endY;
        } else if (endY > this.worldHeight) {
            endY = this.worldHeight - (endY - this.worldHeight);
        }

        // 执行传送
        // 直接修改 player 实体的 Transform 组件坐标，它会自动同步给渲染系统
        transform.x = endX;
        transform.y = endY;
        emitGameSound('dash', { x: transform.x, y: transform.y });
        
        // 由于我们在处理事件时可能已经离开了主循环更新，
        // 或者 Transform 未被完全应用到渲染中，我们可以再通过事件发射一个粒子特效来强调传送
        if (this.trailCtx) {
            this.trailCtx.save();
            this.trailCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.trailCtx.beginPath();
            this.trailCtx.arc(startX, startY, 30, 0, Math.PI * 2);
            this.trailCtx.fill();
            this.trailCtx.restore();
        }
        
        // 沿途切割敌人：因为反穿进了怪堆，如果切割宽度太窄可能导致落地被围殴，所以这里适当加宽切割判定范围（从40提升到80），甚至满级可以更宽
        const baseDamage = 50 * stats.totalDamageMultiplier * (level === 3 ? 2 : 1);
        const cutWidth = level === 3 ? 120 : 80;
        let hitCount = 0;

        for (const enemy of this.entities) {
            if (!enemy.active || !enemy.tags.has('enemy') || enemy.tags.has('ink_dummy')) continue;
            const eTransform = enemy.getComponent(Transform);
            const eHealth = enemy.getComponent(Health);
            const eBeh = enemy.getComponent(EnemyBehavior);
            if (!eTransform || !eHealth) continue;

            // 简单线段检测：点到线段的距离
            const dx = endX - startX;
            const dy = endY - startY;
            const l2 = dx * dx + dy * dy;
            if (l2 === 0) continue;
            
            const t = Math.max(0, Math.min(1, ((eTransform.x - startX) * dx + (eTransform.y - startY) * dy) / l2));
            const projX = startX + t * dx;
            const projY = startY + t * dy;
            const dist = Math.hypot(eTransform.x - projX, eTransform.y - projY);
            
            if (dist < cutWidth) { // 切割宽度
                eHealth.current -= baseDamage;
                if (baseDamage > 0) emitGameSound('hit-heavy', { x: eTransform.x, y: eTransform.y });
                hitCount++;
                DamageTextSystem.addDamageText(eTransform.x, eTransform.y - 20, baseDamage, '#ffffff', false);
                
                // 处理敌人死亡逻辑
                if (eHealth.current <= 0) {
                    enemy.active = false;
                    emitGameSound('kill', { x: eTransform.x, y: eTransform.y });
                    
                    // 增加金币和分数
                    const score = player.getComponent(Score);
                    if (score && eBeh) {
                        score.value += 10;
                        const t_type = eBeh.type || 'chaser';
                        let baseGold = 1;
                        if (t_type === 'boss') baseGold = 100;
                        else if (t_type !== 'chaser') baseGold = 5;
                        
                        let goldMultiplier = 1;
                        if (stats.characterId === 'collector') {
                            goldMultiplier += stats.survivalTime * 0.005;
                        }
                        const finalGold = Math.ceil(baseGold * goldMultiplier);
                        score.coins += finalGold;
                        stats.gold += finalGold;
                    }
                    
                    // 掉落经验球
                    if (eBeh) {
                        const orbVal = eBeh.type === 'boss' ? 50 : (eBeh.type === 'chaser' ? 1 : 5);
                        XPOrbFactory.drop(eTransform.x, eTransform.y, orbVal, this.entities, this.addEntityCallback);
                    }
                }
            }
        }

        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `镜像反穿！切割了 ${hitCount} 个敌人` } }));
        
        // 留下一道视觉特效线 (加粗，并且使用不同颜色或复合特效让玩家清楚是向后穿了)
        if (this.trailCtx) {
            this.trailCtx.save();
            // 底色粗线
            this.trailCtx.strokeStyle = 'rgba(255, 100, 255, 0.4)';
            this.trailCtx.lineWidth = cutWidth * 2;
            this.trailCtx.lineCap = 'round';
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(startX, startY);
            this.trailCtx.lineTo(endX, endY);
            this.trailCtx.stroke();
            
            // 核心白线
            this.trailCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            this.trailCtx.lineWidth = 15;
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(startX, startY);
            this.trailCtx.lineTo(endX, endY);
            this.trailCtx.stroke();
            
            this.trailCtx.restore();
        }

        // Emit particles at start and end
        const p1 = ParticleFactory.createExplosion(startX, startY, '#ffffff', 15);
        const p2 = ParticleFactory.createExplosion(endX, endY, '#ffffff', 15);
        p1.forEach(p => this.addEntityCallback(p));
        p2.forEach(p => this.addEntityCallback(p));
    }

    private getToolSettings(id: 'curve'|'pin'|'symmetry'|'eraser'|'explosion'): { unlock: number, cd: number } {
        if (id === 'curve') return { unlock: 10, cd: 300 };      // 5s
        if (id === 'pin') return { unlock: 15, cd: 480 };        // 8s
        if (id === 'symmetry') return { unlock: 20, cd: 660 };   // 11s
        if (id === 'eraser') return { unlock: 25, cd: 840 };     // 14s
        return { unlock: 30, cd: 1020 };                         // explosion 17s
    }

    private activateSkill(player: Entity, skill: Skill, transform: Transform, color: string): void {
        skill.cooldown = skill.maxCooldown;
        emitGameSound('explosion', { x: transform.x, y: transform.y });
        
        // 1. Visual Effect: Splatter on Trail Canvas (Player Color)
        // User: "Explosion skill player itself leaves no trace".
        // Wait: "Explosion skill player no trace... and enemy traces are red".
        // Re-reading: "5: Player's explosion skill needs to be visible... form round explosion ink effect... enemies receiving damage also leave explosion ink effect."
        // User Complaint 2: "Explosion skill player itself no trace".
        // So I MUST draw player trace.
        this.drawSplatter(transform.x, transform.y, color);

        // 2. Gameplay Effect: Damage Enemies
        // We need to iterate ALL entities to find enemies.
        // Since this.entities contains ALL entities in the game (as registered in Game.ts), we can iterate.
        for (const target of this.entities) {
            if (!target.active || target === player || target.tags.has('ink_dummy')) continue;
            
            const enemy = target.getComponent(EnemyBehavior);
            const targetTransform = target.getComponent(Transform);
            const health = target.getComponent(Health);

            if (enemy && targetTransform) {
                const dist = Math.hypot(transform.x - targetTransform.x, transform.y - targetTransform.y);
                
                if (dist < skill.radius + 20) { // +20 for enemy radius approximation
                    // Apply Damage
                    if (health) {
                        health.current -= skill.damage;
                        if (skill.damage > 0) emitGameSound('hit-heavy', { x: targetTransform.x, y: targetTransform.y });
                        DamageTextSystem.addDamageText(targetTransform.x, targetTransform.y - 15, skill.damage, '#ffffff', false);
                        if (health.current <= 0) {
                            target.active = false;
                            emitGameSound('kill', { x: targetTransform.x, y: targetTransform.y });
                            
                            // 增加金币和分数
                            const score = player.getComponent(Score);
                            const stats = player.getComponent(PlayerStats);
                            if (score) {
                                score.value += 10;
                                const t = enemy.type || 'chaser';
                                let baseGold = 1;
                                if (t === 'boss') baseGold = 100;
                                else if (t !== 'chaser') baseGold = 5;
                                
                                let goldMultiplier = 1;
                                if (stats) {
                                    if (stats.characterId === 'collector') {
                                        goldMultiplier += stats.survivalTime * 0.005;
                                    }
                                    const finalGold = Math.ceil(baseGold * goldMultiplier);
                                    score.coins += finalGold;
                                    stats.gold += finalGold;
                                } else {
                                    score.coins += baseGold;
                                }
                            }
                            const exp = player.getComponent(Experience);
                                    if (exp && this.addEntityCallback) {
                                        XPOrbFactory.drop(transform.x, transform.y, 20, this.entities, this.addEntityCallback);
                                    }
                            
                            // Spawn Particles
                            const particles = ParticleFactory.createExplosion(
                                targetTransform.x, 
                                targetTransform.y, 
                                '#ff0000', // Enemy color usually
                                15 // Count
                            );
                            particles.forEach(p => this.addEntityCallback(p));
                            
                            // Draw Blood on Trail Canvas (Enemy Color)
                            // User: "Explosion skill... enemy leaves explosion ink marks"
                            // User: "Enemies traces are red, should be enemy color".
                            // I used '#ff0000' hardcoded.
                            const enemyRender = target.getComponent(Renderable);
                            const enemyColor = enemyRender ? enemyRender.color : '#ff0000';
                            
                            this.drawBlood(targetTransform.x, targetTransform.y, enemyColor);
                            
                            // Draw Splatter for enemy death by skill
                            // this.drawSplatter(targetTransform.x, targetTransform.y, '#ff0000'); // Redundant if drawBlood does it?
                        }
                    }
                }
            }
        }

        // 3. Camera Shake
        this.camera.shakeTimer = 0.2; // 0.2 seconds
    }

    // dash removed

    private drawSplatter(x: number, y: number, color: string): void {
        const count = 20 + Math.random() * 10;
        
        this.trailCtx.save();
        this.trailCtx.fillStyle = color;
        this.trailCtx.globalAlpha = 0.8;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 150; // explosion radius
            const size = 5 + Math.random() * 20;
            
            const sx = x + Math.cos(angle) * dist;
            const sy = y + Math.sin(angle) * dist;

            this.trailCtx.beginPath();
            this.trailCtx.arc(sx, sy, size, 0, Math.PI * 2);
            this.trailCtx.fill();
            
            // Draw connecting lines
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(x, y);
            this.trailCtx.lineTo(sx, sy);
            this.trailCtx.strokeStyle = color;
            this.trailCtx.lineWidth = size / 2;
            this.trailCtx.stroke();
        }
        this.trailCtx.restore();
    }

    private drawBlood(x: number, y: number, color: string): void {
        const drops = 5 + Math.random() * 5;
        this.trailCtx.save();
        this.trailCtx.fillStyle = color;
        this.trailCtx.globalAlpha = 0.6;
        
        for(let i=0; i<drops; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 25; 
            const radius = 5 + Math.random() * 12; 
            
            this.trailCtx.beginPath();
            this.trailCtx.arc(x + Math.cos(angle)*dist, y + Math.sin(angle)*dist, radius, 0, Math.PI*2);
            this.trailCtx.fill();
        }
        this.trailCtx.restore();
    }
}
