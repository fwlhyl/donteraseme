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
import { PlayerArtwork } from '../components/PlayerArtwork';
import { Weapon } from '../components/Weapon';
import { drawPlayerArtwork } from '../ui/drawPlayerArtwork';
import { drawDoodleEnemy, hasDoodleEnemyArtwork } from '../art/DoodleArt';
import { DoodleMotion, sampleDoodleMotion } from '../art/DoodleMotion';
import { drawDoodleSkillEntity, drawDoodleSkillSprite, drawDoodleTurret, getDoodleUprightFacing, DOODLE_VEHICLE_SCALE } from '../art/DoodleSkillArt';
import { drawDoodlePlayerEffects, drawDoodleStatus } from '../art/DoodleSkillEffects';
import { drawDoodleProjectile, drawDoodleProjectileLine, drawDoodleRulerShot } from '../art/DoodleProjectiles';
import { Stunned } from '../components/Stunned';
import { Particle } from '../components/Particle';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { SkillVisual } from '../components/SkillVisual';
import type { Entity } from '../core/Entity';
import { CourtyardScene } from '../world/CourtyardScene';
import { sceneBounds, sceneCameraAxis } from '../world/SceneLayout';

export class RenderSystem extends System {
    private tempCanvas: HTMLCanvasElement;
    private tempCtx: CanvasRenderingContext2D;
    private courtyardScene = new CourtyardScene();
    private doodleMotion = new WeakMap<Entity,DoodleMotion>();
    private skillMotion = new WeakMap<Entity,DoodleMotion>();
    private artTime = 0;

    public override onEntityAdded(entity:Entity):void {
        if(entity.tags.has('player')||entity.tags.has('enemy')) sampleDoodleMotion(entity,0,this.doodleMotion);
    }
    public override onEntityRemoved(entity:Entity):void { this.doodleMotion.delete(entity); this.skillMotion.delete(entity); }

