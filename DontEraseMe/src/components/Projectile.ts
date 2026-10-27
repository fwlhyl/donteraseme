import { Component } from '../core/Component';
import type { WeaponType } from './Weapon';

export class Projectile extends Component {
    /** Opt-in path tracking for moving weapon bullets; never used by hostile shots. */
    public sweptCollision = false;
    public previousX?: number;
    public previousY?: number;
    /** Exact outward path budget. Boomerang returns intentionally ignore it. */
    public remainingRange?: number;

    constructor(
        public type: WeaponType = 'standard',
        public damage: number = 10,
        public ownerId: string = '', // ID of the entity that fired this
        public life: number = 0, // For shotgun/gravity/flamethrower
        public pierceCount: number = 0,
        public explosionRadiusScale: number = 1.0,
        public calligrapherBonus: boolean = false,
        public baseColorRGB?: {r: number, g: number, b: number},
        public isCrit: boolean = false,
        public hitEnemies?: Set<string>,
        public reaperStrike: boolean = false, // 死神收割强化攻击标志
        public isSuperCrit: boolean = false, // 双生·色彩溢出 超级暴击
        public calligrapherBoomerang: boolean = false // 书法家觉醒2：折返状态
    ) {
        super();
    }
}
