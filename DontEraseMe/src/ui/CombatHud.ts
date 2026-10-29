import { hudIcon, weaponIcons } from './HudIcons';

export const hudRatio = (value: number, max: number) => Number.isFinite(value) && Number.isFinite(max) && max > 0
    ? Math.max(0, Math.min(1, value / max)) : 0;
export const integrityState = (ratio: number) => ratio <= .3 ? 'critical' : ratio <= .6 ? 'worn' : 'safe';

export function ammoModel(ammo: number, capacity: number, melee = false) {
    const infinite = melee || capacity >= 9999;
    const slots = infinite ? 0 : Math.min(12, Math.max(1, Math.ceil(capacity)));
    const ratio = hudRatio(ammo, capacity);
    return { infinite, slots, ratio, fills: Array.from({ length: slots }, (_, i) => Math.max(0, Math.min(1, ratio * slots - i))) };
}

function find(root: HTMLElement, name: string): HTMLElement { return root.querySelector(`[data-hud="${name}"]`)!; }
function text(el: HTMLElement, value: string) { if (el.textContent !== value) el.textContent = value; }
function meter(el: HTMLElement, value: number, label: string) {
    const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
    el.style.setProperty('--fill', `${percent}%`);
    el.setAttribute('aria-valuenow', `${percent}`);
    el.setAttribute('aria-label', label);
}
const track = (name: string, extra = '') => `<div data-hud="${name}" class="ink-meter ${extra}" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div>`;

export class HealthHud {
    private value: HTMLElement; private level: HTMLElement; private bar: HTMLElement;
    private xp: HTMLElement; private shield: HTMLElement; private status: HTMLElement;
    private previous = -1; private actor = ''; private flash = 0;
    constructor(public readonly root: HTMLElement) {
        root.className = 'hud-paper health-card';
        root.innerHTML = `<div class="hud-health-row"><span data-hud="status">生命</span><strong data-hud="value"></strong></div>
            ${track('health')}
            <div class="hud-xp-row"><b data-hud="level"></b>${track('xp', 'xp-meter')}</div>
            <small data-hud="shield" class="shield-note" hidden></small>`;
        this.value = find(root,'value'); this.level = find(root,'level'); this.bar = find(root,'health');
        this.xp = find(root,'xp'); this.shield = find(root,'shield'); this.status = find(root,'status');
    }
    update(data: { id: string; hp: number; max: number; level: number; xp: number; next: number; shield: string; zh: boolean }, dt: number) {
        if (data.id !== this.actor) { this.previous = data.hp; this.actor = data.id; this.flash = 0; }
        if (data.hp < this.previous) this.flash = .45;
        this.previous = data.hp; this.flash = Math.max(0, this.flash - Math.max(0, dt));
        const ratio = hudRatio(data.hp, data.max);
        this.root.dataset.state = ratio <= .25 ? 'critical' : 'safe';
        this.root.classList.toggle('is-hit', this.flash > 0);
        text(this.status, ratio <= .25 ? (data.zh ? '生命危急' : 'LOW HP') : (data.zh ? '生命' : 'HP'));
        text(this.value, `${Math.max(0, Math.ceil(data.hp))} / ${data.max}`);
        text(this.level, `Lv. ${data.level}`);
        meter(this.bar, ratio, data.zh ? '生命值' : 'Health');
        meter(this.xp, hudRatio(data.xp, data.next), `XP ${data.xp}/${data.next}`);
        this.xp.title = `${data.xp} / ${data.next}`;
        this.shield.hidden = !data.shield; text(this.shield, data.shield);
    }
}

export interface WeaponHudData {
    key: string; name: string; type: string; ammo: number; capacity: number;
    reloading: boolean; reloadProgress: number; remaining?: number; zh: boolean;
}
export class WeaponHud {
    private icon: HTMLElement; private name: HTMLElement; private count: HTMLElement; private status: HTMLElement;
    private pips: HTMLElement; private bar: HTMLElement; private caption: HTMLElement;
    private iconKey = ''; private slotCount = -1;
    constructor(public readonly root: HTMLElement) {
        root.className = 'hud-paper weapon-card';
        root.innerHTML = `<div class="weapon-stamp" data-hud="icon"></div>
            <div class="hud-weapon-body"><div class="hud-weapon-heading"><b data-hud="name"></b><strong data-hud="count"></strong></div>
                <div class="ammo-pips" data-hud="pips" aria-hidden="true"></div>${track('reload','reload-meter')}
                <div class="hud-card-heading"><span data-hud="caption"></span><small data-hud="status"></small></div></div>`;
        this.icon = find(root,'icon'); this.name = find(root,'name'); this.count = find(root,'count');
        this.status = find(root,'status'); this.pips = find(root,'pips'); this.bar = find(root,'reload'); this.caption = find(root,'caption');
    }
    update(data: WeaponHudData) {
        const vehicle = data.remaining !== undefined;
        const unarmed = data.key === 'unarmed';
        const ammo = ammoModel(data.ammo, data.capacity, data.type === 'melee');
        const iconKey = vehicle ? 'vehicle' : weaponIcons[data.type] || 'brush';
        if (this.iconKey !== iconKey) { this.icon.innerHTML = hudIcon(iconKey); this.iconKey = iconKey; }
        text(this.caption, vehicle ? (data.zh ? '画笔成真 / PILOT' : 'PILOT') : (data.zh ? '主画笔 / BRUSH' : 'BRUSH'));
        text(this.name, data.name); this.name.title = data.name;
        text(this.count, vehicle ? `${Math.max(0, data.remaining!).toFixed(1)}s` : unarmed ? '—' : ammo.infinite ? '∞' : `${Math.max(0, Math.ceil(data.ammo))} / ${data.capacity}`);
        text(this.status, vehicle ? (data.zh ? '驾驶中' : 'PILOTING') : unarmed ? (data.zh ? '未装备' : 'UNARMED') : data.reloading
            ? `${data.zh ? '装填' : 'RELOAD'} ${Math.round(data.reloadProgress * 100)}%`
            : ammo.infinite ? (data.zh ? '近战 · 无需装填' : 'MELEE') : data.ammo <= 0 ? (data.zh ? '颜料用尽' : 'EMPTY') : (data.zh ? 'R 换弹' : 'R RELOAD'));
        this.root.dataset.state = vehicle ? 'vehicle' : data.reloading ? 'reloading' : !ammo.infinite && data.ammo <= 0 ? 'empty' : 'ready';
        const slots = vehicle || unarmed ? 0 : ammo.slots;
        if (slots !== this.slotCount) { this.pips.innerHTML = '<i><b></b></i>'.repeat(slots); this.slotCount = slots; }
        for (let i = 0; i < slots; i++) (this.pips.children[i] as HTMLElement).style.setProperty('--fill', `${ammo.fills[i] * 100}%`);
        this.pips.hidden = !slots;
        this.bar.hidden = !data.reloading || vehicle || unarmed;
        meter(this.bar, data.reloadProgress, data.zh ? '装填进度' : 'Reload progress');
    }
}

