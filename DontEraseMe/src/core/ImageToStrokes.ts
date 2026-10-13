import type { ArtworkStroke, DefenseArtwork } from './DefenseArtwork';
import { MAX_ARTWORK_POINTS, MAX_ARTWORK_STROKES } from './DefenseArtwork';

export interface ImageStrokeOptions {
    detail?: number;
    crop?: { x: number; y: number; width: number; height: number };
    autoCrop?: boolean;
    lineWidth?: number;
    /** Preserve local source colours along the contours; not a raster/photo fill. */
    preserveColor?: boolean;
    name?: string;
}

const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Inspect dimensions before allocating a decoded bitmap (including WebP). */
function inspectImage(bytes: Uint8Array): { width: number; height: number } | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === 'PNG' && text(12, 4) === 'IHDR') {
        return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let p = 2;
        while (p + 3 < bytes.length) {
            if (bytes[p++] !== 0xff) return null;
            while (bytes[p] === 0xff) p++;
            const marker = bytes[p++];
            if (marker === 0xd9 || marker === 0xda) break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (p + 2 > bytes.length) break;
            const length = view.getUint16(p);
            if (length < 2 || p + length > bytes.length) break;
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
                return { height: view.getUint16(p + 3), width: view.getUint16(p + 5) };
            }
            p += length;
        }
    }
    if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
        let p = 12;
        while (p + 8 <= bytes.length) {
            const kind = text(p, 4);
            const length = view.getUint32(p + 4, true);
            const start = p + 8;
            if (start + length > bytes.length) break;
            if (kind === 'VP8X' && length >= 10) {
                return { width: 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16), height: 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16) };
            }
            if (kind === 'VP8 ' && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 1 && bytes[start + 5] === 0x2a) {
                return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
            }
            if (kind === 'VP8L' && length >= 5 && bytes[start] === 0x2f) {
                return { width: 1 + bytes[start + 1] + ((bytes[start + 2] & 0x3f) << 8), height: 1 + (bytes[start + 2] >> 6) + (bytes[start + 3] << 2) + ((bytes[start + 4] & 0x0f) << 10) };
            }
            p = start + length + (length & 1);
        }
    }
    return null;
}

/** Decode only local raster files. Object URLs are revoked on success or error. */
export async function decodeImage(file: File): Promise<HTMLCanvasElement> {
    if (!file.size) throw new Error('这张图片是空文件，请换一张图片。');
    if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB，请先缩小图片。');
    if (file.type && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type.toLowerCase())) {
        throw new Error('请选择 PNG、JPG 或 WebP 图片，其他格式暂不支持。');
    }
    const dimensions = inspectImage(new Uint8Array(await file.arrayBuffer()));
    if (!dimensions) throw new Error('无法读取图片，请选择有效的 PNG、JPG 或 WebP 文件。');
    if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 16384 || dimensions.height > 16384
        || dimensions.width * dimensions.height > 24_000_000) throw new Error('图片尺寸过大，请先缩小至 2400 万像素以内再导入。');
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
        image.src = url;
        await image.decode();
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法创建图片预览，请重试。');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
    } catch {
        throw new Error('图片解码失败，文件可能损坏；请换一张 PNG、JPG 或 WebP 图片。');
    } finally {
        image.src = '';
        URL.revokeObjectURL(url);
    }
}

function simplify(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
    if (points.length <= 2) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [0, points.length - 1];
    while (stack.length) {
        const end = stack.pop()!;
        const start = stack.pop()!;
        const a = points[start];
        const b = points[end];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const squared = dx * dx + dy * dy;
        let distance = tolerance * tolerance;
        let split = -1;
        for (let i = start + 1; i < end; i++) {
            const p = points[i];
            const ratio = squared ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / squared, 0, 1) : 0;
            const d = (p.x - a.x - ratio * dx) ** 2 + (p.y - a.y - ratio * dy) ** 2;
            if (d > distance) { distance = d; split = i; }
        }
        if (split !== -1) { keep[split] = 1; stack.push(start, split, split, end); }
    }
    return points.filter((_, i) => keep[i]);
}

type RGB = [number, number, number];
type ColoredPath = { points: { x: number; y: number }[]; color: string };
const MONOCHROME_INK = '#f0e8d8';

