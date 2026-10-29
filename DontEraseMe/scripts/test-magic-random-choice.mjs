// Isolated browser regression: one random vehicle per charge, including cancel/reopen.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const location = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = location ? await import(pathToFileURL(location).href) : await import('playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext(); const page = await context.newPage();
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173/index.html');
  await page.waitForFunction(() => !!window.gameInstance);
  const result = await page.evaluate(() => {
    const game = window.gameInstance, checks = [];
    for (const [random, expected] of [[0, 'tank'], [.4, 'robot'], [.8, 'bomber']]) {
      game.startGame('endless'); game.isRunning = false;
      const system = game.systems.find(s => s.constructor.name === 'MagicPenSystem');
      const player = [...game.entities.values()].find(e => e.tags.has('player'));
      const stats = [...player.components.values()].find(c => c.constructor.name === 'PlayerStats');
      stats.acquiredSkills.magic_pen = 1; system.update(1/60); system.progressByPlayer.set(player.id, 100);
      const original = Math.random; Math.random = () => random;
      try { system.openBoard(); } finally { Math.random = original; }
      if (!system.boardOpen || system.selectedType !== expected) throw Error(`expected ${expected}`);
      if (document.querySelector('#magic-pen-board .sketch-board-choice')) throw Error('choices remain visible');
      system.closeBoard(false);
      Math.random = () => (random + .4) % 1;
      try { system.openBoard(); } finally { Math.random = original; }
      if (system.selectedType !== expected) throw Error('cancel changed result');
      system.strokes = [[{x:170,y:230},{x:440,y:230}]]; system.completeDrawing();
      const manifestation = [...game.entities.values()].flatMap(e => [...e.components.values()]).find(c => c.constructor.name === 'MagicManifestation' && c.ownerId === player.id);
      if (!manifestation || manifestation.type !== expected || system.pendingType !== null || system.progressByPlayer.get(player.id) !== 0) throw Error('successful use did not commit and reset');
      checks.push(expected);
    }
    return checks;
  });
  assert.deepEqual(result, ['tank','robot','bomber']);
  console.log('PASS: each random vehicle, locked cancel/reopen, successful use and new-run reset.');
} finally { await context.close(); await browser.close(); }
