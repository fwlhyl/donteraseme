export interface CharacterConfig {
    id: string;
    name: string;
    description: string;
    baseHp: number;
    baseSpeed: number;
    // 角色专属技能描述
    uniqueSkillName: string;
    uniqueSkillDesc: string;
}

export const CHARACTERS: CharacterConfig[] = [
    {
        id: 'collector',
        name: '收藏家 (Collector)',
        description: '平衡的基础属性，能快速积累财富',
        baseHp: 800,  //400
        baseSpeed: 4.25, // 平均速度
        uniqueSkillName: '打钱',
        uniqueSkillDesc: '随着游戏存活时间增加，金币获取量逐渐提升'
    },
    {
        id: 'graffiti',
        name: '街头涂鸦客',
        description: '以城市为画布的街头艺术家',
        baseHp: 600,
        baseSpeed: 5, // 高移速
        uniqueSkillName: '涂鸦护城河',
        uniqueSkillDesc: '按住攻击键移动时留下轨迹，闭合图形会瞬间造成伤害，并形成持续5秒的颜料沼泽（减速并持续伤害）'
    },
    {
        id: 'classical',
        name: '古典油画家 (Classical Painter)',
        description: '重装坦克，速度慢但血量最高',
        baseHp: 1000,
        baseSpeed: 3.65, // 低移速
        uniqueSkillName: '厚涂',
        uniqueSkillDesc: '自带护盾，能抵挡一次任意伤害（怪物碰撞或子弹）。护盾破裂后需20秒重新生成。'
    },
    {
        id: 'sketcher',
        name: '速写漫画家 (Sketch Artist)',
        description: '玻璃大炮，极致的射速和换弹',
        baseHp: 500,
        baseSpeed: 4.25,
        uniqueSkillName: '极速手感',
        uniqueSkillDesc: '基础射速和换弹速度提升30%，但生命值较少。'
    },
    {
        id: 'watercolor',
        name: '水彩插画师 (Watercolorist)',
        description: '擅长持续伤害和范围扩散',
        baseHp: 600,
        baseSpeed: 4.25,
        uniqueSkillName: '水痕',
        uniqueSkillDesc: '击杀敌人后在原地留下水痕毒沼，造成持续伤害'
    },
    {
        id: 'digital',
        name: '数字板绘师 (Digital Artist)',
        description: '自动化输出，伴随召唤物',
        baseHp: 9999, //360
        baseSpeed: 4.25,
        uniqueSkillName: 'Ctrl+C',
        uniqueSkillDesc: '自带“数位笔”浮游炮，周期性复制上一次强力攻击'
    },
    {
        id: 'calligrapher',
        name: '书法家 (Calligrapher)',
        description: '极高单发爆发，牺牲移动开火',
        baseHp: 500,
        baseSpeed: 4.25,
        uniqueSkillName: '入木三分',
        uniqueSkillDesc: '静止时伤害不断叠加，且子弹具有极强穿透力'
    },
    {
        id: 'ink',
        name: '水墨画家 (Ink Painter)',
        description: '利用致盲和隐蔽进行反击',
        baseHp: 500,
        baseSpeed: 4.25,
        uniqueSkillName: '墨染',
        uniqueSkillDesc: '受击喷射致盲水墨团，范围内的敌人丢失目标原地发愣'
    }
];

export enum SkillCategory {
    BASE_STATS = '基础属性强化',
    RELOAD = '换弹触发系',
    HIT = '命中/暴击触发系',
    KILL = '击杀触发系',
    SUMMON = '召唤物系',
    DEFENSE = '防御/受击触发系',
    MOVEMENT = '走位互动系',
    ELEMENT = '元素附魔系',
    SYNERGY = '双生联动系',
    BODY = '体型变异系',
    WEAPON_MASTERY = '专属武器觉醒系',
    CHARACTER_AWAKENING = '专属人物觉醒系'
}

