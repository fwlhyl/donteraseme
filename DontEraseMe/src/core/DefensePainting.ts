import { BUILT_IN_ARTWORK, drawArtwork, type DefenseArtwork } from './DefenseArtwork';
import { DEFENSE_ARTWORK_FIT } from '../config/WorldConfig';

export interface DefensePaintTarget {
    x: number;
    y: number;
}

export interface DefensePaintingBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Owns the defendable, pre-existing artwork used by Guard Mode.
 *
 * The visible canvas keeps the high-resolution painting.  A small companion
 * mask mirrors only original ink, so integrity can be sampled cheaply and
 * repairs can never create health in originally blank paper.
 */
export class DefensePainting {
    public name = '守护之花';
    public active = false;
    public onErase?: (x: number, y: number, radius: number, strength: number) => void;
    public onRepair?: (x: number, y: number, rotation: number, range: number, width: number, strength: number) => void;

    private readonly ctx: CanvasRenderingContext2D;
    private readonly originalCanvas: HTMLCanvasElement;
    private readonly originalCtx: CanvasRenderingContext2D;
    private readonly coverageCanvas: HTMLCanvasElement;
    private readonly coverageCtx: CanvasRenderingContext2D;
    private readonly maskWidth = 360;
    private readonly maskHeight = 240;
    private worldWidth = 0;
    private worldHeight = 0;
    private inkTargets: DefensePaintTarget[] = [];
    private originalAlphaTotal = 1;
    private cachedIntegrity = 1;

    public bounds: DefensePaintingBounds = { x: 0, y: 0, width: 0, height: 0 };

    constructor(public readonly canvas: HTMLCanvasElement, worldWidth: number, worldHeight: number) {
        const ctx = canvas.getContext('2d');
        const originalCanvas = document.createElement('canvas');
        const originalCtx = originalCanvas.getContext('2d');
        const coverageCanvas = document.createElement('canvas');
        const coverageCtx = coverageCanvas.getContext('2d');

        if (!ctx || !originalCtx || !coverageCtx) {
            throw new Error('Defense painting canvas could not be initialized.');
        }

        this.ctx = ctx;
        this.originalCanvas = originalCanvas;
        this.originalCtx = originalCtx;
        this.coverageCanvas = coverageCanvas;
        this.coverageCtx = coverageCtx;
        this.resize(worldWidth, worldHeight);
    }

    public resize(worldWidth: number, worldHeight: number): void {
        if (this.worldWidth === worldWidth && this.worldHeight === worldHeight && this.canvas.width === worldWidth && this.canvas.height === worldHeight) {
            return;
        }

        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.canvas.width = worldWidth;
        this.canvas.height = worldHeight;
        this.canvas.style.width = `${worldWidth}px`;
        this.canvas.style.height = `${worldHeight}px`;
        this.ctx.imageSmoothingEnabled = true;

        this.originalCanvas.width = worldWidth;
        this.originalCanvas.height = worldHeight;
        this.originalCtx.imageSmoothingEnabled = true;

        this.coverageCanvas.width = this.maskWidth;
        this.coverageCanvas.height = this.maskHeight;
        this.coverageCtx.imageSmoothingEnabled = true;
        this.reset();
    }

    public reset(): void {
        this.ctx.clearRect(0, 0, this.worldWidth, this.worldHeight);
        this.originalCtx.clearRect(0, 0, this.worldWidth, this.worldHeight);
        this.coverageCtx.clearRect(0, 0, this.maskWidth, this.maskHeight);
        this.active = false;
        this.inkTargets = [];
        this.originalAlphaTotal = 1;
        this.cachedIntegrity = 1;
    }

    public beginBuiltInPainting(): void {
        this.beginArtwork(BUILT_IN_ARTWORK);
    }

