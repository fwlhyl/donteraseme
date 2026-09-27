import { WEAPONS, type WeaponConfig } from '../components/Weapon';

export enum Faction {
    Geometry = 'Geometry Guild',       // 几何公会：形态 (Shape)
    Coherence = 'Coherence Society',   // 连贯会：轨迹 (Trajectory)
    Contrast = 'Contrast Syndicate',   // 对比财团：色彩/控制 (Color/Impact)
    Density = 'Density Forge'          // 稠密熔炉：质感/物理 (Texture/Mass)
}

export enum ElementType {
    BaseForm = 'BaseForm',             // 基础形态（决定如何发射，主要由几何/连贯提供）
    Modifier = 'Modifier'              // 修饰属性（决定特效与附加状态，主要由对比/稠密提供）
}

export interface InspirationElement {
    id: string;
    name: string;
    faction: Faction;
    type: ElementType;
    description: string;
    // 这里未来会扩展具体的属性加成，比如 { speed: +2, damage: +10, specialEffect: 'stun' }
    statsModifier?: any; 
}

// 预设一些“故事模式”中玩家可以收集到的灵感元素
export const ElementDictionary: Record<string, InspirationElement> = {
    // --- 基础形态 (Base Forms) ---
    'geo_ray': {
        id: 'geo_ray',
        name: '几何射线',
        faction: Faction.Geometry,
        type: ElementType.BaseForm,
        description: '发射一条极具破坏力的直线射线，穿透路径上的敌人。',
        statsModifier: { type: 'sniper', fireRate: 60, speed: 15, damage: 30, count: 1, spread: 0, radius: 4, range: 800, magSize: 10, reloadTime: 100 }
    },
    'coh_track': {
        id: 'coh_track',
        name: '流体弹幕',
        faction: Faction.Coherence,
        type: ElementType.BaseForm,
        description: '画出具有生命的流体线条，向四周散射。',
        statsModifier: { type: 'shotgun', fireRate: 40, speed: 8, damage: 12, count: 5, spread: 0.5, radius: 3, range: 500, magSize: 15, reloadTime: 80 }
    },
    
    // --- 修饰属性 (Modifiers) ---
    'con_neon': {
        id: 'con_neon',
        name: '霓虹高反差',
        faction: Faction.Contrast,
        type: ElementType.Modifier,
        description: '为技能附加极其刺眼的波普霓虹色彩，有几率致盲并眩晕敌人。',
        statsModifier: { color: '#ff00ff', damageMul: 1.5, speedMul: 1.2 }
    },
    'den_heavy': {
        id: 'den_heavy',
        name: '厚涂重彩',
        faction: Faction.Density,
        type: ElementType.Modifier,
        description: '给技能加上厚重的油彩质感，大幅增加伤害并附带重力减速效果。',
        statsModifier: { color: '#8b4513', damageMul: 2.5, speedMul: 0.6, fireRateMul: 1.5, radiusMul: 1.5 }
    }
};

export class PaletteSystem {
    /**
     * 在“调色盘”中融合两个灵感元素，创造新的流派技能
     * @param base 基础形态元素（如射线、追踪）
     * @param modifier 修饰属性元素（如致盲、重力）
     * @returns 融合后的新技能数据（这里暂时返回描述，后续对接Weapon系统）
     */
    public static fuseElements(base: InspirationElement, modifier: InspirationElement): any {
        if (base.type !== ElementType.BaseForm || modifier.type !== ElementType.Modifier) {
            console.warn("调色盘融合失败：必须是一个【基础形态】搭配一个【修饰属性】！");
            return null;
        }

        const fusionName = `${modifier.name} · ${base.name}`;
        const fusionDescription = `[调色盘杰作] 结合了${base.faction}与${modifier.faction}的特质。\n效果：${base.description} 并且 ${modifier.description}`;
        
        console.log(`✨ 灵感迸发！你创作出了新技能：【${fusionName}】`);
        
        // 生成新的 WeaponConfig
        const baseStats = base.statsModifier || {};
        const modStats = modifier.statsModifier || {};
        
        const newWeaponId = WEAPONS.length; // 追加到武器列表末尾
        const fusedWeapon: WeaponConfig = {
            id: newWeaponId,
            name: fusionName,
            type: baseStats.type || 'standard',
            color: modStats.color || '#ffffff',
            fireRate: (baseStats.fireRate || 30) * (modStats.fireRateMul || 1.0),
            speed: (baseStats.speed || 10) * (modStats.speedMul || 1.0),
            damage: (baseStats.damage || 15) * (modStats.damageMul || 1.0),
            count: baseStats.count || 1,
            spread: baseStats.spread || 0,
            radius: (baseStats.radius || 4) * (modStats.radiusMul || 1.0),
            range: baseStats.range || 600,
            magSize: baseStats.magSize || 20,
            reloadTime: baseStats.reloadTime || 60
        };
        
        WEAPONS.push(fusedWeapon); // 注册到全局武器库

        return {
            name: fusionName,
            description: fusionDescription,
            baseId: base.id,
            modifierId: modifier.id,
            weaponId: newWeaponId // 返回新武器的ID，方便玩家装备
        };
    }
}
