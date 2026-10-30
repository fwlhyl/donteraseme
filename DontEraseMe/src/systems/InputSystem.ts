import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { PlayerControl } from '../components/PlayerControl';
import { InputManager } from '../core/InputManager';
import { PlayerStats } from '../components/PlayerStats';
import { SpriteAnimation } from '../components/SpriteAnimation';
import { PlayerAnimation } from '../components/PlayerAnimation';
import { Renderable } from '../components/Renderable';

export class InputSystem extends System {
    constructor(
        private input: InputManager,
        private camera: { x: number, y: number }
    ) {
        super();
    }

    public update(dt: number): void {
        for (const entity of this.entities) {
            if (!entity.hasComponent(PlayerControl)) continue;

            const velocity = entity.getComponent(Velocity)!;
            const control = entity.getComponent(PlayerControl)!;
            const transform = entity.getComponent(Transform)!;
            const stats = entity.getComponent(PlayerStats);

            const calculatedSpeed = stats ? control.speed * stats.speedMultiplier : control.speed;
            
            let currentSpeed = calculatedSpeed;
            if (stats) {
                // 清理过期的 墨滴狂热 (kill_frenzy) buff
                const now = Date.now();
                stats.killFrenzyStacks = stats.killFrenzyStacks.filter(stack => stack.expireTime > now);
                
                // 计算 墨滴狂热 的速度加成
                let frenzySpeedBonus = 0;
                for (const stack of stats.killFrenzyStacks) {
                    frenzySpeedBonus += stack.amount;
                }
                
                // 走位互动系 - 颜料滑板 (move_skateboard)
                let skateboardSpeedBonus = 0;
                const skateboardLevel = stats.getSkillLevel('move_skateboard');
                if (skateboardLevel > 0) {
                    const maxSpeedBonus = skateboardLevel === 1 ? .30 : (skateboardLevel === 2 ? .50 : 1.0);
                    const maxFrames = 180; // Ramp for 3 seconds after the initial 3-second wait.
                    stats.skateboardActive = false;
                    if (!entity.attacking) {
                        stats.skateboardIdleFrames++;
                        stats.skateboardDamageBonus = 0;
                        if (stats.skateboardIdleFrames > 180) {
                            stats.skateboardFrames = Math.min(maxFrames, stats.skateboardFrames + 1);
                            skateboardSpeedBonus = stats.skateboardFrames / maxFrames * maxSpeedBonus;
                            stats.skateboardActive = true;
                        } else {
                            stats.skateboardFrames = 0;
                        }
                    } else {
                        stats.skateboardIdleFrames = 0;
                        const currentBonus = stats.skateboardFrames / maxFrames * maxSpeedBonus;
                        stats.skateboardDamageBonus = skateboardLevel === 3 ? currentBonus * 2 : currentBonus;
                        stats.skateboardFrames = Math.max(0, stats.skateboardFrames - 2);
                    }
                } else {
                    stats.skateboardIdleFrames = 0;
                    stats.skateboardActive = false;
                    stats.skateboardFrames = 0;
                    stats.skateboardDamageBonus = 0;
                }

                // 应用速度加成
                const totalSpeedWithFrenzy = calculatedSpeed * (1 + frenzySpeedBonus + skateboardSpeedBonus);

                // 先重置由速度溢出带来的临时伤害加成
                stats.speedOverflow = Math.max(0, totalSpeedWithFrenzy - 8.0);
                currentSpeed = Math.min(totalSpeedWithFrenzy, 8.0);
            }

            // The bomber is a piloted air vehicle: it keeps the player's normal
            // controls but has distinctly higher map traversal speed.
            if (entity.tags.has('magic_piloting_bomber')) {
                currentSpeed *= 1.65;
            }

            // Reset velocity
            velocity.x = 0;
            velocity.y = 0;

            if (control.dashFrames > 0) {
                control.dashFrames--;
                velocity.x = control.dashDirX * control.dashSpeed;
                velocity.y = control.dashDirY * control.dashSpeed;
                
                // Dash effects like invincible are handled elsewhere
            } else if (control.recoilFrames > 0) {
                // 处理武器后坐力
                control.recoilFrames--;
                velocity.x = control.recoilDirX * control.recoilSpeed;
                velocity.y = control.recoilDirY * control.recoilSpeed;
            } else {
                // 书法家：攻击时移速大幅降低
                if (stats && stats.hasCalligrapherPassive && entity.attacking) {
                    currentSpeed *= 0.1;
                }

                // Keyboard input
                if (this.input.isKeyDown('w')) velocity.y -= currentSpeed;
                if (this.input.isKeyDown('s')) velocity.y += currentSpeed;
                if (this.input.isKeyDown('a')) velocity.x -= currentSpeed;
                if (this.input.isKeyDown('d')) velocity.x += currentSpeed;
                
                const mag = Math.hypot(velocity.x, velocity.y);
                if (mag > 0) {
                    velocity.x = (velocity.x / mag) * currentSpeed;
                    velocity.y = (velocity.y / mag) * currentSpeed;
                }
            }
            
            if (stats?.mirrorMovementLocked) {
                velocity.x = 0;
                velocity.y = 0;
                control.dashFrames = 0;
                control.recoilFrames = 0;
                const directionHeld = ['w','a','s','d'].some(key => this.input.isKeyDown(key));
                if (!directionHeld) stats.mirrorMovementLocked = false;
            }
            const isMoving = velocity.x !== 0 || velocity.y !== 0;
            const currentActualSpeed = Math.hypot(velocity.x, velocity.y);
            if (stats) {
                stats.currentSpeed = currentActualSpeed;
                
                // 跑酷大师 (move_parkour) - 移速越高闪避越高，满速(约8)时达到最高
                const parkourLevel = stats.getSkillLevel('move_parkour');
                if (parkourLevel > 0) {
                    const maxDodge = parkourLevel === 1 ? 0.15 : (parkourLevel === 2 ? 0.25 : 0.40);
                    stats.parkourDodgeBonus = Math.min(maxDodge, (currentActualSpeed / 8.0) * maxDodge);
                } else {
                    stats.parkourDodgeBonus = 0;
                }

                // 动如脱兔 (move_rabbit) - 移速越高暴击越高，满速(约8)时达到最高
                const rabbitLevel = stats.getSkillLevel('move_rabbit');
                if (rabbitLevel > 0) {
                    const maxCrit = rabbitLevel === 1 ? 0.15 : (rabbitLevel === 2 ? 0.30 : 0.45);
                    stats.rabbitCritBonus = Math.min(maxCrit, (currentActualSpeed / 8.0) * maxCrit);
                } else {
                    stats.rabbitCritBonus = 0;
                }

                // 静止蓄能 (move_static_charge)
                const staticLevel = stats.getSkillLevel('move_static_charge');
                if (staticLevel > 0) {
                    const chargeTimeFrames = staticLevel === 1 ? 120 : (staticLevel === 2 ? 90 : 60); // 2s, 1.5s, 1s
                    const maxBonus = staticLevel === 1 ? 0.5 : (staticLevel === 2 ? 1.0 : 1.5);
                    if (!isMoving) {
                        stats.staticFrames++;
                        if (stats.staticFrames > chargeTimeFrames) {
                            // 每秒 (60帧) 增加一定伤害（这里设定达到最大值需要2秒）
                            const activeChargeFrames = stats.staticFrames - chargeTimeFrames;
                            stats.staticDamageBonus = Math.min(maxBonus, (activeChargeFrames / 120) * maxBonus);
                        } else {
                            stats.staticDamageBonus = 0;
                        }
                    } else {
                        stats.staticFrames = 0;
                        stats.staticDamageBonus = 0;
                    }
                } else {
                    stats.staticFrames = 0;
                    stats.staticDamageBonus = 0;
                }

                // 镜像位移 (move_mirror)
                const mirrorLevel = stats.getSkillLevel('move_mirror');
                if (mirrorLevel > 0) {
                    if (isMoving) {
                        const mag = Math.hypot(velocity.x, velocity.y);
                        const dirX = velocity.x / mag;
                        const dirY = velocity.y / mag;
                        
                        stats.moveSameDirFrames++;
                        stats.lastMoveDir = { x: dirX, y: dirY };

                        const targetFrames = mirrorLevel === 1 ? 600 : (mirrorLevel === 2 ? 480 : 300); // 10s, 8s, 5s
                        if (stats.moveSameDirFrames >= targetFrames) {
                            // 为了确保传送起点正确，我们传入 transform 的坐标，但不直接修改，而是通过事件让 SkillSystem 去修改
                            // 并且为了避免死循环或误差，在这里重置累计时间
                            stats.moveSameDirFrames = 0; 
                            
                            // 触发镜像位移
                            window.dispatchEvent(new CustomEvent('skill-trigger', { 
                                detail: { 
                                    skill: 'move_mirror',
                                    dirX: stats.lastMoveDir.x,
                                    dirY: stats.lastMoveDir.y,
                                    x: transform.x,
                                    y: transform.y,
                                    entityId: entity.id
                                }
                            }));
                        }
                    } else {
                        stats.moveSameDirFrames = 0;
                        stats.lastMoveDir = { x: 0, y: 0 };
                    }
                } else {
                    stats.moveSameDirFrames = 0;
                }
            }

            // 书法家被动：静止时叠加伤害
            if (stats && stats.hasCalligrapherPassive) {
                if (!isMoving) {
                    stats.calligrapherStackTimer++;
                    if (stats.calligrapherStackTimer >= 15) { // 每0.25秒(15帧)加一层
                        stats.calligrapherDamageStacks = Math.min(stats.maxCalligrapherStacks, stats.calligrapherDamageStacks + 1);
                        stats.calligrapherStackTimer = 0;
                    }
                } else {
                    const isAwakened1 = stats.getSkillLevel('awakening_calligrapher_1') > 0;
                    if (isAwakened1) {
                        stats.calligrapherStackTimer++;
                        if (stats.calligrapherStackTimer >= 6) { // 每0.1秒(6帧)掉落1层，1秒掉落10层
                            stats.calligrapherDamageStacks = Math.max(0, stats.calligrapherDamageStacks - 1);
                            stats.calligrapherStackTimer = 0;
                        }
                    } else {
                        stats.calligrapherDamageStacks = 0;
                        stats.calligrapherStackTimer = 0;
                    }
                }
            }

            // Update rotation based on mouse or auto-attack
            const autoAttack = (window as any).gameInstance?.autoAttackEnabled || false;
            
            // Mouse is in screen coordinates, transform is in world coordinates.
            // We need to convert mouse to world coordinates.
            const mouseWorldX = this.input.mouse.x + this.camera.x;
            const mouseWorldY = this.input.mouse.y + this.camera.y;
            const dx = mouseWorldX - transform.x;
            const dy = mouseWorldY - transform.y;
            
            if (!autoAttack || entity.tags.has('magic_piloting_tank') || entity.tags.has('magic_piloting_robot')) {
                transform.rotation = Math.atan2(dy, dx);
            }

            // 动画状态切换 (方向和移动判断)
            const playerAnim = entity.getComponent(PlayerAnimation);
            const spriteAnim = entity.getComponent(SpriteAnimation);
            const renderable = entity.getComponent(Renderable);
            
            if (playerAnim && spriteAnim && renderable) {
                // 确保不要再被代码翻转了，恢复正数
                renderable.scaleX = Math.abs(renderable.scaleX);

                const isTwoDirection = !!playerAnim.animations['idle_left'] && !!playerAnim.animations['idle_right'] && !playerAnim.animations['dash_down'];

                // 如果当前没有动画名，默认先给一个 idle_left
                if (!playerAnim.currentAnim) {
                    playerAnim.currentAnim = isTwoDirection ? 'idle_left' : 'idle_down';
                }
                
                let animName = playerAnim.currentAnim;
                
                // 处理受击动画计时器
                if (playerAnim.hitTimer > 0) {
                    playerAnim.hitTimer--;
                }

                if (isTwoDirection) {
                    // ===== 真实的 2 方向模式 (美术提供 Left 和 Right) =====
                    const action = (playerAnim.hitTimer > 0 && !!playerAnim.animations['hit_left']) ? 'hit' : (isMoving ? 'dash' : 'idle');
                    
                    // 方向应该由键盘移动速度(velocity)决定，而不是鼠标位置(dx)
                    // 只有在没有移动时，才保持最后的朝向（或者跟随鼠标）
                    let direction = 'left';
                    if (isMoving && playerAnim.hitTimer <= 0) { // 受击时不改变朝向
                        if (velocity.x > 0) {
                            direction = 'right';
                        } else if (velocity.x < 0) {
                            direction = 'left';
                        } else {
                            // 只有上下移动时，保持当前的左右朝向
                            direction = playerAnim.currentAnim.includes('right') ? 'right' : 'left';
                        }
                    } else {
                        // 没移动或受击时，保持停下那一瞬间的朝向
                        direction = playerAnim.currentAnim.includes('right') ? 'right' : 'left';
                    }
                    
                    animName = `${action}_${direction}`;
                } else {
                    // ===== 传统的 6 方向模式 =====
                    if (isMoving) {
                        const angle = Math.atan2(velocity.y, velocity.x); 
                        
                        // 将角度划分为6个方向
                        if (angle > Math.PI / 3 && angle <= 2 * Math.PI / 3) {
                            animName = 'dash_down';
                        } else if (angle >= 0 && angle <= Math.PI / 3) {
                            animName = 'dash_right_down';
                        } else if (angle > -Math.PI / 3 && angle < 0) {
                            animName = 'dash_right_up';
                        } else if (angle > -2 * Math.PI / 3 && angle <= -Math.PI / 3) {
                            animName = 'dash_up';
                        } else if (angle > -Math.PI && angle <= -2 * Math.PI / 3) {
                            animName = 'dash_left_up';
                        } else { 
                            animName = 'dash_left_down';
                        }
                    } else {
                        // 如果没有移动，则根据最后一次移动的方向，将 dash_xxx 替换为 idle_xxx
                        if (animName.startsWith('dash_')) {
                            animName = animName.replace('dash_', 'idle_');
                        }
                    }
                }

                if (playerAnim.currentAnim !== animName) {
                    playerAnim.currentAnim = animName;
                    const animConfig = playerAnim.animations[animName];
                    if (animConfig && animConfig.image && animConfig.image.complete) {
                        spriteAnim.image = animConfig.image;
                        spriteAnim.row = animConfig.row || 0;
                        spriteAnim.totalFrames = animConfig.totalFrames;
                        spriteAnim.frameWidth = animConfig.frameWidth;
                        spriteAnim.frameHeight = animConfig.frameHeight;
                        spriteAnim.currentFrame = 0;
                        spriteAnim.elapsedFrames = 0;
                    }
                }
            }
        }
    }
}
