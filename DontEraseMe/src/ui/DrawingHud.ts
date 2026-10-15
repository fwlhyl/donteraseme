import { Weapon, WEAPONS } from '../components/Weapon';
import { Renderable } from '../components/Renderable';
import { Trail } from '../components/Trail';
import type { Entity } from '../core/Entity';
import { t } from '../i18n/index';
import './drawingHud.css';

/** Presentation only: the Game owns simulation time and session completion. */
export class DrawingHud {
    private root = document.createElement('section');
    private timer: HTMLOutputElement;
    private tools: HTMLSelectElement;
    private player: Entity | null = null;

    constructor(finish: () => void, clearInput: () => void) {
        this.root.id = 'drawing-hud';
        this.root.dataset.gameInputBlock = '';
        this.root.hidden = true;
        this.root.setAttribute('aria-label', '纯画画工具栏');
        this.root.innerHTML = `<div class="drawing-heading"><b>纯画画 · 收藏家</b><output id="drawing-timer">20:00</output></div>
            <p>无限颜料 · 没有敌人 · 笔迹不褪色</p>
            <label>画笔 <select id="drawing-weapon" aria-label="已解锁画笔"></select></label>
            <label>颜色 <input id="drawing-color" type="color" value="#287ac0" aria-label="画笔颜色"></label>
            <div class="drawing-actions"><button id="drawing-pause" type="button">暂停 / Esc</button><button id="drawing-finish" type="button">完成作品</button></div>
            <small>WASD 移动 · 按住鼠标绘画<br>下拉菜单切换全部已解锁画笔；1–9 快捷切换<br>完成后可回放、保存画廊或导出 PNG</small>`;
        this.timer = this.root.querySelector('output')!;
        this.tools = this.root.querySelector('select')!;
        this.tools.addEventListener('change', () => {
            const weapon = this.player?.getComponent(Weapon);
            const id = Number(this.tools.value);
            if (weapon?.unlocked.has(id)) {
                weapon.currentWeaponIndex = id;
                weapon.reloading = false;
                weapon.reloadTimer = 0;
                weapon.cooldown = 0;
            }
            clearInput(); this.tools.blur();
        });
        this.root.querySelector<HTMLInputElement>('#drawing-color')!.addEventListener('input', event => {
            const color = (event.target as HTMLInputElement).value;
            const renderable = this.player?.getComponent(Renderable), trail = this.player?.getComponent(Trail);
            if (renderable) renderable.color = color;
            if (trail) trail.color = color;
            clearInput();
        });
        this.root.querySelector<HTMLInputElement>('#drawing-color')!.addEventListener('change', event => {
            clearInput(); (event.target as HTMLInputElement).blur();
        });
        this.root.querySelector('#drawing-pause')!.addEventListener('click', () => {
            clearInput(); window.dispatchEvent(new CustomEvent('open-esc'));
        });
        this.root.querySelector('#drawing-finish')!.addEventListener('click', finish);
        document.body.append(this.root);
    }

    show(player: Entity): void {
        this.player = player;
        this.tools.replaceChildren();
        const weapon = player.getComponent(Weapon)!;
        for (const config of WEAPONS) {
            if (!weapon.unlocked.has(config.id)) continue;
            const option = document.createElement('option');
            option.value = String(config.id); option.textContent = t(config.name);
            this.tools.append(option);
        }
        this.root.querySelector<HTMLInputElement>('#drawing-color')!.value = player.getComponent(Renderable)!.color;
        this.root.hidden = false;
        this.update(20 * 60);
    }

    update(remaining: number): void {
        const seconds = Math.max(0, Math.ceil(remaining));
        const text = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        if (this.timer.textContent !== text) this.timer.textContent = text;
        const index = this.player?.getComponent(Weapon)?.currentWeaponIndex;
        if (index !== undefined && this.tools.value !== String(index)) this.tools.value = String(index);
    }

    hide(): void { this.root.hidden = true; this.player = null; }
}
