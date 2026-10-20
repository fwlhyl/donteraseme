import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseURL = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

async function isolated(name, run) {
    // Never use the player's browser/profile: each test owns its IndexedDB.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/gallery-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated gallery test</title><style>body{margin:0}</style>' }));
        await page.goto(`${baseURL}/gallery-test.html`);
        await page.evaluate(async () => {
            const { ArtGallery } = await import('/src/gallery/ArtGallery.ts');
            const { GalleryStore } = await import('/src/core/GalleryStore.ts');
            window.GalleryStore = GalleryStore;
            window.gallery = new ArtGallery();
            window.galleryClosedCount = 0;
            window.liveUrls = new Set();
            const create = URL.createObjectURL.bind(URL);
            const revoke = URL.revokeObjectURL.bind(URL);
            URL.createObjectURL = blob => { const url = create(blob); window.liveUrls.add(url); return url; };
            URL.revokeObjectURL = url => { window.liveUrls.delete(url); revoke(url); };
            window.liveListeners = 0;
            const add = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, callback, options) {
                if ((this === window || this === document) && options?.signal) {
                    window.liveListeners++;
                    add.call(options.signal, 'abort', () => window.liveListeners--, { once: true });
                }
                return add.call(this, type, callback, options);
            };
            window.makeBlob = async (width, height, type = 'image/png') => {
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const context = canvas.getContext('2d');
                context.fillStyle = '#e02759'; context.fillRect(0, 0, width, height);
                context.fillStyle = '#2177b9'; context.fillRect(width / 3, height / 4, width / 2, height / 2);
                return new Promise(resolve => canvas.toBlob(resolve, type));
            };
        });
        await run(page);
        assert.deepEqual(errors, [], `${name}: uncaught browser errors`);
        results.push({ name, passed: true });
    } finally { await context.close(); }
}