export interface SkillLevelConfig {
    level: number;
    description: string;
    // 后续可在这里添加具体的数值字段，如 value1, value2 等
    // 以便在业务逻辑中直接读取
    value?: number;
    sizeMultiplier?: number;
    hpMultiplier?: number;
    dodgeBonus?: number;
}

export interface SkillConfig {
    id: string;
    name: string;
    category: SkillCategory;
    maxLevel: number;
    levels: SkillLevelConfig[];
    prerequisites?: string[]; // 前置技能ID（比如双生联动需要2个）
    requiredWeapon?: string; // 只有持有特定武器才能刷出该技能
    requiredCharacter?: string; // 只有特定角色才能刷出该技能
}

// 技能配置
export const SKILLS: SkillConfig[] = [
    // ================== 基础属性强化 ==================
    {
        id: 'base_speed', name: '健步如飞 (移速提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '移速 +10%', value: 0.1 },
            { level: 2, description: '移速 +25%', value: 0.25 },
            { level: 3, description: '移速 +50%', value: 0.5 }
        ]
    },
    {
        id: 'base_firerate', name: '灵感迸发 (射速提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '射速 +10%', value: 0.1 },
            { level: 2, description: '射速 +25%', value: 0.25 },
            { level: 3, description: '射速 +50%', value: 0.5 }
        ]
    },
    {
        id: 'base_dodge', name: '躲避伤害 (闪避提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '有 10% 概率避免受到伤害', value: 0.1 },
            { level: 2, description: '有 20% 概率避免受到伤害', value: 0.2 },
            { level: 3, description: '有 30% 概率避免受到伤害', value: 0.3 }
        ]
    },
    {
        id: 'base_health', name: '生命强化 (最大生命提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '最大生命值 +10%', value: 0.1 },
            { level: 2, description: '最大生命值 +25%', value: 0.25 },
            { level: 3, description: '最大生命值 +50%', value: 0.5 }
        ]
    },
    {
        id: 'base_damage', name: '武器伤害 (攻击提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '伤害 +10%', value: 0.1 },
            { level: 2, description: '伤害 +25%', value: 0.25 },
            { level: 3, description: '伤害 +50%', value: 0.5 }
        ]
    },
    {
        id: 'base_reload', name: '换弹速度 (换弹提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '换弹时间 -10%', value: 0.1 },
            { level: 2, description: '换弹时间 -25%', value: 0.25 },
            { level: 3, description: '换弹时间 -50%', value: 0.5 }
        ]
    },
    {
        id: 'base_trail', name: '轨迹粗细 (覆盖提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹粗细 +10%', value: 0.1 },
            { level: 2, description: '子弹粗细 +25%', value: 0.25 },
            { level: 3, description: '子弹粗细 +50%', value: 0.5 }
        ]
    },
    {
        id: 'base_pierce', name: '子弹穿透', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹额外穿透 1 个敌人', value: 1 },
            { level: 2, description: '子弹额外穿透 2 个敌人', value: 2 },
            { level: 3, description: '子弹额外穿透 3 个敌人', value: 3 }
        ]
    },
    {
        id: 'base_crit_chance', name: '致命笔锋 (暴击率提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '暴击率 +10%', value: 0.1 },
            { level: 2, description: '暴击率 +20%', value: 0.2 },
            { level: 3, description: '暴击率 +30%', value: 0.3 }
        ]
    },
    {
        id: 'base_crit_damage', name: '重墨渲染 (暴击伤害提升)', category: SkillCategory.BASE_STATS, maxLevel: 3,
        levels: [
            { level: 1, description: '暴击伤害倍率 +0.5倍', value: 0.5 },
            { level: 2, description: '暴击伤害倍率 +1.0倍', value: 1.0 },
            { level: 3, description: '暴击伤害倍率 +1.5倍', value: 1.5 }
        ]
    },

    // ================== 体型变异系 (Body Mutations) ==================
    {
        id: 'body_enlarge', name: '巨人画笔 (变大)', category: SkillCategory.BODY, maxLevel: 3,
        levels: [
            { level: 1, description: '角色体积 +15%，最大生命值 +20%', sizeMultiplier: 1.15, hpMultiplier: 1.2 },
            { level: 2, description: '角色体积 +30%，最大生命值 +40%', sizeMultiplier: 1.3, hpMultiplier: 1.4 },
            { level: 3, description: '角色体积 +50%，最大生命值 +70%', sizeMultiplier: 1.5, hpMultiplier: 1.7 }
        ]
    },
    {
        id: 'body_reduce', name: '微雕笔触 (变小)', category: SkillCategory.BODY, maxLevel: 3,
        levels: [
            { level: 1, description: '角色体积 -15%，闪避率 +10%', sizeMultiplier: 0.85, dodgeBonus: 0.1 },
            { level: 2, description: '角色体积 -30%，闪避率 +20%', sizeMultiplier: 0.7, dodgeBonus: 0.2 },
            { level: 3, description: '角色体积 -50%，闪避率 +30%', sizeMultiplier: 0.5, dodgeBonus: 0.3 }
        ]
    },
    
    // ================== 元素附魔系 ==================
    {
        id: 'element_ice', name: '冰霜颜料', category: SkillCategory.ELEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹有 20% 概率冻结敌人 1 秒', value: 0.2 },
            { level: 2, description: '冰冻概率提升至 30%', value: 0.3 },
            { level: 3, description: '冰冻概率提升至 40%，且冻结时间变为 1.5 秒', value: 0.4 }
        ]
    },
    {
        id: 'element_corrosive', name: '腐蚀墨水', category: SkillCategory.ELEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹命中使敌人受到伤害增加 10%，最多叠加 3 层', value: 0.1 },
            { level: 2, description: '每层伤害增加提升至 15%', value: 0.15 },
            { level: 3, description: '每层伤害增加提升至 20%', value: 0.2 }
        ]
    },
    {
        id: 'element_fire', name: '焦油燃烧', category: SkillCategory.ELEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹附加燃烧，每秒造成 20% 攻击力的持续伤害，持续 3 秒', value: 0.2 },
            { level: 2, description: '燃烧伤害提升至 35% 攻击力', value: 0.35 },
            { level: 3, description: '燃烧伤害提升至 50% 攻击力，且引燃周围敌人', value: 0.5 }
        ]
    },
    {
        id: 'element_electric', name: '静电导电', category: SkillCategory.ELEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '子弹命中时弹射 1 个附近敌人，造成 50% 伤害', value: 1 },
            { level: 2, description: '弹射 2 个附近敌人，造成 50% 伤害', value: 2 },
            { level: 3, description: '弹射 3 个附近敌人，造成 75% 伤害', value: 3 }
        ]
    },

    // ================== 换弹触发系 ==================
    {
        id: 'reload_thumbtack', name: '图钉禁锢', category: SkillCategory.RELOAD, maxLevel: 3,
        levels: [
            { level: 1, description: '每次换弹时，将自身周围小范围内的所有敌人钉住 2 秒' },
            { level: 2, description: '范围中等，持续 3 秒' },
            { level: 3, description: '范围大，持续 4 秒' }
        ]
    },
    {
        id: 'reload_pigment_dump', name: '颜料倾倒', category: SkillCategory.RELOAD, maxLevel: 3,
        levels: [
            { level: 1, description: '每次换弹时在脚下留下一摊毒水，持续 5 秒，造成基础伤害' },
            { level: 2, description: '范围扩大，伤害 +50%' },
            { level: 3, description: '毒水内的敌人移速降低 50%' }
        ]
    },
    {
        id: 'reload_compass_dash', name: '圆规冲刺', category: SkillCategory.RELOAD, maxLevel: 3,
        levels: [
            { level: 1, description: '弹匣为 0 换弹时，向移动方向短冲刺，画出半圆减速敌人 30% 并造成伤害' },
            { level: 2, description: '冲刺距离中等，减速 50%' },
            { level: 3, description: '冲刺期间无敌，减速 80%' }
        ]
    },
    {
        id: 'reload_inspiration', name: '灵感爆发', category: SkillCategory.RELOAD, maxLevel: 3,
        levels: [
            { level: 1, description: '换弹后的第一发子弹必定暴击，且伤害 +100%' },
            { level: 2, description: '第一发子弹伤害 +200%' },
            { level: 3, description: '第一发子弹伤害 +300% 且附带穿透' }
        ]
    },

    // ================== 命中/暴击触发系 ==================
    {
        id: 'hit_sketch_clone', name: '素描分身', category: SkillCategory.HIT, maxLevel: 3,
        levels: [
            { level: 1, description: '击中敌人后，30% 概率分裂 2 发额外子弹弹射其他敌人' },
            { level: 2, description: '概率提升至 40%，分裂 2 发' },
            { level: 3, description: '概率提升至 50%，分裂 4 发' }
        ]
    },
    {
        id: 'hit_explosion', name: '色彩爆炸', category: SkillCategory.HIT, maxLevel: 3,
        levels: [
            { level: 1, description: '触发暴击时，必定产生一次小范围爆炸（爆炸伤害受暴击伤害倍率加成）' },
            { level: 2, description: '爆炸范围扩大' },
            { level: 3, description: '爆炸伤害额外翻倍' }
        ]
    },
    {
        id: 'crit_pierce', name: '致命穿透', category: SkillCategory.HIT, maxLevel: 3,
        levels: [
            { level: 1, description: '暴击时 30% 概率穿透敌人（穿透类武器则转化为 +30% 暴击伤害）' },
            { level: 2, description: '穿透概率或暴伤加成提升至 60%' },
            { level: 3, description: '穿透概率或暴伤加成提升至 100%' }
        ]
    },
    {
        id: 'crit_vampire', name: '吸血鬼之触', category: SkillCategory.HIT, maxLevel: 3,
        levels: [
            { level: 1, description: '触发暴击时，有 30% 概率恢复 1 点生命值' },
            { level: 2, description: '概率提升至 40%' },
            { level: 3, description: '概率提升至 50%，且恢复量变为 2 点' }
        ]
    },
    {
        id: 'hit_last_strike', name: '收笔一击', category: SkillCategory.HIT, maxLevel: 3,
        levels: [
            { level: 1, description: '弹匣内的最后一发子弹必定暴击' },
            { level: 2, description: '该发子弹额外获得 50% 暴击伤害加成' },
            { level: 3, description: '额外获得 100% 暴击伤害加成且附带穿透' }
        ]
    },

    // ================== 击杀触发系 ==================
    {
        id: 'kill_bloom', name: '颜料绽放', category: SkillCategory.KILL, maxLevel: 3,
        levels: [
            { level: 1, description: '击杀敌人后尸体炸开，造成相当于其最大生命值 5% 的真实伤害' },
            { level: 2, description: '真实伤害提升至 10%' },
            { level: 3, description: '真实伤害提升至 15%' }
        ]
    },
    {
        id: 'kill_frenzy', name: '墨滴狂热', category: SkillCategory.KILL, maxLevel: 3,
        levels: [
            { level: 1, description: '击杀敌人后，移速和射速临时提升 10%，持续 2 秒（可叠加）' },
            { level: 2, description: '加成提升至 15%' },
            { level: 3, description: '加成提升至 20%，持续时间增至 3 秒' }
        ]
    },
    {
        id: 'kill_magnet', name: '经验磁铁', category: SkillCategory.KILL, maxLevel: 3,
        levels: [
            { level: 1, description: '击杀敌人时，10% 概率直接吸收当前击败敌人掉落的经验' },
            { level: 2, description: '概率提升至 20%' },
            { level: 3, description: '概率提升至 40%，且拾取时恢复极少量生命' }
        ]
    },
    {
        id: 'kill_reaper', name: '死神收割', category: SkillCategory.KILL, maxLevel: 3,
        levels: [
            { level: 1, description: '连续击杀 15 个敌人后，下一次攻击必定触发所有“命中触发系”效果' },
            { level: 2, description: '需连杀 10 个' },
            { level: 3, description: '需连杀 5 个' }
        ]
    },

    // ================== 召唤物系 ==================
    {
        id: 'summon_stickman', name: '火柴人助手', category: SkillCategory.SUMMON, maxLevel: 3,
        levels: [
            { level: 1, description: '召唤 1 个简笔画火柴人跟在身后独立开火' },
            { level: 2, description: '召唤 2 个火柴人' },
            { level: 3, description: '召唤 2 个火柴人，且射速翻倍' }
        ]
    },
    {
        id: 'summon_palette', name: '调色盘卫星', category: SkillCategory.SUMMON, maxLevel: 3,
        levels: [
            { level: 1, description: '召唤 2 个发光的色块像卫星一样围绕玩家旋转切割敌人' },
            { level: 2, description: '增加至 3 个色块' },
            { level: 3, description: '增加至 4 个色块，且旋转速度提升' }
        ]
    },
    {
        id: 'summon_scythe', name: '吸血镰刀', category: SkillCategory.SUMMON, maxLevel: 3,
        levels: [
            { level: 1, description: '召唤 1 把镰刀围绕玩家做圆周运动，割到敌人恢复 1 点生命值' },
            { level: 2, description: '收割半径扩大 50%' },
            { level: 3, description: '恢复量提升至 2 点并附带重伤效果' }
        ]
    },
    {
        id: 'summon_drone', name: '无人机（橡皮擦猎手）', category: SkillCategory.SUMMON, maxLevel: 3,
        levels: [
            { level: 1, description: '召唤 1 架小飞船专门消灭“橡皮擦”敌人' },
            { level: 2, description: '召唤 2 架无人机' },
            { level: 3, description: '无人机附带发射激光制导，伤害大幅提升' }
        ]
    },

    // ================== 防御/受击触发系 ==================
    {
        id: 'defense_shield', name: '折纸盾牌', category: SkillCategory.DEFENSE, maxLevel: 3,
        levels: [
            { level: 1, description: '定期生成环绕自身的纸盾抵挡一次伤害，60 秒冷却' },
            { level: 2, description: '冷却时间降低至 45 秒' },
            { level: 3, description: '冷却时间降低至 30 秒，且破碎时发射纸屑打击敌人' }
        ]
    },
    {
        id: 'defense_dummy', name: '墨水替身', category: SkillCategory.DEFENSE, maxLevel: 3,
        levels: [
            { level: 1, description: '受致命伤留下假人嘲讽，自身隐身无敌并加速，60 秒冷却' },
            { level: 2, description: '冷却时间降低至 45 秒' },
            { level: 3, description: '冷却时间降低至 30 秒，且假人爆炸造成巨额伤害' }
        ]
    },
    {
        id: 'defense_desperate_explosion', name: '绝境爆炸', category: SkillCategory.DEFENSE, maxLevel: 3,
        levels: [
            { level: 1, description: '血量低于 20% 且受击时，瞬间触发大范围颜料爆炸，60 秒冷却' },
            { level: 2, description: '冷却时间降低至 45 秒' },
            { level: 3, description: '冷却时间降低至 30 秒，且爆炸后恢复 10% 生命值' }
        ]
    },
    {
        id: 'defense_hedgehog', name: '刺猬装甲', category: SkillCategory.DEFENSE, maxLevel: 3,
        levels: [
            { level: 1, description: '受击时，向四周发射 8 根尖锐的铅笔芯' },
            { level: 2, description: '发射 16 根' },
            { level: 3, description: '发射 24 根且带穿透' }
        ]
    },

    // ================== 走位互动系 ==================
    {
        id: 'move_mirror', name: '镜像位移', category: SkillCategory.MOVEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '朝同向移动 10 秒后，向后方反穿 400 距离，切割沿途敌人' },
            { level: 2, description: '朝同向移动 8 秒后，向后方反穿 400 距离，切割沿途敌人' },
            { level: 3, description: '朝同向移动 5 秒后，向后方反穿 400 距离，切割范围变宽且伤害翻倍' }
        ]
    },
    {
        id: 'move_skateboard', name: '颜料滑板', category: SkillCategory.MOVEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '未开火状态下移速逐渐提升最高 150%，开火时转化为伤害倍率' },
            { level: 2, description: '最高提升至 200% 移速' },
            { level: 3, description: '最高提升至 250% 移速，且开火伤害倍率翻倍' }
        ]
    },
    {
        id: 'move_static_charge', name: '静止蓄能', category: SkillCategory.MOVEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '静止 2 秒后，每秒增加攻击力，最高 50%' },
            { level: 2, description: '需静止 1.5 秒，最高 100%' },
            { level: 3, description: '需静止 1 秒，最高 150%' }
        ]
    },
    {
        id: 'move_parkour', name: '跑酷大师', category: SkillCategory.MOVEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '移动速度越快闪避率越高，最高 15%' },
            { level: 2, description: '最高 25% 闪避' },
            { level: 3, description: '最高 40% 闪避' }
        ]
    },
    {
        id: 'move_rabbit', name: '动如脱兔', category: SkillCategory.MOVEMENT, maxLevel: 3,
        levels: [
            { level: 1, description: '移动速度越高，暴击率越高（最高提升 15% 暴击率）' },
            { level: 2, description: '最高提升 30% 暴击率' },
            { level: 3, description: '最高提升 45% 暴击率' }
        ]
    },

    // ================== 特殊文具联动与双生系 ==================
    {
        id: 'gadget_paperclip', name: '磁力曲别针', category: SkillCategory.SYNERGY, maxLevel: 3,
        levels: [
            { level: 1, description: '每 10 秒掉落曲别针，两针之间连起高压电线，伤害敌人后消失' },
            { level: 2, description: '每 8 秒掉落 1 个' },
            { level: 3, description: '每 5 秒掉落 1 个，且电线伤害翻倍' }
        ]
    },
    {
        id: 'synergy_ice_fire', name: '双生·冰火两重天', category: SkillCategory.SYNERGY, maxLevel: 1,
        prerequisites: ['element_ice', 'element_fire'],
        levels: [
            { level: 1, description: '子弹命中冻结且燃烧的敌人触发热胀冷缩，造成最大生命值 15% 真实伤害爆炸' }
        ]
    },
    {
        id: 'synergy_legion', name: '双生·军团降临', category: SkillCategory.SYNERGY, maxLevel: 1,
        prerequisites: ['summon_stickman', 'summon_palette'],
        levels: [
            { level: 1, description: '火柴人获得微型调色盘卫星，且火柴人伤害有概率吸血' }
        ]
    },
    {
        id: 'synergy_crit_overflow', name: '双生·色彩溢出', category: SkillCategory.SYNERGY, maxLevel: 1,
        prerequisites: ['base_crit_chance', 'base_crit_damage'],
        levels: [
            { level: 1, description: '溢出 100% 的暴击率将转化为 2 倍的暴击伤害加成，且暴击时有概率触发红色超级暴击（3倍最终伤害）' }
        ]
    },

    // ================== 专属武器觉醒系 (Weapon Mastery) ==================
    {
        id: 'mastery_pistol', name: '【乱涂乱画】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'standard',
        levels: [
            { level: 1, description: '基础画笔觉醒：子弹在击中敌人或到达最远距离后，会分裂成 3-5 颗更小的子弹向四周弹射。' }
        ]
    },
    {
        id: 'mastery_shotgun', name: '【超广角喷头】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'shotgun',
        levels: [
            { level: 1, description: '散布喷枪觉醒：每次开火连续喷射 3 次，弹丸数量翻倍，后坐力极大。' }
        ]
    },
    {
        id: 'mastery_scraper', name: '【居合 / 斩铁】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'melee',
        levels: [
            { level: 1, description: '刮刀觉醒：攻击范围翻倍，每次挥击不仅能横扫身前扇形区域，还能向前发射出一道宽阔的剑气波。' }
        ]
    },
    {
        id: 'mastery_chain', name: '【连锁反应】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'chain',
        levels: [
            { level: 1, description: '墨水链觉醒：闪电链传导无目标上限，每次传导伤害仅递减 5%。' }
        ]
    },
    {
        id: 'mastery_ruler', name: '【等离子尺】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'ruler',
        levels: [
            { level: 1, description: '修正带射线觉醒：子弹变得极宽，穿透不减速不减伤，附带极强击退效果。' }
        ]
    },
    {
        id: 'mastery_ribbon', name: '【丝带风暴】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'ribbon',
        levels: [
            { level: 1, description: '彩带发射器觉醒：子弹呈波浪状扩散，覆盖极宽区域，射速突破极限。' }
        ]
    },
    {
        id: 'mastery_vortex', name: '【事件视界】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'gravity',
        levels: [
            { level: 1, description: '黑洞调色盘觉醒：引力范围扩大 3 倍，持续时间翻倍，被吸入敌人有概率被即死粉碎（BOSS除外）。' }
        ]
    },
    {
        id: 'mastery_rocket', name: '【集束轰炸】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'rocket',
        levels: [
            { level: 1, description: '颜料桶炸弹觉醒：爆炸后向四周散落 4-6 个小型颜料炸弹，造成连环爆炸。' }
        ]
    },
    {
        id: 'mastery_sniper', name: '【达摩克利斯之笔】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'sniper',
        levels: [
            { level: 1, description: '钢笔狙击枪觉醒：同时发射三发子弹，类似于三发豌豆射手的攻击模式。' }
        ]
    },
    {
        id: 'mastery_flamethrower', name: '【高压气罐】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'flamethrower',
        levels: [
            { level: 1, description: '马克笔觉醒：射程暴增 500%，化身为横扫战场的烈焰长鞭。' }
        ]
    },
    {
        id: 'mastery_compass', name: '【巨型齿轮】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'compass',
        levels: [
            { level: 1, description: '圆规觉醒：体型扩大 3 倍，回旋时自动追踪附近敌人疯狂切割。' }
        ]
    },
    {
        id: 'mastery_mine', name: '【掺水火药】', category: SkillCategory.WEAPON_MASTERY, maxLevel: 1,
        requiredWeapon: 'mine',
        levels: [
            { level: 1, description: '滴管地雷觉醒：一次性部署四颗地雷（分别在四个方向），爆炸范围扩大 3 倍，附带极强全屏击退效果。' }
        ]
    },

    // ================== 人物专属觉醒技能 (Character Awakening) ==================
    {
        id: 'awakening_watercolor_1', name: '【水性蔓延】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'watercolor',
        levels: [
            { level: 1, description: '水痕面积扩大 50%，且踩在水痕上的敌人死亡后会立刻在原地生成一个新的水痕。' }
        ]
    },
    {
        id: 'awakening_watercolor_2', name: '【致幻水彩】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'watercolor',
        levels: [
            { level: 1, description: '踩在水痕上的敌人不仅会受到持续伤害，还会陷入“混乱”状态，有一定概率转身攻击其他敌人。' }
        ]
    },
    {
        id: 'awakening_digital_1', name: '【宏指令覆盖】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'digital',
        levels: [
            { level: 1, description: '数位笔浮游炮的数量增加至 2 个，且冷却时间缩短 1 秒。' }
        ]
    },
    {
        id: 'awakening_digital_2', name: '【Ctrl+V 阵列】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'digital',
        levels: [
            { level: 1, description: '数位笔浮游炮不再跟随玩家移动，而是在触发时于玩家当前位置留下一个固定的“炮台”，存在 5 秒并持续扫射。' }
        ]
    },
    {
        id: 'awakening_calligrapher_1', name: '【行云流水】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'calligrapher',
        levels: [
            { level: 1, description: '移动不再瞬间清零伤害层数，而是改为每秒掉落 10 层，只要保持走走停停即可稳定维持高额增伤。' }
        ]
    },
    {
        id: 'awakening_calligrapher_2', name: '【铁画银钩】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'calligrapher',
        levels: [
            { level: 1, description: '子弹在穿透最后一个敌人或达到最大飞行距离后，会像回旋镖一样原路折返飞回玩家手中造成二次真实伤害。' }
        ]
    },
    {
        id: 'awakening_ink_1', name: '【深渊墨池】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'ink',
        levels: [
            { level: 1, description: '受击喷射的致盲水墨团范围扩大一倍，且在水墨团范围内的玩家将获得极高的闪避率和生命回复效果。' }
        ]
    },
    {
        id: 'awakening_ink_2', name: '【墨影杀阵】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'ink',
        levels: [
            { level: 1, description: '处于致盲状态的敌人受到的所有伤害增加 100%，且当致盲结束时敌人会发生一次小型墨水爆炸。' }
        ]
    },
    {
        id: 'awakening_collector_1', name: '【重金悬赏】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'collector',
        levels: [
            { level: 1, description: '每拥有 100 金币，所有武器的暴击率额外提升 2%，暴击伤害额外提升 5%（无上限）。' }
        ]
    },
    {
        id: 'awakening_collector_2', name: '【散财消灾】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'collector',
        levels: [
            { level: 1, description: '受到致命伤害时不会死亡，而是扣除当前 50% 金币（最低需 100 金币触发），并击退全屏敌人，最多触发 3 次。' }
        ]
    },
    {
        id: 'awakening_graffiti_1', name: '【绝对领域】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'graffiti',
        levels: [
            { level: 1, description: '闭合图形形成的颜料沼泽持续时间延长至 15 秒，且沼泽内的敌人会被逐渐向中心拉扯。' }
        ]
    },
    {
        id: 'awakening_graffiti_2', name: '【高压喷罐】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'graffiti',
        levels: [
            { level: 1, description: '闭合图形瞬间造成的爆炸伤害变为基于敌人最大生命值 15% 的真实伤害，且向四周爆发出 8 道冲击波。' }
        ]
    },
    {
        id: 'awakening_classical_1', name: '【不朽名作】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'classical',
        levels: [
            { level: 1, description: '护盾的最大层数增加至 3 层，恢复时间缩短至 10 秒。每次护盾破裂时恢复 10% 最大生命值。' }
        ]
    },
    {
        id: 'awakening_classical_2', name: '【荆棘画框】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'classical',
        levels: [
            { level: 1, description: '护盾存在时获得霸体，并对靠近碰撞的敌人造成高额反伤。破裂瞬间对全屏造成毁灭性打击。' }
        ]
    },
    {
        id: 'awakening_sketcher_1', name: '【残影连击】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'sketcher',
        levels: [
            { level: 1, description: '基础射速和换弹加成超过阈值时，每次开火有 50% 概率触发残影，额外免费发射一发不消耗弹药的子弹。' }
        ]
    },
    {
        id: 'awakening_sketcher_2', name: '【极限截稿】', category: SkillCategory.CHARACTER_AWAKENING, maxLevel: 1,
        requiredCharacter: 'sketcher',
        levels: [
            { level: 1, description: '当前生命值越低，射速和换弹速度的加成越高（最高 200%）。且在换弹期间获得 100% 闪避无敌状态。' }
        ]
    }
];