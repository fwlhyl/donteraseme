import { Component } from '../core/Component';
import { t, getLang } from '../i18n/index';

export class PlayerStats extends Component {
    // 基础属性池 (会受角色初始属性和技能加成影响)
    public maxHp: number = 100;
    public currentHp: number = 100;
    
    // 各种乘区系数 (Multiplier)
    public speedMultiplier: number = 1.0;
    public fireRateMultiplier: number = 1.0;
    public damageMultiplier: number = 1.0;
    public reloadSpeedMultiplier: number = 1.0;
    public trailWidthMultiplier: number = 1.0;
    
    // 暴击与吸血与闪避
    public critChance: number = 0.0;
    public critDamage: number = 1.5;
    public lifesteal: number = 0.0;
    public dodgeChance: number = 0.0;
    
    // 其他属性
    public bulletCountBonus: number = 0; // 额外弹道数
    public pierceBonus: number = 0;      // 额外穿透次数
    public sizeMultiplier: number = 1.0; // 体型大小乘区
    public pickupRange: number = 30;     // 经验拾取范围 (更小的初始范围，配合截图红框)
    
    // 当前拥有的技能与等级字典 (skillId -> level)
    public acquiredSkills: Record<string, number> = {};
    
    // 局内经验与等级
    public level: number = 1;
    public currentXp: number = 0;
    public xpToNextLevel: number = 100;
    
    // 击杀数/金币数
    public kills: number = 0;
    public gold: number = 0;

    // 存活时间（秒）
    public survivalTime: number = 0;

    // 角色ID
    public characterId: string = 'collector';

    // 速度溢出收益：当移动速度超过硬上限(8.0)时，溢出的部分会记录在这里
    public speedOverflow: number = 0;

    // 涂鸦客专用：记录按住攻击时的路径点
    public graffitiPath: {x: number, y: number}[] = [];
    public isDrawingGraffiti: boolean = false;

    // 古典油画家专用：护盾系统
    public hasClassicalShield: boolean = false;
    public shieldCooldownFrames: number = 0;
    public maxShieldCooldownFrames: number = 1200; // 20秒 * 60帧 = 1200帧

    // 古典油画家觉醒1：不朽名作 (多层护盾)
    public classicalShieldStacks: number = 1;
    public maxClassicalShieldStacks: number = 1;

    // 水彩插画师被动：是否有水痕被动
    public hasWatercolorPassive: boolean = false;

    // 数字板绘师被动：浮游炮“数位笔”
    public hasDigitalPassive: boolean = false;
    public digitalPenCooldown: number = 0;
    public maxDigitalPenCooldown: number = 180; // 每3秒触发一次 (180帧)
    public lastAttackConfig: any = null; // WeaponConfig
    public digitalPenBurstCount: number = 0;
    public digitalPenBurstDelay: number = 0;
    public digitalTurrets: any[] = []; // 觉醒2的固定炮台

    // 书法家被动：入木三分
    public hasCalligrapherPassive: boolean = false;
    public calligrapherDamageStacks: number = 0;
    public maxCalligrapherStacks: number = 100; // 最大100层（如每层增加2%伤害，最大200%）
    public calligrapherStackTimer: number = 0; // 叠加计时器

    // 水墨画家被动：墨染
    public hasInkPassive: boolean = false;

    // 占点Buff
    public invincibleUntil: number = 0;
    public infiniteAmmoUntil: number = 0;

    // 击杀触发系：墨滴狂热 (kill_frenzy)
    public killFrenzyStacks: { amount: number, expireTime: number }[] = [];
    
    // 击杀触发系：死神收割 (kill_reaper)
    public killReaperCount: number = 0;
    public killReaperReady: boolean = false;

    // 防御/受击触发系：折纸盾牌 (defense_shield)
    public hasOrigamiShield: boolean = false;
    public origamiShieldCooldownFrames: number = 0;

    // 防御/受击触发系：墨水替身 (defense_dummy)
    public dummyCooldownFrames: number = 0;
    public dummySpeedBuffFrames: number = 0;

    // 防御/受击触发系：绝境爆炸 (defense_desperate_explosion)
    public explosionCooldownFrames: number = 0;

    // 防御/受击触发系：刺猬装甲 (defense_hedgehog)
    public hedgehogCooldownFrames: number = 0;
    
    // 技能：磁力曲别针倒计时
    public paperclipTimer: number = 0;

    // 走位互动系
    public moveSameDirFrames: number = 0; // 镜像位移 (move_mirror)
    public lastMoveDir: { x: number, y: number } = { x: 0, y: 0 };
    
    public mirrorMovementLocked: boolean = false;
    public mirrorLandingFrames: number = 0; // One collision pass of contact-only protection.
    public skateboardIdleFrames: number = 0;
    public skateboardActive: boolean = false;
    public skateboardFrames: number = 0; // 颜料滑板 (move_skateboard)
    public staticFrames: number = 0; // 静止蓄能 (move_static_charge)
    
    // 缓存当前的速度（标量）和开火状态
    public currentSpeed: number = 0;
    
    // 走位互动系加成状态
    public skateboardDamageBonus: number = 0;
    public staticDamageBonus: number = 0;
    public parkourDodgeBonus: number = 0;
    public rabbitCritBonus: number = 0;

    // 收藏家觉醒2：散财消灾触发次数
    public collectorAwaken2Triggers: number = 0;

    constructor() {
        super();
    }

    // 动态计算属性 Getter
    public get totalDodgeChance(): number {
        return this.dodgeChance + this.parkourDodgeBonus;
    }

    public get totalCritChance(): number {
        let base = this.critChance + this.rabbitCritBonus;
        if (this.hasSkill('awakening_collector_1')) {
            base += Math.floor(this.gold / 100) * 0.02; // 收藏家觉醒1：每100金币+2%暴击率
        }
        return base;
    }

    public get totalCritDamage(): number {
        let base = this.critDamage;
        if (this.hasSkill('awakening_collector_1')) {
            base += Math.floor(this.gold / 100) * 0.05; // 收藏家觉醒1：每100金币+5%暴击伤害
        }
        return base;
    }

    public get totalReloadMultiplier(): number {
        let base = this.reloadSpeedMultiplier;
        // 速写漫画家觉醒2：极限截稿
        if (this.hasSkill('awakening_sketcher_2')) {
            const hpPercent = this.currentHp / this.maxHp;
            const missingPercent = 1.0 - hpPercent;
            // 最多提供 2.0 (200%) 的额外加成
            base += missingPercent * 2.0;
        }
        return base;
    }

    public get totalFireRateMultiplier(): number {
        let base = this.fireRateMultiplier;
        // 速写漫画家觉醒2：极限截稿
        if (this.hasSkill('awakening_sketcher_2')) {
            const hpPercent = this.currentHp / this.maxHp;
            const missingPercent = 1.0 - hpPercent;
            // 最多提供 2.0 (200%) 的额外加成
            base += missingPercent * 2.0;
        }
        return base;
    }

    public get totalDamageMultiplier(): number {
        return this.damageMultiplier * (1.0 + this.skateboardDamageBonus + this.staticDamageBonus);
    }

    // 快捷方法：检查是否拥有某个技能，以及获取技能等级
    public getSkillLevel(skillId: string): number {
        return this.acquiredSkills[skillId] || 0;
    }

    public hasSkill(skillId: string): boolean {
        return this.getSkillLevel(skillId) > 0;
    }

    public learnSkill(skillId: string): void {
        this.acquiredSkills[skillId] = (this.acquiredSkills[skillId] || 0) + 1;
    }
}