try {
    await isolated('real WebGL room, legacy migration, paging, PNG export and resource cleanup', async page => {
        await page.evaluate(async () => {
            const { ArtworkStore } = await import('/src/core/ArtworkStore.ts');
            await ArtworkStore.saveFrame(1, await window.makeBlob(48, 32));
            for (let index = 0; index < 11; index++) {
                const width = index % 2 ? 240 : 160;
                const height = index % 2 ? 160 : 240;
                await window.GalleryStore.save({ id: `test-${index}`, name: index === 1 ? '<img onerror=alert(1)>' : `画作 ${index}`, mode: index % 2 ? 'defense' : 'drawing', width, height, blob: await window.makeBlob(width, height) });
            }
            await window.GalleryStore.save({ id: 'large-art', name: '长幅原图', mode: 'drawing', width: 2001, height: 301, blob: await window.makeBlob(2001, 301, 'image/jpeg') });
            await window.gallery.open(() => window.galleryClosedCount++);
        });
        assert.equal(await page.locator('#art-gallery').getAttribute('data-renderer'), 'webgl');
        await page.waitForFunction(() => window.gallery.renderer.info.render.calls > 0);
        // Upload every current-room texture explicitly for deterministic disposal
        // accounting; Three normally delays offscreen materials until first sight.
        await page.evaluate(() => {
            window.gallery.scene.traverse(node => {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) if (material?.map) window.gallery.renderer.initTexture(material.map);
            });
        });
        assert.match(await page.locator('#gallery-page-label').innerText(), /展厅 1 \/ 2 · 共 13 幅/);
        assert.equal(await page.locator('.gallery-artwork-card').count(), 10);
        const first = await page.evaluate(() => {
            const gallery = window.gallery;
            gallery.renderer.render(gallery.scene, gallery.camera);
            const gl = gallery.renderer.getContext();
            const pixel = new Uint8Array(4);
            gl.readPixels(10, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            const firstArtPoint = gallery.walls[0].mesh.position.clone();
            gallery.walls[0].mesh.getWorldPosition(firstArtPoint);
            firstArtPoint.project(gallery.camera);
            const artPixel = new Uint8Array(4);
            gl.readPixels(Math.round((firstArtPoint.x + 1) / 2 * gl.drawingBufferWidth), Math.round((firstArtPoint.y + 1) / 2 * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, artPixel);
            return {
                calls: gallery.renderer.info.render.calls,
                textures: gallery.renderer.info.memory.textures,
                ratio: gallery.renderer.getPixelRatio(),
                pixel: [...pixel],
                artPixel: [...artPixel], glError: gl.getError(),
                aspectPreserved: gallery.walls.every(({ mesh, artwork }) => Math.abs(mesh.geometry.parameters.width / mesh.geometry.parameters.height - artwork.width / artwork.height) < 0.0001),
                urls: window.liveUrls.size, listeners: window.liveListeners
            };
        });
        assert.ok(first.calls > 20);
        assert.ok(first.pixel[3] > 0 && first.pixel.slice(0, 3).some(value => value > 0));
        assert.equal(first.glError, 0);
        assert.ok(first.artPixel[2] > first.artPixel[0], 'small legacy work is blue at its center, not a black/incomplete texture');
        assert.ok(first.ratio <= 1.5);
        assert.equal(first.aspectPreserved, true);
        assert.equal(first.urls, 10);
        await page.screenshot({ path: '/tmp/dont-erase-me-gallery.png' });

        await page.locator('[data-artwork-id="large-art"]').click();
        await page.locator('#gallery-detail-image').waitFor();
        assert.equal(await page.locator('#gallery-detail-image').evaluate(image => image.naturalWidth), 1600);
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#gallery-export-btn').click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), '长幅原图.png');
        const exported = await readFile(await download.path());
        assert.deepEqual([...exported.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(exported.readUInt32BE(16), 2001);
        assert.equal(exported.readUInt32BE(20), 301);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gallery-detail').count(), 0);

        await page.locator('#gallery-next-btn').click();
        // Two paper maps and an extra archive sign stay alive across pages;
        // only the room's artwork textures and captions are replaced.
        await page.waitForFunction(() => window.gallery.page === 1 && document.querySelectorAll('.gallery-thumbnail').length === 3 && window.gallery.renderer.info.memory.textures <= 17);
        assert.equal(await page.locator('.gallery-artwork-card').count(), 3);
        assert.ok(await page.evaluate(() => window.gallery.renderer.info.memory.textures) < first.textures);
        await page.locator('#gallery-previous-btn').click();
        await page.waitForFunction(() => window.gallery.page === 0 && document.querySelectorAll('.gallery-thumbnail').length === 10);
        await page.evaluate(() => {
            window.gallery.scene.traverse(node => {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) if (material?.map) window.gallery.renderer.initTexture(material.map);
            });
        });
        assert.equal(await page.evaluate(() => window.gallery.renderer.info.memory.textures), first.textures);
        assert.equal(await page.evaluate(() => window.liveListeners), first.listeners);
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(300);
        await page.keyboard.up('ArrowUp');
        assert.ok(await page.evaluate(() => window.gallery.camera.position.z) < 6.8);
        await page.evaluate(() => { window.gallery.camera.position.set(500, 1.7, -500); });
        await page.waitForTimeout(40);
        const clamped = await page.evaluate(() => ({ x: window.gallery.camera.position.x, z: window.gallery.camera.position.z }));
        assert.ok(clamped.x <= 9.5 && clamped.z >= -8.5);
        await page.locator('#gallery-exit-btn').click();
        assert.deepEqual(await page.evaluate(() => ({ closed: window.galleryClosedCount, frame: window.gallery.frame, urls: window.liveUrls.size, listeners: window.liveListeners, renderer: window.gallery.renderer })), { closed: 1, frame: 0, urls: 0, listeners: 0, renderer: null });
        await page.evaluate(async () => { await window.gallery.open(() => window.galleryClosedCount++); });
        await page.waitForFunction(() => window.gallery.renderer.info.render.calls > 0);
        await page.locator('#gallery-exit-btn').click();
        await page.evaluate(() => window.gallery.close());
        assert.deepEqual(await page.evaluate(() => ({ closed: window.galleryClosedCount, urls: window.liveUrls.size, listeners: window.liveListeners, count: document.querySelectorAll('#art-gallery').length })), { closed: 2, urls: 0, listeners: 0, count: 0 });
    });

    await isolated('no WebGL falls back to accessible list and original export', async page => {
        await page.evaluate(async () => {
            await window.GalleryStore.save({ id: 'fallback-art', name: '离线画作', mode: 'endless', width: 80, height: 40, blob: await window.makeBlob(80, 40) });
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, options) {
                return type.startsWith('webgl') ? null : getContext.call(this, type, options);
            };
            await window.gallery.open(() => window.galleryClosedCount++);
        });
        assert.equal(await page.locator('#art-gallery').getAttribute('data-renderer'), 'list');
        assert.match(await page.locator('#gallery-notice').innerText(), /3D 渲染/);
        await page.locator('.gallery-artwork-card').click();
        await page.locator('#gallery-detail-image').waitFor();
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#gallery-export-btn').click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), '离线画作.png');
        await page.locator('#gallery-detail-close-btn').click();
        await page.locator('#gallery-exit-btn').click();
        assert.deepEqual(await page.evaluate(() => ({ urls: window.liveUrls.size, listeners: window.liveListeners, closed: window.galleryClosedCount })), { urls: 0, listeners: 0, closed: 1 });
    });

    await isolated('context loss preserves list, async close/reopen does not resurrect old images', async page => {
        await page.evaluate(async () => {
            await window.GalleryStore.save({ id: 'race-art', name: '安全退出', mode: 'drawing', width: 100, height: 80, blob: await window.makeBlob(100, 80) });
            await window.gallery.open(() => window.galleryClosedCount++);
            window.gallery.renderer.forceContextLoss();
        });
        await page.waitForFunction(() => document.querySelector('#art-gallery')?.dataset.renderer === 'list');
        await page.locator('.gallery-artwork-card').click();
        await page.locator('#gallery-detail-image').waitFor();
        await page.locator('#gallery-detail-close-btn').click();
        await page.locator('#gallery-exit-btn').click();
        const race = await page.evaluate(async () => {
            const getDisplay = window.GalleryStore.getDisplay.bind(window.GalleryStore);
            let release;
            let entered;
            const pending = new Promise(resolve => { entered = resolve; });
            window.GalleryStore.getDisplay = async id => { entered(); await new Promise(resolve => { release = resolve; }); return getDisplay(id); };
            const oldOpening = window.gallery.open(() => window.galleryClosedCount++);
            await pending;
            window.gallery.close();
            window.GalleryStore.getDisplay = getDisplay;
            await window.gallery.open(() => window.galleryClosedCount++);
            release();
            await oldOpening;
            const count = document.querySelectorAll('#art-gallery').length;
            const images = window.gallery.displayUrls.size;
            window.gallery.close();
            return { count, images, urls: window.liveUrls.size, listeners: window.liveListeners, closed: window.galleryClosedCount };
        });
        assert.deepEqual(race, { count: 1, images: 1, urls: 0, listeners: 0, closed: 3 });
    });
    console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally { await browser.close(); }
