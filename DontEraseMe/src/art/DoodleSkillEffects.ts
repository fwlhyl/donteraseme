import type { PlayerStats } from '../components/PlayerStats';
import type { Skill } from '../components/Skill';
import type { EnemyBehavior } from '../components/EnemyBehavior';

const INK = '#171d25';
const TAU = Math.PI * 2;
/** A deterministic ink contour, kept within the existing effect radius. */
function contour(ctx: CanvasRenderingContext2D, radius: number, phase = 0, sides = 28): void {
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU + phase;
        const r = radius - (i % 3 === 0 ? .9 : 0);
        if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
}
function inkStroke(ctx: CanvasRenderingContext2D, color: string, width = 2): void {
    ctx.strokeStyle = INK; ctx.lineWidth = width + 2; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

/** Pure visual overlay. No gameplay timers or combat state are modified. */
export function drawDoodlePlayerEffects(ctx: CanvasRenderingContext2D, radius: number,
    stats?: PlayerStats, skill?: Skill, timeSeconds = 0): void {
    if (!Number.isFinite(radius) || radius <= 0) return;
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    ctx.save(); ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    if (skill && skill.eraserShieldFrames > 0) {
        ctx.save(); ctx.globalAlpha *= .8;
        // This exact circle remains the readable 60px erasing boundary.
        ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); inkStroke(ctx, '#7ed6df', 1.5);
        for (let i = 0; i < 3; i++) {
            const a = t * .7 + i * TAU / 3;
            ctx.save(); ctx.translate(Math.cos(a) * 60, Math.sin(a) * 60); ctx.rotate(a);
            ctx.fillStyle = '#f1e5c9'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(-3,-5); ctx.lineTo(3,-4); ctx.lineTo(3,5); ctx.lineTo(-3,4); ctx.closePath();
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }
    if (stats?.characterId === 'classical' && (stats.hasClassicalShield || stats.classicalShieldStacks > 0)) {
        ctx.save(); ctx.globalAlpha *= .78 + .1 * Math.sin(t * 3);
        const stacks = Math.max(stats.classicalShieldStacks, stats.hasClassicalShield ? 1 : 0);
        for (let i = 0; i < stacks; i++) {
            contour(ctx, radius + 15 + i * 5, .15 + i * .12); inkStroke(ctx, '#e7bc59', 1.7);
        }
        ctx.restore();
    }
    if (stats?.hasOrigamiShield) {
        const r = radius + 15;
        ctx.save(); ctx.globalAlpha *= .85;
        contour(ctx, r, t * .4, 6); inkStroke(ctx, '#eee3cc', 1.7);
        for (let i = 0; i < 3; i++) {
            const a = t * .4 + i * TAU / 3;
            ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a);
            ctx.fillStyle = '#eee3cc'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(4,-3); ctx.lineTo(3,5); ctx.lineTo(-4,2); ctx.closePath();
            ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(3,5); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }
    if (stats?.hasCalligrapherPassive && stats.calligrapherDamageStacks > 0) {
        const intensity = Math.min(1, stats.calligrapherDamageStacks / Math.max(1, stats.maxCalligrapherStacks));
        ctx.save(); ctx.globalAlpha *= .35 + intensity * .45;
        contour(ctx, radius + 10 + intensity * 15); ctx.setLineDash([13, 7]); inkStroke(ctx, '#d77b78', 1.5 + intensity);
        ctx.restore();
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f1e5ce';
        ctx.fillText(`+${stats.calligrapherDamageStacks * 2}%`, 0, -radius - 15);
    }
    if (stats && stats.explosionCooldownFrames > 0) {
        const level = stats.getSkillLevel('defense_desperate_explosion');
        const maxCD = [3600, 2700, 1800][level - 1] || 3600;
        if (stats.explosionCooldownFrames > maxCD - 60) {
            ctx.save(); ctx.globalAlpha *= .6;
            // Trigger feedback, not a new countdown or delayed hitbox.
            contour(ctx, radius + 30, t * .3, 16); ctx.setLineDash([8, 7]); inkStroke(ctx, '#ee8072', 2);
            ctx.restore();
        }
    }
    ctx.restore();
}

/** Existing enemy status indicators, using the same small paper/ink vocabulary. */
export function drawDoodleStatus(ctx: CanvasRenderingContext2D, radius: number, eb: EnemyBehavior,
    timeSeconds: number, stunned = false): void {
    if (!Number.isFinite(radius) || radius <= 0) return;
    if (!stunned && eb.frozenFrames<=0 && eb.burnFrames<=0 && eb.corrosiveStacks<=0 && eb.blindFrames<=0 && eb.confusedFrames<=0) return;
    ctx.save(); ctx.shadowBlur = 0; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
    if (eb.frozenFrames > 0) {
        contour(ctx, radius + 2, .2, 7);
        ctx.fillStyle = 'rgba(113,199,218,.14)'; ctx.fill(); inkStroke(ctx, '#a9ddeb', 1.5);
    }
    if (eb.burnFrames > 0) {
        const r = radius + 4;
        for (let i = 0; i < 3; i++) {
            const a = i * TAU / 3 + timeSeconds * .4;
            ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
            ctx.beginPath(); ctx.moveTo(-3,3); ctx.lineTo(-2,-2); ctx.lineTo(0,-5); ctx.lineTo(3,2); ctx.closePath();
            ctx.fillStyle = '#e5a052'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
        }
    }
    if (eb.corrosiveStacks > 0) {
        for (let i = 0; i < eb.corrosiveStacks; i++) {
            const x = (i - (eb.corrosiveStacks - 1) / 2) * 7;
            ctx.beginPath(); ctx.moveTo(x,-radius-12); ctx.lineTo(x+2.5,-radius-7); ctx.lineTo(x,-radius-5); ctx.lineTo(x-2.5,-radius-7); ctx.closePath();
            ctx.fillStyle = '#a9ca69'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        }
    }
    if (eb.blindFrames > 0 || eb.confusedFrames > 0 || stunned) {
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#eee3c8';
        ctx.fillText(stunned ? '×' : eb.blindFrames > 0 ? '???' : '?', 0, -radius - (eb.corrosiveStacks > 0 ? 19 : 10));
    }
    ctx.restore();
}
