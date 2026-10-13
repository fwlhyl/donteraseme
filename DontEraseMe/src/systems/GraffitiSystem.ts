import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { PlayerStats } from '../components/PlayerStats';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { Health } from '../components/Health';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { DamageTextSystem } from './DamageTextSystem';
import { Experience } from '../components/Experience';
import { Score } from '../components/Score';
import { ExperienceOrb } from '../components/ExperienceOrb';
import { Projectile } from '../components/Projectile';
import { ParticleFactory } from '../entities/ParticleFactory';

interface GraffitiZone {
    polygon: {x: number, y: number}[];
    bounds: { minX: number, minY: number, maxX: number, maxY: number };
    life: number;
    maxLife: number;
    playerStats: PlayerStats;
}

interface GraffitiSegmentIndex {
    indexedCount: number;
    cells: Map<string, number[]>;
    longSegments: number[];
}

export class GraffitiSystem extends System {
    private trailCtx?: CanvasRenderingContext2D;
    
    // Configurable parameters
    private minDistanceSq: number = 25; // 5^2, minimum distance between points to record
    private intersectionSkipPoints: number = 10; // Must be at least this many points apart to count as a loop (prevents adjacent segment intersection)
    private initialDamage: number = 100; // Base damage for closed loop (50% of original 200)
    private dotDamage: number = 20; // Damage per second in the zone
    private slowMultiplier: number = 0.3; // 70% slow down in zone
    private zoneLife: number = 5.0; // Zone lasts for 5 seconds
    
    // Active graffiti zones
    private activeZones: GraffitiZone[] = [];
    private frame: number = 0;
    // Paths are append-only until replaced on release/loop closure. Weak keys
    // release the index with the old path without discarding any painted trail.
    private segmentIndices = new WeakMap<{x: number, y: number}[], GraffitiSegmentIndex>();
    private readonly segmentCellSize = 96;
    public addEntityCallback?: (entity: Entity) => void;

    constructor(trailCtx?: CanvasRenderingContext2D) {
        super();
        this.trailCtx = trailCtx;
    }

    public update(dt: number): void {
        this.frame++;
        
        // 1. Update active zones and apply continuous effects
        for (let i = this.activeZones.length - 1; i >= 0; i--) {
            const zone = this.activeZones[i];
            zone.life -= dt;
            
            if (zone.life <= 0) {
                this.activeZones.splice(i, 1);
                // Note: We don't clear the visual trail here, so the drawn path remains on the canvas.
                // The trailCtx content persists until erased by a monster.
                continue;
            }
            
            // Apply continuous effects every 30 frames (~0.5s at 60fps)
            if (this.frame % 30 === 0) {
                this.applyZoneEffects(zone);
            }
        }

        // 2. Handle player drawing logic
        for (const entity of this.entities) {
            if (!entity.tags.has('player')) continue;

            const stats = entity.getComponent(PlayerStats);
            const transform = entity.getComponent(Transform);
            
            if (!stats || !transform || stats.characterId !== 'graffiti') continue;

            if (entity.attacking) {
                // Currently attacking, record path
                this.recordPath(stats, transform);
            } else {
                // Stopped attacking, clear path
                if (stats.graffitiPath.length > 0) {
                    stats.graffitiPath = [];
                }
            }
        }
    }

    private recordPath(stats: PlayerStats, transform: Transform): void {
        const path = stats.graffitiPath;
        const currentPos = { x: transform.x, y: transform.y };

        if (path.length === 0) {
            path.push(currentPos);
            return;
        }

        const lastPos = path[path.length - 1];
        const dx = currentPos.x - lastPos.x;
        const dy = currentPos.y - lastPos.y;
        const distSq = dx * dx + dy * dy;

        // Only record point if moved far enough
        if (distSq > this.minDistanceSq) {
            // Before adding, check for intersection with previous segments
            const intersectionIdx = this.checkIntersection(path, lastPos, currentPos);
            
            if (intersectionIdx !== -1) {
                // Found a loop!
                // Extract the polygon
                const polygon = path.slice(intersectionIdx);
                polygon.push(currentPos);
                
                this.triggerLoopEffect(polygon, stats);
                
                // Clear path after triggering
                stats.graffitiPath = [];
            } else {
                path.push(currentPos);
            }
        }
    }

