import type { Entity } from '../core/Entity';
import { Projectile } from '../components/Projectile';
import { Renderable } from '../components/Renderable';
import { Transform } from '../components/Transform';

let glow: HTMLCanvasElement | undefined;

/** A cached soft field and inward-moving ink motes, rendered behind actors. */
export function drawVortexField(ctx: CanvasRenderingContext2D, entity: Entity, playerId: string | undefined, time: number): void {
    const projectile = entity.getComponent(Projectile);
    const transform = entity.getComponent(Transform);
    const renderable = entity.getComponent(Renderable);
    if (!playerId || !entity.active || !transform || !renderable?.visible || projectile?.type !== 'gravity' || projectile.ownerId !== playerId || projectile.life <= 0) return;
    // The collision broad phase currently limits awakened attraction to ±300.
    const radius = (projectile as Projectile & { isAwakened?: boolean }).isAwakened ? 300 : 250;
    if (!glow) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const brush = canvas.getContext('2d');
        if (!brush) return;
        const gradient = brush.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, 'rgba(149,65,225,0.20)');
        gradient.addColorStop(.3, 'rgba(149,65,225,0.11)');
        gradient.addColorStop(.7, 'rgba(149,65,225,0.035)');
        gradient.addColorStop(1, 'rgba(149,65,225,0)');
        brush.fillStyle = gradient; brush.fillRect(0, 0, 256, 256);
        glow = canvas;
    }
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.globalAlpha *= Math.min(1, projectile.life / 12);
    ctx.drawImage(glow, -radius, -radius, radius * 2, radius * 2);
    // Motes spiral toward the center; each fades with its distance from it.
    for (let i = 0; i < 8; i++) {
        const distance = 1 - ((time * .32 + i / 8) % 1);
        const angle = i * 2.4 + time * .7 + (1 - distance) * 2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(178,113,238,${(1 - distance) * .32})`;
        ctx.arc(Math.cos(angle) * distance * radius, Math.sin(angle) * distance * radius, 1.5 + (1 - distance), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
