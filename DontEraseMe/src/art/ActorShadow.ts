import type { EnemyType } from '../components/EnemyBehavior';

/** A quiet contact shadow in local, upright world coordinates. `size` is the
 * same display size used by the actor art, not its gameplay hitbox. */
export function drawActorShadow(ctx: CanvasRenderingContext2D, size: number,
    kind: 'player' | EnemyType, boss: boolean): void {
    if (!Number.isFinite(size) || size <= 0) return;
    const airborne = kind === 'paper_plane' || kind === 'summoner' || kind === 'boss_prism';
    const wide = kind === 'eraser' || kind === 'boss_eraser' || kind === 'boss_roller';
    const rx = size * (kind === 'player' ? .25 : wide ? .40 : boss ? .34 : .30);
    const ry = size * (airborne ? .055 : .075);
    const y = size * (airborne ? .43 : .46);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha *= airborne ? .75 : 1;
    ctx.fillStyle = 'rgba(34, 37, 32, .11)';
    ctx.beginPath(); ctx.ellipse(0, y, rx * 1.16, ry * 1.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(34, 37, 32, .20)';
    ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}
