import { ArtworkStore } from './ArtworkStore';

export type GalleryMode = 'endless' | 'defense' | 'drawing' | 'legacy';

export interface GalleryArtwork {
    id: string;
    name: string;
    mode: GalleryMode;
    createdAt: number;
    width: number;
    height: number;
}

interface GallerySaveInput {
    id?: string;
    name: string;
    mode: GalleryMode;
    blob: Blob;
    width: number;
    height: number;
}

interface GalleryImages {
    id: string;
    blob: Blob;
    display: Blob;
}

interface DecodedImage {
    source: CanvasImageSource;
    width: number;
    height: number;
    close: () => void;
}

const DATABASE_NAME = 'dont_erase_me_gallery_v1';
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_SIDE = 8192;
const MAX_IMAGE_PIXELS = 32 * 1024 * 1024;
const DISPLAY_SIDE = 1600;
const MODES: readonly GalleryMode[] = ['endless', 'defense', 'drawing', 'legacy'];

function storageError(error: unknown, fallback = '画廊存储失败，原作品已保留，请重试。'): Error {
    if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError') {
            return new Error('本地存储空间不足，作品未保存到画廊。请先导出 PNG，释放空间后重试。');
        }
        if (error.name === 'SecurityError' || error.name === 'InvalidStateError') {
            return new Error('当前环境无法使用本地画廊，请检查浏览器隐私设置后重试。');
        }
        return new Error(fallback);
    }
    return error instanceof Error ? error : new Error(fallback);
}

function validId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value;
}

function validSize(width: unknown, height: unknown): boolean {
    return typeof width === 'number' && typeof height === 'number'
        && Number.isInteger(width) && Number.isInteger(height)
        && width > 0 && height > 0 && width <= MAX_IMAGE_SIDE && height <= MAX_IMAGE_SIDE
        && width * height <= MAX_IMAGE_PIXELS;
}

function validMetadata(value: unknown): value is GalleryArtwork {
    if (!value || typeof value !== 'object') return false;
    const artwork = value as Partial<GalleryArtwork>;
    return validId(artwork.id) && typeof artwork.name === 'string'
        && artwork.name.trim().length > 0 && artwork.name.length <= 80
        && MODES.includes(artwork.mode as GalleryMode)
        && typeof artwork.createdAt === 'number' && Number.isFinite(artwork.createdAt) && artwork.createdAt >= 0
        && validSize(artwork.width, artwork.height);
}

function checkBlob(value: unknown): asserts value is Blob {
    if (!(value instanceof Blob) || !/^image\/(png|jpeg|webp)$/i.test(value.type) || !value.size) {
        throw new Error('作品不是有效的 PNG、JPEG 或 WebP 图片，未修改存档。');
    }
    if (value.size > MAX_IMAGE_BYTES) throw new Error('作品超过 32 MB，请先导出并缩小图片后重试。');
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
    checkBlob(blob);
    let decoded: DecodedImage;
    try {
        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob);
            decoded = { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
        } else {
            const url = URL.createObjectURL(blob);
            const image = new Image();
            try {
                await new Promise<void>((resolve, reject) => {
                    image.onload = () => resolve();
                    image.onerror = () => reject(new Error('图片无法解码'));
                    image.src = url;
                });
                decoded = { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ''; } };
            } finally {
                URL.revokeObjectURL(url);
            }
        }
    } catch {
        throw new Error('作品图片无法解码，原存档已保留，请重新导出 PNG 后重试。');
    }
    if (!validSize(decoded.width, decoded.height)) {
        decoded.close();
        throw new Error('作品尺寸过大；单边不得超过 8192 像素，总面积不得超过 3200 万像素。');
    }
    return decoded;
}

async function displayImage(decoded: DecodedImage): Promise<Blob> {
    const scale = Math.min(1, DISPLAY_SIDE / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法生成画廊预览，请重新打开游戏后重试。');
        context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) resolve(result);
                else reject(new Error('无法生成画廊预览，作品尚未保存，请重试。'));
            }, 'image/webp', 0.86);
        });
        checkBlob(blob);
        return blob;
    } finally {
        // Release temporary backing memory; the original image Blob is never re-encoded.
        canvas.width = 1;
        canvas.height = 1;
    }
}

