import type { WeaponType } from '../components/Weapon';
import { SkillCategory, type SkillConfig } from './EndlessConfig';

// These attacks already pass through targets, or detonate instead of spending pierce.
const NO_BASE_PIERCE: readonly WeaponType[] = [
    'sniper', 'ruler', 'flamethrower', 'gravity', 'compass', 'melee', 'rocket', 'mine',
];

/** Filter offers using the equipped weapon, rather than weapons merely unlocked. */
export function isSkillUsefulForWeapon(skill: SkillConfig, weapon?: WeaponType): boolean {
    if (!weapon) return true;
    if (skill.id === 'base_pierce' && NO_BASE_PIERCE.includes(weapon)) return false;
    // Explosive projectiles detonate before critical piercing can extend their flight.
    // Other piercing weapons convert crit_pierce to bonus critical damage.
    if (skill.id === 'crit_pierce' && (weapon === 'rocket' || weapon === 'mine')) return false;
    if (weapon === 'melee' && (skill.id === 'base_reload'
        || skill.category === SkillCategory.RELOAD || skill.id === 'hit_last_strike')) return false;
    return true;
}
