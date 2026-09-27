import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';

export class MinimapSystem extends System {
    private width: number;
    private height: number;
    private scaleX: number;
    private scaleY: number;

    constructor(
        private ctx: CanvasRenderingContext2D,
        private worldWidth: number,
        private worldHeight: number,
        private camera: { x: number, y: number }
    ) {
        super();
        this.width = ctx.canvas.width;
        this.height = ctx.canvas.height;
        this.scaleX = this.width / worldWidth;
        this.scaleY = this.height / worldHeight;
    }

    public update(dt: number): void {
        // Clear minimap
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw entities as dots
        for (const entity of this.entities) {
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);

            if (!transform || !renderable || !renderable.visible) continue;

            const mx = transform.x * this.scaleX;
            const my = transform.y * this.scaleY;

            this.ctx.fillStyle = renderable.color;
            this.ctx.beginPath();
            
            if (entity.tags.has('player')) {
                this.ctx.arc(mx, my, 4, 0, Math.PI * 2); // Larger dot for player
            } else if (entity.tags.has('enemy')) {
                this.ctx.arc(mx, my, 2, 0, Math.PI * 2);
            } else {
                continue; // Skip bullets/particles for clarity
            }
            
            this.ctx.fill();
        }

        // Draw Camera Viewport Rect
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
            this.camera.x * this.scaleX,
            this.camera.y * this.scaleY,
            window.innerWidth * this.scaleX,
            window.innerHeight * this.scaleY
        );
    }
}