    public beginArtwork(artwork: DefenseArtwork): void {
        this.reset();
        this.name = artwork.name;
        // Library documents remain resolution-independent. Fit both existing
        // and newly imported art to the central arena without distorting it.
        const scale = Math.min(this.worldWidth * DEFENSE_ARTWORK_FIT / artwork.width,
            this.worldHeight * DEFENSE_ARTWORK_FIT / artwork.height);
        const width = artwork.width * scale;
        const height = artwork.height * scale;
        this.bounds = {
            x: (this.worldWidth - width) / 2,
            y: (this.worldHeight - height) / 2,
            width,
            height
        };

        this.ctx.save();
        this.ctx.translate(this.bounds.x, this.bounds.y);
        this.ctx.scale(scale, scale);
        drawArtwork(this.ctx, artwork);
        this.ctx.restore();
        this.originalCtx.drawImage(this.canvas, 0, 0);
        this.coverageCtx.drawImage(this.canvas, 0, 0, this.worldWidth, this.worldHeight, 0, 0, this.maskWidth, this.maskHeight);
        this.captureInkTargets();
        this.cachedIntegrity = this.calculateIntegrity();
        this.active = true;
    }

    public getIntegrity(): number {
        return this.cachedIntegrity;
    }

    public refreshIntegrity(): number {
        if (!this.active) return 1;
        this.cachedIntegrity = this.calculateIntegrity();
        return this.cachedIntegrity;
    }

    public getRandomInkTarget(): DefensePaintTarget | null {
        if (!this.active || this.inkTargets.length === 0) return null;

        // Prefer ink which still exists. This keeps erasers from repeatedly
        // walking to already blank locations after a successful erasure.
        for (let attempt = 0; attempt < 24; attempt++) {
            const target = this.inkTargets[Math.floor(Math.random() * this.inkTargets.length)];
            if (this.hasCoverageAt(target.x, target.y)) return target;
        }

        return this.inkTargets[Math.floor(Math.random() * this.inkTargets.length)];
    }

    public eraseAt(x: number, y: number, radius: number, strength = 0.12): void {
        if (!this.active) return;
        const alpha = this.clamp(strength, 0, 0.5);
        if (alpha <= 0) return;

        this.eraseCircle(this.ctx, x, y, radius, alpha);
        const mask = this.toMaskPoint(x, y);
        this.eraseCircle(this.coverageCtx, mask.x, mask.y, Math.max(1, radius * this.maskWidth / this.worldWidth), alpha);
        this.onErase?.(x, y, radius, alpha);
    }

