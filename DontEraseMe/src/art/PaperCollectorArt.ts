import collectorUrl from '../assets/characters/collector-paper-v1.webp';
import type { AtlasFrame } from './AtlasFrame';
import type { DoodlePose } from './DoodleMotion';
import { drawDoodleWeapon } from './DoodleWeapons';
import type { Weapon } from '../components/Weapon';

/**
 * Measured parts of the approved, unchanged 1346×1168 transparent concept.
 * The body's polygon excludes both floating hands and the baked-in brush.
 * Source coordinates share one scale/pivot; none of the parts is stretched.
 */
export const PAPER_COLLECTOR_PARTS = {
    body: { x: 438, y: 202, width: 528, height: 708 },
    hand: { x: 414, y: 763, width: 136, height: 128 },
    leftShoe: { x: 475, y: 923, width: 188, height: 77 },
    rightShoe: { x: 710, y: 923, width: 187, height: 77 },
} as const satisfies Record<string, AtlasFrame>;

export const PAPER_COLLECTOR_BODY_CLIP: readonly (readonly [number, number])[] = [
    [438, 202], [966, 202], [966, 620], [836, 659],
    [836, 910], [550, 910], [550, 714], [438, 714],
];

const SOURCE_CENTER_X = 695;
const SOURCE_BASELINE_Y = 998;
const SOURCE_HEIGHT = 796;
const INK_HEIGHT = 60;
const FOOT_BASELINE = 30;

let collector: HTMLImageElement | undefined;
export function getPaperCollector(): HTMLImageElement {
    if (!collector) {
        collector = new Image();
        collector.src = collectorUrl;
    }
    return collector;
}

function drawPart(
    ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: AtlasFrame,
    ratio: number, offsetX = 0, offsetY = 0
): void {
    const scale = INK_HEIGHT / SOURCE_HEIGHT * ratio;
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height,
        (frame.x - SOURCE_CENTER_X) * scale + offsetX,
        (frame.y - SOURCE_BASELINE_Y) * scale + FOOT_BASELINE * ratio + offsetY,
        frame.width * scale, frame.height * scale);
}

function drawBody(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ratio: number): void {
    const scale = INK_HEIGHT / SOURCE_HEIGHT * ratio;
    ctx.save();
    ctx.beginPath();
    PAPER_COLLECTOR_BODY_CLIP.forEach(([x, y], index) => {
        const px = (x - SOURCE_CENTER_X) * scale;
        const py = (y - SOURCE_BASELINE_Y) * scale + FOOT_BASELINE * ratio;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.clip();
    drawPart(ctx, image, PAPER_COLLECTOR_PARTS.body, ratio);
    ctx.restore();
}

function drawGrip(ctx: CanvasRenderingContext2D, image: HTMLImageElement, ratio: number): void {
    const frame = PAPER_COLLECTOR_PARTS.hand;
    const scale = INK_HEIGHT / SOURCE_HEIGHT * ratio;
    const width = frame.width * scale, height = frame.height * scale;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height,
        -width / 2, -height / 2 + 1.1 * ratio, width, height);
    ctx.restore();
}

/** Shoes step independently; body and empty hand remain upright with only a subpixel bob. */
export function drawPaperCollector(
    ctx: CanvasRenderingContext2D, image: HTMLImageElement, size: number,
    facingLeft: boolean, aim: number, pose?: DoodlePose, weapon?: Weapon | null
): void {
    const ratio = size / 64;
    const step = pose?.step ?? 0;
    ctx.save();
    ctx.scale(facingLeft ? -1 : 1, 1);
    for (const [side, frame] of [
        [-1, PAPER_COLLECTOR_PARTS.leftShoe], [1, PAPER_COLLECTOR_PARTS.rightShoe],
    ] as const) {
        const phase = side * step;
        drawPart(ctx, image, frame, ratio, phase * 2.7 * ratio, -Math.max(0, phase) * 1.8 * ratio);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(0, (pose?.y ?? 0) * ratio);
    const toolBehind = Math.sin(aim) < -.2;
    const drawTool = () => drawDoodleWeapon(ctx, weapon?.config?.type, size, aim, pose, weapon?.reloading, {
        detachedHand: true,
        drawGrip: (gripContext, gripRatio) => drawGrip(gripContext, image, gripRatio),
    });
    const toolDrawn = toolBehind && drawTool();
    ctx.save();
    ctx.scale(facingLeft ? -1 : 1, 1);
    drawBody(ctx, image, ratio);
    drawPart(ctx, image, PAPER_COLLECTOR_PARTS.hand, ratio);
    ctx.restore();
    // A missing/invalid weapon still leaves a second empty hand, never the source's baked brush.
    if (!(toolBehind ? toolDrawn : drawTool())) {
        ctx.save();
        ctx.scale(facingLeft ? 1 : -1, 1);
        drawPart(ctx, image, PAPER_COLLECTOR_PARTS.hand, ratio);
        ctx.restore();
    }
    ctx.restore();
}