    constructor(
        private ctx: CanvasRenderingContext2D,
        private camera: { x: number, y: number },
        private worldWidth: number,
        private worldHeight: number,
        private useCourtyard: () => boolean = () => false,
        private useRuins: () => boolean = () => false,
        private clipDrawingToWorld: () => boolean = () => false
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

    /**
     * World coordinates use CSS pixels. Canvas.width/height use device pixels on
     * Retina displays, so they must not be used for camera calculations.
     */
    private getViewportSize(): { width: number; height: number } {
        return {
            width: this.ctx.canvas.clientWidth || window.innerWidth,
            height: this.ctx.canvas.clientHeight || window.innerHeight
        };
    }

    /** Only local, bounded bodies are eligible. Skills, bosses, long lines,
     * sprite animations and bone attachments keep their existing draw path. */
    private isOutsideViewport(entity: Entity, left: number, top: number, right: number, bottom: number): boolean {
        const transform = entity.getComponent(Transform), renderable = entity.getComponent(Renderable);
        if (!transform || !renderable || entity.tags.has('player') || entity.tags.has('boss') || entity.tags.has('blackhole')) return false;
        const enemy = entity.getComponent(EnemyBehavior);
        const ordinaryEnemy = entity.tags.has('enemy') && enemy
            && (enemy.type === 'chaser' || enemy.type === 'eraser' || enemy.type === 'shield'
                || enemy.type === 'shooter' || enemy.type === 'summoner' || enemy.type === 'paper_plane');
        if (!ordinaryEnemy && !entity.hasComponent(Particle) && !entity.hasComponent(ExperienceOrb)) return false;
        if (renderable.shape !== 'circle' && renderable.shape !== 'rect'
            && renderable.shape !== 'triangle' && renderable.shape !== 'diamond') return false;
        if (entity.hasComponent(Skeleton) || entity.hasComponent(SpriteAttachments) || entity.hasComponent(ControlPoint)
            || entity.hasComponent(SpriteAnimation) || entity.hasComponent(Summon) || entity.hasComponent(SkillVisual)
            || entity.hasComponent(Projectile) || entity.hasComponent(Skill) || entity.hasComponent(PlayerStats)
            || renderable.attachmentBone) return false;
        // Atlas poses/feet, rotated rectangles, shield arcs, status text and glow
        // fit comfortably inside this envelope. Corrosion rows can grow wider.
        const scale = Math.max(1, Math.abs(renderable.scaleX), Math.abs(renderable.scaleY));
        const radius = Math.max(Math.abs(renderable.radius) * 2.5, Math.abs(renderable.width),
            Math.abs(renderable.height), (enemy?.corrosiveStacks ?? 0) * 3.5) * scale + 48;
        return transform.x + radius < left || transform.x - radius > right
            || transform.y + radius < top || transform.y - radius > bottom;
    }

    public override setWorldSize(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
        this.doodleMotion = new WeakMap();
        this.skillMotion = new WeakMap();
        this.artTime = 0;
    }

    public update(dt: number): void {
        if (Number.isFinite(dt) && dt > 0) this.artTime += Math.min(dt, .1);
        const ruins = this.useRuins();
        const illustratedScene = this.useCourtyard() || ruins;
        const boundedDrawing = this.clipDrawingToWorld();
        this.ctx.save();

        // 1. Update Camera Position (Follow Player)
        let player: Entity | undefined;
        for (const entity of this.entities) if (entity.tags.has('player')) { player = entity; break; }
        if (player) {
            const t = player.getComponent(Transform);
            if (t) {
                const viewport = this.getViewportSize();
                // Center camera on player
                this.camera.x = t.x - viewport.width / 2;
                this.camera.y = t.y - viewport.height / 2;

                // A viewport larger than the world centers the whole arena,
                // including its painting. Negative offsets are intentional.
                const bounds = sceneBounds(this.worldWidth, this.worldHeight, ruins ? 'ruins' : 'atelier');
                this.camera.x = sceneCameraAxis(t.x, viewport.width, this.worldWidth, -bounds.x);
                this.camera.y = sceneCameraAxis(t.y, viewport.height, this.worldHeight, -bounds.y);
            }
        }

        // 2. Draw Background Grid
        this.courtyardScene.draw(this.camera,this.worldWidth,this.worldHeight,illustratedScene,ruins?'ruins':'atelier',this.artTime);
        if(!illustratedScene) this.drawGrid(boundedDrawing);


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

        // Cull drawing only. Hidden enemies still consume every motion sample,
        // so returning to view cannot replay old hit/attack pulses or skip steps.
        const viewport = this.getViewportSize();
        const left = this.camera.x - shakeX, top = this.camera.y - shakeY;
        const renderList: Entity[] = [];
        for (const entity of this.entities) {
            if (this.isOutsideViewport(entity, left, top, left + viewport.width, top + viewport.height)) {
                if (entity.tags.has('enemy')) sampleDoodleMotion(entity, dt, this.doodleMotion);
                continue;
            }
            renderList.push(entity);
        }
        // Stable sorting keeps insertion order for equal z-indices. Re-sort the
        // retained bodies because gameplay can change their public zIndex.
        renderList.sort((a, b) => {
            const ra = a.getComponent(Renderable), rb = b.getComponent(Renderable);
            return (ra?.zIndex ?? 0) - (rb?.zIndex ?? 0);
        });

        // Legacy scenery is only used in the story-mode prototype. Both released
        // modes render their illustrated environment beneath the artwork layers.
        if(!illustratedScene) this.drawSketchbookSetDressing();
        
        // Draw World Boundary
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 5;
        if(!illustratedScene) this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

        // The permanent trail bitmap already ends at the paper edge. Clip the
        // live layer too: long shots, wide brushes and particles must not hang
        // outside that same edge. Install after the camera/DPR transform so it
        // remains a world-space boundary, including on oversized viewports.
        if (boundedDrawing) {
            const paper = new Path2D();
            paper.rect(0, 0, this.worldWidth, this.worldHeight);
            this.ctx.clip(paper);
        }

        // const player = Array.from(this.entities).find(e => e.tags.has('player')); // Already defined at the top of update()

        for (const entity of renderList) {
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);

            if (!transform || !renderable) continue;
            const doodlePose=(entity.tags.has('player')||entity.tags.has('enemy'))
                ? sampleDoodleMotion(entity,dt,this.doodleMotion) : undefined;
            let summonPose;
            if (entity.getComponent(Summon)?.type === 'stickman') {
                const sample = {x:transform.x,y:transform.y,hp:0,attackSerial:0,kind:'player'};
                let motion = this.skillMotion.get(entity);
                if (!motion) { motion = new DoodleMotion(0,sample); this.skillMotion.set(entity,motion); }
                summonPose = motion.update(sample,dt);
            }
            if (!renderable.visible) continue;

            // If this is the player, we should probably update trail canvas here too?
            // No, TrailSystem handles that.

            this.ctx.save();
            
            if (renderable.shape === 'line') {
                if (drawDoodleProjectileLine(this.ctx,entity,player?.id)) {
                    this.ctx.restore();
                    continue;
                }
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

                if (pData && pData.type === 'melee' && renderable.shape === 'rect' && renderable.color === 'transparent' && !isPlayerBullet) {
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
                        this.ctx.shadowBlur = 0;
                        this.ctx.globalAlpha *= Math.max(0,1-progress);
                        this.ctx.strokeStyle = '#1b2028';
                        this.ctx.lineWidth = 5;
                        this.ctx.stroke();
                        this.ctx.strokeStyle = '#e7bc59';
                        this.ctx.lineWidth = 2.5;
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
                // `complete` is also true when an image request has failed.  Drawing a
                // failed image throws on some Chromium builds (including macOS), which
                // used to abort the whole frame.  Keep the geometric player fallback
                // active until the sprite has real bitmap dimensions.
                if (spriteAnim && spriteAnim.image && spriteAnim.image.complete && spriteAnim.image.naturalWidth > 0) {
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
                    
                    if (entity.tags.has('player')) {
                        drawDoodlePlayerEffects(this.ctx,renderable.radius,entity.getComponent(PlayerStats),entity.getComponent(Skill),this.artTime);
                    }

                    this.ctx.restore(); // MUST restore the outer save from line 101 before continue!
                    continue; // 序列帧及角色特效渲染完毕，跳过下面的基础几何渲染
                }
                
                if (drawDoodleSkillEntity(this.ctx,entity,this.artTime,summonPose)) {
                    // Skill bodies only: attachments and status overlays continue below.
                } else if (drawDoodleProjectile(this.ctx,entity,player?.id)) {
                    // Cached doodle stamps replace only player weapon bodies.
                    // Skill provenance above and hostile telegraphs stay authoritative.
                } else if (renderable.shape === 'circle') {

                    const beh = entity.getComponent(EnemyBehavior);
                    const playerArt = entity.getComponent(PlayerArtwork);
                    const readyPlayerArt = entity.tags.has('player') && playerArt?.image.complete && playerArt.image.naturalWidth > 0;
                    const useDoodleBody = readyPlayerArt || (entity.tags.has('enemy') && hasDoodleEnemyArtwork(beh?.type));

                    this.ctx.save();
                    if (!useDoodleBody) this.ctx.scale(renderable.scaleX, renderable.scaleY);

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
                    const hasPlayerArtwork = entity.tags.has('player') && drawPlayerArtwork(
                        this.ctx, playerArt, renderable.radius, transform.rotation, doodlePose, entity.getComponent(Weapon)
                    );
                    const hasEnemyArtwork = entity.tags.has('enemy') && drawDoodleEnemy(
                        this.ctx, beh?.type, renderable.radius, rotation, doodlePose, beh?.bossTimer
                    );
                    if (hasPlayerArtwork || hasEnemyArtwork) {
                        // Only replace the body; keep all existing effects below.
                    } else if (wData && wData.erasedParts.length > 0) {
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
                        // The approved prototype already includes its held brush.
                        if (!hasPlayerArtwork) {
                            this.ctx.save();
                            this.ctx.rotate(rotation);
                            this.ctx.fillStyle = '#ff0000';
                            this.ctx.fillRect(renderable.radius * 0.5, -renderable.radius * 0.3, renderable.radius * 1.2, renderable.radius * 0.6);
                            this.ctx.restore();
                        }
                        drawDoodlePlayerEffects(this.ctx,renderable.radius,entity.getComponent(PlayerStats),entity.getComponent(Skill),this.artTime);
                    }
                } else if (renderable.shape === 'rect') {
                    this.ctx.save();
                    const eb=entity.getComponent(EnemyBehavior);
                    const drawn = entity.tags.has('enemy') && drawDoodleEnemy(
                        this.ctx, eb?.type, renderable.radius, rotation, doodlePose, eb?.bossTimer
                    );
                    if (!drawn) {
                        this.ctx.scale(renderable.scaleX, renderable.scaleY);
                        this.ctx.rotate(rotation);
                        this.ctx.fillRect(-renderable.width / 2, -renderable.height / 2, renderable.width, renderable.height);
                    }
                    this.ctx.restore();
                } else if (renderable.shape === 'magic_tank') {
                    this.ctx.save();
                    this.ctx.scale(getDoodleUprightFacing(entity,rotation)*DOODLE_VEHICLE_SCALE,DOODLE_VEHICLE_SCALE);
                    const width = renderable.width;
                    const height = renderable.height;
                    this.ctx.fillStyle = '#1f2937';
                    this.ctx.fillRect(-width / 2, -height / 2 + 8, width, height - 8);
                    this.ctx.fillStyle = renderable.color;
                    this.ctx.fillRect(-width / 2 + 5, -height / 2 + 6, width - 10, height - 18);
                    this.ctx.fillRect(-8, -height / 2 - 7, 20, 15);
                    this.ctx.fillRect(7, -4, width / 2 + 10, 7);
                    // A small cockpit makes it clear this is the player piloting
                    // the tank rather than a separate companion.
                    this.ctx.fillStyle = '#fef08a';
                    this.ctx.beginPath();
                    this.ctx.arc(-1, -height / 2, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.strokeStyle = '#fef08a';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(-width / 2 + 5, -height / 2 + 6, width - 10, height - 18);
                    this.ctx.restore();
                } else if (renderable.shape === 'magic_robot') {
                    this.ctx.save();
                    this.ctx.scale(getDoodleUprightFacing(entity,rotation)*DOODLE_VEHICLE_SCALE,DOODLE_VEHICLE_SCALE);
                    const width = renderable.width;
                    const height = renderable.height;
                    this.ctx.fillStyle = renderable.color;
                    this.ctx.fillRect(-width / 2, -height / 2 + 12, width, height - 20);
                    this.ctx.fillRect(-width / 2 + 5, -height / 2 - 12, width - 10, 20);
                    this.ctx.fillStyle = '#fef08a';
                    this.ctx.beginPath();
                    this.ctx.arc(0, -height / 2 - 3, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillStyle = '#020617';
                    this.ctx.fillRect(-width / 2 + 10, -height / 2 - 5, 7, 5);
                    this.ctx.fillRect(width / 2 - 17, -height / 2 - 5, 7, 5);
                    this.ctx.strokeStyle = '#dbeafe';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(-width / 2, -height / 2 + 12, width, height - 20);
                    this.ctx.restore();
                } else if (renderable.shape === 'magic_bomber') {
                    this.ctx.save();
                    this.ctx.scale(getDoodleUprightFacing(entity,rotation)*DOODLE_VEHICLE_SCALE,DOODLE_VEHICLE_SCALE);
                    const width = renderable.width;
                    const height = renderable.height;
                    this.ctx.fillStyle = renderable.color;
                    this.ctx.beginPath();
                    this.ctx.moveTo(width / 2, 0);
                    this.ctx.lineTo(-width / 2, -height / 2);
                    this.ctx.lineTo(-width / 4, 0);
                    this.ctx.lineTo(-width / 2, height / 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.fillStyle = '#fce7f3';
                    this.ctx.fillRect(-5, -height / 2 + 5, 15, height - 10);
                    this.ctx.fillStyle = '#fef08a';
                    this.ctx.beginPath();
                    this.ctx.arc(3, 0, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.strokeStyle = '#fdf2f8';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
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
                    const drawn = entity.tags.has('enemy') && drawDoodleEnemy(this.ctx, eb?.type, renderable.radius, rotation, doodlePose, eb?.bossTimer);
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
                    if (!drawn) this.ctx.fill();

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
                
                if (entity.tags.has('player')) drawDoodleRulerShot(this.ctx,entity,doodlePose);
                const status = entity.getComponent(EnemyBehavior);
                if (status) drawDoodleStatus(this.ctx,renderable.radius,status,this.artTime,(entity.getComponent(Stunned)?.frames ?? 0)>0);

                // Legion is a visual attachment, not a new collision entity.
                const summon = entity.getComponent(Summon);
                if (summon?.type === 'stickman' && player?.getComponent(PlayerStats)?.getSkillLevel('synergy_legion')) {
                    for (let i=0;i<2;i++) {
                        const angle=i*Math.PI+this.artTime/0.3;
                        this.ctx.save(); this.ctx.translate(Math.cos(angle)*25,Math.sin(angle)*25);
                        if (!drawDoodleSkillSprite(this.ctx,'palette',10,angle)) {
                            this.ctx.fillStyle='#ff8800'; this.ctx.fillRect(-4,-4,8,8);
                        }
                        this.ctx.restore();
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
        
        // Digital pen positions retain the exact clock/radius used by WeaponSystem.
        if (player) {
            const stats=player.getComponent(PlayerStats), r=player.getComponent(Renderable), t=player.getComponent(Transform);
            if (stats?.hasDigitalPassive && r && t) {
                const fixed=stats.getSkillLevel('awakening_digital_2')>0;
                if (fixed) {
                    for (const turret of stats.digitalTurrets) {
                        this.ctx.save(); this.ctx.translate(turret.x,turret.y);
                        if (!drawDoodleTurret(this.ctx,turret.rotation??0,turret.lifeTimer)) {
                            this.ctx.fillStyle='#65d3da'; this.ctx.beginPath(); this.ctx.arc(0,0,25,0,Math.PI*2); this.ctx.fill();
                            this.ctx.save(); this.ctx.rotate(turret.rotation??0); this.ctx.fillRect(0,-10,40,20); this.ctx.restore();
                            this.ctx.strokeStyle='#65d3da'; this.ctx.lineWidth=2;
                            this.ctx.beginPath(); this.ctx.arc(0,0,30,-Math.PI/2,-Math.PI/2+Math.max(0,turret.lifeTimer/300)*Math.PI*2); this.ctx.stroke();
                        }
                        this.ctx.restore();
                    }
                } else {
                    let nearest: Transform|undefined, distance=Infinity, nearestZ=Infinity;
                    // Visual aim still considers off-screen targets. At equal
                    // distance use the same z/insertion tie order as rendering.
                    for (const candidate of this.entities) {
                        const ct=candidate.getComponent(Transform), hp=candidate.getComponent(Health);
                        if (!candidate.active || !candidate.hasComponent(EnemyBehavior) || !ct || !hp || hp.current<=0) continue;
                        const d=Math.hypot(ct.x-t.x,ct.y-t.y);
                        const z=candidate.getComponent(Renderable)?.zIndex ?? 0;
                        if ((d<distance || (d===distance && z<nearestZ)) && d<(stats.lastAttackConfig?.range||600)+200) {nearest=ct;distance=d;nearestZ=z;}
                    }
                    const count=stats.getSkillLevel('awakening_digital_1')>0?2:1;
                    const clock=Date.now()/300, radius=r.radius+20;
                    for(let i=0;i<count;i++) {
                        const x=t.x+Math.cos(clock+i*Math.PI)*radius, y=t.y+Math.sin(clock+i*Math.PI)*radius;
                        const aim=nearest?Math.atan2(nearest.y-y,nearest.x-x):t.rotation;
                        this.ctx.save(); this.ctx.translate(x,y); this.ctx.rotate(aim); this.ctx.scale(1,Math.cos(aim)<0?-1:1);
                        if (!drawDoodleSkillSprite(this.ctx,'digital_pen',25)) {
                            this.ctx.fillStyle='#65d3da'; this.ctx.beginPath(); this.ctx.moveTo(10,0); this.ctx.lineTo(-5,5); this.ctx.lineTo(-5,-5); this.ctx.closePath(); this.ctx.fill();
                        }
                        this.ctx.restore();
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
        this.ctx.restore(); // overlay pass
        this.ctx.restore(); // camera transform
        this.ctx.restore(); // frame state
    }

    private drawGrid(boundedDrawing = false) {
        this.ctx.save();
        // Light pencil construction lines: the map reads as an open sketchbook
        // page rather than a digital arena grid.
        this.ctx.strokeStyle = 'rgba(56, 67, 69, 0.18)';
        this.ctx.lineWidth = 1;

        const gridSize = 100;
        
        // Calculate visible grid range
        const viewport = this.getViewportSize();
        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;
        const endX = startX + viewport.width + gridSize;
        const endY = startY + viewport.height + gridSize;

        this.ctx.translate(-this.camera.x, -this.camera.y);
        if (boundedDrawing) {
            const paper = new Path2D();
            paper.rect(0, 0, this.worldWidth, this.worldHeight);
            this.ctx.clip(paper);
        }

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
        this.ctx.strokeStyle = 'rgba(201, 93, 91, 0.72)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

        this.ctx.restore();
    }

    /** Decorative city props only. All coordinates deliberately hug the arena
     * edge, so the combat-readable centre remains clear. */
    private drawSketchbookSetDressing(): void {
        const ctx = this.ctx;
        const ink = '#35312b';

        const paper = (x: number, y: number, rotation = 0, color = '#fff8e8') => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.fillStyle = color;
            ctx.strokeStyle = ink;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-13, -9); ctx.lineTo(12, -7); ctx.lineTo(10, 9); ctx.lineTo(-12, 8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        };
        const tree = (x: number, y: number, scale = 1) => {
            ctx.save();
            ctx.translate(x, y); ctx.scale(scale, scale);
            ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.fillStyle = '#8d5b3f';
            ctx.beginPath(); ctx.moveTo(-5, 25); ctx.lineTo(-2, -1); ctx.lineTo(5, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
            const leaves: Array<[number, number, number, string]> = [[-14,-11,17,'#7eb85e'],[5,-16,19,'#63a65c'],[16,0,15,'#8cc55e'],[-4,6,18,'#9dcb65']];
            for (const [lx, ly, r, color] of leaves) {
                ctx.fillStyle = color; ctx.strokeStyle = ink; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
            ctx.restore();
        };
        const lamp = (x: number, y: number) => {
            ctx.save(); ctx.translate(x, y); ctx.strokeStyle = ink; ctx.fillStyle = '#374d4f'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 27); ctx.lineTo(0, -21); ctx.stroke();
            ctx.fillRect(-5, 22, 10, 5); ctx.fillRect(-9, -19, 18, 20);
            ctx.fillStyle = '#f4ce61'; ctx.fillRect(-5, -15, 10, 12); ctx.strokeRect(-9, -19, 18, 20);
            ctx.restore();
        };
        const bench = (x: number, y: number) => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(-.1); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.fillStyle = '#b67743';
            ctx.fillRect(-28, -9, 56, 9); ctx.fillRect(-28, 3, 56, 8); ctx.strokeRect(-28, -9, 56, 9); ctx.strokeRect(-28, 3, 56, 8);
            ctx.strokeStyle = '#374d4f'; ctx.beginPath(); ctx.moveTo(-20, 11); ctx.lineTo(-23, 25); ctx.moveTo(20,11); ctx.lineTo(23,25); ctx.stroke(); ctx.restore();
        };
        const stall = (x: number, y: number) => {
            ctx.save(); ctx.translate(x, y); ctx.strokeStyle = ink; ctx.lineWidth = 3;
            ctx.fillStyle = '#b56f45'; ctx.fillRect(-35, -2, 70, 36); ctx.strokeRect(-35, -2, 70, 36);
            ctx.fillStyle = '#f8f1de'; ctx.fillRect(-42, -24, 84, 23); ctx.strokeRect(-42, -24, 84, 23);
            for (let sx = -39; sx < 42; sx += 20) { ctx.fillStyle = '#4e94c4'; ctx.fillRect(sx, -24, 10, 23); }
            ctx.strokeRect(-42, -24, 84, 23); ctx.restore();
        };
        const paintStroke = (x: number, y: number, color: string, rotation: number) => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -7, 24, 1); ctx.stroke(); ctx.restore();
        };

        // All scenery stays inside a 190px perimeter; the interior is a blank
        // drawing surface. Relative placement also supports the smaller arena.
        const building = (x: number, y: number, color: string, variant: number) => {
            ctx.save(); ctx.translate(x, y);
            ctx.lineWidth = 2.5; ctx.strokeStyle = ink;
            ctx.fillStyle = '#c5b7a0';
            ctx.beginPath(); ctx.moveTo(54,-70); ctx.lineTo(72,-80); ctx.lineTo(72,48); ctx.lineTo(54,60); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = color; ctx.fillRect(-55,-75,110,135); ctx.strokeRect(-55,-75,110,135);
            // Terracotta roof, individual tiles and uneven eaves.
            ctx.fillStyle = '#cf7754'; ctx.beginPath(); ctx.moveTo(-65,-74); ctx.lineTo(-43,-107); ctx.lineTo(53,-103); ctx.lineTo(69,-72); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.lineWidth = 1; ctx.strokeStyle = '#8e503b';
            for (let tx=-46; tx<58; tx+=13) { ctx.beginPath(); ctx.moveTo(tx,-100); ctx.lineTo(tx-9,-76); ctx.stroke(); }
            ctx.strokeStyle = ink; ctx.lineWidth = 2;
            for (const wx of [-33, 22]) {
                ctx.fillStyle = '#334e53'; ctx.fillRect(wx,-53,22,31); ctx.strokeRect(wx,-53,22,31);
                ctx.fillStyle = '#81b7b0'; ctx.fillRect(wx-7,-52,6,30); ctx.fillRect(wx+23,-52,6,30);
                ctx.strokeRect(wx-7,-52,6,30); ctx.strokeRect(wx+23,-52,6,30);
                ctx.strokeStyle = '#eae3bd'; ctx.beginPath(); ctx.moveTo(wx+11,-51); ctx.lineTo(wx+11,-24); ctx.stroke(); ctx.strokeStyle = ink;
                ctx.fillStyle = '#b47a4d'; ctx.fillRect(wx-3,-20,29,7);
                for (let f=0; f<4; f++) { ctx.fillStyle = f%2 ? '#e4b54f' : '#65944c'; ctx.beginPath(); ctx.arc(wx+f*7,-23,4,0,Math.PI*2); ctx.fill(); }
            }
            ctx.fillStyle = '#5e736f'; ctx.fillRect(-14,12,29,48); ctx.strokeRect(-14,12,29,48);
            ctx.fillStyle = '#e9bc45'; ctx.beginPath(); ctx.arc(7,38,2,0,7); ctx.fill();
            // Striped shop canopy and its scalloped fabric edge.
            for (let s=0;s<7;s++) { ctx.fillStyle = s%2 ? '#fff4d9' : variant%2 ? '#668eae' : '#d27a72'; ctx.fillRect(-49+s*14,-4,14,18); ctx.beginPath(); ctx.arc(-42+s*14,14,7,0,Math.PI); ctx.fill(); }
            ctx.strokeRect(-49,-4,98,18);
            ctx.fillStyle = '#f8efcf'; ctx.fillRect(-24,-17,49,11); ctx.strokeRect(-24,-17,49,11);
            // Pencil marks and masonry detail stay on the facade.
            ctx.globalAlpha = .32; ctx.lineWidth = 1;
            for(let h=0;h<6;h++) { ctx.beginPath(); ctx.moveTo(-49+h*5,35); ctx.lineTo(-43+h*5,47); ctx.stroke(); }
            ctx.restore();
        };
        const w = this.worldWidth, h = this.worldHeight;
        const colors = ['#e6c879','#a6c7cc','#c6b1ce','#dca995'];
        ctx.save();
        // Sidewalk edging frames the usable paper without painting over it.
        ctx.strokeStyle = '#b9aa90'; ctx.lineWidth = 2;
        ctx.strokeRect(190,190,w-380,h-380);
        for(let i=0,x=100;x<w-60;x+=205,i++) {
            building(x,115,colors[i%4],i);
            building(x,h-75,colors[(i+2)%4],i+1);
            tree(x+85,156,.7); tree(x+85,h-42,.65);
            if(i%2===0) { lamp(x+70,65); bench(x+15,h-156); }
        }
        for(let i=0,y=350;y<h-240;y+=235,i++) {
            building(80,y,colors[(i+1)%4],i);
            building(w-105,y,colors[(i+3)%4],i+1);
            tree(147,y+59,.8); tree(w-155,y+65,.8);
            lamp(158,y-79); lamp(w-165,y-79);
            bench(85,y+104); stall(w-100,y+113);
            paper(155,y+110,.3); paper(w-165,y+121,-.3);
        }
        ctx.restore();
    }
}
