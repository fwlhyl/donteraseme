import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseURL = process.env.ARTWORK_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

async function isolatedTest(name, test) {
    // A new incognito browser context owns its own IndexedDB and localStorage.
    // Never attach to the developer's running browser/profile.
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await page.route('**/artwork-storage-test.html', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><title>Isolated artwork storage test</title>'
        }));
        await page.goto(`${baseURL}/artwork-storage-test.html`);
        await test(page);
        results.push({ name, passed: true });
    } finally {
        await context.close();
    }
}

try {
    await isolatedTest('artwork save/reload, selection, deletion and atomic capacity', async page => {
        const initial = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const { BUILT_IN_ARTWORK } = await import('/src/core/DefenseArtwork.ts');
            const artwork = { ...structuredClone(BUILT_IN_ARTWORK), id: 'storage-test-art', name: '存档测试', createdAt: Date.now() };
            await ArtworkStore.saveArtwork(artwork);
            await ArtworkStore.setSelectedArtworkId(artwork.id);
            return { count: (await ArtworkStore.listArtworks()).length, selected: await ArtworkStore.getSelectedArtworkId() };
        });
        assert.deepEqual(initial, { count: 1, selected: 'storage-test-art' });
        await page.reload();
        const reloaded = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const artwork = await ArtworkStore.getArtwork('storage-test-art');
            const selected = await ArtworkStore.getSelectedArtworkId();
            await ArtworkStore.deleteArtwork('storage-test-art');
            return { name: artwork?.name, selected, afterDelete: await ArtworkStore.getSelectedArtworkId(), count: (await ArtworkStore.listArtworks()).length };
        });
        assert.deepEqual(reloaded, { name: '存档测试', selected: 'storage-test-art', afterDelete: null, count: 0 });
        const capacity = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const { BUILT_IN_ARTWORK } = await import('/src/core/DefenseArtwork.ts');
            const writes = await Promise.allSettled(Array.from({ length: 13 }, (_, index) => ArtworkStore.saveArtwork({
                ...structuredClone(BUILT_IN_ARTWORK), id: `capacity-${index}`, name: `作品 ${index}`, createdAt: index
            })));
            const artworks = await ArtworkStore.listArtworks();
            await ArtworkStore.saveArtwork({ ...artworks[0], name: '容量已满时仍可覆盖同一作品' });
            let missingSelectionRejected = false;
            try { await ArtworkStore.setSelectedArtworkId('missing-id'); } catch { missingSelectionRejected = true; }
            return {
                count: artworks.length,
                success: writes.filter(result => result.status === 'fulfilled').length,
                failures: writes.filter(result => result.status === 'rejected').length,
                updated: (await ArtworkStore.getArtwork(artworks[0].id))?.name,
                missingSelectionRejected
            };
        });
        assert.deepEqual(capacity, { count: 12, success: 12, failures: 1, updated: '容量已满时仍可覆盖同一作品', missingSelectionRejected: true });
    });

    await isolatedTest('Blob frame reload and invalid frame input rejection', async page => {
        const validation = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const canvas = document.createElement('canvas');
            canvas.width = 48;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            context.fillStyle = '#ff267b';
            context.fillRect(0, 0, 48, 32);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await ArtworkStore.saveFrame(1, blob);
            const checks = await Promise.allSettled([
                ArtworkStore.saveFrame(0, blob), ArtworkStore.getFrame(5),
                ArtworkStore.saveFrame(2, new Blob([], { type: 'image/png' })),
                ArtworkStore.saveFrame(2, new Blob(['<svg/>'], { type: 'image/svg+xml' }))
            ]);
            return { bytes: blob.size, rejected: checks.filter(result => result.status === 'rejected').length };
        });
        assert.equal(validation.rejected, 4);
        await page.reload();
        const saved = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const blob = await ArtworkStore.getFrame(1);
            const bitmap = await createImageBitmap(blob);
            return { bytes: blob.size, type: blob.type, width: bitmap.width, height: bitmap.height, empty: await ArtworkStore.getFrame(4) };
        });
        assert.deepEqual(saved, { bytes: validation.bytes, type: 'image/png', width: 48, height: 32, empty: null });
    });

    await isolatedTest('legacy migration preserves newer slots and damaged originals', async page => {
        const migration = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            const context = canvas.getContext('2d');
            context.fillStyle = 'red'; context.fillRect(0, 0, 16, 16);
            const legacy = canvas.toDataURL('image/png');
            localStorage.setItem('art_frame_1', legacy);
            localStorage.setItem('art_frame_2', legacy);
            localStorage.setItem('art_frame_3', 'data:image/png;base64,broken%%%');
            localStorage.setItem('art_frame_4', legacy);
            context.fillStyle = 'blue'; context.fillRect(0, 0, 16, 16);
            const newer = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await ArtworkStore.saveFrame(2, newer);
            let reportedDamage = false;
            try { await ArtworkStore.migrateLegacyFrames(); } catch { reportedDamage = true; }
            const sameBytes = async (first, second) => {
                const a = new Uint8Array(await first.arrayBuffer());
                const b = new Uint8Array(await second.arrayBuffer());
                return a.length === b.length && a.every((value, index) => value === b[index]);
            };
            return {
                migrated1: Boolean(await ArtworkStore.getFrame(1)),
                legacy1Removed: localStorage.getItem('art_frame_1') === null,
                newer2Preserved: await sameBytes(await ArtworkStore.getFrame(2), newer),
                old2Preserved: localStorage.getItem('art_frame_2') === legacy,
                damaged3Preserved: localStorage.getItem('art_frame_3') === 'data:image/png;base64,broken%%%',
                empty3: await ArtworkStore.getFrame(3) === null,
                migrated4Despite3Error: Boolean(await ArtworkStore.getFrame(4)),
                reportedDamage
            };
        });
        assert.ok(Object.values(migration).every(Boolean), JSON.stringify(migration));
    });

    await isolatedTest('failed write preserves legacy; successful retry migrates it', async page => {
        const failure = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            await ArtworkStore.getFrame(1);
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const legacy = canvas.toDataURL('image/png');
            localStorage.setItem('art_frame_1', legacy);
            const original = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
                if (mode === 'readwrite') throw new DOMException('Simulated quota failure', 'QuotaExceededError');
                return original.call(this, stores, mode, ...rest);
            };
            let rejected = false;
            try { await ArtworkStore.migrateLegacyFrames(); } catch { rejected = true; }
            finally { IDBDatabase.prototype.transaction = original; }
            const preserved = localStorage.getItem('art_frame_1') === legacy;
            const unwritten = await ArtworkStore.getFrame(1) === null;
            await ArtworkStore.migrateLegacyFrames();
            return { rejected, preserved, unwritten, retrySaved: Boolean(await ArtworkStore.getFrame(1)), retryRemoved: localStorage.getItem('art_frame_1') === null };
        });
        assert.ok(Object.values(failure).every(Boolean), JSON.stringify(failure));
    });

    await isolatedTest('failed legacy cleanup preserves both committed Blob and source', async page => {
        const cleanup = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const canvas = document.createElement('canvas');
            canvas.width = 8;
            canvas.height = 8;
            const legacy = canvas.toDataURL('image/png');
            localStorage.setItem('art_frame_1', legacy);
            const original = Storage.prototype.removeItem;
            Storage.prototype.removeItem = function (key) {
                if (key === 'art_frame_1') throw new DOMException('Simulated security failure', 'SecurityError');
                return original.call(this, key);
            };
            let rejected = false;
            try { await ArtworkStore.migrateLegacyFrames(); } catch { rejected = true; }
            finally { Storage.prototype.removeItem = original; }
            return { rejected, saved: Boolean(await ArtworkStore.getFrame(1)), legacyPreserved: localStorage.getItem('art_frame_1') === legacy };
        });
        assert.ok(Object.values(cleanup).every(Boolean), JSON.stringify(cleanup));
    });

    await isolatedTest('damaged IndexedDB reads report failure without deleting data', async page => {
        const damaged = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            await ArtworkStore.listArtworks();
            const database = await new Promise((resolve, reject) => {
                const request = indexedDB.open('dont_erase_me_artwork_v1', 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(['artworks', 'frames'], 'readwrite');
                transaction.objectStore('artworks').put({ id: 'damaged-art', version: 99 });
                transaction.objectStore('frames').put('not-an-image-blob', 1);
                transaction.oncomplete = resolve;
                transaction.onabort = () => reject(transaction.error);
            });
            const reads = await Promise.allSettled([
                ArtworkStore.listArtworks(), ArtworkStore.getArtwork('damaged-art'), ArtworkStore.getFrame(1)
            ]);
            const preserved = await new Promise(resolve => {
                const request = database.transaction(['artworks'], 'readonly').objectStore('artworks').get('damaged-art');
                request.onsuccess = () => resolve(request.result?.version === 99);
            });
            database.close();
            return { rejected: reads.filter(result => result.status === 'rejected').length, preserved };
        });
        assert.deepEqual(damaged, { rejected: 3, preserved: true });
    });

    await isolatedTest('opening failures reject and a retry recovers', async page => {
        const opening = await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const original = IDBFactory.prototype.open;
            IDBFactory.prototype.open = () => { throw new DOMException('Simulated blocked storage', 'SecurityError'); };
            let message = '';
            try { await ArtworkStore.listArtworks(); } catch (error) { message = error.message; }
            finally { IDBFactory.prototype.open = original; }
            return { message, recovered: (await ArtworkStore.listArtworks()).length === 0 };
        });
        assert.match(opening.message, /无法使用本地画作存储/);
        assert.equal(opening.recovered, true);
    });

    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally {
    await browser.close();
}
