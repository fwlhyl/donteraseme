import { System } from '../core/System';
import { Weapon } from '../components/Weapon';
import { PlayerControl } from '../components/PlayerControl';
import { Health } from '../components/Health'; // Import Health
import { Skill } from '../components/Skill';
import { Score } from '../components/Score'; // Import Score
import { Renderable } from '../components/Renderable';
import { Trail } from '../components/Trail';
import { Transform } from '../components/Transform'; // Import Transform
import { Experience } from '../components/Experience';
import { Quest } from '../components/Quest';
import { PlayerStats } from '../components/PlayerStats';
import { MagicManifestation } from '../components/MagicManifestation';
import { t, getLang } from '../i18n/index';
import { HealthHud, WeaponHud, hudRatio } from '../ui/CombatHud';

export class UISystem extends System {
    private uiContainer: HTMLElement;
    private weaponDisplay: HTMLElement;
    private statsDisplay: HTMLElement; // Add Stats Display
    private scoreDisplay: HTMLElement;
    private eyeDisplay: HTMLElement;
    private healthHud: HealthHud;
    private weaponHud: WeaponHud;
    private announceEl: HTMLElement | null = null;
    private escModal: HTMLElement | null = null;

    private pauseBtn: HTMLElement;
    private pauseMenu: HTMLElement;
    private resumeBtn: HTMLElement;
    private colorPalette: HTMLElement;

    private isPaused: boolean = false;
    private toolWheel: HTMLElement | null = null;

    constructor() {
        super();
        this.uiContainer = document.getElementById('ui')!;
        
        // Score Display
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.className = 'hud-note hud-score';
        this.uiContainer.appendChild(this.scoreDisplay);

        // Stats Display (Wave, HP)
        this.statsDisplay = document.createElement('div');
        this.statsDisplay.className = 'hud-note hud-stats';
        this.uiContainer.appendChild(this.statsDisplay);

        // Create Weapon Display
        this.weaponDisplay = document.createElement('div');
        this.weaponDisplay.className = 'hud-note hud-weapon';
        this.uiContainer.appendChild(this.weaponDisplay);
        this.healthHud = new HealthHud(this.statsDisplay);
        this.weaponHud = new WeaponHud(this.weaponDisplay);

        // Canvas Eye Health Display (for story mode)
        this.eyeDisplay = document.createElement('div');
        this.eyeDisplay.className = 'hud-note hud-eye';
        this.eyeDisplay.style.display = 'none'; // Hidden by default
        this.uiContainer.appendChild(this.eyeDisplay);

        // Pause Menu Elements
        this.pauseBtn = document.getElementById('pause-btn')!;
        this.pauseMenu = document.getElementById('pause-menu')!;
        this.resumeBtn = document.getElementById('resume-btn')!;
        this.colorPalette = document.getElementById('color-palette')!;

        this.setupPauseMenu();
        this.setupPerkModal();
        this.setupAnnounce();
        this.setupToolWheel();
        this.setupEscModal();
    }

