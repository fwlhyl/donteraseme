import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const session = await browser.newBrowserCDPSession();
const info = await session.send('SystemInfo.getInfo');
console.log('GPU devices:', JSON.stringify(info.gpu?.devices?.map(d => d.vendorString + ' | ' + d.deviceString)));
const fs = info.gpu?.featureStatus || {};
for (const k of Object.keys(fs)) if (/canvas|compositing|webgl|raster/i.test(k)) console.log(' ', k, '=', fs[k]);
await browser.close();
