import { validateArtwork } from './DefenseArtwork';
import type { DefenseArtwork } from './DefenseArtwork';

const DATABASE_NAME = 'dont_erase_me_artwork_v1';
const DATABASE_VERSION = 1;
const MAX_ARTWORKS = 12;
const MAX_FRAME_BYTES = 32 * 1024 * 1024;
const SELECTED_ARTWORK_KEY = 'selectedArtworkId';

function storageError(error: unknown, fallback = '本地画作存储失败，请重试。'): Error {
    if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError') return new Error('本地存储空间不足，画作未保存。请导出作品或释放空间后重试。');
        if (error.name === 'SecurityError' || error.name === 'InvalidStateError') {
            return new Error('当前环境无法使用本地画作存储，请检查浏览器隐私设置后重试。');
        }
        return new Error(fallback);
    }
    return error instanceof Error ? error : new Error(fallback);
}

function checkFrameIndex(index: number): void {
    if (!Number.isInteger(index) || index < 1 || index > 4) throw new Error('画框编号必须为 1 至 4。');
}

function checkFrame(blob: unknown): asserts blob is Blob {
    if (!(blob instanceof Blob) || !/^image\/(png|jpeg|webp)$/i.test(blob.type) || blob.size === 0) {
        throw new Error('画框作品不是有效的 PNG、JPEG 或 WebP 图片。');
    }
    if (blob.size > MAX_FRAME_BYTES) throw new Error('画框作品超过 32 MB，请缩小图片后重试。');
}