    // Returns the index of the point in the path where the intersection occurred, or -1
    private checkIntersection(path: {x: number, y: number}[], p1: {x: number, y: number}, p2: {x: number, y: number}): number {
        // We need at least intersectionSkipPoints to form a valid loop
        if (path.length < this.intersectionSkipPoints) return -1;

        const eligibleCount = path.length - this.intersectionSkipPoints;
        let candidates: number[] | null = null;
        if (eligibleCount > 64) {
            let index = this.segmentIndices.get(path);
            if (!index || index.indexedCount > eligibleCount) {
                index = { indexedCount: 0, cells: new Map(), longSegments: [] };
                this.segmentIndices.set(path, index);
            }
            // Only newly eligible segments are inserted as the skipped tail
            // advances; earlier points and the recorded stroke stay untouched.
            while (index.indexedCount < eligibleCount) {
                const i = index.indexedCount++;
                const bounds = this.segmentCellBounds(path[i], path[i + 1]);
                const cellCount = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
                if (!Object.values(bounds).every(Number.isSafeInteger) || !Number.isFinite(cellCount) || cellCount > 256) {
                    index.longSegments.push(i);
                    continue;
                }
                for (let y = bounds.minY; y <= bounds.maxY; y++) {
                    for (let x = bounds.minX; x <= bounds.maxX; x++) {
                        const key = `${x},${y}`;
                        let cell = index.cells.get(key);
                        if (!cell) index.cells.set(key, cell = []);
                        cell.push(i);
                    }
                }
            }

            const bounds = this.segmentCellBounds(p1, p2);
            const cellCount = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
            // Teleports can span the world: retain the linear fallback for
            // them instead of allocating an enormous rectangle of cells.
            if (Object.values(bounds).every(Number.isSafeInteger) && Number.isFinite(cellCount) && cellCount < eligibleCount) {
                const nearby = new Set(index.longSegments);
                for (let y = bounds.minY; y <= bounds.maxY; y++) {
                    for (let x = bounds.minX; x <= bounds.maxX; x++) {
                        const cell = index.cells.get(`${x},${y}`);
                        if (cell) for (const i of cell) nearby.add(i);
                    }
                }
                // The first intersecting segment defines the original loop.
                candidates = [...nearby].sort((a, b) => a - b);
            }
        }

        // The exact intersection test and its strict endpoint rules are unchanged.
        for (let candidate = 0; candidate < (candidates?.length ?? eligibleCount); candidate++) {
            const i = candidates ? candidates[candidate] : candidate;
            const p3 = path[i];
            const p4 = path[i + 1];

            if (this.linesIntersect(p1, p2, p3, p4)) {
                return i;
            }
        }
        return -1;
    }

    private segmentCellBounds(p1: {x: number, y: number}, p2: {x: number, y: number}) {
        return {
            minX: Math.floor(Math.min(p1.x, p2.x) / this.segmentCellSize),
            minY: Math.floor(Math.min(p1.y, p2.y) / this.segmentCellSize),
            maxX: Math.floor(Math.max(p1.x, p2.x) / this.segmentCellSize),
            maxY: Math.floor(Math.max(p1.y, p2.y) / this.segmentCellSize),
        };
    }

