import { StrokeLog, type PaintBoundary } from './StrokeLog';
import { BUILT_IN_ARTWORK, type DefenseArtwork } from './DefenseArtwork';

export interface ArtworkSnapshot { time: number; blob: Blob }

/** Keeps only the current run. A bounded, compressed snapshot tail protects
 * unusually dense runs without discarding the rest of their visual history. */
export class ArtReplayRecording {
    public readonly log = new StrokeLog();
    public isDefense = false;
    public isDrawing = false;
    public initialArtwork: DefenseArtwork | null = null;
    public finalArtwork: HTMLCanvasElement | null = null;
    public readonly snapshots: ArtworkSnapshot[] = [];
    private generation = 0;
    private pending = false;
    private nextSnapshotAt = 0;
    private snapshotInterval = 5;

    public start(width: number, height: number, defense: boolean, artwork: DefenseArtwork = BUILT_IN_ARTWORK, boundary: PaintBoundary | null = null): void {
        this.clear();
        this.isDefense = defense;
        // A run owns its source; deleting/replacing library art cannot change a replay.
        this.initialArtwork = defense ? structuredClone(artwork) : null;
        this.log.start(width, height, boundary);
    }

    public clear(): void {
        this.isDrawing = false;
        this.generation++;
        this.pending = false;
        this.nextSnapshotAt = 0;
        this.snapshotInterval = 5;
        this.snapshots.length = 0;
        if (this.finalArtwork) this.finalArtwork.width = this.finalArtwork.height = 0;
        this.finalArtwork = null;
        this.initialArtwork = null;
        this.log.clear();
    }

    public finish(painting: HTMLCanvasElement, trail: HTMLCanvasElement): void {
        this.log.finish();
        if (this.finalArtwork) this.finalArtwork.width = this.finalArtwork.height = 0;
        this.finalArtwork = this.compose(painting, trail, 1);
    }

    public captureTail(painting: HTMLCanvasElement, trail: HTMLCanvasElement): void {
        if (this.log.overflowAt === null || this.pending || this.log.duration < this.nextSnapshotAt) return;
        this.pending = true;
        const generation = this.generation;
        const time = this.log.duration;
        this.nextSnapshotAt = time + this.snapshotInterval;
        const canvas = this.compose(painting, trail, Math.min(1, 1200 / this.log.width));
        canvas.toBlob(blob => {
            canvas.width = canvas.height = 0;
            if (generation !== this.generation) return;
            this.pending = false;
            if (!blob) return;
            this.snapshots.push({ time, blob });
            // Retain an evenly spaced visual timeline, including the first and
            // last snapshots, instead of growing memory throughout a long run.
            if (this.snapshots.reduce((bytes, frame) => bytes + frame.blob.size, 0) > 16 * 1024 * 1024) {
                const last = this.snapshots.length - 1;
                const keep = this.snapshots.filter((_, index) => index % 2 === 0 || index === last);
                this.snapshots.splice(0, this.snapshots.length, ...keep);
                this.snapshotInterval *= 2;
            }
        }, 'image/webp', 0.82);
    }

    private compose(painting: HTMLCanvasElement, trail: HTMLCanvasElement, scale: number): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(this.log.width * scale));
        canvas.height = Math.max(1, Math.round(this.log.height * scale));
        const ctx = canvas.getContext('2d')!;
        if (this.isDefense) ctx.drawImage(painting, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(trail, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
}
