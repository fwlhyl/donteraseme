import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = join(await mkdtemp(join(tmpdir(), 'combat-hud-')), 'hud.mjs');
await build({ entryPoints: ['src/ui/CombatHud.ts'], bundle: true, platform: 'node', format: 'esm', outfile: file });
const { hudRatio, ammoModel, integrityState, HealthHud, WeaponHud, MagicHud, mountDefenseHud, updateDefenseHud } = await import(pathToFileURL(file));
assert.equal(hudRatio(-20, 100), 0); assert.equal(hudRatio(110, 100), 1);
assert.equal(hudRatio(20, 0), 0); assert.equal(hudRatio(NaN, 100), 0);
assert.equal(ammoModel(9999, 9999, true).slots, 0);
assert.equal(ammoModel(150, 150).slots, 12);
assert.deepEqual(ammoModel(2, 5).fills, [1, 1, 0, 0, 0]);
assert.equal(ammoModel(0, 1).fills[0], 0);
assert.equal(integrityState(.3), 'critical'); assert.equal(integrityState(.6), 'worn');
assert.equal(integrityState(.61), 'safe');

// Small DOM adapter tests the real presenters; browser QA covers markup/layout.
class Element {
    textContent = ''; dataset = {}; hidden = false; children = []; nodes = new Map(); attrs = new Map(); classes = new Set();
    style = { setProperty: (name, value) => { this.style[name] = value; } };
    classList = { add: (...names) => names.forEach(n => this.classes.add(n)), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    set innerHTML(value) { this.html = value; this.children = Array.from({ length: (value.match(/<i><b><\/b><\/i>/g) || []).length }, () => new Element()); }
    querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new Element()); return this.nodes.get(key); }
    setAttribute(key, value) { this.attrs.set(key, value); }
}
const part = (root, name) => root.querySelector(`[data-hud="${name}"]`);
const healthRoot = new Element(), health = new HealthHud(healthRoot);
const hero = { id: 'a', hp: 800, max: 800, level: 2, xp: 50, next: 100, shield: '', zh: true };
health.update(hero, 1 / 60);
assert.equal(part(healthRoot, 'value').textContent, '800 / 800');
assert.equal(part(healthRoot, 'xp').style['--fill'], '50%');
health.update({ ...hero, hp: 190, shield: '厚涂护盾: 就绪' }, 1 / 60);
assert.equal(healthRoot.dataset.state, 'critical'); assert(healthRoot.classes.has('is-hit'));
assert.equal(part(healthRoot, 'shield').hidden, false);
health.update({ ...hero, id: 'new-run', hp: 100 }, 1 / 60);
assert(!healthRoot.classes.has('is-hit'), 'new run must not inherit damage flash');

const weaponRoot = new Element(), weapon = new WeaponHud(weaponRoot);
const brush = { key: '0', name: 'Brush', type: 'standard', ammo: 12, capacity: 12, reloading: false, reloadProgress: 0, zh: true };
weapon.update(brush); assert.equal(part(weaponRoot, 'pips').children.length, 12);
weapon.update({ ...brush, ammo: 0, reloading: true, reloadProgress: .5 });
assert.equal(weaponRoot.dataset.state, 'reloading'); assert.equal(part(weaponRoot, 'status').textContent, '装填 50%');
assert.equal(part(weaponRoot, 'reload').hidden, false);
weapon.update({ ...brush, key: '2', type: 'melee', ammo: 9999, capacity: 9999 });
assert.equal(part(weaponRoot, 'count').textContent, '∞'); assert.equal(part(weaponRoot, 'pips').hidden, true);
weapon.update({ ...brush, remaining: 4.25 });
assert.equal(part(weaponRoot, 'count').textContent, '4.3s'); assert.equal(weaponRoot.dataset.state, 'vehicle');
weapon.update({ ...brush, key: 'unarmed' }); assert.equal(part(weaponRoot, 'count').textContent, '—');
weapon.update(brush); assert.equal(part(weaponRoot, 'pips').children.length, 12);
assert.equal(part(weaponRoot, 'reload').hidden, true);

const magicRoot = new Element(), magic = new MagicHud(magicRoot);
magic.update(32, 45, false, true);
assert.equal(part(magicRoot, 'count').textContent, '32 / 45');
assert.equal(part(magicRoot, 'inspiration').style['--fill'], '71%');
assert.equal(part(magicRoot, 'status').hidden, true);
magic.update(45, 45, false, true);
assert.equal(magicRoot.dataset.ready, 'true');
assert.equal(part(magicRoot, 'status').textContent, '就绪 · 按 G 描绘');
magic.update(0, 45, true, false);
assert.equal(magicRoot.dataset.ready, 'false');
assert.equal(part(magicRoot, 'status').textContent, 'Piloting');
assert.equal(part(magicRoot, 'status').hidden, false);

const guard = new Element(); mountDefenseHud(guard);
updateDefenseHud(guard, { name: '<img onerror=alert(1)>', integrity: .2, attackers: 3, remaining: 65.1, zh: true });
assert.equal(guard.dataset.state, 'critical'); assert.equal(guard.dataset.attacked, 'true');
assert.equal(guard.querySelector('#painting-name').textContent, '<img onerror=alert(1)>', 'custom names stay text, never HTML');
assert.equal(guard.querySelector('#guard-time').textContent, '1:06');
assert.equal(guard.querySelector('#painting-integrity-fill').style.width, '20%');
updateDefenseHud(guard, { name: 'Flower', integrity: 1, attackers: 0, remaining: -2, zh: false });
assert.equal(guard.dataset.state, 'safe'); assert.equal(guard.dataset.attacked, 'false');
assert.equal(guard.querySelector('#guard-time').textContent, '0:00');
assert.equal(guard.querySelector('#guard-condition').textContent, 'INTACT');
console.log('PASS: health/XP, hit reset, shields, grouped ammo, reload, melee, vehicle/unarmed transitions, integrity states, timer, repair recovery and safe artwork names.');
