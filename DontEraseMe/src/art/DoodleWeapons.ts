import weaponsUrl from '../assets/doodle/weapons-v1.png';
import type { WeaponType } from '../components/Weapon';
import type { AtlasFrame } from './AtlasFrame';
import type { DoodlePose } from './DoodleMotion';

// Measured alpha bounds; transparent padding protects the rough ink contours.
const frame = (x: number, y: number, width: number, height: number): AtlasFrame =>
    ({ x: x - 2, y: y - 2, width: width + 4, height: height + 4 });

export const WEAPON_FRAMES: Readonly<Partial<Record<WeaponType, AtlasFrame>>> = {
    standard: frame(25, 176, 367, 85),
    shotgun: frame(444, 144, 302, 137),
    melee: frame(795, 130, 302, 163),
    chain: frame(1146, 174, 364, 87),
    ruler: frame(50, 465, 322, 96),
    ribbon: frame(426, 445, 316, 143),
    gravity: frame(784, 442, 342, 150),
    rocket: frame(1173, 413, 325, 192),
    sniper: frame(33, 795, 368, 74),
    flamethrower: frame(437, 717, 310, 201),
    compass: frame(795, 768, 326, 130),
    mine: frame(1178, 787, 332, 93),
};

interface Grip {
    /** Long-axis display length for a 64px player, not a collision dimension. */
    length: number;
    /** Position of the hand within the source crop. */
    x: number;
    y: number;
}

const GRIPS: Readonly<Partial<Record<WeaponType, Grip>>> = {
    standard: { length: 38, x: .19, y: .5 },
    shotgun: { length: 34, x: .24, y: .5 },
    melee: { length: 34, x: .18, y: .54 },
    chain: { length: 38, x: .17, y: .5 },
    ruler: { length: 34, x: .17, y: .5 },
    ribbon: { length: 34, x: .2, y: .52 },
    gravity: { length: 40, x: .17, y: .54 },
    rocket: { length: 42, x: .14, y: .49 },
    sniper: { length: 42, x: .2, y: .5 },
    flamethrower: { length: 40, x: .23, y: .62 },
    compass: { length: 38, x: .16, y: .51 },
    mine: { length: 36, x: .17, y: .49 },
};

let weapons: HTMLImageElement | undefined;
export function getDoodleWeapons(): HTMLImageElement {
    if (!weapons) {
        weapons = new Image();
        weapons.src = weaponsUrl;
    }
    return weapons;
}

/** Optional cutout hand treatment; omitted for every existing doodle character. */
export interface DoodleWeaponStyle {
    detachedHand?: boolean;
    drawGrip?: (ctx: CanvasRenderingContext2D, ratio: number) => void;
}

/**
 * Draws an independently held tool and arm in upright player-local coordinates.
 * Caller supplies the torso's vertical offset once, and must not mirror/rotate this
 * coordinate system: aim controls the tool direction. Inherits caller hit alpha.
 * Unsupported types and unloaded images draw nothing so the caller can fall back.
 */
export function drawDoodleWeapon(
    ctx: CanvasRenderingContext2D,
    type: WeaponType | undefined | null,
    size: number,
    aim: number,
    pose?: DoodlePose,
    reloading = false,
    style?: DoodleWeaponStyle,
): boolean {
    if (!type || !Object.prototype.hasOwnProperty.call(WEAPON_FRAMES, type)
        || !Number.isFinite(size) || size <= 0 || !Number.isFinite(aim)) return false;
    const source = WEAPON_FRAMES[type], grip = GRIPS[type];
    if (!source || !grip) return false;
    const image = getDoodleWeapons();
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;

    const ratio = size / 64;
    const attack = Math.max(0, Math.min(1, pose?.attack ?? 0));
    const facing = Math.cos(aim) < 0 ? -1 : 1;
    const recoil = attack * (type === 'melee' ? .5 : 1.8) * ratio;
    const handX = Math.cos(aim) * 17 * ratio - Math.cos(aim) * recoil;
    const handY = (8 + Math.sin(aim) * 11) * ratio - Math.sin(aim) * recoil;
    const swing = type === 'melee' ? Math.sin(attack * Math.PI) * .6 * facing : 0;
    const angle = aim + swing + (reloading ? .25 * facing : 0);
    const width = grip.length * ratio;
    const height = width * source.height / source.width;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    // A short bent ink arm follows the hand; torso and feet stay independent.
    if (!style?.detachedHand) {
        const shoulderX = facing * 8.5 * ratio;
        const shoulderY = 6 * ratio;
        ctx.strokeStyle = '#1c1b23';
        ctx.lineWidth = 2.1 * ratio;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo((shoulderX + handX) * .5, (shoulderY + handY) * .5 + 2 * ratio);
        ctx.lineTo(handX, handY);
        ctx.stroke();
    }

    ctx.translate(handX, handY);
    ctx.rotate(angle);
    // Leftward aim uses a local Y mirror, keeping spray cups above the barrel.
    ctx.scale(1, facing);
    ctx.drawImage(image, source.x, source.y, source.width, source.height,
        -width * grip.x, -height * grip.y, width, height);

    if (style?.drawGrip) style.drawGrip(ctx, ratio);
    else {
        ctx.fillStyle = '#eee4cb';
        ctx.strokeStyle = '#1c1b23';
        ctx.lineWidth = 1.3 * ratio;
        ctx.beginPath();
        ctx.ellipse(0, 1.1 * ratio, 2.7 * ratio, 2.35 * ratio, -.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
    return true;
}
