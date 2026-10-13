import { Component } from '../core/Component';

export type EnemyType = 'chaser' | 'shooter' | 'shield' | 'summoner' | 'paper_plane' | 'eraser' | 'blackhole' | 'boss' | 'boss_roller' | 'boss_prism' | 'boss_slime' | 'boss_eraser' | 'particle' | 'ink_dummy' | 'eraser_bomb';

export class EnemyBehavior extends Component {
    public slowFrames: number = 0;
    public slowFactor: number = 1;
    public blindFrames: number = 0; // 致盲帧数：在此期间无法追踪玩家
    public confusedFrames: number = 0; // 混乱帧数：在此期间转身攻击其他敌人
    
    // 元素附魔系状态
    public frozenFrames: number = 0; // 冻结帧数
    public corrosiveStacks: number = 0; // 腐蚀层数
    public corrosiveFactor: number = 0; // 腐蚀单层伤害加深倍率 (例如0.1)
    public burnFrames: number = 0; // 燃烧帧数
    public burnDamagePerFrame: number = 0; // 燃烧每帧伤害
    public burnSpread: boolean = false; // 是否引燃周围敌人

    // Guard Mode: an eraser keeps a stable ink target instead of jittering
    // across the painting every frame. Timers are frame-based like the rest of
    // this component's combat cooldowns.
    public defenseTargetX: number | null = null;
    public defenseTargetY: number | null = null;
    public defenseRetargetFrames: number = 0;
    public defenseEraseCooldown: number = 0;

    // 存活倒计时（如果是召唤物、临时粒子或替身，大于0时会倒计时并死亡）
    public lifeTimer: number = 0;
    
    // 临时存储替身技能等级（或伤害系数），用于死亡/爆炸时计算伤害
    public damageFactor: number = 1;

    constructor(
        public type: EnemyType = 'chaser',
        public shield: number = 0,
        public maxShield: number = 0,
        public shootCooldown: number = 0,
        public summonCooldown: number = 0,
        public bossTimer: number = 0,
        public bossPhase: number = 0
    ) {
        super();
    }
}
