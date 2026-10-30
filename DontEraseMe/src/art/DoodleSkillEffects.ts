import type { Velocity } from '../components/Velocity';
import type { Weapon } from '../components/Weapon';
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
    stats?: PlayerStats, skill?: Skill, timeSeconds = 0, weapon?: Weapon, velocity?: Velocity): void {
    if (!Number.isFinite(radius) || radius <= 0) return;
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    ctx.save(); ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    if (stats && stats.killFrenzyStacks.length > 0 && velocity && Math.hypot(velocity.x,velocity.y) > .1) {
        ctx.save(); ctx.rotate(Math.atan2(velocity.y,velocity.x));
        const count=Math.min(5,2+stats.killFrenzyStacks.length);
        for(let i=0;i<count;i++) {
            const age=(t*5+i/count)%1;
            const x=-radius-7-age*30, y=Math.sin(i*13)*8;
            ctx.globalAlpha=.65*(1-age); ctx.fillStyle=i%2?'#74628e':'#313046';
            ctx.beginPath(); ctx.moveTo(x+5,y); ctx.quadraticCurveTo(x-3,y-5,x-6,y);
            ctx.quadraticCurveTo(x-3,y+5,x+5,y); ctx.fill();
        }
        ctx.restore();
    }
    if (stats && stats.getSkillLevel('defense_hedgehog') > 0) {
        const cooldown=[180,150,120][stats.getSkillLevel('defense_hedgehog')-1];
        const age=cooldown-stats.hedgehogCooldownFrames;
        if(stats.hedgehogCooldownFrames>0 && age>=0 && age<18) {
            ctx.save(); ctx.globalAlpha*=Math.min(1,(18-age)/6);
            const extension=Math.min(1,(age+1)/4);
            ctx.strokeStyle=INK; ctx.fillStyle='#c0b5d4'; ctx.lineWidth=1.6;
            for(let i=0;i<10;i++) {
                ctx.save();ctx.rotate(i*TAU/10);
                ctx.beginPath();ctx.moveTo(radius-2,-4);ctx.lineTo(radius+5+extension*14,0);
                ctx.lineTo(radius-2,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
            }
            ctx.restore();
        }
    }
    const inspired = (weapon as (Weapon & {inspirationLevel?:number}) | undefined)?.inspirationLevel ?? 0;
    if (inspired > 0 || stats?.killReaperReady) {
        const reaper = !!stats?.killReaperReady;
        ctx.save(); ctx.translate(radius+9, -radius*.5);
        ctx.strokeStyle=reaper?'#c4a2e5':'#fff0a8'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(-4,12); ctx.lineTo(5,-12);
        if(reaper) ctx.quadraticCurveTo(24,-14,17,5);
        else { ctx.moveTo(-6,-4); ctx.lineTo(12,-4); ctx.moveTo(3,-13); ctx.lineTo(3,5); }
        ctx.stroke(); ctx.restore();
    }
    if (stats && stats.staticFrames > 0 && stats.getSkillLevel('move_static_charge') > 0) {
        const level=stats.getSkillLevel('move_static_charge');
        const delay=[120,90,60][level-1];
        const charge=Math.min(1,stats.staticFrames/(delay+120));
        ctx.strokeStyle=stats.staticDamageBonus>0?'#f4d779':'#8c82b0'; ctx.lineWidth=2;
        for(let i=0;i<6;i++) {
            const a=i*TAU/6; const d=radius+18-charge*10;
            ctx.beginPath(); ctx.moveTo(Math.cos(a)*d,Math.sin(a)*d);
            ctx.lineTo(Math.cos(a)*(d+3+charge*7),Math.sin(a)*(d+3+charge*7)); ctx.stroke();
        }
    }
    if (stats && stats.skateboardActive && stats.currentSpeed > .1
        && stats.getSkillLevel('move_skateboard') > 0) {
        ctx.save(); ctx.translate(0,radius+5);
        // A small ink-outlined wooden deck; only the wheels animate with speed.
        ctx.lineJoin='round'; ctx.lineCap='round';
        ctx.fillStyle='rgba(23,29,37,.16)';
        ctx.beginPath(); ctx.ellipse(0,9,24,3,-.03,0,TAU); ctx.fill();
        ctx.strokeStyle=INK; ctx.lineWidth=2;
        for(const x of [-13,13]) {
            ctx.beginPath(); ctx.moveTo(x-3,2); ctx.lineTo(x+3,2);
            ctx.moveTo(x,2); ctx.lineTo(x,6); ctx.stroke();
            ctx.fillStyle='#eee4cf'; ctx.beginPath(); ctx.ellipse(x,7,3.8,4.2,.1,0,TAU); ctx.fill(); ctx.stroke();
            const spin=t*stats.currentSpeed*3;
            ctx.beginPath(); ctx.moveTo(x-Math.cos(spin)*2,7-Math.sin(spin)*2);
            ctx.lineTo(x+Math.cos(spin)*2,7+Math.sin(spin)*2); ctx.lineWidth=1; ctx.stroke(); ctx.lineWidth=2;
        }
        ctx.beginPath(); ctx.moveTo(-26,-5);
        ctx.quadraticCurveTo(-23,2,-14,2); ctx.lineTo(15,1);
        ctx.quadraticCurveTo(23,0,27,-7); ctx.lineTo(24,-8);
        ctx.quadraticCurveTo(20,-3,13,-3); ctx.lineTo(-14,-2);
        ctx.quadraticCurveTo(-21,-2,-24,-7); ctx.closePath();
        ctx.fillStyle='#cfaa79'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-19,-4); ctx.quadraticCurveTo(0,-1,20,-5);
        ctx.strokeStyle='#f7e5bf'; ctx.lineWidth=1; ctx.stroke();
        ctx.strokeStyle='#4f756a'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(-1,-3); ctx.lineTo(4,-2); ctx.lineTo(9,-4); ctx.stroke();
        ctx.restore();
    }
    if (skill && skill.eraserShieldFrames > 0) {
        ctx.save(); ctx.globalAlpha *= .8;
        // This exact circle remains the readable 60px erasing boundary.
        ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); inkStroke(ctx, '#7ed6df', 1.5);
        for (let i = 0; i < 5; i++) {
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
            const a = i * TAU / 3 + timeSeconds * .5;
            ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.scale(1.25,1.6 + Math.sin(timeSeconds*9+i)*.25);
            ctx.beginPath(); ctx.moveTo(-3,3); ctx.lineTo(-2,-2); ctx.lineTo(0,-5); ctx.lineTo(3,2); ctx.closePath();
            ctx.fillStyle = '#c38652'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
        }
    }
    if (eb.corrosiveStacks > 0) {
        ctx.save();
        for(let i=0;i<eb.corrosiveStacks+2;i++) {
            const a=i*2.4, x=Math.cos(a)*radius*.65,y=Math.sin(a)*radius*.5;
            ctx.fillStyle='rgba(79,105,44,.72)';ctx.strokeStyle='#273c2b';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(x-4,y-2);ctx.lineTo(x+2,y-4);ctx.lineTo(x+5,y+1);
            ctx.lineTo(x+1,y+4);ctx.lineTo(x-5,y+2);ctx.closePath();ctx.fill();ctx.stroke();
            const drop=(timeSeconds*.7+i*.37)%1;
            ctx.globalAlpha=1-drop;ctx.fillStyle='#9aba59';
            ctx.beginPath();ctx.ellipse(x,y+5+drop*13,1.6,2.7,0,0,TAU);ctx.fill();ctx.globalAlpha=1;
        }
        ctx.restore();
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
