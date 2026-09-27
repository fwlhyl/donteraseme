import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { EnemyFactory } from '../entities/EnemyFactory';
import { EnemyBehavior } from '../components/EnemyBehavior';
import type { EnemyType } from '../components/EnemyBehavior';
import { Velocity } from '../components/Velocity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Health } from '../components/Health';
import { StoryState } from '../components/StoryState';

interface TimelineStage {
    endSecond: number;
    maxEnemies: number;
    spawnInterval: number; // Seconds
    weights: { type: EnemyType; weight: number }[];
}

// 0-20分钟的无尽时间轴刷怪配置
const TIMELINE: TimelineStage[] = [
    // 阶段1: 0-3分钟 (0-180s) 轻松热身，只有杂兵
    { endSecond: 180, maxEnemies: 40, spawnInterval: 1.5, weights: [{ type: 'chaser', weight: 100 }] },
    // 阶段2: 3-5分钟 (180-300s) 引入高伤杂兵 (eraser)
    { endSecond: 300, maxEnemies: 70, spawnInterval: 1.0, weights: [{ type: 'chaser', weight: 70 }, { type: 'eraser', weight: 30 }] },
    // 阶段3: 5-7分钟 (300-420s) 第1个BOSS之后，引入远程怪 (shooter) 和极速纸飞机 (paper_plane)
    { endSecond: 420, maxEnemies: 100, spawnInterval: 0.8, weights: [{ type: 'chaser', weight: 58 }, { type: 'eraser', weight: 27 }, { type: 'shooter', weight: 5 }, { type: 'paper_plane', weight: 10 }] },
    // 阶段4: 7-10分钟 (420-600s) 引入持盾精英怪 (shield)
    { endSecond: 600, maxEnemies: 150, spawnInterval: 0.6, weights: [{ type: 'chaser', weight: 48 }, { type: 'eraser', weight: 24 }, { type: 'shooter', weight: 8 }, { type: 'paper_plane', weight: 10 }, { type: 'shield', weight: 10 }] },
    // 阶段5: 10-15分钟 (600-900s) 第2个BOSS之后，引入墨水母体 (summoner) 和 磁性黑洞 (blackhole)
    { endSecond: 900, maxEnemies: 200, spawnInterval: 0.4, weights: [{ type: 'chaser', weight: 43 }, { type: 'eraser', weight: 18 }, { type: 'shooter', weight: 9 }, { type: 'paper_plane', weight: 10 }, { type: 'shield', weight: 10 }, { type: 'summoner', weight: 10 } /* , { type: 'blackhole', weight: 5 } */] },
    // 阶段6: 15-20分钟 (900-1200s) 第3个BOSS之后，满屏弹幕与精英
    { endSecond: 1200, maxEnemies: 250, spawnInterval: 0.3, weights: [{ type: 'chaser', weight: 33 }, { type: 'eraser', weight: 18 }, { type: 'shooter', weight: 10 }, { type: 'paper_plane', weight: 14 }, { type: 'shield', weight: 15 }, { type: 'summoner', weight: 10 } /* , { type: 'blackhole', weight: 5 } */] },
    // 阶段7: 20分钟之后 (1200s+) 第4个终极BOSS之后，无尽狂热
    { endSecond: Infinity, maxEnemies: 300, spawnInterval: 0.15, weights: [{ type: 'chaser', weight: 28 }, { type: 'eraser', weight: 18 }, { type: 'shooter', weight: 10 }, { type: 'paper_plane', weight: 14 }, { type: 'shield', weight: 15 }, { type: 'summoner', weight: 15 } /* , { type: 'blackhole', weight: 10 } */] }
];

// BOSS 刷新时间点 (秒)
const BOSS_SPAWN_TIMES = [300, 600, 900, 1200]; // 5, 10, 15, 20 分钟

export class WaveSystem extends System {
    private spawnTimer: number = 0;
    private survivalTime: number = 0;
    private bossSpawnedFlags: boolean[] = [false, false, false, false];
    
