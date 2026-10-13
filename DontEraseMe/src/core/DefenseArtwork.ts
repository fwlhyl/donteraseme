export interface ArtworkStroke {
    points: { x: number; y: number }[];
    color: string;
    width: number;
}

/** Portable, entirely local source of a guard painting (not a screenshot). */
export interface DefenseArtwork {
    version: 1;
    id: string;
    name: string;
    width: number;
    height: number;
    strokes: ArtworkStroke[];
    createdAt: number;
}

export const MAX_ARTWORK_STROKES = 2400;
export const MAX_ARTWORK_POINTS = 40000;

/** Check persisted/imported data before using it as canvas commands. */
export function validateArtwork(value: unknown): value is DefenseArtwork {
    if (!value || typeof value !== 'object') return false;
    const art = value as Partial<DefenseArtwork>;
    if (art.version !== 1 || typeof art.id !== 'string' || !art.id.length || art.id.length > 100
        || typeof art.name !== 'string' || !art.name.trim() || art.name.length > 60
        || !Number.isFinite(art.width) || !Number.isFinite(art.height)
        || art.width! < 1 || art.width! > 2048 || art.height! < 1 || art.height! > 2048
        || !Number.isFinite(art.createdAt) || art.createdAt! < 0
        || !Array.isArray(art.strokes) || art.strokes.length < 1 || art.strokes.length > MAX_ARTWORK_STROKES) return false;

    let pointCount = 0;
    let length = 0;
    for (const stroke of art.strokes) {
        if (!stroke || typeof stroke !== 'object' || !Array.isArray(stroke.points)
            || stroke.points.length < 2 || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 24
            || typeof stroke.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(stroke.color)) return false;
        pointCount += stroke.points.length;
        if (pointCount > MAX_ARTWORK_POINTS) return false;
        for (let i = 0; i < stroke.points.length; i++) {
            const point = stroke.points[i];
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                || point.x < 0 || point.x > art.width! || point.y < 0 || point.y > art.height!) return false;
            if (i > 0) length += Math.hypot(point.x - stroke.points[i - 1].x, point.y - stroke.points[i - 1].y);
        }
    }
    return length >= 8;
}

const lengths = new WeakMap<DefenseArtwork, { strokes: number[]; total: number }>();

/** Draw in artwork coordinates. The caller owns clearing, translation and scale. */
export function drawArtwork(ctx: CanvasRenderingContext2D, art: DefenseArtwork, progress = 1): void {
    const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    if (fraction === 0) return;
    let measured = lengths.get(art);
    if (!measured) {
        const strokes = art.strokes.map(stroke => stroke.points.reduce((total, point, index, points) =>
            index ? total + Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) : 0, 0));
        measured = { strokes, total: strokes.reduce((sum, length) => sum + length, 0) };
        lengths.set(art, measured);
    }
    let remaining = measured.total * fraction;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    for (let s = 0; s < art.strokes.length && remaining > 0; s++) {
        const stroke = art.strokes[s];
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        let available = remaining;
        for (let i = 1; i < stroke.points.length; i++) {
            const previous = stroke.points[i - 1];
            const point = stroke.points[i];
            const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
            if (segment > available) {
                const ratio = available / segment;
                ctx.lineTo(previous.x + (point.x - previous.x) * ratio, previous.y + (point.y - previous.y) * ratio);
                break;
            }
            ctx.lineTo(point.x, point.y);
            available -= segment;
        }
        ctx.stroke();
        remaining -= measured.strokes[s];
    }
    ctx.restore();
}

function makeBuiltIn(): DefenseArtwork {
    const strokes: ArtworkStroke[] = [];
    const line = (points: { x: number; y: number }[], color: string, width: number) => strokes.push({ points, color, width });
    const ellipse = (cx: number, cy: number, rx: number, ry: number, rotation: number, color: string, width: number) => {
        const points = Array.from({ length: 65 }, (_, i) => {
            const a = i * Math.PI * 2 / 64;
            return {
                x: cx + Math.cos(a) * rx * Math.cos(rotation) - Math.sin(a) * ry * Math.sin(rotation),
                y: cy + Math.cos(a) * rx * Math.sin(rotation) + Math.sin(a) * ry * Math.cos(rotation)
            };
        });
        line(points, color, width);
    };
    // All parts are genuine strokes: the introduction and the repair baseline
    // use exactly the same data as a player's converted image.
    line(Array.from({ length: 41 }, (_, i) => ({ x: 390 + Math.sin(i / 40 * Math.PI * 2) * 17, y: 500 - i * 6.1 })), '#3d9b71', 12);
    const leaves = [{ x: 336, y: 419, a: 0.58 }, { x: 439, y: 386, a: -0.6 }, { x: 325, y: 471, a: 0.25 }];
    for (const leaf of leaves) {
        ellipse(leaf.x, leaf.y, 64, 24, leaf.a, '#57b979', 8);
        line([-48, 48].map(d => ({ x: leaf.x + Math.cos(leaf.a) * d, y: leaf.y + Math.sin(leaf.a) * d })), '#347e5d', 4);
    }
    const colors = ['#ee719c', '#ea8fab', '#d579c1', '#dc9b54', '#a081d2', '#7297d7', '#eb779e', '#d893b9'];
    for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 4;
        ellipse(390 + Math.cos(a) * 102, 245 + Math.sin(a) * 102, 71, 43, a, colors[i], 10);
        ellipse(390 + Math.cos(a) * 112, 245 + Math.sin(a) * 112, 45, 23, a, colors[i], 3);
    }
    ellipse(390, 245, 62, 62, 0, '#dba94e', 10);
    ellipse(370, 231, 5, 7, 0, '#5d5140', 4);
    ellipse(410, 231, 5, 7, 0, '#5d5140', 4);
    line(Array.from({ length: 25 }, (_, i) => ({ x: 369 + i * 1.75, y: 262 + Math.sin(i / 24 * Math.PI) * 12 })), '#5d5140', 5);
    for (const star of [{ x: 130, y: 130, r: 30 }, { x: 660, y: 164, r: 26 }, { x: 622, y: 436, r: 32 }, { x: 154, y: 386, r: 22 }]) {
        line(Array.from({ length: 11 }, (_, i) => {
            const a = -Math.PI / 2 + i * Math.PI / 5;
            const radius = i % 2 ? star.r * 0.45 : star.r;
            return { x: star.x + Math.cos(a) * radius, y: star.y + Math.sin(a) * radius };
        }), '#b795d5', 5);
    }
    return { version: 1, id: 'builtin-flower', name: '守护之花', width: 780, height: 580, strokes, createdAt: 0 };
}

export const BUILT_IN_ARTWORK: DefenseArtwork = makeBuiltIn();
