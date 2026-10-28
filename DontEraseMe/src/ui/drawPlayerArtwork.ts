import { PlayerArtwork } from '../components/PlayerArtwork';
import { PLAYER_PRESENTATION } from '../config/PlayerPresentation';
import { drawAtlasFrame } from '../art/AtlasFrame';
import { applyDoodlePose, drawDoodleAccent, type DoodlePose } from '../art/DoodleMotion';
import { drawDoodleWeapon } from '../art/DoodleWeapons';
import { drawPaperCollector } from '../art/PaperCollectorArt';
import type { Weapon } from '../components/Weapon';

/** Feet stay on the floor while the two legs alternate; the torso never sways. */
function drawLegs(ctx: CanvasRenderingContext2D, size: number, bottom: number, left: boolean, pose?: DoodlePose): void {
    const ratio = size / 64;
    const step = pose?.step ?? 0;
    const bob = (pose?.y ?? 0) * ratio;
    const facing = left ? -1 : 1;
    ctx.strokeStyle = '#11130f';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.3 * ratio;
    for (const side of [-1, 1]) {
        const phase = step * side;
        const hipX = side * 7 * ratio;
        const stride = phase * 3.2 * ratio;
        const lift = Math.max(0, phase) * 2.4 * ratio;
        const footY = 30 * ratio - lift;
        ctx.beginPath();
        ctx.moveTo(hipX, bottom - 3 * ratio + bob);
        ctx.lineTo(hipX + stride * .45, footY - 4 * ratio);
        ctx.lineTo(hipX + stride, footY);
        ctx.lineTo(hipX + stride + facing * 3.5 * ratio, footY);
        ctx.stroke();
    }
}

function drawArticulatedPlayer(ctx: CanvasRenderingContext2D, artwork: PlayerArtwork, size: number, aim: number, pose?: DoodlePose, weapon?: Weapon | null): void {
    const ratio = size / 64;
    const frame = artwork.frame!;
    // The original 64px silhouette now consists of a 56px torso and 8px legs.
    const torsoSize = size * .875;
    const scale = torsoSize / Math.max(frame.width, frame.height);
    const bodyWidth = frame.width * scale;
    const bottom = frame.height * scale * (1 - (frame.pivotY ?? .5));
    drawLegs(ctx, size, bottom, artwork.facingLeft, pose);

    ctx.save();
    ctx.translate(0, (pose?.y ?? 0) * ratio);
    const config = weapon?.config;
    const behind = Math.sin(aim) < -.2;
    if (behind) drawDoodleWeapon(ctx, config?.type, size, aim, pose, weapon?.reloading);
    ctx.save();
    ctx.scale(artwork.facingLeft ? -1 : 1, 1);
    drawAtlasFrame(ctx, artwork.image, frame, torsoSize);
    ctx.restore();

    // Unoccupied hands hang still. Only the separate legs drive walking motion.
    ctx.strokeStyle = '#11130f'; ctx.lineWidth = 2 * ratio; ctx.lineCap = 'round';
    const freeSides = config ? [artwork.facingLeft ? 1 : -1] : [-1, 1];
    for (const side of freeSides) {
        const x = side * bodyWidth * .39;
        ctx.beginPath();ctx.moveTo(x, 6 * ratio);
        ctx.quadraticCurveTo(x + side * 2 * ratio, 11 * ratio, x + side * ratio, 16 * ratio);
        ctx.stroke();
    }
    if (!behind) drawDoodleWeapon(ctx, config?.type, size, aim, pose, weapon?.reloading);
    ctx.restore();
}

/** Caller retains normal damage blink, visibility and skill-overlay passes. */
export function drawPlayerArtwork(
    ctx: CanvasRenderingContext2D,
    artwork: PlayerArtwork | undefined,
    radius: number,
    aim: number,
    pose?: DoodlePose,
    weapon?: Weapon | null
): boolean {
    if (!artwork) return false;
    if (artwork.rig !== 'neutral-player' && (!artwork.image.complete || artwork.image.naturalWidth <= 0 || artwork.image.naturalHeight <= 0)) return false;

    // Keep the figure upright; horizontal hysteresis avoids jitter at vertical aim.
    const direction = Math.cos(aim);
    if (direction < -PLAYER_PRESENTATION.facingDeadZone) artwork.facingLeft = true;
    else if (direction > PLAYER_PRESENTATION.facingDeadZone) artwork.facingLeft = false;
    const size = artwork.displaySize * radius / artwork.baseRadius;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (pose) {
        ctx.fillStyle='#30382b24';ctx.beginPath();ctx.ellipse(0,size*.44,size*.23*pose.shadowScale,size*.055,0,0,Math.PI*2);ctx.fill();
    }
    if (artwork.rig === 'paper-collector-v1' || artwork.rig === 'neutral-player') {
        drawPaperCollector(ctx, artwork.image, size, artwork.facingLeft, aim, pose, weapon, undefined, artwork.characterId);
    } else if (artwork.articulated && artwork.frame) {
        drawArticulatedPlayer(ctx, artwork, size, aim, pose, weapon);
    } else {
        ctx.save();
        applyDoodlePose(ctx,pose,size,aim);
        ctx.scale(artwork.facingLeft ? -1 : 1, 1);
        if (artwork.frame) drawAtlasFrame(ctx, artwork.image, artwork.frame, size);
        else ctx.drawImage(artwork.image, -size / 2, -size / 2, size, size);
        ctx.restore();
    }
    // Ballistic feedback now comes from the actual weapon muzzle. Keep the
    // existing damage signal without drawing a second shot halo on the torso.
    if (artwork.rig === 'neutral-player') {
        if (pose && pose.hit > 0) drawDoodleAccent(ctx, {...pose, attack: 0}, size, aim);
    } else drawDoodleAccent(ctx,pose,size,aim);
    ctx.restore();
    return true;
}