function legacyDataUrlToBlob(value: string): Blob {
    // Decode locally: old artwork must never be fetched or sent to a server.
    if (value.length > Math.ceil(MAX_FRAME_BYTES / 3) * 4 + 128) {
        throw new Error('旧画框作品超过 32 MB，已保留原存档，请先导出作品。');
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(value);
    if (!match) throw new Error('旧画框图片格式无效，原存档已保留。');
    let binary: string;
    try {
        binary = atob(match[2]);
    } catch {
        throw new Error('旧画框图片无法读取，原存档已保留。');
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const blob = new Blob([bytes], { type: match[1].toLowerCase() });
    checkFrame(blob);
    return blob;
}

/** Local-only artwork storage. A resolved write always means its transaction committed. */
export class ArtworkStore {
    private static databasePromise: Promise<IDBDatabase> | null = null;
    private static migrationPromise: Promise<void> | null = null;

    private static open(): Promise<IDBDatabase> {
        if (this.databasePromise) return this.databasePromise;
        const pending = new Promise<IDBDatabase>((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('当前环境不支持本地画作存储。'));
                return;
            }
            let request: IDBOpenDBRequest;
            try {
                request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
            } catch (error) {
                reject(storageError(error));
                return;
            }
            let settled = false;
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains('artworks')) database.createObjectStore('artworks', { keyPath: 'id' });
                if (!database.objectStoreNames.contains('frames')) database.createObjectStore('frames');
                if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
            };
            request.onblocked = () => {
                settled = true;
                reject(new Error('画作存储正在被另一个游戏窗口占用，请关闭旧窗口后重试。'));
            };
            request.onerror = () => {
                settled = true;
                reject(storageError(request.error, '无法打开本地画作存储，请重试。'));
            };
            request.onsuccess = () => {
                const database = request.result;
                // A blocked open can finish later; do not leak that abandoned connection.
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
        stores: string[],
        mode: IDBTransactionMode,
        run: (transaction: IDBTransaction, setResult: (result: T) => void, fail: (error: unknown) => void) => void
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
                try {
                    transaction.abort();
                } catch {
                    reject(failure);
                }
            };
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(failure ?? storageError(transaction.error, '画作存储操作未完成，原存档保持不变。'));
            // Do not preventDefault: a failed request must abort the complete write.
            transaction.onerror = event => {
                const request = event.target as IDBRequest | null;
                failure ??= storageError(request?.error ?? transaction.error);
            };
            try {
                run(transaction, value => { result = value; }, fail);
            } catch (error) {
                fail(error);
            }
        });
    }

    public static async listArtworks(): Promise<DefenseArtwork[]> {
        return this.transaction(['artworks'], 'readonly', (transaction, setResult, fail) => {
            const request = transaction.objectStore('artworks').getAll();
            request.onsuccess = () => {
                const artworks: unknown[] = request.result;
                if (!artworks.every(validateArtwork)) {
                    fail(new Error('有画作存档无法读取，原数据已保留，请勿清理浏览器数据。'));
                    return;
                }
                setResult(artworks.sort((first, second) => second.createdAt - first.createdAt));
            };
        });
    }

    public static async getArtwork(id: string): Promise<DefenseArtwork | null> {
        return this.transaction(['artworks'], 'readonly', (transaction, setResult, fail) => {
            const request = transaction.objectStore('artworks').get(id);
            request.onsuccess = () => {
                const artwork: unknown = request.result;
                if (artwork === undefined) setResult(null);
                else if (validateArtwork(artwork)) setResult(artwork);
                else fail(new Error('这幅画作的存档无法读取，原数据已保留。'));
            };
        });
    }

    public static async saveArtwork(artwork: DefenseArtwork): Promise<void> {
        if (!validateArtwork(artwork)) throw new Error('画作数据无效，无法保存。');
        // Snapshot before opening the transaction; callers may continue editing their preview.
        const snapshot: DefenseArtwork = structuredClone(artwork);
        return this.transaction(['artworks'], 'readwrite', (transaction, setResult, fail) => {
            const store = transaction.objectStore('artworks');
            const existing = store.getKey(snapshot.id);
            existing.onsuccess = () => {
                const count = store.count();
                count.onsuccess = () => {
                    if (existing.result === undefined && count.result >= MAX_ARTWORKS) {
                        fail(new Error('最多保存 12 幅自定义画作，请先删除不需要的画作。'));
                        return;
                    }
                    store.put(snapshot);
                    setResult(undefined);
                };
            };
        });
    }

    public static async deleteArtwork(id: string): Promise<void> {
        return this.transaction(['artworks', 'meta'], 'readwrite', (transaction, setResult) => {
            transaction.objectStore('artworks').delete(id);
            const meta = transaction.objectStore('meta');
            const selected = meta.get(SELECTED_ARTWORK_KEY);
            selected.onsuccess = () => {
                if (selected.result === id) meta.delete(SELECTED_ARTWORK_KEY);
                setResult(undefined);
            };
        });
    }

    public static async getSelectedArtworkId(): Promise<string | null> {
        return this.transaction(['meta'], 'readonly', (transaction, setResult) => {
            const request = transaction.objectStore('meta').get(SELECTED_ARTWORK_KEY);
            request.onsuccess = () => setResult(typeof request.result === 'string' ? request.result : null);
        });
    }

    public static async setSelectedArtworkId(id: string | null): Promise<void> {
        return this.transaction(['artworks', 'meta'], 'readwrite', (transaction, setResult, fail) => {
            const meta = transaction.objectStore('meta');
            if (id === null) {
                meta.delete(SELECTED_ARTWORK_KEY);
                setResult(undefined);
                return;
            }
            const artwork = transaction.objectStore('artworks').get(id);
            artwork.onsuccess = () => {
                if (!validateArtwork(artwork.result)) {
                    fail(new Error('这幅画作尚未保存或已经删除，请重新选择。'));
                    return;
                }
                meta.put(id, SELECTED_ARTWORK_KEY);
                setResult(undefined);
            };
        });
    }

    public static async saveFrame(index: number, blob: Blob): Promise<void> {
        checkFrameIndex(index);
        checkFrame(blob);
        return this.transaction(['frames'], 'readwrite', (transaction, setResult) => {
            transaction.objectStore('frames').put(blob, index);
            setResult(undefined);
        });
    }

    public static async getFrame(index: number): Promise<Blob | null> {
        checkFrameIndex(index);
        return this.transaction(['frames'], 'readonly', (transaction, setResult, fail) => {
            const request = transaction.objectStore('frames').get(index);
            request.onsuccess = () => {
                if (request.result === undefined) {
                    setResult(null);
                    return;
                }
                try {
                    checkFrame(request.result);
                    setResult(request.result);
                } catch (error) {
                    fail(error);
                }
            };
        });
    }

    public static async migrateLegacyFrames(): Promise<void> {
        if (this.migrationPromise) return this.migrationPromise;
        const pending = this.migrateFrames();
        this.migrationPromise = pending;
        try {
            await pending;
        } finally {
            // Retry is safe and also picks up frames written by an older open game window.
            if (this.migrationPromise === pending) this.migrationPromise = null;
        }
    }

    private static async migrateFrames(): Promise<void> {
        let firstError: Error | null = null;
        for (let index = 1; index <= 4; index++) {
            const key = `art_frame_${index}`;
            try {
                const previous = localStorage.getItem(key);
                if (!previous) continue;
                const blob = legacyDataUrlToBlob(previous);
                const inserted = await this.transaction<boolean>(['frames'], 'readwrite', (transaction, setResult) => {
                    const store = transaction.objectStore('frames');
                    const existing = store.getKey(index);
                    existing.onsuccess = () => {
                        if (existing.result !== undefined) {
                            setResult(false);
                            return;
                        }
                        store.put(blob, index);
                        setResult(true);
                    };
                });
                // Never overwrite newer frames or remove a legacy value changed during migration.
                if (inserted && localStorage.getItem(key) === previous) localStorage.removeItem(key);
            } catch (error) {
                firstError ??= storageError(error, '旧画框迁移失败，原存档已保留。');
            }
        }
        if (firstError) throw firstError;
    }
}
