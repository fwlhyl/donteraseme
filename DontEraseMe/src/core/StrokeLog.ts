/** A single run's drawing commands. Coordinates and paint state are packed in
 * numeric chunks; no canvas screenshots or per-projectile objects on the hot path. */
export interface MagicDrawing {
    time: number;
    type: string;
    grade: string;
    width: number;
    height: number;
    strokes: { x: number; y: number }[][];
}

export interface StrokePlaybackTargets {
    trail: CanvasRenderingContext2D;
    erase: (x: number, y: number, radius: number, strength: number) => void;
    repair: (x: number, y: number, rotation: number, range: number, width: number, strength: number) => void;
}

const CHUNK_SIZE = 65536;
const enum Draw { Fill, Stroke, FillRect, StrokeRect, ClearRect, Erase, Repair }
const enum Path { Move, Line, Arc, Ellipse, Bezier, Quadratic, Rect, Close, Transform, ArcTo }
const PATH_METHODS: Record<string, [Path, number]> = {
    moveTo: [Path.Move, 2], lineTo: [Path.Line, 2], arc: [Path.Arc, 6],
    ellipse: [Path.Ellipse, 8], bezierCurveTo: [Path.Bezier, 6],
    quadraticCurveTo: [Path.Quadratic, 4], rect: [Path.Rect, 4],
    closePath: [Path.Close, 0], arcTo: [Path.ArcTo, 5],
};
const CAPS: CanvasLineCap[] = ['butt', 'round', 'square'];
const JOINS: CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const COMPOSITES: GlobalCompositeOperation[] = ['source-over', 'destination-out', 'lighter', 'copy', 'destination-over', 'source-atop', 'destination-in', 'source-in', 'xor', 'multiply', 'screen'];
const PAINT_METHODS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText']);
const TRANSFORM_METHODS = new Set(['translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'restore', 'reset']);

interface WrappedPaintContext {
    target: CanvasRenderingContext2D;
    batchDepth: number;
    matrix: DOMMatrix | null;
    matrixDirty: boolean;
    changedProperties: Set<PropertyKey>;
    transformTouched: boolean;
    dashTouched: boolean;
}

export type PaintBoundary = ReadonlyArray<{ readonly x: number; readonly y: number }>;

export class StrokeLog {
    public width = 0;
    public height = 0;
    public duration = 0;
    public eventCount = 0;
    public recording = false;
    /** In extreme runs the host records a compressed snapshot tail instead. */
    public overflowAt: number | null = null;
    public fallbackReason = '';
    public readonly magicDrawings: MagicDrawing[] = [];
    private chunks: Float32Array[] = [];
    private length = 0;
    private colors = new Map<string, readonly [number, number]>();
    private readonly maxNumbers: number;
    private paintClip: Path2D | null = null;
    private readonly wrappedContexts = new WeakMap<CanvasRenderingContext2D, WrappedPaintContext>();

    constructor(maxBytes = 96 * 1024 * 1024) {
        this.maxNumbers = Math.max(128, Math.floor(maxBytes / 4));
    }

    public get hasContent(): boolean { return this.eventCount > 0 || this.magicDrawings.length > 0; }
    public get byteLength(): number { return this.chunks.reduce((size, chunk) => size + chunk.byteLength, 0); }

    public start(width: number, height: number, boundary: PaintBoundary | null = null): void {
        this.clear();
        this.width = width;
        this.height = height;
        if (boundary) {
            if (boundary.length < 3 || boundary.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
                throw new Error('Invalid paint boundary');
            }
            // Path2D copies the run's geometry and does not disturb callers'
            // current drawing paths. Never rebuild this polygon per stroke.
            this.paintClip = new Path2D();
            this.paintClip.moveTo(boundary[0].x, boundary[0].y);
            for (let i = 1; i < boundary.length; i++) this.paintClip.lineTo(boundary[i].x, boundary[i].y);
            this.paintClip.closePath();
        }
        this.recording = true;
    }

    public clear(): void {
        this.recording = false;
        this.chunks = [];
        this.length = 0;
        this.duration = 0;
        this.eventCount = 0;
        this.overflowAt = null;
        this.fallbackReason = '';
        this.colors.clear();
        this.magicDrawings.length = 0;
        this.paintClip = null;
    }

    /** Call within a native save/restore pair. Clip in world coordinates even
     * when a brush is rotated/scaled. Shared by live drawing and replay. */
    public applyPaintBoundary(ctx: CanvasRenderingContext2D): void {
        if (!this.paintClip) return;
        const matrix = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clip(this.paintClip);
        ctx.setTransform(matrix);
    }

    /** One synchronous frame's paints share the same immutable world clip.
     * Brushes must balance save/restore and leave canvas resize/reset/clearRect
     * outside this scope. The current path and final paint state are preserved:
     * the extra native save only owns the boundary, not callers' style changes.
     * Async callbacks are intentionally unsupported. */
    public withPaintBoundary<T>(ctx: CanvasRenderingContext2D, paint: () => T): T {
        const state = this.wrappedContexts.get(ctx);
        if (!state) throw new Error('Paint batches require this StrokeLog wrapped context');
        if (state.batchDepth > 0) return paint();
        const target = state.target;
        const clipped = this.paintClip !== null;
        if (clipped) {
            target.save();
            try { this.applyPaintBoundary(target); }
            catch (error) { target.restore(); throw error; }
        }
        state.batchDepth = 1;
        state.matrixDirty = true;
        state.changedProperties.clear();
        state.transformTouched = false;
        state.dashTouched = false;
        try {
            return paint();
        } finally {
            // Capture the state after callers' own restores, not the last value
            // assigned inside a temporary brush scope. Native operations bypass
            // logging and never add events to the artwork timeline.
            const properties = clipped
                ? [...state.changedProperties].map(key => [key, Reflect.get(target, key, target)] as const)
                : [];
            const matrix = clipped && state.transformTouched ? target.getTransform() : null;
            const dash = clipped && state.dashTouched ? target.getLineDash() : null;
            state.batchDepth = 0;
            state.matrixDirty = true;
            if (clipped) {
                target.restore();
                for (const [key, value] of properties) {
                    if (Reflect.get(target, key, target) !== value) Reflect.set(target, key, value, target);
                }
                if (matrix) target.setTransform(matrix);
                if (dash) target.setLineDash(dash);
            }
            state.changedProperties.clear();
        }
    }

    public advance(dt: number): void {
        if (this.recording && Number.isFinite(dt) && dt > 0) this.duration += dt;
    }

    public finish(): void { this.recording = false; }

    public recordErase(x: number, y: number, radius: number, strength: number): void {
        this.recordNumbers(Draw.Erase, [x, y, radius, strength]);
    }

    public recordRepair(x: number, y: number, rotation: number, range: number, width: number, strength: number): void {
        this.recordNumbers(Draw.Repair, [x, y, rotation, range, width, strength]);
    }

    public recordMagicDrawing(drawing: Omit<MagicDrawing, 'time'>): void {
        if (!this.recording) return;
        // UI ink is its own channel. It must never be painted onto the world.
        const strokes = drawing.strokes.map(stroke => {
            const points: { x: number; y: number }[] = [];
            for (const point of stroke) {
                const last = points[points.length - 1];
                if (Number.isFinite(point.x) && Number.isFinite(point.y)
                    && (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 2)) {
                    points.push({ x: point.x, y: point.y });
                }
            }
            return points;
        }).filter(stroke => stroke.length > 0);
        this.magicDrawings.push({ ...drawing, time: this.duration, strokes });
    }

    /** The proxy calls the real context with its native receiver. Nothing in
     * gameplay uses a separate renderer, and random splashes are recorded after
     * their coordinates have been chosen, so playback never rerolls randomness. */
    public wrapContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
        const methods = new Map<PropertyKey, unknown>();
        let path: number[] = [];
        const pathMatrix = [1, 0, 0, 1, 0, 0];
        const state: WrappedPaintContext = {
            target: ctx, batchDepth: 0, matrix: null, matrixDirty: true,
            changedProperties: new Set(), transformTouched: false, dashTouched: false,
        };
        const readMatrix = () => {
            // Outside an explicit frame scope, retain the original native read
            // behavior (e.g. reset/restart or externally manipulated contexts).
            if (!state.batchDepth || state.matrixDirty || !state.matrix) {
                state.matrix = ctx.getTransform();
                state.matrixDirty = false;
            }
            return state.matrix;
        };
        const proxy = new Proxy(ctx, {
            get: (target, property) => {
                const value = Reflect.get(target, property, target);
                if (typeof value !== 'function') return value;
                if (methods.has(property)) return methods.get(property);
                const name = String(property);
                const method = (...args: any[]) => {
                    // These operations change the enclosing clip/reset state,
                    // rather than drawing a brush. Never silently give them a
                    // different meaning inside the shared boundary scope.
                    if (state.batchDepth && (name === 'clearRect' || name === 'reset' || name === 'clip')) {
                        throw new Error(`${name} must run outside withPaintBoundary`);
                    }
                    let result: unknown;
                    if (this.paintClip && state.batchDepth === 0 && PAINT_METHODS.has(name)) {
                        target.save();
                        try {
                            // Native calls bypass logging: this static boundary
                            // is run metadata, not a per-stroke snapshot fallback.
                            this.applyPaintBoundary(target);
                            result = Reflect.apply(value, target, args);
                        } finally { target.restore(); }
                    } else {
                        // clearRect must remain unrestricted for reset/restart.
                        result = Reflect.apply(value, target, args);
                    }
                    if (TRANSFORM_METHODS.has(name)) {
                        state.matrixDirty = true;
                        state.transformTouched = true;
                    }
                    if (name === 'setLineDash') state.dashTouched = true;
                    if (name === 'beginPath' || name === 'reset') {
                        path.length = 0;
                        pathMatrix[0] = pathMatrix[3] = 1;
                        pathMatrix[1] = pathMatrix[2] = pathMatrix[4] = pathMatrix[5] = 0;
                    }
                    if (name !== 'beginPath' && this.recording && this.overflowAt === null) {
                        const pathMethod = PATH_METHODS[name];
                        if (pathMethod) {
                            const m = readMatrix();
                            if (m.a !== pathMatrix[0] || m.b !== pathMatrix[1] || m.c !== pathMatrix[2]
                                || m.d !== pathMatrix[3] || m.e !== pathMatrix[4] || m.f !== pathMatrix[5]) {
                                path.push(Path.Transform, m.a, m.b, m.c, m.d, m.e, m.f);
                                pathMatrix[0] = m.a; pathMatrix[1] = m.b; pathMatrix[2] = m.c;
                                pathMatrix[3] = m.d; pathMatrix[4] = m.e; pathMatrix[5] = m.f;
                            }
                            path.push(pathMethod[0]);
                            for (let i = 0; i < pathMethod[1]; i++) path.push(Number(args[i] ?? 0));
                        } else if (name === 'fill' || name === 'stroke') {
                            if (args[0] && typeof args[0] !== 'string') this.useSnapshotTail('Path2D');
                            else this.recordPaint(target, name === 'fill' ? Draw.Fill : Draw.Stroke, path, args[0] === 'evenodd', readMatrix());
                        } else if (name === 'fillRect' || name === 'strokeRect' || name === 'clearRect') {
                            this.recordPaint(target, name === 'fillRect' ? Draw.FillRect : name === 'strokeRect' ? Draw.StrokeRect : Draw.ClearRect, args, false, readMatrix());
                        } else if (['clip', 'drawImage', 'putImageData', 'fillText', 'strokeText', 'roundRect', 'reset'].includes(name)) {
                            // Future sprite stamps/clip paths need a new log command.
                            // Keep playback honest and bounded using the host's snapshot tail.
                            this.useSnapshotTail(name);
                        }
                    }
                    return result;
                };
                methods.set(property, method);
                return method;
            },
            set: (target, property, value) => {
                if (state.batchDepth) state.changedProperties.add(property);
                return Reflect.set(target, property, value, target);
            },
        });
        this.wrappedContexts.set(proxy, state);
        return proxy;
    }

    public createCursor(targets: StrokePlaybackTargets): StrokeCursor {
        return new StrokeCursor(this, targets);
    }

    public valueAt(index: number): number {
        return this.chunks[Math.floor(index / CHUNK_SIZE)][index % CHUNK_SIZE];
    }

    public get numberCount(): number { return this.length; }

    private recordPaint(ctx: CanvasRenderingContext2D, kind: Draw, geometry: readonly number[], evenOdd: boolean, matrix: DOMMatrix): void {
        const color = this.color(kind === Draw.Stroke || kind === Draw.StrokeRect ? ctx.strokeStyle : ctx.fillStyle);
        const shadow = this.color(ctx.shadowColor);
        const composite = COMPOSITES.indexOf(ctx.globalCompositeOperation);
        if (!color || !shadow || composite < 0 || (ctx.filter && ctx.filter !== 'none')) {
            this.useSnapshotTail('paint-style');
            return;
        }
        const dash = ctx.getLineDash();
        // header (3), color/state (16), transform (6), dash length (1), geometry
        const count = 26 + dash.length + geometry.length;
        if (!this.beginRecord(kind, count)) return;
        this.append(color[0]); this.append(color[1]); this.append(ctx.globalAlpha);
        this.append(ctx.lineWidth); this.append(CAPS.indexOf(ctx.lineCap)); this.append(JOINS.indexOf(ctx.lineJoin));
        this.append(ctx.miterLimit); this.append(composite);
        this.append(shadow[0]); this.append(shadow[1]); this.append(ctx.shadowBlur);
        this.append(ctx.shadowOffsetX); this.append(ctx.shadowOffsetY); this.append(ctx.lineDashOffset);
        this.append(Number(evenOdd)); this.append(geometry.length);
        this.append(matrix.a); this.append(matrix.b); this.append(matrix.c);
        this.append(matrix.d); this.append(matrix.e); this.append(matrix.f);
        this.append(dash.length);
        for (const n of dash) this.append(n);
        for (const n of geometry) this.append(n);
    }

    private recordNumbers(kind: Draw, values: number[]): void {
        if (!values.every(Number.isFinite) || !this.beginRecord(kind, 3 + values.length)) return;
        for (const value of values) this.append(value);
    }

    private beginRecord(kind: Draw, size: number): boolean {
        if (!this.recording || this.overflowAt !== null) return false;
        if (this.length + size > this.maxNumbers) {
            this.useSnapshotTail('memory-budget');
            return false;
        }
        this.append(size);
        this.append(this.duration);
        this.append(kind);
        this.eventCount++;
        return true;
    }

    private useSnapshotTail(reason: string): void {
        if (this.overflowAt !== null) return;
        this.overflowAt = this.duration;
        this.fallbackReason = reason;
    }

    private append(value: number): void {
        const chunkIndex = Math.floor(this.length / CHUNK_SIZE);
        if (!this.chunks[chunkIndex]) this.chunks.push(new Float32Array(Math.min(CHUNK_SIZE, this.maxNumbers - chunkIndex * CHUNK_SIZE)));
        this.chunks[chunkIndex][this.length % CHUNK_SIZE] = value;
        this.length++;
    }

    private color(style: string | CanvasGradient | CanvasPattern): readonly [number, number] | null {
        if (typeof style !== 'string') return null;
        const cached = this.colors.get(style);
        if (cached) return cached;
        let result: readonly [number, number];
        if (/^#[0-9a-f]{6}$/i.test(style)) result = [parseInt(style.slice(1), 16), 1];
        else {
            const rgba = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(style);
            if (!rgba) return null;
            result = [(Number(rgba[1]) << 16) | (Number(rgba[2]) << 8) | Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
        }
        // Fading RGBA strings vary every frame; bound the parsing cache.
        if (this.colors.size >= 1024) this.colors.clear();
        this.colors.set(style, result);
        return result;
    }
}

/** Incremental playback with an event budget, so a dense 60x replay can't
 * monopolize a frame and prevent the user from pausing or closing it. */
export class StrokeCursor {
    private offset = 0;
    public time = 0;
    constructor(private readonly log: StrokeLog, private readonly targets: StrokePlaybackTargets) {}
    public reset(): void { this.offset = 0; this.time = 0; }

    public renderUntil(time: number, budget = 2500): boolean {
        let processed = 0;
        while (this.offset < this.log.numberCount && this.log.valueAt(this.offset + 1) <= time + 0.0001) {
            if (processed++ >= budget) return false;
            this.time = this.log.valueAt(this.offset + 1);
            this.renderRecord();
        }
        this.time = Math.min(time, this.log.duration);
        return true;
    }

    private renderRecord(): void {
        const start = this.offset;
        let at = start;
        const next = () => this.log.valueAt(at++);
        const size = next(); next();
        const kind = next();
        this.offset = start + size;
        if (kind === Draw.Erase) { this.targets.erase(next(), next(), next(), next()); return; }
        if (kind === Draw.Repair) { this.targets.repair(next(), next(), next(), next(), next(), next()); return; }
        const ctx = this.targets.trail;
        ctx.save();
        if (kind !== Draw.ClearRect) this.log.applyPaintBoundary(ctx);
        const paint = cssColor(next(), next());
        ctx.fillStyle = paint; ctx.strokeStyle = paint; ctx.globalAlpha = next();
        ctx.lineWidth = next(); ctx.lineCap = CAPS[next()]; ctx.lineJoin = JOINS[next()];
        ctx.miterLimit = next(); ctx.globalCompositeOperation = COMPOSITES[next()];
        ctx.shadowColor = cssColor(next(), next()); ctx.shadowBlur = next();
        ctx.shadowOffsetX = next(); ctx.shadowOffsetY = next(); ctx.lineDashOffset = next();
        const evenOdd = next() !== 0;
        const geometryLength = next();
        const matrix = [next(), next(), next(), next(), next(), next()];
        const dashLength = next();
        const dash: number[] = [];
        for (let i = 0; i < dashLength; i++) dash.push(next());
        ctx.setLineDash(dash);
        if (kind === Draw.Fill || kind === Draw.Stroke) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.beginPath();
            const end = at + geometryLength;
            while (at < end) {
                switch (next()) {
                    case Path.Move: ctx.moveTo(next(), next()); break;
                    case Path.Line: ctx.lineTo(next(), next()); break;
                    case Path.Arc: ctx.arc(next(), next(), next(), next(), next(), next() !== 0); break;
                    case Path.Ellipse: ctx.ellipse(next(), next(), next(), next(), next(), next(), next(), next() !== 0); break;
                    case Path.Bezier: ctx.bezierCurveTo(next(), next(), next(), next(), next(), next()); break;
                    case Path.Quadratic: ctx.quadraticCurveTo(next(), next(), next(), next()); break;
                    case Path.Rect: ctx.rect(next(), next(), next(), next()); break;
                    case Path.Close: ctx.closePath(); break;
                    case Path.Transform: ctx.setTransform(next(), next(), next(), next(), next(), next()); break;
                    case Path.ArcTo: ctx.arcTo(next(), next(), next(), next(), next()); break;
                    default: throw new Error('Invalid stroke path');
                }
            }
            ctx.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
            if (kind === Draw.Fill) ctx.fill(evenOdd ? 'evenodd' : 'nonzero');
            else ctx.stroke();
        } else {
            ctx.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
            if (kind === Draw.FillRect) ctx.fillRect(next(), next(), next(), next());
            else if (kind === Draw.StrokeRect) ctx.strokeRect(next(), next(), next(), next());
            else ctx.clearRect(next(), next(), next(), next());
        }
        ctx.restore();
    }
}

function cssColor(rgb: number, alpha: number): string {
    return `rgba(${rgb >> 16 & 255},${rgb >> 8 & 255},${rgb & 255},${alpha})`;
}