/** Local-only gallery. Metadata enumeration never loads original or display image Blobs. */
export class GalleryStore {
    private static databasePromise: Promise<IDBDatabase> | null = null;
    private static migrationPromise: Promise<void> | null = null;

    private static open(): Promise<IDBDatabase> {
        if (this.databasePromise) return this.databasePromise;
        const pending = new Promise<IDBDatabase>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('当前环境不支持本地画廊存储。'));
                return;
            }
            let request: IDBOpenDBRequest;
            try {
                request = indexedDB.open(DATABASE_NAME, 1);
            } catch (error) {
                reject(storageError(error));
                return;
            }
            let settled = false;
            request.onupgradeneeded = () => {
                const database = request.result;
                database.createObjectStore('artworks', { keyPath: 'id' });
                database.createObjectStore('originals');
                database.createObjectStore('displays');
                database.createObjectStore('meta');
            };
            request.onblocked = () => {
                settled = true;
                reject(new Error('画廊正被另一个旧游戏窗口占用，请关闭旧窗口后重试。'));
            };
            request.onerror = () => {
                settled = true;
                reject(storageError(request.error, '无法打开本地画廊，请重试。'));
            };
            request.onsuccess = () => {
                const database = request.result;
                if (settled) {
                    database.close();
                    return;
                }
                settled = true;
                database.onversionchange = () => {
                    database.close();
                    if (this.databasePromise === pending) this.databasePromise = null;
                };
                database.onclose = () => {
                    if (this.databasePromise === pending) this.databasePromise = null;
                };
                resolve(database);
            };
        });
        this.databasePromise = pending;
        void pending.catch(() => {
            if (this.databasePromise === pending) this.databasePromise = null;
        });
        return pending;
    }

    private static async transaction<T>(
        stores: string[], mode: IDBTransactionMode,
        run: (transaction: IDBTransaction, setResult: (value: T) => void, fail: (error: unknown) => void) => void
    ): Promise<T> {
        const database = await this.open();
        return new Promise<T>((resolve, reject) => {
            let transaction: IDBTransaction;
            try {
                transaction = database.transaction(stores, mode);
            } catch (error) {
                reject(storageError(error));
                return;
            }
            let result: T;
            let failure: Error | null = null;
            const fail = (error: unknown) => {
                failure = storageError(error);
                try { transaction.abort(); } catch { reject(failure); }
            };
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(failure ?? storageError(transaction.error));
            transaction.onerror = event => {
                failure ??= storageError((event.target as IDBRequest | null)?.error ?? transaction.error);
            };
            try { run(transaction, value => { result = value; }, fail); } catch (error) { fail(error); }
        });
    }

    public static async list(): Promise<GalleryArtwork[]> {
        return this.transaction(['artworks'], 'readonly', (transaction, setResult, fail) => {
            const request = transaction.objectStore('artworks').getAll();
            request.onsuccess = () => {
                const artworks: unknown[] = request.result;
                if (!artworks.every(validMetadata)) {
                    fail(new Error('部分画廊作品信息无法读取，原数据已保留，请勿清除本地存档。'));
                    return;
                }
                setResult(artworks.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)));
            };
        });
    }

    public static async get(id: string): Promise<(GalleryArtwork & { blob: Blob }) | null> {
        if (!validId(id)) throw new Error('作品编号无效。');
        return this.transaction(['artworks', 'originals'], 'readonly', (transaction, setResult, fail) => {
            const metadata = transaction.objectStore('artworks').get(id);
            const images = transaction.objectStore('originals').get(id);
            images.onsuccess = () => {
                if (metadata.result === undefined && images.result === undefined) {
                    setResult(null);
                    return;
                }
                try {
                    if (!validMetadata(metadata.result)) throw new Error('这幅作品的信息无法读取，原数据已保留。');
                    checkBlob(images.result);
                    setResult({ ...metadata.result, blob: images.result });
                } catch (error) { fail(error); }
            };
        });
    }

    public static async getDisplay(id: string): Promise<Blob | null> {
        if (!validId(id)) throw new Error('作品编号无效。');
        return this.transaction(['displays'], 'readonly', (transaction, setResult, fail) => {
            const request = transaction.objectStore('displays').get(id);
            request.onsuccess = () => {
                if (request.result === undefined) { setResult(null); return; }
                try {
                    checkBlob(request.result);
                    setResult(request.result);
                } catch (error) { fail(error); }
            };
        });
    }

    public static async save(input: GallerySaveInput): Promise<GalleryArtwork> {
        // Capture primitive values before image decoding: callers can keep editing their UI.
        const id = input.id ?? (typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID() : `painting-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const name = typeof input.name === 'string' ? input.name.trim() || '未命名作品' : '';
        const metadata: GalleryArtwork = { id, name, mode: input.mode, createdAt: Date.now(), width: input.width, height: input.height };
        if (!validMetadata(metadata)) throw new Error('作品信息无效：标题最多 80 字，尺寸必须是有效的图片尺寸。');
        const blob = input.blob;
        const decoded = await decodeImage(blob);
        let display: Blob;
        try {
            if (decoded.width !== metadata.width || decoded.height !== metadata.height) {
                throw new Error('作品实际尺寸与记录不一致，未修改存档，请重新保存。');
            }
            display = await displayImage(decoded);
        } finally { decoded.close(); }
        return this.write(metadata, { id, blob, display });
    }

    private static async write(metadata: GalleryArtwork, images: GalleryImages, migrationKey?: string): Promise<GalleryArtwork> {
        return this.transaction(['artworks', 'originals', 'displays', 'meta'], 'readwrite', (transaction, setResult, fail) => {
            const store = transaction.objectStore('artworks');
            const existing = store.get(metadata.id);
            const marker = migrationKey ? transaction.objectStore('meta').get(migrationKey) : null;
            const commit = () => {
                // Migration must never resurrect deleted works or overwrite user-renamed works.
                if (migrationKey && (marker?.result === true || existing.result !== undefined)) {
                    transaction.objectStore('meta').put(true, migrationKey);
                    setResult(validMetadata(existing.result) ? existing.result : metadata);
                    return;
                }
                if (existing.result !== undefined && !validMetadata(existing.result)) {
                    fail(new Error('原作品的信息无法读取，未覆盖原存档。'));
                    return;
                }
                const saved = { ...metadata, createdAt: existing.result?.createdAt ?? metadata.createdAt };
                store.put(saved);
                transaction.objectStore('originals').put(images.blob, metadata.id);
                transaction.objectStore('displays').put(images.display, metadata.id);
                if (migrationKey) transaction.objectStore('meta').put(true, migrationKey);
                setResult(saved);
            };
            if (marker) marker.onsuccess = commit;
            else existing.onsuccess = commit;
        });
    }

    public static async delete(id: string): Promise<void> {
        if (!validId(id)) throw new Error('作品编号无效。');
        return this.transaction(['artworks', 'originals', 'displays'], 'readwrite', (transaction, setResult) => {
            transaction.objectStore('artworks').delete(id);
            transaction.objectStore('originals').delete(id);
            transaction.objectStore('displays').delete(id);
            setResult(undefined);
        });
    }

    public static async migrateLegacyFrames(): Promise<void> {
        if (this.migrationPromise) return this.migrationPromise;
        const pending = this.migrateFrames();
        this.migrationPromise = pending;
        try { await pending; }
        finally { if (this.migrationPromise === pending) this.migrationPromise = null; }
    }

    private static async migrateFrames(): Promise<void> {
        let firstError: Error | null = null;
        // Reuse the existing durable localStorage -> Blob migration. The old frame store remains intact.
        try { await ArtworkStore.migrateLegacyFrames(); }
        catch (error) { firstError = storageError(error); }
        for (let index = 1; index <= 4; index++) {
            try {
                const id = `legacy-frame-${index}`;
                const migrationKey = `imported-${id}`;
                const imported = await this.transaction<boolean>(['meta'], 'readonly', (transaction, setResult) => {
                    const request = transaction.objectStore('meta').get(migrationKey);
                    request.onsuccess = () => setResult(request.result === true);
                });
                if (imported) continue;
                const blob = await ArtworkStore.getFrame(index);
                if (!blob) continue;
                const decoded = await decodeImage(blob);
                try {
                    const display = await displayImage(decoded);
                    await this.write({
                        id, name: `旧画框作品 ${index}`, mode: 'legacy', createdAt: Date.now(),
                        width: decoded.width, height: decoded.height
                    }, { id, blob, display }, migrationKey);
                } finally { decoded.close(); }
            } catch (error) { firstError ??= storageError(error); }
        }
        if (firstError) throw firstError;
    }
}
