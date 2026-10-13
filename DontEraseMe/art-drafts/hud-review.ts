import '../src/style.css';
import '../src/ui/combatHud.css';
import { HealthHud, WeaponHud, mountDefenseHud, updateDefenseHud } from '../src/ui/CombatHud';
import { hudIcon, weaponIcons } from '../src/ui/HudIcons';

function sample(label: string) {
    const wrap = document.createElement('div'); wrap.className = 'sample';
    const caption = document.createElement('p'); caption.textContent = label;
    const root = document.createElement('div'); wrap.append(caption, root); document.getElementById('samples')!.append(wrap); return root;
}
for (const hp of [800, 420, 120]) new HealthHud(sample(hp === 800 ? '生命充足 / 升级进度' : hp === 420 ? '受伤 / 精确血量' : '低血量 / 明确警示'))
    .update({ id: 'sample', hp, max: 800, level: 3, xp: 70, next: 100, shield: '', zh: true }, 0);
for (const [label, data] of [
    ['画笔 / 剩余 8 发', { key: '0', name: 'Pistol (Brush)', type: 'standard', ammo: 8, capacity: 12, reloading: false, reloadProgress: 0 }],
    ['装填 / 动态进度', { key: '1', name: 'Shotgun (Spray)', type: 'shotgun', ammo: 0, capacity: 7, reloading: true, reloadProgress: .56 }],
    ['近战 / 无限使用', { key: '2', name: 'Scraper (Blade)', type: 'melee', ammo: 9999, capacity: 9999, reloading: false, reloadProgress: 0 }],
] as const) new WeaponHud(sample(label)).update({ ...data, zh: true });
const guard = document.getElementById('defense-hud')!; mountDefenseHud(guard);
function setGuard(state: string) { updateDefenseHud(guard, { name: '守护之花', integrity: state === 'safe' ? 1 : state === 'worn' ? .48 : .22, attackers: state === 'critical' ? 3 : 0, remaining: 725, zh: true }); }
document.querySelectorAll<HTMLButtonElement>('[data-state]').forEach(button => { if (button.tagName === 'BUTTON') button.onclick = () => setGuard(button.dataset.state!); }); setGuard('safe');
for (const [name, icon] of Object.entries(weaponIcons)) {
    const tile = document.createElement('div'); tile.className = 'icon-tile'; tile.innerHTML = `${hudIcon(icon)}<small>${name}</small>`; document.getElementById('icon-gallery')!.append(tile);
}
