import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseURL = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

async function isolatedTest(name, test) {
    // This incognito profile is unrelated to the player's real wallet and artwork saves.
    const context = await browser.newContext();
    try {
        await context.addInitScript(() => {
            window.galleryImage = async (width = 48, height = 32, color = '#fd4691') => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, width, height);
                return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            };
            window.galleryInput = async (id, color = '#fd4691') => ({
                id, name: `作品 ${id}`, mode: 'drawing', width: 48, height: 32,
                blob: await window.galleryImage(48, 32, color)
            });
        });
        const page = await context.newPage();
        await page.route('**/gallery-storage-test.html', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><title>Isolated gallery storage test</title>'
        }));
        await page.goto(`${baseURL}/gallery-storage-test.html`);
        await test(page);
        results.push({ name, passed: true });
    } finally { await context.close(); }
}

try {
    await isolatedTest('save/reload/overwrite retain exact original PNG, date and aspect ratio', async page => {
        const first = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const blob = await window.galleryImage(2200, 1100);
            const metadata = await GalleryStore.save({ id: 'large', name: '  我的画  ', mode: 'drawing', width: 2200, height: 1100, blob });
            const saved = await GalleryStore.get('large');
            const preview = await GalleryStore.getDisplay('large');
            const bitmap = await createImageBitmap(preview);
            const a = new Uint8Array(await blob.arrayBuffer());
            const b = new Uint8Array(await saved.blob.arrayBuffer());
            const output = {
                metadata, originalExact: a.length === b.length && a.every((value, index) => value === b[index]),
                displayWidth: bitmap.width, displayHeight: bitmap.height, originalType: saved.blob.type, displayType: preview.type
            };
            bitmap.close();
            return output;
        });
        assert.equal(first.originalExact, true);
        assert.equal(first.metadata.name, '我的画');
        assert.equal(first.displayWidth, 1600);
        assert.equal(first.displayHeight, 800);
        assert.equal(first.originalType, 'image/png');
        assert.equal(first.displayType, 'image/webp');
        await page.reload();
        const reloaded = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const saved = await GalleryStore.get('large');
            const updated = await GalleryStore.save({ ...saved, name: '改名后' });
            const other = await GalleryStore.save(await window.galleryInput('second'));
            return { updated, count: (await GalleryStore.list()).length, newest: (await GalleryStore.list())[0].id, other };
        });
        assert.equal(reloaded.updated.createdAt, first.metadata.createdAt);
        assert.equal(reloaded.updated.name, '改名后');
        assert.equal(reloaded.count, 2);
        assert.equal(reloaded.newest, 'second');
    });

    await isolatedTest('list reads metadata only; display never reads original blobs; deletion is complete', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            await GalleryStore.save(await window.galleryInput('separate'));
            const original = IDBDatabase.prototype.transaction;
            const requestedStores = [];
            IDBDatabase.prototype.transaction = function (stores, ...rest) {
                requestedStores.push(typeof stores === 'string' ? [stores] : Array.from(stores));
                return original.call(this, stores, ...rest);
            };
            let listed;
            let display;
            try { listed = await GalleryStore.list(); display = await GalleryStore.getDisplay('separate'); }
            finally { IDBDatabase.prototype.transaction = original; }
            await GalleryStore.delete('separate');
            return {
                requestedStores, listKeys: Object.keys(listed[0]).sort(), displayExists: Boolean(display),
                afterDelete: await GalleryStore.get('separate'), displayDeleted: await GalleryStore.getDisplay('separate'), count: (await GalleryStore.list()).length
            };
        });
        assert.deepEqual(result.requestedStores, [['artworks'], ['displays']]);
        assert.deepEqual(result.listKeys, ['createdAt', 'height', 'id', 'mode', 'name', 'width']);
        assert.equal(result.displayExists, true);
        assert.equal(result.afterDelete, null);
        assert.equal(result.displayDeleted, null);
        assert.equal(result.count, 0);
    });

    await isolatedTest('invalid metadata, size, MIME, oversize blobs and mismatched images reject before saving', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const valid = await window.galleryInput('invalid');
            const attempts = [
                { ...valid, id: '' }, { ...valid, width: 0 }, { ...valid, width: 8193 },
                { ...valid, width: 8000, height: 8000 }, { ...valid, height: 3.5 },
                { ...valid, mode: 'online' }, { ...valid, name: 'a'.repeat(81) },
                { ...valid, blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }) },
                { ...valid, blob: new Blob([], { type: 'image/png' }) },
                { ...valid, blob: new Blob(['broken'], { type: 'image/png' }) },
                { ...valid, blob: new Blob([new Uint8Array(32 * 1024 * 1024 + 1)], { type: 'image/png' }) },
                { ...valid, width: 49 }
            ];
            const writes = await Promise.allSettled(attempts.map(input => GalleryStore.save(input)));
            const emptyName = await GalleryStore.save({ ...valid, id: 'unnamed', name: '   ' });
            return { rejected: writes.filter(result => result.status === 'rejected').length, attempts: attempts.length, count: (await GalleryStore.list()).length, defaultName: emptyName.name };
        });
        assert.equal(result.rejected, result.attempts);
        assert.equal(result.count, 1);
        assert.equal(result.defaultName, '未命名作品');
    });

    await isolatedTest('transaction abort after successful put rejects and restores both originals and metadata', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const initial = await window.galleryInput('atomic', 'red');
            await GalleryStore.save(initial);
            const replacement = { ...await window.galleryInput('atomic', 'blue'), name: '不能出现的改名' };
            const original = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (...args) {
                const request = original.apply(this, args);
                if (this.name === 'displays') request.addEventListener('success', () => this.transaction.abort());
                return request;
            };
            let rejected = false;
            try { await GalleryStore.save(replacement); } catch { rejected = true; }
            finally { IDBObjectStore.prototype.put = original; }
            const restored = await GalleryStore.get('atomic');
            const originalBytes = new Uint8Array(await initial.blob.arrayBuffer());
            const savedBytes = new Uint8Array(await restored.blob.arrayBuffer());
            return { rejected, name: restored.name, originalPreserved: originalBytes.length === savedBytes.length && originalBytes.every((v, i) => v === savedBytes[i]), count: (await GalleryStore.list()).length };
        });
        assert.deepEqual(result, { rejected: true, name: '作品 atomic', originalPreserved: true, count: 1 });
    });

    await isolatedTest('old four frames migrate once without overwriting renamed works or resurrecting deletions', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            const blob = await window.galleryImage();
            await ArtworkStore.saveFrame(1, blob);
            const reader = new FileReader();
            const legacy = await new Promise(resolve => { reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
            localStorage.setItem('art_frame_2', legacy);
            await Promise.all([GalleryStore.migrateLegacyFrames(), GalleryStore.migrateLegacyFrames()]);
            const before = await GalleryStore.list();
            const saved = await GalleryStore.get('legacy-frame-1');
            await GalleryStore.save({ ...saved, name: '我的旧画改名' });
            await GalleryStore.delete('legacy-frame-2');
            await GalleryStore.migrateLegacyFrames();
            return {
                initialCount: before.length, initialModes: before.map(item => item.mode), count: (await GalleryStore.list()).length,
                name: (await GalleryStore.get('legacy-frame-1')).name, deletedStillMissing: await GalleryStore.get('legacy-frame-2') === null,
                original1Preserved: Boolean(await ArtworkStore.getFrame(1)), original2Preserved: Boolean(await ArtworkStore.getFrame(2)),
                originalLegacySafelyMigrated: localStorage.getItem('art_frame_2') === null
            };
        });
        assert.deepEqual(result, { initialCount: 2, initialModes: ['legacy', 'legacy'], count: 1, name: '我的旧画改名', deletedStillMissing: true, original1Preserved: true, original2Preserved: true, originalLegacySafelyMigrated: true });
        await page.reload();
        const persisted = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            await GalleryStore.migrateLegacyFrames();
            return (await GalleryStore.list()).map(item => item.name);
        });
        assert.deepEqual(persisted, ['我的旧画改名']);
    });

    await isolatedTest('one damaged old slot does not prevent healthy migration or delete the source', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            localStorage.setItem('art_frame_1', 'data:image/png;base64,broken%%%');
            await ArtworkStore.saveFrame(4, await window.galleryImage());
            let rejected = false;
            try { await GalleryStore.migrateLegacyFrames(); } catch { rejected = true; }
            return { rejected, preserved: localStorage.getItem('art_frame_1') === 'data:image/png;base64,broken%%%', healthy: Boolean(await GalleryStore.get('legacy-frame-4')), originalPreserved: Boolean(await ArtworkStore.getFrame(4)) };
        });
        assert.ok(Object.values(result).every(Boolean), JSON.stringify(result));
    });

    await isolatedTest('quota failure during gallery migration retains old frame and permits retry', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            await ArtworkStore.saveFrame(1, await window.galleryImage());
            await GalleryStore.list();
            const original = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
                if (this.name === 'dont_erase_me_gallery_v1' && mode === 'readwrite') throw new DOMException('Simulated quota', 'QuotaExceededError');
                return original.call(this, stores, mode, ...rest);
            };
            let message = '';
            try { await GalleryStore.migrateLegacyFrames(); } catch (error) { message = error.message; }
            finally { IDBDatabase.prototype.transaction = original; }
            const notWritten = (await GalleryStore.list()).length === 0;
            const originalPreserved = Boolean(await ArtworkStore.getFrame(1));
            await GalleryStore.migrateLegacyFrames();
            return { message, notWritten, originalPreserved, retrySaved: Boolean(await GalleryStore.get('legacy-frame-1')) };
        });
        assert.match(result.message, /存储空间不足/);
        assert.equal(result.notWritten, true);
        assert.equal(result.originalPreserved, true);
        assert.equal(result.retrySaved, true);
    });

    await isolatedTest('opening failure recovers on retry', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            const original = IDBFactory.prototype.open;
            IDBFactory.prototype.open = () => { throw new DOMException('Simulated security error', 'SecurityError'); };
            let message = '';
            try { await GalleryStore.list(); } catch (error) { message = error.message; }
            finally { IDBFactory.prototype.open = original; }
            return { message, recovered: (await GalleryStore.list()).length === 0 };
        });
        assert.match(result.message, /无法使用本地画廊/);
        assert.equal(result.recovered, true);
    });

    await isolatedTest('corrupt gallery records reject without deletion or silent replacement', async page => {
        const result = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            await GalleryStore.save(await window.galleryInput('damaged'));
            const database = await new Promise((resolve, reject) => {
                const request = indexedDB.open('dont_erase_me_gallery_v1', 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(['artworks', 'originals', 'displays'], 'readwrite');
                transaction.objectStore('artworks').put({ id: 'damaged', version: 99 });
                transaction.objectStore('originals').put('not an image', 'damaged');
                transaction.objectStore('displays').put('not an image', 'damaged');
                transaction.oncomplete = resolve;
                transaction.onabort = () => reject(transaction.error);
            });
            const input = await window.galleryInput('damaged');
            const readsAndWrite = await Promise.allSettled([
                GalleryStore.list(), GalleryStore.get('damaged'), GalleryStore.getDisplay('damaged'), GalleryStore.save(input)
            ]);
            const preserved = await new Promise(resolve => {
                const request = database.transaction(['artworks'], 'readonly').objectStore('artworks').get('damaged');
                request.onsuccess = () => resolve(request.result?.version === 99);
            });
            database.close();
            return { rejected: readsAndWrite.filter(result => result.status === 'rejected').length, preserved };
        });
        assert.deepEqual(result, { rejected: 4, preserved: true });
    });

    await isolatedTest('simultaneous separate game windows import only one copy of each old frame', async page => {
        await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            await ArtworkStore.saveFrame(1, await window.galleryImage(1200, 800));
            await ArtworkStore.saveFrame(2, await window.galleryImage(800, 1200));
        });
        const secondPage = await page.context().newPage();
        await secondPage.route('**/gallery-storage-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Second isolated gallery window</title>' }));
        await secondPage.goto(`${baseURL}/gallery-storage-test.html`);
        const migrate = target => target.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            await GalleryStore.migrateLegacyFrames();
        });
        await Promise.all([migrate(page), migrate(secondPage)]);
        const ids = await page.evaluate(async () => {
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            return (await GalleryStore.list()).map(item => item.id).sort();
        });
        assert.deepEqual(ids, ['legacy-frame-1', 'legacy-frame-2']);
        await secondPage.close();
    });

    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
