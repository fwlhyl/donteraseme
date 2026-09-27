export enum EnemyTier {
    MINION = '杂兵',
    ELITE = '精英怪',
    BOSS = 'Boss'
}

export interface EnemyConfig {
    id: string;
    name: string;
    tier: EnemyTier;
    baseHp: number;
    baseSpeed: number;
    baseDamage: number;
    color: string;
    shape: 'circle' | 'rect' | 'sprite';
    width: number;
    height: number;
    radius: number;
    // XP 和金币掉落
    xpValue: number;
    goldValue: number;
    // 特殊AI或机制标识
    behaviorType: string;
    // 出场时间（秒），比如 Boss 可能是 300(5分钟)
    spawnTime?: number;
}

export const ENEMIES: EnemyConfig[] = [
    // --- 杂兵 ---
    {
        id: 'chaser_red',
        name: '红色颜料块',
        tier: EnemyTier.MINION,
        baseHp: 30,
        baseSpeed: 4,
        baseDamage: 5,
        color: '#ff4444',
        shape: 'circle',
        radius: 12,
        width: 24,
        height: 24,
        xpValue: 10,
        goldValue: 1,
        behaviorType: 'chase'
    },
    {
        id: 'chaser_blue',
        name: '蓝色颜料块 (稍快)',
        tier: EnemyTier.MINION,
        baseHp: 20,
        baseSpeed: 6,
        baseDamage: 5,
        color: '#4444ff',
        shape: 'circle',
        radius: 10,
        width: 20,
        height: 20,
        xpValue: 10,
        goldValue: 1,
        behaviorType: 'chase'
    },
    // --- 精英怪 ---
    {
        id: 'elite_shooter',
        name: '修正液射手',
        tier: EnemyTier.ELITE,
        baseHp: 300,
        baseSpeed: 1.2, // 降低精英远程怪的移动速度
        baseDamage: 15,
        color: '#ffffff',
        shape: 'rect',
        radius: 0,
        width: 30,
        height: 30,
        xpValue: 100,
        goldValue: 10,
        behaviorType: 'ranged_shoot' // 保持距离并发射激光
    },
    {
        id: 'elite_block',
        name: '重型橡皮块',
        tier: EnemyTier.ELITE,
        baseHp: 800,
        baseSpeed: 1,
        baseDamage: 20,
        color: '#dddddd',
        shape: 'rect',
        radius: 0,
        width: 50,
        height: 50,
        xpValue: 150,
        goldValue: 15,
        behaviorType: 'tank_block' // 阻挡子弹并清除颜料
    },
    {
        id: 'elite_spawner',
        name: '墨水瓶母体',
        tier: EnemyTier.ELITE,
        baseHp: 500,
        baseSpeed: 0.5,
        baseDamage: 10,
        color: '#222222',
        shape: 'circle',
        radius: 25,
        width: 50,
        height: 50,
        xpValue: 200,
        goldValue: 20,
        behaviorType: 'spawn_minions' // 源源不断分裂小怪
    },
    // --- Boss ---
    {
        id: 'boss_prism',
        name: '色彩剥夺者·多面棱镜',
        tier: EnemyTier.BOSS,
        baseHp: 1000,
        baseSpeed: 2,
        baseDamage: 30,
        color: '#ffffff',
        shape: 'circle',
        radius: 40,
        width: 80,
        height: 80,
        xpValue: 1000,
        goldValue: 100,
        behaviorType: 'shield_prism', // 四面护盾机制
        spawnTime: 300 // 5分钟
    },
    {
        id: 'boss_roller',
        name: '清道夫·巨型滚刷',
        tier: EnemyTier.BOSS,
        baseHp: 1500,
        baseSpeed: 3,
        baseDamage: 40,
        color: '#555555',
        shape: 'rect',
        radius: 0,
        width: 120,
        height: 40,
        xpValue: 1500,
        goldValue: 150,
        behaviorType: 'dash_charge', // 直线冲锋
        spawnTime: 600 // 10分钟
    },
    {
        id: 'boss_slime',
        name: '混沌污染源·泼墨巨兽',
        tier: EnemyTier.BOSS,
        baseHp: 2500,
        baseSpeed: 1.5,
        baseDamage: 50,
        color: '#111111',
        shape: 'circle',
        radius: 60,
        width: 120,
        height: 120,
        xpValue: 2000,
        goldValue: 200,
        behaviorType: 'poison_split', // 毒沼+分裂小怪
        spawnTime: 900 // 15分钟
    },
    {
        id: 'boss_eraser',
        name: '空白法则·终极橡皮擦',
        tier: EnemyTier.BOSS,
        baseHp: 4000,
        baseSpeed: 2,
        baseDamage: 80,
        color: '#ffffff',
        shape: 'rect',
        radius: 0,
        width: 150,
        height: 100,
        xpValue: 5000,
        goldValue: 500,
        behaviorType: 'final_eraser', // 3阶段终极BOSS
        spawnTime: 1200 // 20分钟
    }
];