    // 环境颜料墙相关
    private envWallSpawnTimer: number = 20; // 首次生成延迟20秒
    private wallColorPalette: string[] = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];

    private width: number = window.innerWidth;
    private height: number = window.innerHeight;

    constructor(
        private addEntityCallback: (entity: Entity) => void,
        private camera: { x: number, y: number },
        private getMode: () => 'story' | 'endless' = () => 'endless'
    ) {
        super();
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        });
    }

    public update(dt: number): void {
        // Only spawn enemies automatically in endless mode or after prologue
        if (this.getMode() === 'story') {
            let inPrologue = false;
            for (const entity of this.entities) {
                if (entity.tags.has('player')) {
                    const story = entity.getComponent(StoryState);
                    if (story && story.chapter === 'Prologue') {
                        inPrologue = true;
                    }
                    break;
                }
            }
            if (inPrologue) return; // Do not spawn waves during Prologue
        }

        this.survivalTime += dt;

        // Count active enemies (exclude walls which are not counted towards max enemies)
        let activeEnemies = 0;
        for (const entity of this.entities) {
            // Check if it's an enemy but NOT a wall (walls are particles/environment)
            if (entity.hasComponent(EnemyBehavior) && !entity.tags.has('wall')) {
                activeEnemies++;
            }
        }

        // 检查 BOSS 刷新
        for (let i = 0; i < BOSS_SPAWN_TIMES.length; i++) {
            if (this.survivalTime >= BOSS_SPAWN_TIMES[i] && !this.bossSpawnedFlags[i]) {
                this.bossSpawnedFlags[i] = true;
                this.spawnBoss(i + 1); // 传入 Boss 阶段数 (1-4)
            }
        }

        // 获取当前时间轴阶段配置
        let currentStage = TIMELINE[0];
        for (const stage of TIMELINE) {
            if (this.survivalTime <= stage.endSecond) {
                currentStage = stage;
                break;
            }
        }

        // 在 BOSS 存活期间，可以适当减少杂兵刷新频率或上限，这里选择不减少以保持高压，但可以根据需要调整
        const maxEnemies = currentStage.maxEnemies;
        
        // Spawn logic
        if (activeEnemies < maxEnemies) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy(currentStage);
                this.spawnTimer = currentStage.spawnInterval;
            }
        }

        // Spawn Environmental Paint Walls
        // 根据存活时间缩短颜料墙的生成间隔
        const wallInterval = Math.max(10, 20 - (this.survivalTime / 60) * 2);
        this.envWallSpawnTimer -= dt;
        if (this.envWallSpawnTimer <= 0) {
            this.envWallSpawnTimer = wallInterval;
            this.spawnEnvironmentalWall();
        }
    }

    public reset(): void {
        this.survivalTime = 0;
        this.spawnTimer = 0;
        this.envWallSpawnTimer = 20;
        this.bossSpawnedFlags = [false, false, false, false];
    }

    private spawnEnvironmentalWall(): void {
        const viewX = this.camera.x;
        const viewY = this.camera.y;
        const viewW = this.width;
        const viewH = this.height;

        // 生成距离玩家一定范围的起点
        const spawnDist = Math.min(viewW, viewH) / 2 + 100;
        const startAngle = Math.random() * Math.PI * 2;
        const startX = viewX + viewW / 2 + Math.cos(startAngle) * spawnDist;
        const startY = viewY + viewH / 2 + Math.sin(startAngle) * spawnDist;

        // 生成一系列连续的线段作为墙体
        const numSegments = 3 + Math.floor(Math.random() * 5); // 3-7 段
        const segmentLength = 100 + Math.random() * 150; // 100-250 长度
        const color = this.wallColorPalette[Math.floor(Math.random() * this.wallColorPalette.length)];

        let currentX = startX;
        let currentY = startY;
        
        // 让初始方向指向屏幕中心（玩家大致所在的位置），使得墙体有概率穿过或靠近玩家
        let currentAngle = Math.atan2((viewY + viewH / 2) - startY, (viewX + viewW / 2) - startX) + (Math.random() - 0.5) * Math.PI / 2;

        for (let i = 0; i < numSegments; i++) {
            const endX = currentX + Math.cos(currentAngle) * segmentLength;
            const endY = currentY + Math.sin(currentAngle) * segmentLength;

            const wall = new Entity();
            wall.tags.add('wall');
            wall.addComponent(new Transform(currentX, currentY));
            wall.addComponent(new Renderable(color, 20, currentX, currentY, 'wall_line'));
            
            const wallRender = wall.getComponent(Renderable)!;
            wallRender.width = endX;
            wallRender.height = endY;
            
            // 环境生成的墙体血量适当降低，以免过度封锁
            wall.addComponent(new Health(150, 150));
            // 墙体存在一段时间后自然消失
            const wallBeh = new EnemyBehavior('particle');
            wallBeh.lifeTimer = 1200; // 20秒
            wall.addComponent(wallBeh);
            
            this.addEntityCallback(wall);

            // 更新下一段的起点和角度
            currentX = endX;
            currentY = endY;
            // 稍微改变一点角度，让墙体不规则（-45度 到 45度 之间偏转）
            currentAngle += (Math.random() - 0.5) * Math.PI / 2;
        }
    }

    private spawnBoss(bossPhase: number): void {
        const viewX = this.camera.x;
        const viewY = this.camera.y;
        const viewW = this.width;
        const viewH = this.height;
        
        // 生成在玩家视野正上方稍微远一点的位置，避免直接刷脸
        const x = viewX + viewW / 2;
        const y = viewY - 200;

        const warn = new Entity();
        warn.addComponent(new Transform(x, y));
        warn.addComponent(new Renderable('rgba(255,204,0,0.25)', 120, 0, 0, 'circle', 9999));
        this.addEntityCallback(warn);
        
        let bossName = '';
        if (bossPhase === 1) bossName = '色彩剥夺者·多面棱镜';
        else if (bossPhase === 2) bossName = '清道夫·巨型滚刷';
        else if (bossPhase === 3) bossName = '混沌污染源·泼墨巨兽';
        else if (bossPhase === 4) bossName = '空白法则·终极橡皮擦';

        window.dispatchEvent(new CustomEvent('announce', { detail: { text: `警告：第 ${bossPhase} 阶段 BOSS ${bossName} 降临！` } }));
        
        setTimeout(() => {
            let bossType: EnemyType = 'boss_prism';
            if (bossPhase === 2) bossType = 'boss_roller';
            else if (bossPhase === 3) bossType = 'boss_slime';
            else if (bossPhase === 4) bossType = 'boss_eraser';

            const boss = EnemyFactory.create(bossType, x, y);
            const hp = boss.getComponent(Health);
            if (hp) {
                // 基础血量已经在 EnemyFactory 中设置，不再乘以倍数
                // hp.max *= mult;
                // hp.current = hp.max;
            }
            this.addEntityCallback(boss);
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `激战开始！击败BOSS获取专属觉醒！` } }));
        }, 1500);

        setTimeout(() => {
            warn.active = false;
        }, 1500);
    }

    private spawnSpecificEnemy(type: EnemyType): void {
        const viewX = this.camera.x;
        const viewY = this.camera.y;
        const viewW = this.width;
        const viewH = this.height;
        
        // 生成在视野外
        const spawnDist = Math.max(viewW, viewH) / 2 + 100;
        const angle = Math.random() * Math.PI * 2;
        const x = viewX + viewW / 2 + Math.cos(angle) * spawnDist;
        const y = viewY + viewH / 2 + Math.sin(angle) * spawnDist;

        const enemy = EnemyFactory.create(type, x, y);
        const hp = enemy.getComponent(Health);
        if (hp) {
            const minutes = Math.floor(this.survivalTime / 60);
            hp.max = Math.floor(hp.max * (1 + minutes * 0.2));
            hp.current = hp.max;
        }
        
        if (type === 'boss') {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `【领主】降临，清理场地！` } }));
        }
        
        this.addEntityCallback(enemy);
    }

    private spawnEnemy(stage: TimelineStage): void {
        // Calculate visible area in world coordinates
        const viewX = this.camera.x;
        const viewY = this.camera.y;
        const viewW = this.width;
        const viewH = this.height;
        const padding = 50;
        let x = 0, y = 0;

        // 随机在屏幕四边生成
        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0: // Top
                x = viewX + Math.random() * viewW;
                y = viewY - padding;
                break;
            case 1: // Right
                x = viewX + viewW + padding;
                y = viewY + Math.random() * viewH;
                break;
            case 2: // Bottom
                x = viewX + Math.random() * viewW;
                y = viewY + viewH + padding;
                break;
            case 3: // Left
                x = viewX - padding;
                y = viewY + Math.random() * viewH;
                break;
        }
        
        // 根据权重选择怪物类型
        const totalWeight = stage.weights.reduce((sum, w) => sum + w.weight, 0);
        let randomVal = Math.random() * totalWeight;
        let selectedType: EnemyType = 'chaser';
        
        for (const w of stage.weights) {
            if (randomVal <= w.weight) {
                selectedType = w.type;
                break;
            }
            randomVal -= w.weight;
        }
        
        const enemy = EnemyFactory.create(selectedType, x, y);
        
        // 随时间增加怪物数值（每分钟增加一定比例血量和伤害）
        const hp = enemy.getComponent(Health);
        if (hp) {
            // 每存活1分钟，怪物血量增加 20%
            const minutes = Math.floor(this.survivalTime / 60);
            const hpMultiplier = 1 + (minutes * 0.2);
            hp.max = Math.floor(hp.max * hpMultiplier);
            hp.current = hp.max;
        }

        // 还可以提升移动速度（可选），这里仅增加少量
        const velocity = enemy.getComponent(Velocity);
        if (velocity) {
            const minutes = Math.floor(this.survivalTime / 60);
            // 速度最多增加 50%
            const speedMultiplier = Math.min(1.5, 1 + (minutes * 0.05));
            velocity.speed *= speedMultiplier;
        }

        this.addEntityCallback(enemy);
    }
}
