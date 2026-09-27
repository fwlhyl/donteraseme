import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Trail } from '../components/Trail';
import { Weapon } from '../components/Weapon';
import { PlayerStats } from '../components/PlayerStats';

export class TrailSystem extends System {
    constructor(
        private ctx: CanvasRenderingContext2D,
        private camera: { x: number, y: number }
    ) {
        super();
    }

    public update(dt: number): void {
        for (const entity of this.entities) {
            const transform = entity.getComponent(Transform);
            const trail = entity.getComponent(Trail);

            if (transform && trail) {
                // For players, only draw trail when attacking AND it's the graffiti artist
                if (entity.tags.has('player')) {
                    const stats = entity.getComponent(PlayerStats);
                    const isGraffiti = stats && stats.characterId === 'graffiti';
                    
                    if (!entity.attacking || !isGraffiti) {
                        // Update last position but don't draw
                        trail.lastX = transform.x;
                        trail.lastY = transform.y;
                        trail.initialized = true;
                        continue;
                    }
                }

                if (!trail.initialized) {
                    trail.lastX = transform.x;
                    trail.lastY = transform.y;
                    trail.initialized = true;
                    continue;
                }

                // Draw line from last to current
                // Draw even if dist is small to ensure continuous line while moving slowly
                const dist = Math.hypot(transform.x - trail.lastX, transform.y - trail.lastY);
                if (dist > 0.5) { // Lowered threshold for smoother continuous drawing
                    this.ctx.beginPath();
                    this.ctx.moveTo(trail.lastX, trail.lastY);
                    this.ctx.lineTo(transform.x, transform.y);
                    
                    this.ctx.strokeStyle = trail.color;
                    this.ctx.lineWidth = trail.width; 
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.globalAlpha = trail.alpha;
                    
                    this.ctx.stroke();
                    this.ctx.globalAlpha = 1.0; // Restore
                    

                    trail.lastX = transform.x;
                    trail.lastY = transform.y;
                }
            }
        }
    }
}
