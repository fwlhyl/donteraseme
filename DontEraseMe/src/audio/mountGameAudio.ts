import { Game, GameState } from '../core/Game';
import { Transform } from '../components/Transform';
import { AudioDirector } from './AudioDirector';
import { AUDIO_URLS } from './AudioAssets';
import { listenGameSounds } from './AudioEvents';
import './audioControls.css';

/** Audio is an optional presentation observer; no timers modify gameplay state. */
export function mountGameAudio(game: Game): AudioDirector {
    const audio = new AudioDirector(AUDIO_URLS, () => {
        const combat = game.state === GameState.PLAYING;
        let position: Transform | undefined;
        if (combat) for (const entity of game.entities.values()) {
            if (entity.tags.has('player')) { position = entity.getComponent(Transform); break; }
        }
        return { music: game.state === GameState.GAMEOVER ? null : combat
            ? (game.currentMode === 'defense' ? 'ruins' : 'atelier') : 'menu',
        combat, paused: combat && !game.isRunning,
        x: position?.x ?? game.worldWidth / 2, y: position?.y ?? game.worldHeight / 2 };
    });
    const unsubscribe = listenGameSounds((cue, options) => audio.play(cue, options));
    const controller = new AbortController(), signal = controller.signal;
    const unlock = () => { void audio.unlock(); };
    window.addEventListener('pointerdown', unlock, { signal, capture: true });
    window.addEventListener('keydown', unlock, { signal, capture: true });
    document.addEventListener('visibilitychange', () => { void audio.setHidden(document.hidden); }, { signal });
    document.addEventListener('click', event => {
        const button = (event.target as Element | null)?.closest('button');
        if (button && !(button as HTMLButtonElement).disabled) audio.play('ui-click');
    }, { signal });
    window.addEventListener('player-levelup', () => { audio.sync(); audio.play('level-up'); }, { signal });
    window.addEventListener('boss-killed', () => { audio.sync(); audio.play('level-up'); }, { signal });
    window.addEventListener('game-pause', () => audio.sync(), { signal });

    // Only add controls inside existing settings/pause panels; no extra combat HUD.
    const groups: HTMLElement[] = [];
    function controls(compact: boolean): HTMLElement {
        const element = document.createElement('fieldset');
        element.className = 'audio-controls';
        element.innerHTML = `<legend>声音 / Audio</legend>
            ${(['master', 'music', 'effects'] as const).map((key, index) => `<label>
                <span>${['总音量 / Master', '音乐 / Music', '音效 / Effects'][index]}</span>
                <input data-audio="${key}" type="range" min="0" max="100" step="1" aria-label="${['总音量', '音乐音量', '音效音量'][index]}">
                <output data-output="${key}"></output></label>`).join('')}
            <label class="audio-mute"><input type="checkbox" data-audio="muted"> 静音 / Mute</label>
            ${compact ? '' : '<small data-audio-status>点击或按键后启用声音</small>'}`;
        element.addEventListener('input', event => {
            const input = event.target as HTMLInputElement, key = input.dataset.audio;
            if (key === 'muted') audio.setSettings({ muted: input.checked });
            else if (key === 'master' || key === 'music' || key === 'effects') audio.setSettings({ [key]: Number(input.value) / 100 });
            refresh();
        }, { signal });
        groups.push(element); return element;
    }
    function refresh(): void {
        for (const group of groups) {
            for (const key of ['master', 'music', 'effects'] as const) {
                const value = Math.round(audio.settings[key] * 100);
                (group.querySelector(`[data-audio="${key}"]`) as HTMLInputElement).value = String(value);
                group.querySelector(`[data-output="${key}"]`)!.textContent = `${value}%`;
            }
            (group.querySelector('[data-audio="muted"]') as HTMLInputElement).checked = audio.settings.muted;
        }
    }
    document.getElementById('close-settings-btn')?.before(controls(false));
    document.querySelector('.sketch-esc-overlay .sketch-dialog')?.append(controls(true));
    refresh();
    audio.onStatus(message => { for (const group of groups) { const status = group.querySelector('[data-audio-status]'); if (status) status.textContent = message; } });
    let frame = 0, last = 0;
    function tick(now: number): void {
        if (now - last > 50) { audio.sync(); last = now; }
        frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    audio.attachCleanup(() => { unsubscribe(); controller.abort(); cancelAnimationFrame(frame); for (const group of groups) group.remove(); });
    window.addEventListener('pagehide', () => { audio.dispose(); }, { signal, once: true });
    return audio;
}