/** Read-only inspiration display; charging and piloting remain owned by MagicPenSystem. */
export class MagicHud {
    private label: HTMLElement; private count: HTMLElement; private bar: HTMLElement; private status: HTMLElement;
    constructor(public readonly root: HTMLElement) {
        root.innerHTML = `<div class="hud-magic-stamp">${hudIcon('brush')}</div>
            <div class="hud-magic-readout"><div class="hud-magic-heading"><kbd>G</kbd><span data-hud="label"></span><strong data-hud="count"></strong></div>
            ${track('inspiration', 'hud-magic-meter')}<small class="hud-magic-status" data-hud="status" hidden></small></div>`;
        this.label = find(root, 'label'); this.count = find(root, 'count');
        this.bar = find(root, 'inspiration'); this.status = find(root, 'status');
    }
    update(progress: number, maximum: number, piloting: boolean, zh: boolean, enabled: boolean) {
        this.root.hidden = !enabled;
        if (!enabled) return;
        const ready = !piloting && progress >= maximum;
        text(this.label, zh ? '画笔成真' : 'Brush to Life');
        text(this.count, `${progress} / ${maximum}`);
        text(this.status, piloting ? (zh ? '驾驶中' : 'Piloting') : ready ? (zh ? '就绪 · 按 G 描绘' : 'Ready · press G') : '');
        this.status.hidden = !piloting && !ready;
        meter(this.bar, hudRatio(progress, maximum), zh ? '画笔成真充能' : 'Brush to Life charge');
        this.root.dataset.ready = String(ready);
    }
}

export function mountDefenseHud(root: HTMLElement) {
    root.classList.add('hud-paper', 'guard-card');
    // The old HTML's inline dimensions must not defeat responsive HUD rules.
    root.style.cssText = 'display:none';
    root.innerHTML = `<div class="guard-seal">${hudIcon('shield')}</div><div class="guard-content">
        <div class="hud-card-heading"><span id="guard-caption">守卫记录 / CONSERVATION</span><b id="guard-time">20:00</b></div>
        <div class="guard-title"><b id="painting-name"></b><strong id="painting-integrity-label"></strong></div>
        <div class="ink-meter integrity-meter" id="painting-integrity-meter" role="progressbar" aria-label="画作完整度" aria-valuemin="0" aria-valuemax="100"><i id="painting-integrity-fill"></i></div>
        <div class="guard-footer"><span id="guard-condition"></span><span id="painting-alert" role="status"></span></div></div>`;
}

export function updateDefenseHud(root: HTMLElement, data: { name: string; integrity: number; attackers: number; remaining: number; zh: boolean }) {
    const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    const ratio = hudRatio(data.integrity, 1), percent = Math.round(ratio * 100);
    const state = integrityState(ratio);
    root.dataset.state = state; root.dataset.attacked = `${data.attackers > 0}`;
    text(el('painting-name'), data.name); el('painting-name').title = data.name;
    text(el('painting-integrity-label'), `${percent}%`);
    text(el('guard-caption'), data.zh ? '守卫记录 / CONSERVATION' : 'CONSERVATION');
    meter(el('painting-integrity-meter'), ratio, data.zh ? '画作完整度' : 'Artwork integrity');
    // Preserve this public element/width for existing UI consumers.
    el('painting-integrity-fill').style.width = `${percent}%`;
    text(el('guard-condition'), state === 'critical' ? (data.zh ? '濒临损毁' : 'CRITICAL')
        : state === 'worn' ? (data.zh ? '需要修复' : 'DAMAGED') : (data.zh ? '画作完好' : 'INTACT'));
    const seconds = Math.max(0, Math.ceil(data.remaining));
    text(el('guard-time'), `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`);
    text(el('painting-alert'), data.attackers > 0 ? (data.zh ? `！${data.attackers} 个橡皮擦正在擦画` : `! ${data.attackers} erasers attacking`)
        : (data.zh ? '攻击原画可修复笔迹' : 'Paint over the artwork to repair'));
}
