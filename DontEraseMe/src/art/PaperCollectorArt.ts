import { drawVariantABody, drawVariantAHead } from './CharacterVariantsA';
import { drawVariantBBody, drawVariantBHead } from './CharacterVariantsB';
import { drawVariantCBody, drawVariantCHead } from './CharacterVariantsC';
import type { DoodlePose } from './DoodleMotion';
import { drawDoodleWeapon } from './DoodleWeapons';
import type { Weapon } from '../components/Weapon';
import { neutralArtImage } from './NeutralArtImage';

/** Kept for the artwork component's compatibility; the actual figure is rendered below. */
export function getPaperCollector(): HTMLImageElement { return neutralArtImage('player'); }

// Eight restrained material values, with detail grouped into 2–4 pixel clusters.
// No eyes, outlines around every fold, or texture noise at the 64px play size.
export const COLLECTOR_PALETTE = {
    ink: '#252923', shadow: '#343b32', cloth: '#535e4c', light: '#75816a',
    trim: '#a1aa8c', skin: '#c7b99b', skinShade: '#988d74', leather: '#716d56',
} as const;
const C = COLLECTOR_PALETTE;

function patch(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Scanline limbs keep diagonal knees stepped, instead of blurring pixel contours. */
function limb(ctx: CanvasRenderingContext2D, color: string, ax: number, ay: number,
    bx: number, by: number, width: number): void {
    const top = Math.round(ay), bottom = Math.round(by);
    ctx.fillStyle = color;
    for (let y = top; y <= bottom; y++) {
        const mix = bottom === top ? 0 : (y - top) / (bottom - top);
        ctx.fillRect(Math.round(ax + (bx - ax) * mix - width / 2), y, width, 1);
    }
}

function leg(ctx: CanvasRenderingContext2D, side: -1 | 1, phase: number, moving: number,
    travelX: number, travelY: number): void {
    const cycle = phase + (side === -1 ? Math.PI : 0);
    const stride = Math.sin(cycle) * moving;
    // The returning foot lifts; the supporting foot travels backwards on the ground.
    const lift = Math.max(0, Math.cos(cycle)) * 3.5 * moving;
    const hip = side * 5;
    const footX = hip + stride * (Math.abs(travelX) < .2 ? 2.5 : 5 * travelX);
    const footY = 28 - lift + stride * travelY * 1.6;
    const kneeX = hip + (footX - hip) * .55 + moving;
    const kneeY = 20 - lift * .5;
    limb(ctx, C.ink, hip, 11, kneeX, kneeY, 8);
    limb(ctx, C.ink, kneeX, kneeY, footX, footY - 2, 7);
    limb(ctx, side === -1 ? C.shadow : C.cloth, hip, 12, kneeX, kneeY - 1, 5);
    limb(ctx, side === -1 ? C.shadow : C.cloth, kneeX, kneeY, footX, footY - 4, 4);
    patch(ctx, side === -1 ? C.cloth : C.light, kneeX - 2, kneeY - 1, 4, 2);
    patch(ctx, C.ink, footX - 4, footY - 4, 8, 6);
    patch(ctx, C.ink, footX + 3, footY - 1, 4, 3);
    patch(ctx, C.shadow, footX - 2, footY - 3, 5, 3);
    patch(ctx, C.leather, footX - 2, footY - 3, 4, 1);
    patch(ctx, C.cloth, footX + 3, footY, 3, 1);
}

function pack(ctx: CanvasRenderingContext2D, backView: boolean): void {
    const x = backView ? -9 : -17, y = backView ? -6 : -8;
    patch(ctx, C.ink, x + 2, y - 2, 10, 3);
    patch(ctx, C.ink, x, y, 14, 22);
    patch(ctx, C.shadow, x + 2, y + 1, 10, 18);
    patch(ctx, C.cloth, x + 2, y + 2, 8, 5);
    patch(ctx, C.light, x + 2, y + 2, 2, 15);
    patch(ctx, C.leather, x + 6, y + 4, 3, 16);
    patch(ctx, C.trim, x + 6, y + 11, 3, 2);
    patch(ctx, C.ink, x + 3, y + 18, 8, 2);
}

function body(ctx: CanvasRenderingContext2D, phase: number, moving: number, backView: boolean, idleBreath: number): void {
    if (!backView) pack(ctx, false);
    const shoulderLift = Math.round(Math.max(0, idleBreath));
    // Angular shoulders and split coat hem; the silhouette stays compact and adult.
    patch(ctx, C.ink, -10, -11 - shoulderLift, 21, 4 + shoulderLift);
    patch(ctx, C.ink, -13, -7, 27, 17);
    patch(ctx, C.ink, -11, 8, 23, 7);
    const hem = Math.round(Math.sin(phase - .55) * moving);
    patch(ctx, C.ink, -13 + hem, 10, 11, 7);
    patch(ctx, C.ink, 3 + hem, 10, 11, 6);
    patch(ctx, C.shadow, -11, -6, 10, 18);
    patch(ctx, C.cloth, -7, -7, 18, 19);
    patch(ctx, C.light, -7, -7, 6, 4);
    patch(ctx, C.light, 8, -5, 2, 11);
    patch(ctx, C.shadow, 1, -3, 2, 17);
    patch(ctx, C.cloth, -11 + hem, 11, 8, 3);
    patch(ctx, C.shadow, 5 + hem, 12, 7, 2);
    // Bandolier and belt: three readable groups, not scattered single-pixel noise.
    for (let i = 0; i < 5; i++) patch(ctx, C.leather, -8 + i * 3, -6 + i * 4, 4, 5);
    patch(ctx, C.trim, -1, 2, 3, 3);
    patch(ctx, C.ink, -10, 10, 21, 3);
    patch(ctx, C.leather, -9, 10, 18, 2);
    patch(ctx, C.trim, 0, 10, 3, 2);
    patch(ctx, C.ink, -11, 8, 5, 6);
    patch(ctx, C.leather, -10, 9, 3, 3);
    if (backView) pack(ctx, true);
    // High collar separates the small face from the dark upper body.
    patch(ctx, C.ink, -10, -11 - shoulderLift, 22, 5 + shoulderLift);
    patch(ctx, C.cloth, -9, -11 - shoulderLift, 9, 3);
    patch(ctx, C.light, 1, -10 - shoulderLift, 9, 2);
}

function head(ctx: CanvasRenderingContext2D, backView: boolean, aim: number, hit: number, idleBreath: number): void {
    ctx.save();
    // A small vertical head settle accompanies the collar, without changing aim.
    const nod = Math.round(idleBreath * 1.6) / 4;
    ctx.translate(0, Math.round(Math.sin(aim) * .45 + hit * .6) + nod);
    patch(ctx, C.ink, -8, -31, 14, 3);
    patch(ctx, C.ink, -11, -28, 21, 4);
    patch(ctx, C.ink, -13, -25, 25, 9);
    patch(ctx, C.ink, -10, -17, 21, 5);
    patch(ctx, C.ink, -7, -13, 17, 3);
    // Two directional locks replace a square cap without increasing head size.
    patch(ctx, C.ink, 1, -33, 5, 4);
    patch(ctx, C.ink, 9, -27, 4, 5);
    patch(ctx, C.shadow, -7, -28, 12, 3);
    patch(ctx, C.shadow, -10, -24, 6, 7);
    if (backView) {
        patch(ctx, C.shadow, -6, -18, 12, 3);
        patch(ctx, C.cloth, -2, -13, 5, 2);
    } else {
        patch(ctx, C.skinShade, -1, -22, 12, 9);
        patch(ctx, C.skin, 3, -22, 8, 7);
        patch(ctx, C.skin, 10, -18, 3, 3);
        patch(ctx, C.skinShade, 2, -14, 7, 2);
        patch(ctx, C.skinShade, -3, -19, 4, 4);
        patch(ctx, C.ink, -1, -24, 13, 3);
        patch(ctx, C.ink, -1, -22, 5, 4);
        patch(ctx, C.ink, 9, -23, 3, 3);
    }
    ctx.restore();
}

// The small marker grows from the same ground anchor as the collector's feet.
function drawGrave(ctx: CanvasRenderingContext2D, progress: number): void {
    const rise = Math.max(0, Math.min(1, (progress - .32) / .35));
    if (rise <= 0) return;
    const eased = 1 - (1 - rise) ** 3;
    const bounce = Math.sin(Math.PI * rise) * 2;
    ctx.save();
    ctx.translate(0, 28);
    ctx.scale(1, eased);
    ctx.translate(0, -28 - bounce);
    // Rounded, stepped stone silhouette and a simple inked cross.
    patch(ctx, C.ink, -10, 1, 20, 25);
    patch(ctx, C.ink, -8, -3, 16, 4);
    patch(ctx, C.ink, -5, -5, 10, 2);
    patch(ctx, '#d6d2c6', -8, 1, 16, 22);
    patch(ctx, '#d6d2c6', -6, -2, 12, 3);
    patch(ctx, '#e8e5dd', -6, 1, 3, 19);
    patch(ctx, C.shadow, -1, 4, 2, 11);
    patch(ctx, C.shadow, -4, 7, 8, 2);
    patch(ctx, C.ink, -13, 24, 26, 4);
    patch(ctx, C.cloth, -10, 25, 20, 2);
    ctx.restore();
    // A few restrained paper flecks accompany the appearance.
    const puff = Math.sin(Math.PI * rise);
    if (puff > 0) {
        ctx.save(); ctx.globalAlpha *= puff;
        patch(ctx, C.light, -17 - 3 * rise, 24 - 4 * rise, 3, 2);
        patch(ctx, C.light, 14 + 3 * rise, 22 - 5 * rise, 3, 2);
        patch(ctx, C.trim, -12 - 3 * rise, 17 - 7 * rise, 2, 2);
        ctx.restore();
    }
}

/** 64px collector rig. All motion is presentation-only; the hitbox and aim are untouched. */
export interface CollectorOutcome { type: 'defeat' | 'victory'; progress: number; }

export function drawPaperCollector(
    ctx: CanvasRenderingContext2D, _image: HTMLImageElement, size: number,
    facingLeft: boolean, aim: number, pose?: DoodlePose, weapon?: Weapon | null, outcome?: CollectorOutcome, characterId = 'collector'
): void {
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(aim)) return;
    const facing = facingLeft ? -1 : 1;
    const moving = Math.max(0, Math.min(1, pose?.moving ?? 0));
    const phase = pose?.gaitPhase ?? Math.asin(Math.max(-1, Math.min(1, pose?.step ?? 0)));
    const localX = (pose?.travelX ?? facing) * facing;
    const travelY = pose?.travelY ?? 0;
    const backView = false;
    const idleBreath = weapon?.reloading ? 0 : Math.max(-1, Math.min(1, pose?.idleBreath ?? 0));
    ctx.save(); ctx.scale(size / 64, size / 64); ctx.imageSmoothingEnabled = false;
    const defeat = outcome?.type === 'defeat' ? Math.max(0, Math.min(1, outcome.progress)) : 0;
    if (outcome?.type === 'defeat' && defeat >= .5) {
        drawGrave(ctx, defeat); ctx.restore(); return;
    }
    if (outcome?.type === 'defeat') {
        const vanish = Math.max(0, Math.min(1, (defeat - .05) / .45));
        const eased = vanish * vanish * (3 - 2 * vanish);
        ctx.globalAlpha *= 1 - eased;
        ctx.translate(0, 28); ctx.scale(1 - .55 * eased, 1 - .8 * eased); ctx.translate(0, -28);
    }
    const hit = Math.max(0, Math.min(1, pose?.hit ?? 0));
    ctx.translate(-facing * hit * 2, hit * 1.5);
    if (outcome) {
        const t = Math.max(0, Math.min(1, outcome.progress));
        if (outcome.type === 'victory') ctx.translate(0, -Math.sin(t * Math.PI) * 3);
    }
    const turnScale = Math.max(.88, Math.min(1, pose?.turnScale ?? 1));
    ctx.save(); ctx.scale(facing * .72 * turnScale, 1);
    ctx.translate(0, 28); ctx.scale(1, .75); ctx.translate(0, -28);
    leg(ctx, -1, phase, moving, localX, travelY);
    leg(ctx, 1, phase, moving, localX, travelY);
    ctx.restore();

    // Quarter-pixel vertical settling keeps breathing visible without rocking the torso.
    ctx.translate(0, Math.round((pose?.y ?? 0) * 4) / 4);
    const tool = () => drawDoodleWeapon(ctx, weapon?.config?.type, 64, aim, pose, weapon?.reloading,
        {reloadProgress: pose?.reloadProgress, facingLeft, compact: true});
    if (backView) tool();
    // Compact torso and limbs support a larger, readable head silhouette.
    ctx.save(); ctx.scale(facing * .70 * turnScale, 1);
    ctx.translate(0, 15); ctx.scale(1, .72); ctx.translate(0, -15);
    const variantPose = pose ? {...pose, idleBreath} : undefined;
    if (!drawVariantABody(ctx, characterId, variantPose) && !drawVariantBBody(ctx, characterId, variantPose) && !drawVariantCBody(ctx, characterId, variantPose))
        body(ctx, phase, moving, backView, idleBreath);
    if (!weapon?.config) {
        for (const side of [-1, 1]) {
            patch(ctx, C.ink, side * 14 - 3, -4, 7, 13);
            patch(ctx, C.cloth, side * 14 - 2, -3, 4, 8);
            patch(ctx, C.leather, side * 14 - 2, 8, 5, 3);
        }
    }
    ctx.restore();
    // Anchor the head at the shortened torso's collar, preserving its identity.
    ctx.save(); ctx.scale(facing * .95 * turnScale, 1);
    ctx.translate(0, -3); ctx.scale(1, 1.16); ctx.translate(0, 10);
    // Variant faces sit closer to the collar of the shortened torso.
    if (characterId !== 'collector') ctx.translate(0, 3);
    if (!drawVariantAHead(ctx, characterId, variantPose) && !drawVariantBHead(ctx, characterId, variantPose) && !drawVariantCHead(ctx, characterId, variantPose))
        head(ctx, backView, aim, pose?.hit ?? 0, idleBreath);
    ctx.restore();
    if (!backView) tool();
    ctx.restore();
    if (outcome?.type === 'defeat') {
        ctx.save(); ctx.scale(size / 64, size / 64);
        drawGrave(ctx, defeat); ctx.restore();
    }
}
