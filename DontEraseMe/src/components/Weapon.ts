import { Component } from '../core/Component';

export type WeaponType = 'standard' | 'shotgun' | 'sniper' | 'rocket' | 'gravity' | 'roller' | 'ribbon' | 'ruler' | 'eraser' | 'chain' | 'melee' | 'flamethrower' | 'compass' | 'mine' | 'clone_bullet' | 'shockwave_fx';

export interface WeaponConfig {
    name: string;
    id: number;
    fireRate: number; // Frames between shots (or ms)
    speed: number;
    damage: number;
    count: number; // Bullets per shot
    spread: number; // Radians
    color: string;
    radius: number;
    type: WeaponType;
    range: number;      // Max travel distance
    magSize: number;    // Magazine size
    reloadTime: number; // Frames to reload
}

export const WEAPONS: WeaponConfig[] = [
    { name: "Pistol (Brush)", id: 0, fireRate: 20, speed: 9, damage: 10, count: 1, spread: 0, color: 'yellow', radius: 5, type: 'standard', range: 600, magSize: 12, reloadTime: 60 },
    { name: "Shotgun (Spray)", id: 1, fireRate: 80, speed: 9, damage: 7, count: 8, spread: 0.4, color: 'orange', radius: 3, type: 'shotgun', range: 400, magSize: 7, reloadTime: 90 },
    { name: "Scraper (Blade)", id: 2, fireRate: 20, speed: 0, damage: 20, count: 1, spread: 0, color: '#dddddd', radius: 0, type: 'melee', range: 100, magSize: 9999, reloadTime: 1 },
    { name: "Ink Chain", id: 3, fireRate: 30, speed: 9, damage: 18, count: 1, spread: 0, color: '#ffffff', radius: 5, type: 'chain', range: 600, magSize: 30, reloadTime: 60 },
    { name: "Ruler Gun", id: 4, fireRate: 20, speed: 3, damage: 15, count: 0, spread: 0, color: '#66ffe0', radius: 0, type: 'ruler', range: 300, magSize: 30, reloadTime: 60 },
    { name: "Ribbon", id: 5, fireRate: 8, speed: 10, damage: 8, count: 1, spread: 0.15, color: '#ff66cc', radius: 4, type: 'ribbon', range: 500, magSize: 50, reloadTime: 45 },
    { name: "Vortex (Blender)", id: 6, fireRate: 350, speed: 4, damage: 30, count: 1, spread: 0, color: '#9900ff', radius: 10, type: 'gravity', range: 600, magSize: 1, reloadTime: 180 },
    { name: "Rocket (Bucket)", id: 7, fireRate: 150, speed: 6, damage: 50, count: 1, spread: 0, color: 'red', radius: 8, type: 'rocket', range: 900, magSize: 1, reloadTime: 150 },
    { name: "Sniper (Pen)", id: 8, fireRate: 100, speed: 18, damage: 50, count: 1, spread: 0, color: 'cyan', radius: 2, type: 'sniper', range: 1000, magSize: 5, reloadTime: 160 },
    { name: "Airbrush (Flamethrower)", id: 9, fireRate: 2, speed: 12, damage: 2, count: 1, spread: 0.5, color: '#ff4400', radius: 4, type: 'flamethrower', range: 250, magSize: 150, reloadTime: 120 },
    { name: "Compass (Boomerang)", id: 10, fireRate: 60, speed: 15, damage: 10, count: 1, spread: 0, color: '#aaccff', radius: 8, type: 'compass', range: 450, magSize: 5, reloadTime: 90 },
    { name: "Eyedropper (Mine)", id: 11, fireRate: 40, speed: 0, damage: 40, count: 1, spread: 0, color: '#22ff22', radius: 10, type: 'mine', range: 0, magSize: 10, reloadTime: 100 },
];

export class Weapon extends Component {
    public currentWeaponIndex: number = 0;
    public cooldown: number = 0;
    public ammo: number[];
    public reloading: boolean = false;
    public reloadTimer: number = 0;
    public unlocked: Set<number> = new Set([0]);
    public fireRateMul: number = 1.0;
    public spreadMul: number = 1.0;
    public speedMul: number = 1.0;
    public damageBonus: number[] = WEAPONS.map(() => 0);
    public reloadTimeMul: number = 1.0;
    public critChance: number = 0.0;
    public critMultiplier: number = 1.5;
    public pierceCount: number = 0;
    public explosionRadiusScale: number = 1.0;

    constructor(
        public index: number = 0
    ) {
        super();
        this.currentWeaponIndex = index;
        this.ammo = WEAPONS.map(w => w.id === index ? w.magSize : w.magSize);
    }

    public get config(): WeaponConfig | null {
        if (this.currentWeaponIndex === -1) return null;
        return WEAPONS[this.currentWeaponIndex] || null;
    }
}