    /**
     * Restore a small amount of the original artwork along a player attack.
     * Copying from the immutable original canvas makes repairs mask-safe:
     * blank paper cannot be painted into extra integrity.
     */
    public repairStroke(x: number, y: number, rotation: number, range: number, width: number, strength = 0.16): void {
        if (!this.active) return;
        const repairStrength = this.clamp(strength, 0, 0.5);
        if (repairStrength <= 0) return;

        const clampedRange = Math.min(Math.max(36, range), 420);
        const endX = x + Math.cos(rotation) * clampedRange;
        const endY = y + Math.sin(rotation) * clampedRange;
        const step = Math.max(18, width * 0.9);
        const steps = Math.min(12, Math.max(1, Math.ceil(clampedRange / step)));

        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const px = x + (endX - x) * progress;
            const py = y + (endY - y) * progress;
            this.repairCircle(px, py, width, repairStrength);
        }
        this.onRepair?.(x, y, rotation, range, width, repairStrength);
    }

    public isNearPainting(x: number, y: number, padding = 0): boolean {
        return x >= this.bounds.x - padding
            && x <= this.bounds.x + this.bounds.width + padding
            && y >= this.bounds.y - padding
            && y <= this.bounds.y + this.bounds.height + padding;
    }

    private eraseCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private repairCircle(x: number, y: number, radius: number, strength: number): void {
        if (!this.isNearPainting(x, y, radius)) return;
        this.restoreFromOriginal(this.ctx, this.originalCanvas, x, y, radius, strength);

        const mask = this.toMaskPoint(x, y);
        const maskRadius = Math.max(1, radius * this.maskWidth / this.worldWidth);
        this.restoreFromOriginal(this.coverageCtx, this.originalCanvas, mask.x, mask.y, maskRadius, strength, true);
    }

    private restoreFromOriginal(
        targetCtx: CanvasRenderingContext2D,
        sourceCanvas: HTMLCanvasElement,
        x: number,
        y: number,
        radius: number,
        strength: number,
        isMask = false
    ): void {
        const sourceWidth = isMask ? this.maskWidth : this.worldWidth;
        const sourceHeight = isMask ? this.maskHeight : this.worldHeight;
        const scaleX = isMask ? this.maskWidth / this.worldWidth : 1;
        const scaleY = isMask ? this.maskHeight / this.worldHeight : 1;
        const drawRadius = Math.max(1, radius);
        const left = Math.max(0, Math.floor(x - drawRadius - 2));
        const top = Math.max(0, Math.floor(y - drawRadius - 2));
        const right = Math.min(sourceWidth, Math.ceil(x + drawRadius + 2));
        const bottom = Math.min(sourceHeight, Math.ceil(y + drawRadius + 2));
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) return;

        targetCtx.save();
        targetCtx.globalAlpha = strength;
        targetCtx.beginPath();
        targetCtx.arc(x, y, drawRadius, 0, Math.PI * 2);
        targetCtx.clip();
        // Interpolate toward the immutable original instead of repeatedly
        // source-over stamping it. Stamping makes antialiased thin lines more
        // opaque than their baseline and can manufacture integrity elsewhere.
        targetCtx.globalCompositeOperation = 'destination-out';
        targetCtx.fillStyle = '#000';
        targetCtx.fillRect(left, top, width, height);
        targetCtx.globalCompositeOperation = 'lighter';
        targetCtx.drawImage(
            sourceCanvas,
            left / scaleX,
            top / scaleY,
            width / scaleX,
            height / scaleY,
            left,
            top,
            width,
            height
        );
        targetCtx.restore();
    }

    private captureInkTargets(): void {
        const image = this.coverageCtx.getImageData(0, 0, this.maskWidth, this.maskHeight);
        let total = 0;
        const targets: DefensePaintTarget[] = [];

        for (let y = 0; y < this.maskHeight; y++) {
            for (let x = 0; x < this.maskWidth; x++) {
                const index = (y * this.maskWidth + x) * 4 + 3;
                const alpha = image.data[index];
                total += alpha;
                if (alpha > 12 && targets.length < 12000) {
                    targets.push({
                        x: (x + 0.5) * this.worldWidth / this.maskWidth,
                        y: (y + 0.5) * this.worldHeight / this.maskHeight
                    });
                }
            }
        }

        this.originalAlphaTotal = Math.max(1, total);
        this.inkTargets = targets;
    }

    private calculateIntegrity(): number {
        const coverage = this.coverageCtx.getImageData(0, 0, this.maskWidth, this.maskHeight);
        let alphaTotal = 0;
        for (let y = 0; y < this.maskHeight; y++) {
            for (let x = 0; x < this.maskWidth; x++) {
                alphaTotal += coverage.data[(y * this.maskWidth + x) * 4 + 3];
            }
        }
        return this.clamp(alphaTotal / this.originalAlphaTotal, 0, 1);
    }

    private hasCoverageAt(x: number, y: number): boolean {
        const point = this.toMaskPoint(x, y);
        const px = Math.max(0, Math.min(this.maskWidth - 1, Math.floor(point.x)));
        const py = Math.max(0, Math.min(this.maskHeight - 1, Math.floor(point.y)));
        return this.coverageCtx.getImageData(px, py, 1, 1).data[3] > 8;
    }

    private toMaskPoint(x: number, y: number): DefensePaintTarget {
        return {
            x: x * this.maskWidth / this.worldWidth,
            y: y * this.maskHeight / this.worldHeight
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