    private setupPauseMenu() {
        // Toggle Pause
        this.pauseBtn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('open-esc'));
        });

        this.resumeBtn.addEventListener('click', () => {
            this.dismissPause();
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
        });

        // Colors
        const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#000000'];
        colors.forEach(color => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'palette-swatch';
            swatch.setAttribute('aria-label', `${getLang() === 'zh' ? '笔迹颜色' : 'Ink color'} ${color}`);
            swatch.setAttribute('aria-pressed', 'false');
            // These small samples represent actual drawing colors, not UI rarity.
            swatch.style.backgroundColor = color;
            
            swatch.addEventListener('click', () => {
                this.updatePlayerSettings('color', color);
                // Highlight selection
                Array.from(this.colorPalette.children).forEach(c => {
                    c.classList.remove('is-selected');
                    c.setAttribute('aria-pressed', 'false');
                });
                swatch.classList.add('is-selected');
                swatch.setAttribute('aria-pressed', 'true');
            });
            this.colorPalette.appendChild(swatch);
        });

        // Damage Numbers Toggle
        const damageNumbersCheckbox = document.getElementById('setting-damage-numbers') as HTMLInputElement;
        if (damageNumbersCheckbox) {
            // Set initial state from Game
            if ((window as any).gameInstance) {
                damageNumbersCheckbox.checked = (window as any).gameInstance.showDamageNumbers;
            }
            
            damageNumbersCheckbox.addEventListener('change', (e: any) => {
                if ((window as any).gameInstance) {
                    (window as any).gameInstance.showDamageNumbers = e.target.checked;
                }
            });
        }

        // Auto Attack Toggle
        const autoAttackCheckbox = document.getElementById('setting-auto-attack') as HTMLInputElement;
        if (autoAttackCheckbox) {
            if ((window as any).gameInstance) {
                autoAttackCheckbox.checked = (window as any).gameInstance.autoAttackEnabled;
            }
            
            autoAttackCheckbox.addEventListener('change', (e: any) => {
                if ((window as any).gameInstance) {
                    (window as any).gameInstance.autoAttackEnabled = e.target.checked;
                }
            });
        }
    }

    private setupAnnounce() {
        const el = document.createElement('div');
        el.className = 'sketch-announce';
        el.style.display = 'none';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
        this.announceEl = el;
        window.addEventListener('announce', (e: any) => {
            let text = e.detail?.text || '';
            // Basic heuristic to translate common dynamic strings
            if (getLang() === 'en') {
                text = text.replace('警告：第 ', 'WARNING: Phase ')
                           .replace(' 阶段 BOSS ', ' BOSS ')
                           .replace(' 降临！', ' has arrived!')
                           .replace('激战开始！击败BOSS获取专属觉醒！', 'Battle start! Defeat BOSS for Awakening!')
                           .replace('【领主】降临，清理场地！', '[Lord] arrives, clearing the field!')
                           .replace('你捡起了一支掉落的【基础画笔】！', 'You picked up a dropped [Basic Brush]!')
                           .replace('画眼被摧毁！防守失败。', 'Canvas Eye destroyed! Defense failed.')
                           .replace('作品已保存至画框', 'Artwork saved to Frame');
            }
            if (!this.announceEl) return;
            this.announceEl.textContent = t(text);
            this.announceEl.style.display = 'block';
            this.announceEl.style.opacity = '1';
            setTimeout(() => {
                if (!this.announceEl) return;
                this.announceEl.style.transition = 'opacity 0.6s';
                this.announceEl.style.opacity = '0';
                setTimeout(() => {
                    if (this.announceEl) {
                        this.announceEl.style.display = 'none';
                        this.announceEl.style.transition = '';
                    }
                }, 700);
            }, 1600);
        });
    }

    private setupToolWheel() {
        // Tab skill UI removed per user request
    }

    private setupPerkModal() {
        // choose-perk modal UI removed per user request (replaced by automatic rewards)
    }

    private setupEscModal() {
        const overlay = document.createElement('div');
        overlay.className = 'sketch-esc-overlay';
        overlay.style.display = 'none';
        const panel = document.createElement('div');
        panel.className = 'sketch-dialog';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'escape-dialog-title');
        const heading = document.createElement('h2');
        heading.id = 'escape-dialog-title';
        heading.className = 'dialog-heading';
        heading.textContent = getLang() === 'zh' ? '对局暂停' : 'PAUSED';
        const copy = document.createElement('p');
        copy.className = 'dialog-copy';
        copy.textContent = getLang() === 'zh' ? '暂留此刻。保存笔迹，或继续抵抗抹除。' : 'Hold this moment. Preserve your marks, or resist erasure.';
        panel.append(heading, copy);
        // The pause button and Escape share one panel and one set of controls.
        for (const group of Array.from(this.pauseMenu.querySelectorAll('.setting-group'))) panel.appendChild(group);
        const btnSaveFrame = document.createElement('button');
        btnSaveFrame.className = 'btn';
        btnSaveFrame.textContent = '保存当前作品到画廊';
        const btnSaveLocal = document.createElement('button');
        btnSaveLocal.className = 'btn';
        btnSaveLocal.textContent = t('保存作品到本地');
        const btnExit = document.createElement('button');
        btnExit.className = 'btn btn-danger';
        btnExit.textContent = t('退出当前对局');
        
        window.addEventListener('lang-changed', () => {
            heading.textContent = getLang() === 'zh' ? '对局暂停' : 'PAUSED';
            copy.textContent = getLang() === 'zh' ? '暂留此刻。保存笔迹，或继续抵抗抹除。' : 'Hold this moment. Preserve your marks, or resist erasure.';
            btnSaveFrame.textContent = '保存当前作品到画廊';
            btnSaveLocal.textContent = t('保存作品到本地');
            btnExit.textContent = t('退出当前对局');
        });
        
        panel.appendChild(btnSaveFrame);
        panel.appendChild(btnSaveLocal);
        panel.appendChild(btnExit);
        const resume = document.createElement('button');
        resume.className = 'btn btn-primary'; resume.textContent = '继续 / Esc';
        resume.onclick = () => {
            this.dismissPause();
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
        };
        panel.appendChild(resume);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        this.escModal = overlay;
        btnSaveFrame.onclick = () => {
            // Use the same awaited save dialog as settlement. Keep this pause
            // menu underneath so failure/retry cannot silently resume combat.
            window.dispatchEvent(new CustomEvent('save-art-local'));
        };
        btnSaveLocal.onclick = () => {
            window.dispatchEvent(new CustomEvent('export-art-png'));
        };
        btnExit.onclick = () => {
            if (this.escModal) this.escModal.style.display = 'none';
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
            window.dispatchEvent(new CustomEvent('exit-run'));
        };
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                
                // 仅在游戏进行中允许打开ESC菜单（1 = GameState.PLAYING）
                const gameInstance = (window as any).gameInstance;
                if (gameInstance && gameInstance.state !== 1) return;
                btnExit.textContent = gameInstance?.currentMode === 'drawing' ? '完成绘画并查看作品' : t('退出当前对局');
                const frameDialog = document.getElementById('frame-save-modal');
                if (frameDialog?.style.display === 'flex') {
                    frameDialog.style.display = 'none';
                    return;
                }
                
                if (!this.escModal) return;
                const showing = this.escModal.style.display === 'flex';
                if (!showing) {
                    this.escModal.style.display = 'flex';
                    window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: true } }));
                } else {
                    this.escModal.style.display = 'none';
                    window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
                }
            }
        });
        window.addEventListener('open-esc', () => {
            const game = (window as any).gameInstance;
            if (game?.state !== 1) return;
            btnExit.textContent = game?.currentMode === 'drawing' ? '完成绘画并查看作品' : t('退出当前对局');
            if (!this.escModal) return;
            this.escModal.style.display = 'flex';
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: true } }));
        });
    }

    private applyPerk(label: string) {
        // choose-perk logic removed per user request
    }

    public dismissPause(): void {
        this.isPaused = false;
        this.pauseMenu.style.display = 'none';
        if (this.escModal) this.escModal.style.display = 'none';
    }

    private updatePlayerSettings(key: string, value: any) {
        for (const entity of this.entities) {
            if (entity.tags.has('player')) {
                if (key === 'color') {
                    const renderable = entity.getComponent(Renderable);
                    if (renderable) renderable.color = value;
                    const trail = entity.getComponent(Trail);
                    if (trail) trail.color = value;
                }
            }
        }
    }

    public update(dt: number): void {
        let canvasEyeHealth: number | null = null;
        let canvasEyeMax: number | null = null;

        for (const entity of this.entities) {
            if (entity.tags.has('canvas_eye')) {
                const health = entity.getComponent(Health);
                if (health) {
                    canvasEyeHealth = health.current;
                    canvasEyeMax = health.max;
                }
            }
        }

        if (canvasEyeHealth !== null && canvasEyeMax !== null) {
            this.eyeDisplay.style.display = 'block';
            this.eyeDisplay.textContent = `${getLang() === 'zh' ? '画眼耐久度' : 'Canvas Eye HP'}: ${Math.ceil(canvasEyeHealth)} / ${canvasEyeMax}`;
        } else {
            this.eyeDisplay.style.display = 'none';
        }

        for (const entity of this.entities) {
            if (entity.tags.has('player')) {
                const weapon = entity.getComponent(Weapon);
                const health = entity.getComponent(Health); // Get Player Health
                const skill = entity.getComponent(Skill);
                const score = entity.getComponent(Score);
                
                if (score) {
                    const label = getLang() === 'zh' ? `得分 ${score.value} · 金币 ${score.coins}` : `SCORE ${score.value} · COINS ${score.coins}`;
                    if (this.scoreDisplay.textContent !== label) this.scoreDisplay.textContent = label;
                }

                // Update Stats
                const exp = entity.getComponent(Experience);
                const stats = entity.getComponent(PlayerStats);
                if (health) {
                    let shieldTxt = '';
                    if (stats && stats.characterId === 'classical') {
                        if (stats.hasClassicalShield) shieldTxt = getLang() === 'zh' ? '  [厚涂护盾: 就绪]' : '  [Impasto Shield: Ready]';
                        else shieldTxt = getLang() === 'zh' ? `  [厚涂护盾: ${(stats.shieldCooldownFrames / 60).toFixed(1)}秒]` : `  [Impasto Shield: ${(stats.shieldCooldownFrames / 60).toFixed(1)}s]`;
                    }
                    this.healthHud.update({ id: entity.id, hp: health.current, max: health.max,
                        level: exp?.level ?? 1, xp: exp?.xp ?? 0, next: exp?.next ?? 100,
                        shield: shieldTxt, zh: getLang() === 'zh' }, dt);
                }

                if (weapon) {
                    const pilotedVehicle = Array.from(this.entities).find(candidate => {
                        const manifestation = candidate.getComponent(MagicManifestation);
                        return candidate.active && manifestation?.ownerId === entity.id;
                    })?.getComponent(MagicManifestation);

                    if (pilotedVehicle) {
                        const names = getLang() === 'zh'
                            ? { tank: '坦克', robot: '机器人', bomber: '轰炸机' }
                            : { tank: 'Tank', robot: 'Robot', bomber: 'Bomber' };
                        this.weaponHud.update({ key: pilotedVehicle.type, name: names[pilotedVehicle.type], type: 'vehicle',
                            ammo: 0, capacity: 0, reloading: false, reloadProgress: 0,
                            remaining: pilotedVehicle.remainingFrames / 60, zh: getLang() === 'zh' });
                    } else {
                        const config = weapon.config;
                        if (config) {
                            const ammo = weapon.ammo[weapon.currentWeaponIndex] ?? 0;
                            const reloadFrames = Math.max(1, Math.floor(config.reloadTime * weapon.reloadTimeMul / (stats?.totalReloadMultiplier ?? 1)));
                            this.weaponHud.update({ key: `${config.id}`, name: t(config.name), type: config.type,
                                ammo, capacity: config.magSize, reloading: weapon.reloading,
                                reloadProgress: 1 - hudRatio(weapon.reloadTimer, reloadFrames), zh: getLang() === 'zh' });
                        } else {
                            this.weaponHud.update({ key: 'unarmed', name: getLang() === 'zh' ? '尚未装备画笔' : 'Unarmed',
                                type: 'standard', ammo: 0, capacity: 0, reloading: false, reloadProgress: 0, zh: getLang() === 'zh' });
                        }
                    }
                }
                
                const quest = entity.getComponent(Quest);
                if (quest && quest.active && quest.steps[quest.index]) {
                    const step = quest.steps[quest.index];
                    if (step.type === 'defend') {
                        const duration = step.duration || 120;
                        const elapsed = step.elapsed || 0;
                        const remaining = Math.max(0, Math.ceil((duration * 60 - elapsed) / 60)); // Assuming 60 FPS for dt
                        this.eyeDisplay.textContent += getLang() === 'zh' ? `  |  防守剩余时间: ${remaining}秒` : `  |  Defend Time Left: ${remaining}s`;
                    }
                }
            }
        }
    }
}
