import { drawPaperCollector, getPaperCollector, type CollectorOutcome } from '../art/PaperCollectorArt';
import type { Weapon } from '../components/Weapon';

/** Decorative settlement portrait; no gameplay clocks or artwork canvases are touched. */
export class OutcomePortrait {
    private canvas: HTMLCanvasElement;
    private frame = 0;
    constructor(private readonly menu: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 144; this.canvas.height = 90;
        this.canvas.style.cssText = 'display:block;position:relative;top:auto;left:auto;width:144px;height:90px;image-rendering:pixelated;pointer-events:none;flex:none;background:#faf9f5;border:1px solid #b7b2a4';
        this.canvas.setAttribute('aria-hidden', 'true');
        menu.querySelector('h1')?.insertAdjacentElement('afterend', this.canvas);
    }
    show(outcome: CollectorOutcome['type'], aim: number, weapon?: Weapon | null, characterId = 'collector'): void {
        cancelAnimationFrame(this.frame);
        this.canvas.style.display = 'block';
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        const image = getPaperCollector();
        const start = performance.now();
        const draw = (now: number) => {
            if (this.menu.style.display === 'none') return;
            const progress = Math.min(1, (now-start)/(outcome === 'defeat' ? 1200 : 650));
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.save(); ctx.translate(72, 45);
            drawPaperCollector(ctx, image, 52, Math.cos(aim) < 0, aim, undefined, weapon, {type: outcome, progress}, characterId);
            ctx.restore();
            if (progress < 1) this.frame = requestAnimationFrame(draw);
        };
        this.frame = requestAnimationFrame(draw);
    }
    hide(): void { cancelAnimationFrame(this.frame); this.canvas.style.display = 'none'; }
}
