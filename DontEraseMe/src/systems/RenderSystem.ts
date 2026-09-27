import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Skeleton } from '../components/Skeleton';
import { SpriteAttachments } from '../components/SpriteAttachments';
import { ControlPoint } from '../components/ControlPoint';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Projectile } from '../components/Projectile';
import { Skill } from '../components/Skill';
import { Health } from '../components/Health';
import { PlayerStats } from '../components/PlayerStats';
import { WaterMark } from '../components/WaterMark';
import { Summon } from '../components/Summon';
import { SpriteAnimation } from '../components/SpriteAnimation';

export class RenderSystem extends System {
    private tempCanvas: HTMLCanvasElement;
    private tempCtx: CanvasRenderingContext2D;

    constructor(
        private ctx: CanvasRenderingContext2D,
        private camera: { x: number, y: number },
        private worldWidth: number,
        private worldHeight: number
    ) {
        super();
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d') as CanvasRenderingContext2D;
        
        window.addEventListener('shake', (e: any) => {
            const mag = e.detail?.mag ?? 8;
            const frames = e.detail?.frames ?? 8;
            this.shakeMag = mag;
            this.shakeFrames = frames;
        });
    }

    private historyCache: Map<string, {x: number, y: number}[]> = new Map();
    private shakeFrames: number = 0;
    private shakeMag: number = 0;

