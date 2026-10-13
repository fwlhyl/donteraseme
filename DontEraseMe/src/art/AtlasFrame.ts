/** Source rectangles are measured on the original PNG; never stretch a sprite. */
export interface AtlasFrame { x: number; y: number; width: number; height: number; pivotY?: number }

export function drawAtlasFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: AtlasFrame, size: number): boolean {
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
    const scale = size / Math.max(frame.width, frame.height);
    const w = frame.width * scale, h = frame.height * scale;
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, -w / 2, -h * (frame.pivotY ?? .5), w, h);
    return true;
}
