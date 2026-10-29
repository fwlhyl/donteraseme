import type { EnemyType } from '../components/EnemyBehavior';
import type { DoodlePose } from './DoodleMotion';
import { drawBossPrismDraft } from './BossPrismArt';
import { drawBossRollerDraft } from './BossRollerArt';
import { drawBossSlimeDraft } from './BossSlimeArt';
import { drawBossEraserDraft } from './BossEraserArt';

/** The same artwork as the review page, driven by the game's simulation clock. */
export function drawBossArtwork(ctx: CanvasRenderingContext2D, type: EnemyType | undefined,
    radius: number, rotation: number, pose?: DoodlePose): boolean {
    const draw = type === 'boss_prism' ? drawBossPrismDraft
        : type === 'boss_roller' ? drawBossRollerDraft
        : type === 'boss_slime' ? drawBossSlimeDraft
        : type === 'boss_eraser' ? drawBossEraserDraft : undefined;
    if (!draw || !Number.isFinite(radius) || radius <= 0) return false;
    const time = pose?.time ?? 0;
    ctx.save();
    ctx.translate(pose?.x ?? 0, pose?.y ?? 0);
    if (type === 'boss_roller') ctx.scale(Math.cos(rotation) < -.12 ? -1 : 1, 1);
    draw(ctx, radius * 2.5, time * 7, pose?.moving ?? 0);
    ctx.restore();
    return true;
}