    // Helper: Line intersection
    private linesIntersect(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}): boolean {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
        if (det === 0) return false;

        const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
        const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

        return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1);
    }

    private triggerLoopEffect(polygon: {x: number, y: number}[], stats: PlayerStats): void {
        // 检查是否有觉醒1：绝对领域
        const isAwakened1 = stats.hasSkill('awakening_graffiti_1');
        // 检查是否有觉醒2：高压喷罐
        const isAwakened2 = stats.hasSkill('awakening_graffiti_2');

        // 1. Calculate bounding box for optimization
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of polygon) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        const damagedEnemies = new Set<string>();

        // 2. Find enemies inside polygon for initial burst damage
        for (const entity of this.entities) {
            if (!entity.tags.has('enemy') || !entity.active) continue;

            const enemyBehavior = entity.getComponent(EnemyBehavior);
            const transform = entity.getComponent(Transform);
            const health = entity.getComponent(Health);

            if (enemyBehavior && transform && health) {
                // Quick bounding box check
                if (transform.x >= minX && transform.x <= maxX && transform.y >= minY && transform.y <= maxY) {
                    // Detailed polygon point-in-polygon check
                    if (this.isPointInPolygon(transform, polygon)) {
                        // Check if immune (Eraser monsters)
                        if (enemyBehavior.type === 'eraser' || entity.tags.has('giant_eraser')) {
                            // Immune to graffiti
                            DamageTextSystem.addDamageText(transform.x, transform.y - 20, 0, '#888888', false, '免疫');
                        } else {
                            damagedEnemies.add(entity.id);
                            // Apply Initial Burst Damage
                            let finalDamage = this.initialDamage * stats.damageMultiplier;
                            
                            // 涂鸦客觉醒2：高压喷罐（15% 最大生命值真实伤害）
                                if (isAwakened2) {
                                    finalDamage = Math.max(finalDamage, health.max * 0.15);
                                }
                                
                                health.current -= finalDamage;
                                
                                // Show damage text
                                const textColor = isAwakened2 ? '#ff00ff' : '#ff4444'; // 觉醒后真伤用紫色飘字
                                DamageTextSystem.addDamageText(transform.x, transform.y - 20, finalDamage, textColor, true);
                                
                                // 觉醒2附加的视觉表现：被命中的敌人身上也会爆出紫色火花
                                if (isAwakened2 && this.addEntityCallback) {
                                    const particles = ParticleFactory.createExplosion(transform.x, transform.y, '#cc00ff', 8);
                                    particles.forEach(p => this.addEntityCallback!(p));
                                }
                            
                            if (health.current <= 0) {
                                entity.active = false;
                                let player: Entity | null = null;
                                for (const e of this.entities) {
                                    if (e.tags.has('player')) {
                                        player = e;
                                        break;
                                    }
                                }
                                if (player) {
                                    const exp = player.getComponent(Experience);
                                    if (exp && this.addEntityCallback) {
                                        const orb = new Entity();
                                        orb.tags.add('xp_orb');
                                        orb.addComponent(new Transform(transform.x, transform.y));
                                        orb.addComponent(new ExperienceOrb(20));
                                        orb.addComponent(new Renderable('#00ff00', 6, 0, 0, 'diamond'));
                                        this.addEntityCallback(orb);
                                    }
                                    const score = player.getComponent(Score);
                                    if (score) {
                                        score.value += 10;
                                        score.coins += 5;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 涂鸦客觉醒2：闭合瞬间爆发一个基于图形范围外扩的颜料冲击波 (AoE)
        if (isAwakened2 && this.addEntityCallback) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            // 1. 中心大爆炸特效
            const explosionParticles = ParticleFactory.createExplosion(centerX, centerY, '#ff00ff', 40);
            explosionParticles.forEach(p => this.addEntityCallback!(p));
            window.dispatchEvent(new CustomEvent('shake', { detail: { mag: 15, frames: 10 } }));

            // 2. 替代无限飞行的冲击波，改为在图形周围爆发一个巨型颜料冲击波 (AoE)
            // 半径：图形包围盒的一半再向外扩展 150 像素
            const blastRadius = Math.max(maxX - minX, maxY - minY) / 2 + 150;
            
            let playerEntity: Entity | null = null;
            for (const e of this.entities) {
                if (e.tags.has('player')) { playerEntity = e; break; }
            }
            
            // 视觉：创建一个扩张的光圈 (Shockwave)
            const shockwave = new Entity();
            shockwave.addComponent(new Transform(centerX, centerY));
            shockwave.addComponent(new Renderable('rgba(204, 0, 255, 0.8)', 10, 0, 0, 'shockwave'));
            const fxProj = new Projectile('shockwave_fx', 0, playerEntity ? playerEntity.id : '', 20); // 存活20帧
            (fxProj as any).maxRadius = blastRadius;
            shockwave.addComponent(fxProj);
            this.addEntityCallback(shockwave);

            // 逻辑：对 blastRadius 范围内的敌人造成伤害（排除已经在图形内受过伤的）
            for (const entity of this.entities) {
                if (!entity.tags.has('enemy') || !entity.active) continue;
                if (damagedEnemies.has(entity.id)) continue; // 已经在闭合图形内受过伤了

                const enemyBehavior = entity.getComponent(EnemyBehavior);
                const transform = entity.getComponent(Transform);
                const health = entity.getComponent(Health);
                
                if (enemyBehavior && transform && health) {
                    if (enemyBehavior.type === 'eraser' || entity.tags.has('giant_eraser')) continue; // 免疫

                    const dx = transform.x - centerX;
                    const dy = transform.y - centerY;
                    if (Math.sqrt(dx*dx + dy*dy) <= blastRadius) {
                        // Apply damage (真伤保底)
                        const finalDamage = Math.max(this.initialDamage * stats.damageMultiplier, health.max * 0.15);
                        health.current -= finalDamage;
                        
                        DamageTextSystem.addDamageText(transform.x, transform.y - 20, finalDamage, '#ff00ff', true);
                        
                        // 爆出火花
                        const particles = ParticleFactory.createExplosion(transform.x, transform.y, '#cc00ff', 8);
                        particles.forEach(p => this.addEntityCallback!(p));
                        
                        if (health.current <= 0) {
                            entity.active = false;
                            if (playerEntity) {
                                const exp = playerEntity.getComponent(Experience);
                                if (exp && this.addEntityCallback) {
                                    const orb = new Entity();
                                    orb.tags.add('xp_orb');
                                    orb.addComponent(new Transform(transform.x, transform.y));
                                    orb.addComponent(new ExperienceOrb(20));
                                    orb.addComponent(new Renderable('#00ff00', 6, 0, 0, 'diamond'));
                                    this.addEntityCallback(orb);
                                }
                                const score = playerEntity.getComponent(Score);
                                if (score) {
                                    score.value += 10;
                                    score.coins += 5;
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Register as an active graffiti zone
        // 涂鸦客觉醒1：持续时间延长至 15 秒
        const finalZoneLife = isAwakened1 ? 15.0 : this.zoneLife;
        this.activeZones.push({
            polygon,
            bounds: { minX, minY, maxX, maxY },
            life: finalZoneLife,
            maxLife: finalZoneLife,
            playerStats: stats
        });

        // 4. Visual Effect (draw the filled area)
        if (this.trailCtx) {
            this.trailCtx.save();
            this.trailCtx.beginPath();
            this.trailCtx.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                this.trailCtx.lineTo(polygon[i].x, polygon[i].y);
            }
            this.trailCtx.closePath();
            
            // Fill with a semi-transparent color
            this.trailCtx.fillStyle = 'rgba(153, 0, 255, 0.4)'; // Purpleish graffiti color
            this.trailCtx.fill();
            
            // Stroke
            this.trailCtx.lineWidth = 4;
            this.trailCtx.strokeStyle = 'rgba(153, 0, 255, 0.8)';
            this.trailCtx.stroke();
            
            this.trailCtx.restore();
        }
    }

    private applyZoneEffects(zone: GraffitiZone): void {
        const { polygon, bounds, playerStats } = zone;
        const damageAmount = this.dotDamage * playerStats.damageMultiplier * 0.5; // Damage per tick (0.5s)
        
        // 涂鸦客觉醒1：绝对领域 (沼泽内向中心拉扯)
        const isAwakened1 = playerStats.hasSkill('awakening_graffiti_1');
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        for (const entity of this.entities) {
            if (!entity.tags.has('enemy') || !entity.active) continue;

            const enemyBehavior = entity.getComponent(EnemyBehavior);
            const transform = entity.getComponent(Transform);
            const health = entity.getComponent(Health);
            const velocity = entity.getComponent(Velocity);

            if (enemyBehavior && transform && health && velocity) {
                // Quick bounding box check
                if (transform.x >= bounds.minX && transform.x <= bounds.maxX && transform.y >= bounds.minY && transform.y <= bounds.maxY) {
                    // Detailed polygon point-in-polygon check
                    if (this.isPointInPolygon(transform, polygon)) {
                        
                        if (enemyBehavior.type === 'eraser' || entity.tags.has('giant_eraser')) {
                            // Immune to graffiti
                            // Only show immune text occasionally to avoid clutter
                            if (this.frame % 60 === 0) {
                                DamageTextSystem.addDamageText(transform.x, transform.y - 20, 0, '#888888', false, '免疫');
                            }
                        } else {
                            // 觉醒1：向中心强力拉扯 (引力效果)
                            if (isAwakened1) {
                                const dx = centerX - transform.x;
                                const dy = centerY - transform.y;
                                const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                                // 牵引力
                                transform.x += (dx / dist) * 8.0;
                                transform.y += (dy / dist) * 8.0;
                            }

                            // Apply DoT
                            health.current -= damageAmount;
                            DamageTextSystem.addDamageText(transform.x, transform.y - 20, damageAmount, '#ffffff', false); // White text for DoT
                            
                            if (health.current <= 0) {
                                entity.active = false;
                            } else {
                                // Simply apply our new slow system via EnemyBehavior
                                enemyBehavior.slowFrames = 35; // slightly more than 30 frames (next tick)
                                enemyBehavior.slowFactor = this.slowMultiplier;
                            }
                        }
                    }
                }
            }
        }
    }

    // Ray-casting algorithm for point in polygon
    private isPointInPolygon(point: {x: number, y: number}, vs: {x: number, y: number}[]): boolean {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;

            let intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
