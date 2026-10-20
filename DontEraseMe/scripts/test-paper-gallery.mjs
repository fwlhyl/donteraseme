import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.GALLERY_TEST_URL || 'http://127.0.0.1:5174';
const screenshotRoot = process.env.PAPER_GALLERY_SCREENSHOT_DIR || new URL('../art-drafts/dark-paper-scenes-2026-10-17/screenshots/', import.meta.url).pathname;
await mkdir(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.route('**/paper-gallery-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated paper gallery</title><style>body{margin:0}</style>' }));
    await page.goto(`${url}/paper-gallery-test.html`);
    await page.evaluate(async () => {
        const { ArtGallery } = await import('/src/gallery/ArtGallery.ts');
        const { GalleryStore } = await import('/src/core/GalleryStore.ts');
        for (let index = 0; index < 4; index++) {
            const canvas = document.createElement('canvas');
            canvas.width = 360; canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f2ead2'; ctx.fillRect(0, 0, 360, 240);
            ctx.lineCap = 'round';
            for (let stroke = 0; stroke < 6; stroke++) {
                ctx.strokeStyle = ['#b44832', '#3e6d78', '#333e3b', '#b4995e'][(index + stroke) % 4];
                ctx.lineWidth = 9 + stroke * 4;
                ctx.beginPath(); ctx.moveTo(28, 34 + stroke * 30);
                ctx.bezierCurveTo(90, 30 + stroke * 20, 250, 220 - stroke * 28, 325, 65 + stroke * 24); ctx.stroke();
            }
            ctx.fillStyle = '#2177b9'; ctx.fillRect(170, 110, 20, 20);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await GalleryStore.save({ id: `paper-gallery-${index}`, name: ['未被擦去', '旧城的回声', '归途', '第二次落笔'][index], mode: ['endless', 'defense', 'drawing', 'drawing'][index], width: 360, height: 240, blob });
        }
        window.gallery = new ArtGallery();
        await window.gallery.open(() => {});
    });
    await page.waitForFunction(() => {
        let mappedRoomMeshes = 0;
        window.gallery.scene.traverse(node => {
            if (node.material?.map?.image?.complete && (node.material.type === 'MeshLambertMaterial' || node.geometry?.parameters?.depth === 18)) mappedRoomMeshes++;
        });
        return mappedRoomMeshes >= 5 && window.gallery.renderer.info.render.calls > 0;
    });
    assert.equal(await page.locator('#art-gallery').getAttribute('data-theme'), 'dark-paper');
    assert.equal(await page.locator('#art-gallery').getAttribute('data-renderer'), 'webgl');
    const room = await page.evaluate(() => {
        const g = window.gallery;
        const artwork = g.walls[1].mesh;
        g.renderer.render(g.scene, g.camera);
        const point = artwork.position.clone(); artwork.getWorldPosition(point); point.project(g.camera);
        const gl = g.renderer.getContext(); const pixel = new Uint8Array(4);
        gl.readPixels(Math.round((point.x + 1) / 2 * gl.drawingBufferWidth), Math.round((point.y + 1) / 2 * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        const maps = new Map();
        g.scene.traverse(node => {
            const texture = node.material?.map;
            if (texture?.name.startsWith('paper-architecture:')) maps.set(texture.name, {
                name: texture.name, source: texture.image.currentSrc,
                width: texture.image.naturalWidth, height: texture.image.naturalHeight,
                anisotropy: texture.anisotropy, mipmaps: texture.generateMipmaps,
            });
        });
        return { pixel: [...pixel], tint: artwork.material.color.getHexString(), grid: g.scene.children.some(node => node.type === 'GridHelper'), shadow: g.renderer.shadowMap.enabled, dimensions: artwork.geometry.parameters, ratio: g.renderer.getPixelRatio(), maps: [...maps.values()], maxAnisotropy: g.renderer.capabilities.getMaxAnisotropy() };
    });
    assert.equal(room.tint, 'ffffff', 'artwork is not tinted by room colour');
    assert.equal(room.grid, false, 'bright tiled floor removed');
    assert.equal(room.shadow, false, 'no expensive realtime shadows');
    assert.ok(room.ratio <= 1.5);
    assert.equal(room.maps.length, 2, 'wall and floor reuse two architecture textures');
    for (const map of room.maps) {
        assert.match(map.source, /(?:gallery-wall|floor)-clarity-v1\.webp/, 'approved clarity resources are active');
        assert.equal(map.anisotropy, Math.max(1, Math.min(4, room.maxAnisotropy)), 'architecture sampling stays GPU-bounded');
        assert.equal(map.mipmaps, true, 'mipmaps prevent distant texture shimmer');
        assert.ok(map.width > 0 && map.height > 0, 'actual image dimensions are recorded, not assumed');
    }
    assert.ok(room.pixel.slice(0, 3).every((value, index) => Math.abs(value - [33, 119, 185][index]) <= 2), `original centre colour retained: ${room.pixel}`);
    await page.screenshot({ path: `${screenshotRoot}/gallery-room.png` });
    await page.locator('.gallery-artwork-card').first().click();
    await page.locator('#gallery-detail-image').waitFor();
    assert.equal(await page.locator('#gallery-detail-image').evaluate(image => getComputedStyle(image).filter), 'none');
    await page.screenshot({ path: `${screenshotRoot}/gallery-detail.png` });
    await page.locator('#gallery-detail-close-btn').click();
    await page.evaluate(() => {
        window.gallery.yaw = 0.8;
        window.gallery.camera.position.set(5, 1.7, 1.4);
    });
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${screenshotRoot}/gallery-side.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${screenshotRoot}/gallery-mobile.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => window.gallery.renderer.forceContextLoss());
    await page.waitForFunction(() => document.querySelector('#art-gallery').dataset.renderer === 'list');
    await page.screenshot({ path: `${screenshotRoot}/gallery-fallback.png` });
    await page.locator('#gallery-exit-btn').click();
    assert.equal(await page.locator('#art-gallery').count(), 0);
    assert.equal(await page.evaluate(() => window.gallery.releaseRoom), null);
    let pendingWall;
    let wallRequested;
    const wallRequest = new Promise(resolve => { wallRequested = resolve; });
    await page.route('**/gallery-wall-clarity-v1.webp', route => { pendingWall = route; wallRequested(); });
    // A fresh document avoids the browser's decoded-image cache: this case
    // deliberately keeps the room image in flight while the gallery closes.
    await page.reload();
    await page.evaluate(async () => {
        const { ArtGallery } = await import('/src/gallery/ArtGallery.ts');
        window.gallery = new ArtGallery();
        void window.gallery.open(() => {});
    });
    let timeout;
    try {
        await Promise.race([wallRequest, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('wall image request was not intercepted')), 8000); })]);
    } finally { clearTimeout(timeout); }
    await page.evaluate(() => window.gallery.close());
    await pendingWall.continue();
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => ({ room: window.gallery.releaseRoom, renderer: window.gallery.renderer, count: document.querySelectorAll('#art-gallery').length })), { room: null, renderer: null, count: 0 }, 'a delayed paper texture does not resurrect a closed room');
    assert.deepEqual(errors, []);
    const retina = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
    try {
        const retinaPage = await retina.newPage();
        retinaPage.on('pageerror', error => errors.push(error.message));
        await retinaPage.route('**/paper-gallery-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated retina paper gallery</title><style>body{margin:0}</style>' }));
        await retinaPage.goto(`${url}/paper-gallery-test.html`);
        await retinaPage.evaluate(async () => {
            const { ArtGallery } = await import('/src/gallery/ArtGallery.ts');
            window.gallery = new ArtGallery();
            await window.gallery.open(() => {});
        });
        await retinaPage.waitForFunction(() => {
            const maps = new Set();
            window.gallery.scene.traverse(node => {
                const texture = node.material?.map;
                if (texture?.name.startsWith('paper-architecture:') && texture.image.complete) maps.add(texture.name);
            });
            return maps.size === 2 && window.gallery.renderer.info.render.calls > 0;
        });
        assert.equal(await retinaPage.evaluate(() => window.gallery.renderer.getPixelRatio()), 1.5, 'retina retains the existing memory/fill-rate cap');
        await retinaPage.screenshot({ path: `${screenshotRoot}/gallery-room-2x.png` });
        await retinaPage.locator('#gallery-exit-btn').click();
    } finally { await retina.close(); }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, originalArtworkPixel: room.pixel, architectureMaps: room.maps, retinaRenderRatio: 1.5, screenshots: 6 }, null, 2));
} finally { await context.close(); await browser.close(); }
