import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { courtyard } from '../world/CourtyardGeometry';

export class MinimapSystem extends System {
    private width = 150;
    private height = 150;
    private scaleX = 1;
    private scaleY = 1;

    constructor(
        private ctx: CanvasRenderingContext2D,
        private worldWidth: number,
        private worldHeight: number,
        private camera: { x: number, y: number },
        private useCourtyard: () => boolean = () => false
    ) {
        super();
        // Keep CSS size independent of the Retina backing-store dimensions.
        ctx.canvas.style.width ||= '150px';
        ctx.canvas.style.height ||= '150px';
        this.syncCanvasSize();
    }

    public override setWorldSize(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
        this.syncCanvasSize();
    }

    private syncCanvasSize(): void {
        const canvas = this.ctx.canvas;
        this.width = canvas.clientWidth || parseFloat(canvas.style.width) || 150;
        this.height = canvas.clientHeight || parseFloat(canvas.style.height) || 150;
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(this.width * dpr));
        const pixelHeight = Math.max(1, Math.round(this.height * dpr));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        // setTransform is idempotent even after Game.resize resets the context.
        this.ctx.setTransform(pixelWidth / this.width, 0, 0, pixelHeight / this.height, 0, 0);
        this.scaleX = this.width / this.worldWidth;
        this.scaleY = this.height / this.worldHeight;
    }

    public update(dt: number): void {
        this.syncCanvasSize();
        // Clear minimap
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Dark-paper navigator. These colors are UI-only, never artwork colors.
        this.ctx.fillStyle = '#252621';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.strokeStyle = 'rgba(238, 228, 200, 0.025)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = 12; x < this.width; x += 24) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x + ((x / 24) % 2 ? 1 : -1), this.height);
        }
        for (let y = 12; y < this.height; y += 24) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y + ((y / 24) % 2 ? 1 : -1));
        }
        this.ctx.stroke();

        if(this.useCourtyard()) {
            this.ctx.fillStyle='#2c2d26';
            this.ctx.fillRect(0,0,this.width,this.height);
            this.ctx.beginPath();
            courtyard.points.forEach((p,i)=>{
                if(i===0)this.ctx.moveTo(p.x*this.scaleX,p.y*this.scaleY);
                else this.ctx.lineTo(p.x*this.scaleX,p.y*this.scaleY);
            });
            this.ctx.closePath();this.ctx.fillStyle='#252621';this.ctx.fill();
            this.ctx.strokeStyle='#eee4c8';this.ctx.stroke();
        }

        // Draw entities as dots
        for (const entity of this.entities) {
            // Paint trails can produce hundreds of projectiles/particles. They
            // are never shown here, so skip before component/style/path work.
            if (!entity.tags.has('player') && !entity.tags.has('enemy') && !entity.tags.has('magic_manifestation')) continue;
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);

            if (!transform || !renderable || !renderable.visible) continue;

            const mx = transform.x * this.scaleX;
            const my = transform.y * this.scaleY;

            this.ctx.fillStyle = entity.tags.has('enemy') ? '#b74736' : '#eee4c8';
            this.ctx.strokeStyle = '#eee4c8';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            
            if (entity.tags.has('player') || entity.tags.has('magic_manifestation')) {
                this.ctx.arc(mx, my, 4, 0, Math.PI * 2); // Larger dot for player
            } else if (entity.tags.has('enemy')) {
                this.ctx.arc(mx, my, 2, 0, Math.PI * 2);
            } else {
                continue; // Skip bullets/particles for clarity
            }
            
            this.ctx.fill();
            this.ctx.stroke();
        }

        // Draw Camera Viewport Rect
        this.ctx.strokeStyle = 'rgba(238, 228, 200, 0.3)';
        this.ctx.lineWidth = 1.5;
        // Large monitors may show the entire small arena with negative camera
        // offsets; clip the viewport indicator to the actual world bounds.
        const left = Math.max(0, this.camera.x);
        const top = Math.max(0, this.camera.y);
        const right = Math.min(this.worldWidth, this.camera.x + window.innerWidth);
        const bottom = Math.min(this.worldHeight, this.camera.y + window.innerHeight);
        this.ctx.strokeRect(left * this.scaleX, top * this.scaleY,
            Math.max(0, right - left) * this.scaleX,
            Math.max(0, bottom - top) * this.scaleY);
    }
}
