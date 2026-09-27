export type Lang = 'zh' | 'en';

let currentLang: Lang = (localStorage.getItem('game_lang') as Lang) || 'zh';

export function setLang(l: Lang) {
    currentLang = l;
    localStorage.setItem('game_lang', l);
    window.dispatchEvent(new CustomEvent('lang-changed'));
}

export function getLang(): Lang {
    return currentLang;
}

export function t(key: string): string {
    if (!key) return key;
    if (currentLang === 'zh') {
        return dictZh[key] || key;
    } else {
        return dictEn[key] || key;
    }
}

export const dictZh: Record<string, string> = {
    "收藏家 (Collector)": "收藏家",
    "古典油画家 (Classical Painter)": "古典油画家",
    "速写漫画家 (Sketch Artist)": "速写漫画家",
    "水彩插画师 (Watercolorist)": "水彩插画师",
    "数字板绘师 (Digital Artist)": "数字板绘师",
    "书法家 (Calligrapher)": "书法家",
    "水墨画家 (Ink Painter)": "水墨画家",
    "Story Mode": "故事模式",
    "WASD to Move | Mouse to Aim & Shoot": "WASD 移动 | 鼠标 瞄准和射击",
    "A Creative Shooter Experience": "一个充满创意的射击体验",
    "GAME OVER": "游戏结束",
    "Play Again": "再玩一次",
    "Save Art": "保存作品",
    "Resume": "继续游戏"
};

export const dictEn: Record<string, string> = {
    "收藏家 (Collector)": "Collector",
    "街头涂鸦客": "Graffiti Artist",
    "古典油画家 (Classical Painter)": "Classical Painter",
    "速写漫画家 (Sketch Artist)": "Sketch Artist",
    "水彩插画师 (Watercolorist)": "Watercolorist",
    "数字板绘师 (Digital Artist)": "Digital Artist",
    "书法家 (Calligrapher)": "Calligrapher",
    "水墨画家 (Ink Painter)": "Ink Painter",

    "平衡的基础属性，能快速积累财富": "Balanced base stats, accumulates wealth quickly.",
    "以城市为画布的街头艺术家": "A street artist using the city as a canvas.",
    "重装坦克，速度慢但血量最高": "Heavy tank, slow but has the highest HP.",
    "玻璃大炮，极致的射速和换弹": "Glass cannon, extreme fire rate and reload speed.",
    "擅长持续伤害和范围扩散": "Excels in damage over time and AoE spread.",
    "自动化输出，伴随召唤物": "Automated output, accompanied by summons.",
    "极高单发爆发，牺牲移动开火": "Extremely high single-shot burst, sacrifices moving fire.",
    "利用致盲和隐蔽进行反击": "Uses blinding and stealth to counterattack.",

    "健步如飞 (移速提升)": "Swift Step (Speed Up)",
    "灵感迸发 (射速提升)": "Burst of Inspiration (Fire Rate Up)",
    "躲避伤害 (闪避提升)": "Evade Damage (Dodge Up)",
    "生命强化 (最大生命提升)": "Vitality (Max HP Up)",
    "武器伤害 (攻击提升)": "Weapon Damage (Attack Up)",
    "换弹速度 (换弹提升)": "Reload Speed (Reload Up)",
    "轨迹粗细 (覆盖提升)": "Trail Thickness (Coverage Up)",
    "子弹穿透": "Bullet Pierce",
    "致命笔锋 (暴击率提升)": "Deadly Stroke (Crit Chance Up)",
    "重墨渲染 (暴击伤害提升)": "Heavy Ink (Crit Damage Up)",
    "巨人画笔 (变大)": "Giant Brush (Size Up)",
    "微雕笔触 (变小)": "Micro Stroke (Size Down)",

    "打钱": "Make Money",
    "涂鸦护城河": "Graffiti Moat",
    "厚涂": "Impasto",
    "极速手感": "Speed Feel",
    "水痕": "Water Mark",
    "Ctrl+C": "Ctrl+C",
    "入木三分": "Deep Penetration",
    "墨染": "Ink Dye",

    "随着游戏存活时间增加，金币获取量逐渐提升": "Gold acquisition gradually increases with survival time.",
    "按住攻击键移动时留下轨迹，闭合图形会瞬间造成伤害，并形成持续5秒的颜料沼泽（减速并持续伤害）": "Hold attack to leave a trail; closing a shape deals instant damage and creates a paint swamp for 5s (slow & DoT).",
    "自带护盾，能抵挡一次任意伤害（怪物碰撞或子弹）。护盾破裂后需20秒重新生成。": "Innate shield blocks one instance of damage. Regenerates in 20s after breaking.",
    "基础射速和换弹速度提升30%，但生命值较少。": "Base fire rate and reload speed increased by 30%, but has less HP.",
    "击杀敌人后在原地留下水痕毒沼，造成持续伤害": "Leaves a water mark swamp on kill, dealing continuous damage.",
    "自带“数位笔”浮游炮，周期性复制上一次强力攻击": "Accompanied by a 'Digital Pen' drone that periodically copies the last strong attack.",
    "静止时伤害不断叠加，且子弹具有极强穿透力": "Damage stacks while stationary, and bullets have extreme piercing.",
    "受击喷射致盲水墨团，范围内的敌人丢失目标原地发愣": "Sprays blinding ink on hit; enemies inside lose target and stand still.",

    "开始游戏": "Start Game",
    "退出游戏": "Exit Game",
    "设置": "Settings",
    "返回主界面": "Back to Main Menu",
    "确认出击": "Deploy",
    "出击准备": "Preparation",
    "选择角色": "Select Character",
    "选择初始画笔 (武器)": "Select Starting Brush (Weapon)",
    "未选择角色": "No Character Selected",
    "请从上方选择一个角色": "Please select a character from above",
    "未选择武器": "No Weapon Selected",
    "请从上方选择初始画笔": "Please select a starting brush from above",
    
    "已存储": "Stored",
    "空": "Empty",
    "画框 1": "Frame 1",
    "画框 2": "Frame 2",
    "画框 3": "Frame 3",
    "画框 4": "Frame 4",
    "请选择保存到哪个画框？": "Which frame to save to?",
    "如果画框已有作品，将被新作品覆盖": "Existing artwork will be overwritten.",
    "取消": "Cancel",
    "点击任意处关闭": "Click anywhere to close",
    
    "保存当前作品到画框": "Save Artwork to Frame",
    "保存作品到本地": "Save Artwork Locally",
    "退出当前对局": "Exit Current Run",

    "基础属性强化": "Base Stats",
    "换弹触发系": "Reload Trigger",
    "命中/暴击触发系": "Hit/Crit Trigger",
    "击杀触发系": "Kill Trigger",
    "召唤物系": "Summon",
    "防御/受击触发系": "Defense/Hit Trigger",
    "走位互动系": "Movement Interaction",
    "元素附魔系": "Elemental Enchant",
    "双生联动系": "Synergy",
    "体型变异系": "Size Mutation",
    "专属武器觉醒系": "Weapon Awakening",
    "专属人物觉醒系": "Character Awakening",
    
    "新技能": "New Skill",
    "觉醒降临": "Awakening",
    "升级至 Lv.": "Upgrade to Lv.",
    "觉醒提升 Lv.": "Awakening Lv.",
    "升级！": "Level Up!",
    "选择一个技能": "Choose a skill",
    
    "全屏模式 / Fullscreen": "Fullscreen",
    "窗口模式 / Windowed": "Windowed Mode"
};