/** Lift dark ink off the dark battlefield while retaining its hue and saturation. */
function visibleInk(rgb: RGB): RGB {
    const min = Math.min(...rgb) / 255;
    const max = Math.max(...rgb) / 255;
    const lightness = (min + max) / 2;
    // Black and grey contours use the existing paper-coloured ink, not invisible black.
    if (max - min < 0.055) return [240, 232, 216];
    if (lightness >= 0.64) return rgb;
    const saturation = (max - min) / (1 - Math.abs(2 * lightness - 1));
    const nextChroma = (1 - Math.abs(2 * 0.64 - 1)) * saturation;
    const nextMin = 0.64 - nextChroma / 2;
    return rgb.map(channel => (nextMin + (channel / 255 - min) / (max - min) * nextChroma) * 255) as RGB;
}

function inkHex(rgb: RGB): string {
    return `#${rgb.map(channel => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

/** Sample the same cropped/scaled image that generated the edge coordinates.
 * Weight nearby non-white pixels so antialiasing/transparent margins do not bleach ink.
 */
function sampleInk(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number): RGB {
    const centerX = Math.round(x);
    const centerY = Math.round(y);
    const rgb: RGB = [0, 0, 0];
    let total = 0;
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const px = clamp(centerX + dx, 0, width - 1);
            const py = clamp(centerY + dy, 0, height - 1);
            const index = (py * width + px) * 4;
            const foreground = (255 - Math.min(pixels[index], pixels[index + 1], pixels[index + 2])) / 255;
            const weight = foreground * foreground / (1 + (dx * dx + dy * dy) * 0.5);
            for (let c = 0; c < 3; c++) rgb[c] += pixels[index + c] * weight;
            total += weight;
        }
    }
    return total > 0.01 ? visibleInk(rgb.map(channel => channel / total) as RGB) : [240, 232, 216];
}

/** Split long contours when source colour changes, including changes inside a
 * geometrically straight simplified edge. Shared endpoints avoid gaps on replay.
 */
async function colourPath(points: { x: number; y: number }[], pixels: Uint8ClampedArray,
    width: number, height: number): Promise<ColoredPath[]> {
    const result: ColoredPath[] = [];
    let group = [points[0]];
    let colourTotal: RGB = [0, 0, 0];
    let groupLength = 0;
    let samples = 0;
    const flush = () => {
        if (group.length > 1 && groupLength > 0) {
            result.push({ points: simplify(group, 0.8), color: inkHex(colourTotal.map(value => value / groupLength) as RGB) });
        }
    };
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (!length) continue;
        const steps = Math.max(1, Math.ceil(length / 6));
        const stepLength = length / steps;
        for (let step = 1; step <= steps; step++) {
            const ratio = (step - 0.5) / steps;
            const colour = sampleInk(pixels, width, height, a.x + (b.x - a.x) * ratio, a.y + (b.y - a.y) * ratio);
            const difference = groupLength ? Math.hypot(...colour.map((value, c) => value - colourTotal[c] / groupLength)) : 0;
            if (difference > 72 && groupLength >= 10) {
                flush();
                group = [group[group.length - 1]];
                colourTotal = [0, 0, 0];
                groupLength = 0;
            }
            group.push({ x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps });
            for (let c = 0; c < 3; c++) colourTotal[c] += colour[c] * stepLength;
            groupLength += stepLength;
            if (++samples % 4000 === 0) await yieldToUI();
        }
    }
    flush();
    return result;
}

/** Local line-art conversion; no AI model, network or original-photo storage. */
export async function convertToStrokes(source: HTMLCanvasElement, options: ImageStrokeOptions = {}): Promise<DefenseArtwork> {
    if (!source.width || !source.height) throw new Error('图片没有可用的内容。');
    const detail = clamp(Number.isFinite(options.detail) ? options.detail! : 0.5, 0, 1);
    const lineWidth = clamp(Number.isFinite(options.lineWidth) ? options.lineWidth! : 4, 3, 6);
    const requested = options.crop ?? { x: 0, y: 0, width: source.width, height: source.height };
    if (![requested.x, requested.y, requested.width, requested.height].every(Number.isFinite)
        || requested.width < 1 || requested.height < 1) throw new Error('裁剪范围太小，请重新选择。');
    let sx = clamp(requested.x, 0, source.width - 1);
    let sy = clamp(requested.y, 0, source.height - 1);
    let sw = Math.min(requested.width, source.width - sx);
    let sh = Math.min(requested.height, source.height - sy);
    if (sw < 2 || sh < 2) throw new Error('裁剪范围太小，请重新选择。');

    if (options.autoCrop !== false) {
        const probe = document.createElement('canvas');
        const ratio = Math.min(1, 1200 / Math.max(sw, sh));
        probe.width = Math.max(1, Math.round(sw * ratio));
        probe.height = Math.max(1, Math.round(sh * ratio));
        const ctx = probe.getContext('2d', { willReadFrequently: true })!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, probe.width, probe.height);
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, probe.width, probe.height);
        const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
        let left = probe.width, top = probe.height, right = -1, bottom = -1;
        for (let y = 0; y < probe.height; y++) {
            for (let x = 0; x < probe.width; x++) {
                const p = (y * probe.width + x) * 4;
                if (pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722 < 242) {
                    left = Math.min(left, x); right = Math.max(right, x);
                    top = Math.min(top, y); bottom = Math.max(bottom, y);
                }
            }
            if (y % 160 === 0) await yieldToUI();
        }
        if (right < left || bottom < top) throw new Error('图片是空白或颜色太浅，换一张轮廓更清楚的图片试试。');
        const pad = 4;
        left = Math.max(0, left - pad); top = Math.max(0, top - pad);
        right = Math.min(probe.width - 1, right + pad); bottom = Math.min(probe.height - 1, bottom + pad);
        sx += left / probe.width * sw;
        sy += top / probe.height * sh;
        sw *= (right - left + 1) / probe.width;
        sh *= (bottom - top + 1) / probe.height;
        probe.width = probe.height = 1;
    }

    const scale = Math.min(720 / sw, 520 / sh);
    const width = Math.max(3, Math.round(sw * scale));
    const height = Math.max(3, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法处理图片，请重试。');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const count = width * height;
    const gray = new Float32Array(count);
    const blur = new Float32Array(count);
    const magnitude = new Float32Array(count);
    const direction = new Uint8Array(count);
    for (let i = 0; i < count; i++) gray[i] = pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722;
    blur.set(gray);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const p = y * width + x;
            blur[p] = (gray[p - width - 1] + 2 * gray[p - width] + gray[p - width + 1]
                + 2 * gray[p - 1] + 4 * gray[p] + 2 * gray[p + 1]
                + gray[p + width - 1] + 2 * gray[p + width] + gray[p + width + 1]) / 16;
        }
        if (y % 96 === 0) await yieldToUI();
    }
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const p = y * width + x;
            const gx = -blur[p - width - 1] - 2 * blur[p - 1] - blur[p + width - 1]
                + blur[p - width + 1] + 2 * blur[p + 1] + blur[p + width + 1];
            const gy = -blur[p - width - 1] - 2 * blur[p - width] - blur[p - width + 1]
                + blur[p + width - 1] + 2 * blur[p + width] + blur[p + width + 1];
            magnitude[p] = Math.hypot(gx, gy);
            const angle = (Math.atan2(gy, gx) * 180 / Math.PI + 180) % 180;
            direction[p] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
        }
        if (y % 96 === 0) await yieldToUI();
    }
    // Non-maximum suppression + connected weak edges produce thin contours,
    // instead of treating every pixel of a thick Sobel band as a stroke.
    const high = 120 - detail * 100;
    const low = high * 0.45;
    const candidates = new Uint8Array(count);
    const edges = new Uint8Array(count);
    const queue = new Int32Array(count);
    let head = 0, tail = 0;
    const normalOffsets = [1, width + 1, width, width - 1];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const p = y * width + x;
            const m = magnitude[p];
            const offset = normalOffsets[direction[p]];
            if (m >= low && m >= magnitude[p - offset] && m > magnitude[p + offset]) {
                candidates[p] = 1;
                if (m >= high) { edges[p] = 1; queue[tail++] = p; }
            }
        }
    }
    const offsets = [1, width + 1, width, width - 1, -1, -width - 1, -width, -width + 1];
    while (head < tail) {
        const p = queue[head++];
        for (const offset of offsets) {
            const next = p + offset;
            if (candidates[next] && !edges[next]) { edges[next] = 1; queue[tail++] = next; }
        }
        if (head % 12000 === 0) await yieldToUI();
    }
    if (tail < 12) throw new Error('没有找到清晰轮廓，请提高细节或换一张对比更明显的图片。');
    if (tail > count * 0.28) throw new Error('图片纹理太密，请降低细节或裁剪到主体后重试。');

    const links = new Uint8Array(count);
    const visited = new Uint8Array(count);
    const degree = new Uint8Array(count);
    for (let p = 0; p < count; p++) {
        if (!edges[p]) continue;
        for (let d = 0; d < 8; d++) {
            if (!edges[p + offsets[d]]) continue;
            // Avoid diagonal shortcuts across a connected orthogonal corner.
            if (d % 2 && (edges[p + offsets[(d + 7) % 8]] || edges[p + offsets[(d + 1) % 8]])) continue;
            links[p] |= 1 << d;
            degree[p]++;
        }
    }
    const paths: { points: { x: number; y: number }[]; length: number }[] = [];
    const trace = (start: number, firstDirection: number) => {
        let p = start;
        let d = firstDirection;
        let length = 0;
        const points = [{ x: p % width, y: Math.floor(p / width) }];
        while (true) {
            const next = p + offsets[d];
            visited[p] |= 1 << d;
            visited[next] |= 1 << ((d + 4) % 8);
            length += d % 2 ? Math.SQRT2 : 1;
            p = next;
            points.push({ x: p % width, y: Math.floor(p / width) });
            if (degree[p] !== 2 || p === start) break;
            const available = links[p] & ~visited[p];
            if (!available) break;
            d = 0;
            while (!(available & (1 << d))) d++;
        }
        if (length >= 8 - detail * 4) paths.push({ points: simplify(points, 1.3 - detail * 0.65), length });
    };
    // Endpoints/junctions first; closed loops have degree two everywhere.
    for (let pass = 0; pass < 2; pass++) {
        for (let p = 0; p < count; p++) {
            if (!links[p] || (!pass && degree[p] === 2)) continue;
            for (let d = 0; d < 8; d++) if (links[p] & ~visited[p] & (1 << d)) trace(p, d);
            if (paths.length > 10000) throw new Error('图片碎线太多，请降低细节或裁剪到主体后重试。');
            if (p % 16000 === 0) await yieldToUI();
        }
    }
    paths.sort((a, b) => b.length - a.length);
    const fit = Math.min(720 / width, 520 / height);
    const offsetX = (780 - width * fit) / 2;
    const offsetY = (580 - height * fit) / 2;
    const strokes: ArtworkStroke[] = [];
    let pointsUsed = 0;
    let inkLength = 0;
    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
        const path = paths[pathIndex];
        if (strokes.length >= MAX_ARTWORK_STROKES) break;
        if (pointsUsed + path.points.length > MAX_ARTWORK_POINTS) continue;
        let coloured = options.preserveColor === false
            ? [{ points: path.points, color: MONOCHROME_INK }]
            : await colourPath(path.points, pixels, width, height);
        let colourPoints = coloured.reduce((sum, stroke) => sum + stroke.points.length, 0);
        // Geometry has priority over colour segmentation when near either storage
        // budget. A single representative colour keeps the whole contour usable.
        if (strokes.length + coloured.length > MAX_ARTWORK_STROKES || pointsUsed + colourPoints > MAX_ARTWORK_POINTS) {
            coloured = [{ points: path.points, color: coloured[0]?.color ?? MONOCHROME_INK }];
            colourPoints = path.points.length;
        }
        pointsUsed += colourPoints;
        inkLength += path.length;
        for (const stroke of coloured) {
            strokes.push({ color: stroke.color, width: lineWidth, points: stroke.points.map(p => ({ x: offsetX + p.x * fit, y: offsetY + p.y * fit })) });
        }
        if (pathIndex % 32 === 0) await yieldToUI();
    }
    if (!strokes.length || inkLength < 24) throw new Error('可用线条太少，请扩大裁剪范围或换一张轮廓清楚的图片。');
    // Spatial ordering looks like an artist moving around a page in the intro.
    strokes.sort((a, b) => Math.floor(a.points[0].y / 80) - Math.floor(b.points[0].y / 80) || a.points[0].x - b.points[0].x);
    canvas.width = canvas.height = 1;
    return {
        version: 1,
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `art-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: (options.name ?? '我的守护画作').trim().slice(0, 60) || '我的守护画作',
        width: 780, height: 580, strokes, createdAt: Date.now()
    };
}