    public update(dt: number): void {
        this.ctx.save();

        // 1. Update Camera Position (Follow Player)
        const player = Array.from(this.entities).find(e => e.tags.has('player'));
        if (player) {
            const t = player.getComponent(Transform);
            if (t) {
                // Center camera on player
                this.camera.x = t.x - this.ctx.canvas.width / 2;
                this.camera.y = t.y - this.ctx.canvas.height / 2;

                // Clamp camera to world bounds
                this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldWidth - this.ctx.canvas.width));
                this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldHeight - this.ctx.canvas.height));
            }
        }

        // 2. Draw Background Grid
        this.drawGrid();


        // 3. Render Entities
        // Sort by z-index
        const renderList = Array.from(this.entities).sort((a, b) => {
            const ra = a.getComponent(Renderable);
            const rb = b.getComponent(Renderable);
            if (!ra || !rb) return 0;
            return ra.zIndex - rb.zIndex;
        });

        this.ctx.save();
        
        // Camera Transform with screenshake
        let shakeX = 0, shakeY = 0;
        if (this.shakeFrames > 0) {
            const decay = this.shakeFrames / Math.max(1, (this.shakeMag * 2));
            shakeX = (Math.random() - 0.5) * this.shakeMag * decay;
            shakeY = (Math.random() - 0.5) * this.shakeMag * decay;
            this.shakeFrames -= 1;
        }
        this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);
        
        // Draw World Boundary
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 5;
        this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

        // const player = Array.from(this.entities).find(e => e.tags.has('player')); // Already defined at the top of update()

        for (const entity of renderList) {
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);

            if (!transform || !renderable || !renderable.visible) continue;

            // If this is the player, we should probably update trail canvas here too?
            // No, TrailSystem handles that.

            this.ctx.save();
            
            if (renderable.shape === 'line') {
                this.ctx.beginPath();
                this.ctx.moveTo(transform.x, transform.y);
                this.ctx.lineTo(renderable.width, renderable.height); // width/height used as endX/endY for line
                this.ctx.strokeStyle = renderable.color;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else {
                let drawX = transform.x;
                let drawY = transform.y;
                let rotation = transform.rotation;
                const sk = entity.getComponent(Skeleton);
                if (sk && renderable.attachmentBone) {
                    const bone = sk.getBone(renderable.attachmentBone);
                    if (bone) {
                        drawX = bone.worldX + renderable.offsetX;
                        drawY = bone.worldY + renderable.offsetY;
                        rotation = bone.worldRotation + renderable.attachmentRotationOffset;
                    }
                } else if (sk) {
                    const spine = sk.getBone('spine');
                    if (spine) rotation = spine.worldRotation;
                }
                this.ctx.translate(drawX, drawY);
                
                // Blink if invincible
                let isInvincibleBlink = false;
                if (entity.tags.has('player')) {
                    const health = entity.getComponent(Health);
                    if (health && health.invincibleFrames > 0) {
                        if (Math.floor(Date.now() / 100) % 2 === 0) {
                            isInvincibleBlink = true;
                        }
                    }
                }
                
                if (isInvincibleBlink) {
                    this.ctx.globalAlpha = 0.5;
                }

                // ===== 玩家子弹半透明化处理 =====
                const pData = entity.getComponent(Projectile);
                let isPlayerBullet = false;
                if (pData && pData.ownerId === player?.id) {
                    this.ctx.globalAlpha = (this.ctx.globalAlpha || 1.0) * 0.9; // 玩家弹幕半透明 改回 0.9，不再过度削弱
                    isPlayerBullet = true;
                }

                this.ctx.fillStyle = renderable.color;
                
                // ===== 敌方子弹高对比度描边 =====
                let isEnemyBullet = false;
                if (pData && pData.ownerId !== player?.id) {
                    isEnemyBullet = true;
                }

                if (pData && pData.type === 'melee' && renderable.shape === 'rect' && renderable.color === 'transparent') {
                    // Do not render the invisible melee sweep projectile
                    this.ctx.restore();
                    continue;
                }

                if (renderable.shape === 'sprite' && renderable.image) {
                    const img = renderable.image;
                    const ready = (img as any).complete && (img as any).naturalWidth > 0;
                    if (!ready) {
                        this.ctx.save();
                        this.ctx.scale(renderable.scaleX, renderable.scaleY);
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, renderable.radius, 0, Math.PI * 2);
                        this.ctx.fill();
                        if (entity.tags.has('player')) {
                            this.ctx.stroke();
                            this.ctx.save();
                            this.ctx.rotate(rotation);
                            this.ctx.fillStyle = '#ff0000';
                            this.ctx.fillRect(renderable.radius * 0.8, -5, renderable.radius, 10);
                            this.ctx.restore();
                        }
                        this.ctx.restore();
                    } else {
                        const size = renderable.radius * 3;
                        this.ctx.save();
                        this.ctx.scale(renderable.scaleX, renderable.scaleY);
                        this.ctx.drawImage(img, -size/2, -size/2, size, size);
                        this.ctx.restore();
                        if (entity.tags.has('player')) {
                            this.ctx.save();
                            this.ctx.rotate(rotation);
                            this.ctx.fillStyle = '#ff0000';
                            this.ctx.fillRect(size * 0.3, -5, size * 0.5, 10);
                            this.ctx.restore();
                        }
                    }
                } else if (renderable.shape === 'shockwave') {
                    // 冲击波光圈特效渲染
                    const proj = entity.getComponent(Projectile);
                    if (proj) {
                        const maxRadius = (proj as any).maxRadius || 300;
                        const maxLife = 20; // 存活帧数
                        const progress = 1 - (proj.life / maxLife);
                        const currentRadius = 10 + progress * maxRadius;
                        
                        this.ctx.save();
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                        this.ctx.strokeStyle = renderable.color;
                        this.ctx.lineWidth = 15 * (1 - progress); // 边缘逐渐变细
                        this.ctx.shadowBlur = 20;
                        this.ctx.shadowColor = '#ffffff';
                        this.ctx.stroke();
                        this.ctx.restore();
                    }
                } else if (renderable.shape === 'wall_line') {
                    // 【连续线段墙体渲染】
                    // 不画标准的圆形，而是画出带有阴影和高光的平滑粗线段
                    this.ctx.save();
                    
                    // Set line style for the segment
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.lineWidth = renderable.radius * 2;
                    
                    // 1. 底层厚重阴影（立体感）
                    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowOffsetX = 3;
                    this.ctx.shadowOffsetY = 3;

                    // Calculate local end point since context is translated to transform.x/y
                    const endX = renderable.width - transform.x;
                    const endY = renderable.height - transform.y;

                    // ===== 墙体视觉优化：增加半透明度 =====
                    // 解析原本颜色并注入 alpha 通道 (假设原色格式如 '#ff0000' 或 'rgba(...)')
                    let wallColor = renderable.color;
                    if (wallColor.startsWith('#')) {
                        // Convert hex to rgba with 0.6 opacity
                        const r = parseInt(wallColor.slice(1,3), 16);
                        const g = parseInt(wallColor.slice(3,5), 16);
                        const b = parseInt(wallColor.slice(5,7), 16);
                        wallColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
                    } else if (wallColor.startsWith('rgb(')) {
                        wallColor = wallColor.replace('rgb(', 'rgba(').replace(')', ', 0.6)');
                    }

                    // 2. Base Line
                    this.ctx.strokeStyle = wallColor;
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, 0);
                    this.ctx.lineTo(endX, endY);
                    this.ctx.stroke();

                    // 3. 顶部高光（模仿未干颜料的反光）
                    this.ctx.shadowColor = 'transparent'; // 关闭阴影
                    this.ctx.lineWidth = renderable.radius;
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    this.ctx.beginPath();
                    
                    // Calculate normal vector for offset
                    const dx = endX;
                    const dy = endY;
                    const len = Math.hypot(dx, dy) || 1;
                    const nx = -dy / len;
                    const ny = dx / len;
                    
                    this.ctx.moveTo(nx * renderable.radius * 0.3, ny * renderable.radius * 0.3);
                    this.ctx.lineTo(endX + nx * renderable.radius * 0.3, endY + ny * renderable.radius * 0.3);
                    this.ctx.stroke();

                    // 4. 表面纹理肌理（模仿笔刷刮痕）
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    this.ctx.beginPath();
                    this.ctx.moveTo(-nx * renderable.radius * 0.5, -ny * renderable.radius * 0.5);
                    this.ctx.lineTo(endX - nx * renderable.radius * 0.5, endY - ny * renderable.radius * 0.5);
                    this.ctx.stroke();

                    this.ctx.restore(); // restore local save
                    this.ctx.restore(); // restore outer save! This is the fix for the context leak!
                    continue; // 墙体单独渲染完毕，跳过常规渲染
                } 
                
                // ===== 序列帧动画 (Sprite Animation) =====
                const spriteAnim = entity.getComponent(SpriteAnimation);
                if (spriteAnim && spriteAnim.image && spriteAnim.image.complete) {
                    if (spriteAnim.isPlaying) {
                        spriteAnim.elapsedFrames++;
                        if (spriteAnim.elapsedFrames >= spriteAnim.frameDuration) {
                            spriteAnim.elapsedFrames = 0;
                            spriteAnim.currentFrame++;
                            if (spriteAnim.currentFrame >= spriteAnim.totalFrames) {
                                spriteAnim.currentFrame = spriteAnim.loop ? 0 : spriteAnim.totalFrames - 1;
                            }
                        }
                    }

                    this.ctx.save();
                    // 处理 Squash & Stretch
                    this.ctx.scale(renderable.scaleX, renderable.scaleY);

                    // 计算裁剪区域
                    const sx = spriteAnim.currentFrame * spriteAnim.frameWidth;
                    const sy = (spriteAnim.row || 0) * spriteAnim.frameHeight; // 支持多行序列帧

                    // 计算绘制偏移 (考虑 pivot)
                    const dx = -spriteAnim.frameWidth * spriteAnim.pivotX;
                    const dy = -spriteAnim.frameHeight * spriteAnim.pivotY;

                    // 设置透明度等其他 Renderable 属性
                    this.ctx.globalAlpha = renderable.color === 'transparent' ? 0 : 1;

                    // 绘制图像
                    this.ctx.drawImage(
                        spriteAnim.image,
                        sx, sy, spriteAnim.frameWidth, spriteAnim.frameHeight,
                        dx, dy, spriteAnim.frameWidth, spriteAnim.frameHeight
                    );

                    this.ctx.restore();
                    
                    // 特效渲染 (护盾、光环等)，原本写在 circle 的后面
                    // 现在因为使用了序列帧跳过了 circle 渲染，需要把这些绑定在玩家身上的特效补上
                    if (entity.tags.has('player')) {
                        const stats = entity.getComponent(PlayerStats);
                        
                        // 1. 厚涂护盾 (Classical Shield)
                        if (stats && stats.characterId === 'classical' && (stats.hasClassicalShield || stats.classicalShieldStacks > 0)) {
                            this.ctx.save();
                            this.ctx.strokeStyle = '#ffcc00'; // Golden shield
                            this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 200); // Pulsing
                            
                            const stacks = Math.max(stats.classicalShieldStacks, stats.hasClassicalShield ? 1 : 0);
                            for (let i = 0; i < stacks; i++) {
                                this.ctx.lineWidth = 4;
                                this.ctx.beginPath();
                                this.ctx.arc(0, 0, renderable.radius + 15 + i * 5, 0, Math.PI * 2);
                                this.ctx.stroke();
                            }
                            this.ctx.restore();
                        }
                        
                        // 2. 绝地反击爆炸预警
                        if (stats && stats.explosionCooldownFrames > 0) {
                            const exploLevel = stats.getSkillLevel('defense_desperate_explosion');
                            const maxCD = [3600, 2700, 1800][exploLevel - 1] || 3600;
                            if (stats.explosionCooldownFrames > maxCD - 60) {
                                this.ctx.save();
                                this.ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + 0.2 * Math.sin(Date.now() / 100)})`;
                                this.ctx.lineWidth = 6;
                                this.ctx.beginPath();
                                this.ctx.arc(0, 0, renderable.radius + 30, 0, Math.PI * 2);
                                this.ctx.stroke();
                                this.ctx.restore();
                            }
                        }
                        
                        // 3. 折纸盾牌 (Origami Shield)
                        if (stats && stats.hasOrigamiShield) {
                            this.ctx.save();
                            this.ctx.strokeStyle = '#ffffff'; // White/Paper shield
                            this.ctx.setLineDash([5, 5]); // Dashed line for origami effect
                            this.ctx.globalAlpha = 0.8;
                            this.ctx.lineWidth = 3;
                            this.ctx.beginPath();
                            const sides = 6;
                            const radius = renderable.radius + 15;
                            this.ctx.moveTo(radius * Math.cos(Date.now() / 1000), radius * Math.sin(Date.now() / 1000));
                            for (let i = 1; i <= sides; i++) {
                                const angle = (Math.PI * 2 / sides) * i + (Date.now() / 1000);
                                const x = Math.cos(angle) * radius;
                                const y = Math.sin(angle) * radius;
                                this.ctx.lineTo(x, y);
                            }
                            this.ctx.closePath();
                            this.ctx.stroke();
                            this.ctx.restore();
                        }
                    }

                    this.ctx.restore(); // MUST restore the outer save from line 101 before continue!
                    continue; // 序列帧及角色特效渲染完毕，跳过下面的基础几何渲染
                }
                
                if (renderable.shape === 'circle') {

                    const beh = entity.getComponent(EnemyBehavior);
                    if (beh && beh.blindFrames > 0) {
                        this.ctx.save();
                        this.ctx.fillStyle = '#ffcc00';
                        this.ctx.font = 'bold 16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText('???', 0, -renderable.radius - 10);
                        this.ctx.restore();
                    }

                    this.ctx.save();
                    this.ctx.scale(renderable.scaleX, renderable.scaleY);
                    
                    if (entity.tags.has('player')) {
                        // 玩家高对比度描边/高亮
                        this.ctx.shadowBlur = 15;
                        this.ctx.shadowColor = '#ffffff';
                        this.ctx.strokeStyle = '#ffffff';
                        this.ctx.lineWidth = 4;
                    } else if (pData && pData.type === 'gravity') {
                        const isAwakened = (pData as any).isAwakened;
                        this.ctx.shadowBlur = isAwakened ? 30 : 15;
                        this.ctx.shadowColor = renderable.color;
                        if (isAwakened) {
                            this.ctx.lineWidth = 4;
                            this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
                        }
                    } else if (isEnemyBullet) {
                        // 敌方子弹高对比度描边 (红/白交替闪烁高亮)
                        this.ctx.shadowBlur = 10;
                        this.ctx.shadowColor = '#ff0000';
                        this.ctx.strokeStyle = Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#ffffff';
                        this.ctx.lineWidth = 3;
                    } else if (isPlayerBullet) {
                        // 玩家子弹：去除多余的描边，防止火焰/喷雾类粒子变成泡泡
                        this.ctx.lineWidth = 0;
                        this.ctx.strokeStyle = 'transparent';
                    }
                    
                    const wData = entity.getComponent(WaterMark);
                    if (wData && wData.erasedParts.length > 0) {
                        const size = renderable.radius * 2;
                        this.tempCanvas.width = size;
                        this.tempCanvas.height = size;
                        
                        this.tempCtx.globalCompositeOperation = 'source-over';
                        this.tempCtx.fillStyle = renderable.color;
                        this.tempCtx.beginPath();
                        this.tempCtx.arc(size/2, size/2, renderable.radius, 0, Math.PI * 2);
                        this.tempCtx.fill();
                        
                        this.tempCtx.globalCompositeOperation = 'destination-out';
                        this.tempCtx.beginPath();
                        for (const part of wData.erasedParts) {
                            const localX = part.x - drawX + size/2;
                            const localY = part.y - drawY + size/2;
                            this.tempCtx.moveTo(localX + part.radius, localY);
                            this.tempCtx.arc(localX, localY, part.radius, 0, Math.PI * 2);
                        }
                        this.tempCtx.fill();
                        
                        this.ctx.drawImage(this.tempCanvas, -size/2, -size/2);
                    } else {
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, renderable.radius, 0, Math.PI * 2);
                        
                        // 增强高对比度渲染
                        if (pData && pData.type === 'flamethrower') {
                            const isAwakened = (pData as any).isAwakened;
                            if (isAwakened) {
                                // 觉醒后的火焰自带极强的高温发光效果，不再是干瘪的圆块
                                this.ctx.shadowBlur = 20;
                                this.ctx.shadowColor = renderable.color;
                                // 使用 globalCompositeOperation 叠加高亮模式 (lighter) 让重叠的火焰看起来像真实的烈火中心
                                this.ctx.globalCompositeOperation = 'lighter';
                            }
                        }

                        this.ctx.fill();
                        
                        // 【路线二：强制给所有敌人和一般子弹加上黑边（除了火焰）】
                        if (!entity.tags.has('player') && !(pData && pData.type === 'flamethrower')) {
                            this.ctx.lineWidth = 2;
                            this.ctx.strokeStyle = '#000000';
                            this.ctx.stroke();
                        }
                        
                        // 恢复混合模式
                        if (pData && pData.type === 'flamethrower' && (pData as any).isAwakened) {
                            this.ctx.globalCompositeOperation = 'source-over';
                        }

                        if (entity.tags.has('player') || isEnemyBullet || (pData && pData.type === 'gravity' && (pData as any).isAwakened)) {
                            // 玩家发射的火焰粒子不需要黑色描边，因为会破坏火焰的融合感
                            if (!(pData && pData.type === 'flamethrower')) {
                                this.ctx.stroke();
                            }
                        }
                    }
                    
                    this.ctx.shadowBlur = 0; // 重置阴影
                    this.ctx.restore();
                    
                    const eb = entity.getComponent(EnemyBehavior);
                    if (eb && eb.type === 'shield' && eb.shield > 0) {
                        this.ctx.save();
                        this.ctx.rotate(rotation);
                        this.ctx.strokeStyle = '#66ccff';
                        this.ctx.lineWidth = 4;
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, renderable.radius + 6, -Math.PI/3, Math.PI/3);
                        this.ctx.stroke();
                        this.ctx.restore();
                    }
                    
                    // 元素状态特效
                    if (eb) {
                        if (eb.frozenFrames > 0) {
                            this.ctx.save();
                            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
                            this.ctx.beginPath();
                            this.ctx.arc(0, 0, renderable.radius + 2, 0, Math.PI * 2);
                            this.ctx.fill();
                            this.ctx.restore();
                        }
                        if (eb.burnFrames > 0) {
                            this.ctx.save();
                            this.ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
                            this.ctx.lineWidth = 3;
                            this.ctx.setLineDash([5, 5]);
                            this.ctx.beginPath();
                            this.ctx.arc(0, 0, renderable.radius + 4, (Date.now() / 200) % (Math.PI * 2), (Date.now() / 200) % (Math.PI * 2) + Math.PI * 2);
                            this.ctx.stroke();
                            this.ctx.restore();
                        }
                        if (eb.corrosiveStacks > 0) {
                            this.ctx.save();
                            this.ctx.fillStyle = '#00ff00';
                            for (let i = 0; i < eb.corrosiveStacks; i++) {
                                this.ctx.beginPath();
                                this.ctx.arc(-10 + i * 10, -renderable.radius - 8, 3, 0, Math.PI * 2);
                                this.ctx.fill();
                            }
                            this.ctx.restore();
                        }
                    }
                    
                    if (entity.tags.has('blackhole')) {
                        this.ctx.strokeStyle = '#9900ff';
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();
                        
                        const t = Date.now() / 100;
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, renderable.radius * 1.5 * (Math.sin(t)+1.2), 0, Math.PI * 2);
                        this.ctx.strokeStyle = `rgba(153, 0, 255, 0.2)`;
                        this.ctx.stroke();
                    }
                    
                    
                    if (entity.tags.has('player')) {
                        this.ctx.save();
                        this.ctx.rotate(rotation);
                        this.ctx.fillStyle = '#ff0000';
                        this.ctx.fillRect(renderable.radius * 0.5, -renderable.radius * 0.3, renderable.radius * 1.2, renderable.radius * 0.6);
                        this.ctx.restore();
                        const skill = entity.getComponent(Skill);
                        const stats = entity.getComponent(PlayerStats);
                        if (skill && skill.eraserShieldFrames > 0) {
                            this.ctx.save();
                            this.ctx.strokeStyle = '#66ccff';
                            this.ctx.globalAlpha = 0.9;
                            this.ctx.lineWidth = 2;
                            this.ctx.beginPath();
                            this.ctx.arc(0, 0, 60, 0, Math.PI * 2);
                            this.ctx.stroke();
                            this.ctx.restore();
                        }
                        if (stats && stats.characterId === 'classical' && (stats.hasClassicalShield || stats.classicalShieldStacks > 0)) {
                            this.ctx.save();
                            this.ctx.strokeStyle = '#ffcc00'; // Golden shield
                            this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 200); // Pulsing
                            
                            // 根据层数增加线宽或显示多个环
                            const stacks = Math.max(stats.classicalShieldStacks, stats.hasClassicalShield ? 1 : 0);
                            for (let i = 0; i < stacks; i++) {
                                this.ctx.lineWidth = 4;
                                this.ctx.beginPath();
                                this.ctx.arc(0, 0, renderable.radius + 15 + i * 5, 0, Math.PI * 2);
                                this.ctx.stroke();
                            }
                            this.ctx.restore();
                        }
                        if (stats && stats.explosionCooldownFrames > 0) {
                            const exploLevel = stats.getSkillLevel('defense_desperate_explosion');
                            const maxCD = [3600, 2700, 1800][exploLevel - 1] || 3600;
                            if (stats.explosionCooldownFrames > maxCD - 60) {
                                this.ctx.save();
                                this.ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + 0.2 * Math.sin(Date.now() / 100)})`;
                                this.ctx.lineWidth = 6;
                                this.ctx.beginPath();
                                this.ctx.arc(0, 0, renderable.radius + 30, 0, Math.PI * 2);
                                this.ctx.stroke();
                                this.ctx.restore();
                            }
                        }
                        if (stats && stats.hasOrigamiShield) {
                            this.ctx.save();
                            this.ctx.strokeStyle = '#ffffff'; // White/Paper shield
                            this.ctx.setLineDash([5, 5]); // Dashed line for origami effect
                            this.ctx.globalAlpha = 0.8;
                            this.ctx.lineWidth = 3;
                            this.ctx.beginPath();
                            // Draw a hexagon or polygon for "origami" feel instead of circle
                            const sides = 6;
                            const radius = renderable.radius + 15;
                            this.ctx.moveTo(radius * Math.cos(Date.now() / 1000), radius * Math.sin(Date.now() / 1000));
                            for (let i = 1; i <= sides; i++) {
                                const angle = (Math.PI * 2 / sides) * i + (Date.now() / 1000);
                                const x = Math.cos(angle) * radius;
                                const y = Math.sin(angle) * radius;
                                this.ctx.lineTo(x, y);
                            }
                            this.ctx.closePath();
                            this.ctx.stroke();
                            this.ctx.setLineDash([]);
                            this.ctx.restore();
                        }
                        
                        if (stats && stats.hasCalligrapherPassive && stats.calligrapherDamageStacks > 0) {
                            this.ctx.save();
                            this.ctx.fillStyle = '#ffffff';
                            this.ctx.font = 'bold 14px Arial';
                            this.ctx.textAlign = 'center';
                            this.ctx.fillText(`+${stats.calligrapherDamageStacks * 2}%`, 0, -renderable.radius - 15);
                            
                            // Draw an aura based on stacks
                            const intensity = Math.min(1.0, stats.calligrapherDamageStacks / stats.maxCalligrapherStacks);
                            this.ctx.beginPath();
                            this.ctx.arc(0, 0, renderable.radius + 10 + intensity * 15, 0, Math.PI * 2);
                            this.ctx.strokeStyle = `rgba(255, 100, 100, ${0.2 + intensity * 0.5})`;
                            this.ctx.lineWidth = 2 + intensity * 4;
                            this.ctx.stroke();
                            this.ctx.restore();
                        }
                    }
                } else if (renderable.shape === 'rect') {
                    this.ctx.save();
                    this.ctx.rotate(rotation);
                    this.ctx.scale(renderable.scaleX, renderable.scaleY);
                    this.ctx.fillRect(-renderable.width / 2, -renderable.height / 2, renderable.width, renderable.height);
                    this.ctx.restore();
                } else if (renderable.shape === 'crescent') {
                    this.ctx.save();
                    this.ctx.rotate(rotation);
                    this.ctx.scale(renderable.scaleX, renderable.scaleY);
                    
                    // 剑气发光效果
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = renderable.color;
                    this.ctx.fillStyle = renderable.color;
                    
                    const r = renderable.radius || 40;
                    const thickness = renderable.width || 15;
                    const arcAngle = Math.PI * 0.45;
                    
                    // 偏移量，让月牙的肚皮（凸面）朝前
                    const offsetX = -r + thickness / 2;
                    
                    this.ctx.beginPath();
                    // 外部大弧线
                    this.ctx.arc(offsetX, 0, r, -arcAngle, arcAngle, false);
                    // 内部小弧线（反向闭合形成月牙）
                    this.ctx.arc(offsetX - thickness, 0, r, arcAngle, -arcAngle, true);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    // 内部核心高亮（纯白），增加能量感
                    this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    this.ctx.shadowBlur = 0;
                    this.ctx.beginPath();
                    this.ctx.arc(offsetX, 0, r - 2, -arcAngle*0.8, arcAngle*0.8, false);
                    this.ctx.arc(offsetX - thickness + 4, 0, r - 2, arcAngle*0.8, -arcAngle*0.8, true);
                    this.ctx.closePath();
                    this.ctx.fill();

                    this.ctx.restore();
                } else if (renderable.shape === 'triangle') {
                    this.ctx.save();
                    
                    const eb = entity.getComponent(EnemyBehavior);
                    if (eb && eb.type === 'paper_plane') {
                        // 纸飞机高对比度描边 (红白交替闪烁)
                        this.ctx.shadowBlur = 10;
                        this.ctx.shadowColor = '#ff0000';
                        this.ctx.strokeStyle = Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0000' : '#ffffff';
                        this.ctx.lineWidth = 3;
                    }

                    this.ctx.rotate(rotation);
                    const r = renderable.radius;
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -r);
                    this.ctx.lineTo(r * 0.866, r * 0.5);
                    this.ctx.lineTo(-r * 0.866, r * 0.5);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    if (eb && eb.type === 'paper_plane') {
                        this.ctx.stroke();
                    }

                    if (eb && eb.type === 'boss') {
                        const t = Date.now() / 250;
                        const scale = 1.08 + Math.sin(t) * 0.08;
                        const lw = 2 + Math.abs(Math.sin(t * 1.3)) * 3;
                        this.ctx.strokeStyle = '#ffe066';
                        this.ctx.lineWidth = lw;
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, -r * scale);
                        this.ctx.lineTo(r * 0.866 * scale, r * 0.5 * scale);
                        this.ctx.lineTo(-r * 0.866 * scale, r * 0.5 * scale);
                        this.ctx.closePath();
                        this.ctx.stroke();
                        this.ctx.strokeStyle = 'rgba(255, 204, 0, 0.35)';
                        this.ctx.lineWidth = lw + 4;
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, -r * (scale + 0.05));
                        this.ctx.lineTo(r * 0.866 * (scale + 0.05), r * 0.5 * (scale + 0.05));
                        this.ctx.lineTo(-r * 0.866 * (scale + 0.05), r * 0.5 * (scale + 0.05));
                        this.ctx.closePath();
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                } else if (renderable.shape === 'diamond') {
                    this.ctx.save();
                    this.ctx.rotate(rotation);
                    const r = renderable.radius;
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -r);
                    this.ctx.lineTo(r, 0);
                    this.ctx.lineTo(0, r);
                    this.ctx.lineTo(-r, 0);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    // Add a subtle glow for the orb
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = renderable.color;
                    this.ctx.stroke();
                    this.ctx.restore();
                }
                
                // === Summon 特效绘制 (不依赖于形状) ===
                if (entity.tags.has('summon')) {
                    const summon = entity.getComponent(Summon);
                    // === 双生·军团降临 (synergy_legion) 微型调色盘卫星特效 ===
                    if (summon && summon.type === 'stickman' && player) {
                        const pStats = player.getComponent(PlayerStats);
                        if (pStats && pStats.getSkillLevel('synergy_legion') > 0) {
                            this.ctx.save();
                            this.ctx.rotate(rotation); // Rotate with the stickman's rotation
                            this.ctx.fillStyle = '#ff8800'; // Orange palette color
                            const miniDist = 25;
                            const miniSize = 8;
                            // 2 mini palettes
                            for (let i = 0; i < 2; i++) {
                                const angle = (i * Math.PI) + (Date.now() / 300);
                                const px = Math.cos(angle) * miniDist;
                                const py = Math.sin(angle) * miniDist;
                                this.ctx.fillRect(px - miniSize/2, py - miniSize/2, miniSize, miniSize);
                            }
                            this.ctx.restore();
                        }
                    }
                }
            }

            this.ctx.restore();
            
            const attachments = entity.getComponent(SpriteAttachments);
            if (attachments) {
                for (const part of attachments.parts.sort((a, b) => a.z - b.z)) {
                    if (!(part.image as any).complete || (part.image as any).naturalWidth === 0) continue;
                    const sk3 = entity.getComponent(Skeleton);
                    if (!sk3) continue;
                    const bone = sk3.getBone(part.bone);
                    if (!bone) continue;
                    this.ctx.save();
                    this.ctx.translate(bone.worldX + part.offsetX, bone.worldY + part.offsetY);
                    this.ctx.rotate(bone.worldRotation + part.rotationOffset);
                    this.ctx.drawImage(part.image, -part.width/2, -part.height/2, part.width, part.height);
                    this.ctx.restore();
                }
            }
            
            const cp = entity.getComponent(ControlPoint);
            if (cp) {
                const t = entity.getComponent(Transform);
                if (t) {
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, cp.radius, 0, Math.PI * 2);
                    this.ctx.stroke();
                    const p = Math.max(0, Math.min(1, cp.progress / cp.required));
                    this.ctx.strokeStyle = 'rgba(0, 255, 180, 0.9)';
                    this.ctx.lineWidth = 6;
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, cp.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        }

        // Overlay pass: enemy bullets highlight on top of fog
        const playerId = player ? player.id : '';
        this.ctx.save();
        // REMOVED double translation here, since it's already translated at the start of RenderSystem
        
        // Render digital turrets in the overlay pass so they aren't hidden by player/other entities

        if (player) {
            const stats = player.getComponent(PlayerStats);
            const renderable = player.getComponent(Renderable);
            if (stats && stats.hasDigitalPassive && renderable) {
                const isAwakened1 = stats.getSkillLevel('awakening_digital_1') > 0;
                const isAwakened2 = stats.getSkillLevel('awakening_digital_2') > 0;
                
                // 渲染炮台
                if (isAwakened2 && stats.digitalTurrets) {
                    for (const turret of stats.digitalTurrets) {
                        this.ctx.save();
                        // 这里的 turret.x 和 turret.y 已经是世界坐标，而 this.ctx 现在已经被 camera.x/y 偏移过了，
                        // 所以直接 translate 即可将世界坐标转换为屏幕坐标
                        this.ctx.translate(turret.x, turret.y);
                        
                        // 炮台底座
                        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
                        this.ctx.fill();
                        
                        // 炮管
                        this.ctx.save();
                        if (turret.rotation !== undefined) {
                            this.ctx.rotate(turret.rotation);
                        }
                        this.ctx.fillStyle = '#00ffff';
                        this.ctx.fillRect(0, -10, 40, 20);
                        this.ctx.restore();
                        
                        // 生命周期倒计时光环
                        this.ctx.strokeStyle = '#00ffff';
                        this.ctx.lineWidth = 4;
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + (turret.lifeTimer / 300) * Math.PI * 2);
                        this.ctx.stroke();
                        
                        this.ctx.restore();
                    }
                }
                
                if (!isAwakened2) {
                    const transform = player.getComponent(Transform);
                    if (transform) {
                        const time = Date.now() / 300;
                        const orbitRadius = renderable.radius + 20;
                        
                        const drawPen = (angleOffset: number) => {
                            const penX = transform.x + Math.cos(time + angleOffset) * orbitRadius;
                            const penY = transform.y + Math.sin(time + angleOffset) * orbitRadius;
                            
                            this.ctx.save();
                            this.ctx.translate(penX, penY);
                            
                            this.ctx.fillStyle = '#00ffff';
                            this.ctx.shadowColor = '#00ffff';
                            this.ctx.shadowBlur = 10;
                            
                            this.ctx.beginPath();
                            this.ctx.moveTo(10, 0);
                            this.ctx.lineTo(-5, 5);
                            this.ctx.lineTo(-5, -5);
                            this.ctx.closePath();
                            this.ctx.fill();
                            
                            this.ctx.restore();
                        };
                        
                        drawPen(0);
                        if (isAwakened1) {
                            drawPen(Math.PI); // 对面再画一个
                        }
                    }
                }
            }
        }
        
        for (const entity of renderList) {
            const proj = entity.getComponent(Projectile);
            if (!proj) continue;
            if (proj.ownerId === playerId) continue;
            const t = entity.getComponent(Transform);
            const r = entity.getComponent(Renderable);
            if (!t || !r) continue;
            
            // 对于 BOSS 的激光子弹 (shape === 'rect')，也给它增加高亮描边
            if (r.shape !== 'circle' && r.shape !== 'rect') continue;
            
            this.ctx.save();
            this.ctx.beginPath();
            
            if (r.shape === 'circle') {
                this.ctx.arc(t.x, t.y, r.radius + 1.5, 0, Math.PI * 2);
            } else if (r.shape === 'rect') {
                this.ctx.translate(t.x, t.y);
                if (t.rotation !== undefined) {
                    this.ctx.rotate(t.rotation);
                }
                this.ctx.rect(-r.width / 2 - 1.5, -r.height / 2 - 1.5, r.width + 3, r.height + 3);
            }
            
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.9;
            this.ctx.stroke();
            this.ctx.restore();
        }
        // Overlay pass: boss silhouette above fog
        for (const entity of renderList) {
            const eb = entity.getComponent(EnemyBehavior);
            if (!eb || eb.type !== 'boss') continue;
            const t = entity.getComponent(Transform);
            const r = entity.getComponent(Renderable);
            if (!t || !r) continue;
            this.ctx.save();
            this.ctx.translate(t.x, t.y);
            this.ctx.rotate(t.rotation);
            const R = r.radius * 1.15;
            const tPulse = Date.now() / 250;
            const scale = 1.15 + Math.sin(tPulse) * 0.1;
            const lw = 4 + Math.abs(Math.sin(tPulse * 1.3)) * 4;
            this.ctx.strokeStyle = '#ffe066';
            this.ctx.lineWidth = lw;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -R * scale);
            this.ctx.lineTo(R * 0.866 * scale, R * 0.5 * scale);
            this.ctx.lineTo(-R * 0.866 * scale, R * 0.5 * scale);
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.strokeStyle = 'rgba(255, 204, 0, 0.35)';
            this.ctx.lineWidth = lw + 6;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -R * (scale + 0.06));
            this.ctx.lineTo(R * 0.866 * (scale + 0.06), R * 0.5 * (scale + 0.06));
            this.ctx.lineTo(-R * 0.866 * (scale + 0.06), R * 0.5 * (scale + 0.06));
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
        }
        this.ctx.restore();

        this.ctx.restore();
    }

    private drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        const gridSize = 100;
        
        // Calculate visible grid range
        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;
        const endX = startX + this.ctx.canvas.width + gridSize;
        const endY = startY + this.ctx.canvas.height + gridSize;

        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();

        // Draw World Borders
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 5;
        this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

        this.ctx.restore();
    }
}
