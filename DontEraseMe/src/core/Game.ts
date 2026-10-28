import { Entity } from './Entity';
import { System } from './System';
import { InputManager } from './InputManager';
import { InputSystem } from '../systems/InputSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { mountDefenseHud, updateDefenseHud as renderDefenseHud } from '../ui/CombatHud';
import { courtyard } from '../world/CourtyardGeometry';
import { CourtyardBoundarySystem } from '../systems/CourtyardBoundarySystem';
import { TrailSystem } from '../systems/TrailSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { UISystem } from '../systems/UISystem';
import { EnemySystem } from '../systems/EnemySystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { WaveSystem } from '../systems/WaveSystem';
import { MinimapSystem } from '../systems/MinimapSystem';
import { SkillSystem } from '../systems/SkillSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { GraffitiSystem } from '../systems/GraffitiSystem';
import { DamageTextSystem } from '../systems/DamageTextSystem';
import { PlayerFactory } from '../entities/PlayerFactory';
import { EnemyFactory } from '../entities/EnemyFactory';
import { SkeletonSystem } from '../systems/SkeletonSystem';
import { ObjectiveSystem } from '../systems/ObjectiveSystem';
import { LevelSystem } from '../systems/LevelSystem';
import { SummonSystem } from '../systems/SummonSystem';
import { MagicPenSystem } from '../systems/MagicPenSystem';
import { Experience } from '../components/Experience';
import { Weapon } from '../components/Weapon';
import { Transform } from '../components/Transform';
import { Health } from '../components/Health';
import { Velocity } from '../components/Velocity';
import { Score } from '../components/Score';
import { Quest } from '../components/Quest';
import { StoryState } from '../components/StoryState';
import { Renderable } from '../components/Renderable';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { PrologueSystem } from '../systems/PrologueSystem';
import { CHARACTERS } from '../config/EndlessConfig';
import { WEAPONS, getWeaponUnlockPrice } from '../components/Weapon';
import { PlayerStats } from '../components/PlayerStats';
import { PlayerProfile, type PlayerProfileData } from './PlayerProfile';
import { DefensePainting } from './DefensePainting';
import { ArtReplayRecording } from './ArtReplayRecording';
import { ArtReplayPlayer } from './ArtReplayPlayer';
import { DefenseArtworkPicker } from './DefenseArtworkPicker';
import { DefenseIntro } from './DefenseIntro';
import { ArtworkStore } from './ArtworkStore';
import type { DefenseArtwork } from './DefenseArtwork';
import { CREATE_WORLD, DEFENSE_WORLD } from '../config/WorldConfig';
import { emitGameSound } from '../audio/AudioEvents';
import { DrawingHud } from '../ui/DrawingHud';
import { OutcomePortrait } from '../ui/OutcomePortrait';
import { GalleryStore } from './GalleryStore';
import type { ArtGallery } from '../gallery/ArtGallery';
import { Skill } from '../components/Skill';
import { Trail } from '../components/Trail';

import { SKILLS, SkillCategory } from '../config/EndlessConfig';
import type { SkillConfig } from '../config/EndlessConfig';

import { setLang, getLang, t } from '../i18n/index';

// Cap screen rendering only; artwork canvases keep their world resolution.
const MAX_GAME_DPR = 1; // Mac A/B trial; use 1.5 to compare screen sharpness.

export enum GameState {
    MENU,
    PLAYING,
    GAMEOVER,
    STUDIO,
    SELECTION, // 新增状态：选人界面
    REPLAY,
    DEFENSE_INTRO,
    GALLERY
}

export type PlayMode = 'story' | 'endless' | 'defense' | 'drawing';
type SelectablePlayMode = 'endless' | 'defense';

export class Game {
    public entities: Map<string, Entity> = new Map();
    public systems: System[] = [];
    public lastTime: number = 0;
    public isRunning: boolean = false;
    public state: GameState = GameState.MENU; // Default state
    
    public gameCanvas: HTMLCanvasElement;
    public gameCtx: CanvasRenderingContext2D;
    public trailCanvas: HTMLCanvasElement;
    public trailCtx: CanvasRenderingContext2D;
    public paintingCanvas: HTMLCanvasElement;
    public minimapCanvas: HTMLCanvasElement;
    public minimapCtx: CanvasRenderingContext2D;
    
    // UI Elements
    private mainMenu: HTMLElement;
    private selectionScreen: HTMLElement;
    private gameOverMenu: HTMLElement;
    private outcomePortrait!: OutcomePortrait;
    private gameUI: HTMLElement;
    private scoreDisplay: HTMLElement;
    private levelUpScreen: HTMLElement;
    private defenseHud: HTMLElement;

    // Selected Data
    public selectedCharacterId: string | null = null;
    public selectedWeaponId: number | null = null;
    public showDamageNumbers: boolean = true;
    public autoAttackEnabled: boolean = false;
    private hasSettledCurrentRun: boolean = false;
    private pendingMode: SelectablePlayMode = 'endless';

    public width: number = window.innerWidth;
    public height: number = window.innerHeight;
    public worldWidth: number = CREATE_WORLD.width;
    public worldHeight: number = CREATE_WORLD.height;
    public camera: { x: number, y: number, shakeX: number, shakeY: number, shakeTimer: number } = { x: 0, y: 0, shakeX: 0, shakeY: 0, shakeTimer: 0 };

    // Systems references
    private waveSystem!: WaveSystem;
    private courtyardBoundary!: CourtyardBoundarySystem;
    private defensePainting!: DefensePainting;
    private defenseElapsed: number = 0;
    private defenseIntegrityTick: number = 0;
    private lastDefenseRepairAt: number = 0;
    private defenseFailureMessage: string = '';
    private readonly artRecording = new ArtReplayRecording();
    private readonly artReplay = new ArtReplayPlayer();
    private animationFrame = 0;
    private readonly defenseIntro = new DefenseIntro();
    private readonly artworkPicker: DefenseArtworkPicker;
    private runGeneration = 0;
    private frameUrls = new Map<number, string>();
    private frameLoadGeneration = 0;
    private savingFrame = false;
    private frameStorageWarningShown = false;
    private drawingElapsed = 0;
    private readonly drawingDuration = 20 * 60;
    private readonly drawingHud = new DrawingHud(() => this.finishDrawing(), () => this.clearInput());
    private gallery: ArtGallery | null = null;
    private galleryGeneration = 0;
    private savedGalleryId: string | undefined;
    private savingGallery = false;

    public inputManager: InputManager;
    public currentMode: PlayMode = 'endless';
    private studioTimeLeft: number = 0;
    private lastRatingTick: number = 0;
    private lastBuffTime: number = 0;
    private lastEliteTime: number = 0;
    private ratingCanvas: HTMLCanvasElement;
    private ratingCtx: CanvasRenderingContext2D;
    private ratingInterval: number = 1;

    constructor() {
        // Setup canvases
        this.gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.trailCanvas = document.getElementById('trailCanvas') as HTMLCanvasElement;
        this.paintingCanvas = document.getElementById('paintingCanvas') as HTMLCanvasElement;
        this.minimapCanvas = document.getElementById('minimapCanvas') as HTMLCanvasElement;
        
        // Setup UI
        this.mainMenu = document.getElementById('main-menu')!;
        this.selectionScreen = document.getElementById('selection-screen')!;
        this.gameOverMenu = document.getElementById('game-over')!;
        this.outcomePortrait = new OutcomePortrait(this.gameOverMenu);
        this.gameUI = document.getElementById('ui')!;
        this.scoreDisplay = document.getElementById('final-score')!;
        this.levelUpScreen = document.getElementById('level-up-screen')!;
        this.defenseHud = document.getElementById('defense-hud')!;
        mountDefenseHud(this.defenseHud);
        const artworkHost = document.createElement('section');
        artworkHost.id = 'defense-artwork-section';
        this.selectionScreen.insertBefore(artworkHost, this.selectionScreen.querySelector('.selection-container'));
        this.artworkPicker = new DefenseArtworkPicker(artworkHost);

        if (!this.gameCanvas || !this.trailCanvas || !this.paintingCanvas || !this.minimapCanvas) {
            throw new Error('Canvas elements not found');
        }

        this.gameCtx = this.gameCanvas.getContext('2d')!;
        this.trailCtx = this.artRecording.log.wrapContext(this.trailCanvas.getContext('2d')!);
        this.minimapCtx = this.minimapCanvas.getContext('2d')!;
        this.defensePainting = new DefensePainting(this.paintingCanvas, this.worldWidth, this.worldHeight);
        this.defensePainting.onErase = (...args) => this.artRecording.log.recordErase(...args);
        this.defensePainting.onRepair = (...args) => this.artRecording.log.recordRepair(...args);
        
        // 关闭平滑抗锯齿，增强像素风
        this.gameCtx.imageSmoothingEnabled = false;
        this.trailCtx.imageSmoothingEnabled = false;
        
        this.ratingCanvas = document.createElement('canvas');
        this.ratingCanvas.width = 64;
        this.ratingCanvas.height = 64;
        this.ratingCtx = this.ratingCanvas.getContext('2d')!;

        // Debug: Log canvas sizes and z-indexes
        console.log('GameCanvas:', this.gameCanvas.width, this.gameCanvas.height, this.gameCanvas.style.zIndex);
        console.log('TrailCanvas:', this.trailCanvas.width, this.trailCanvas.height, this.trailCanvas.style.zIndex);
        
        // Ensure gameCanvas is on top
        this.gameCanvas.style.zIndex = '10';
        this.paintingCanvas.style.zIndex = '0';
        this.trailCanvas.style.zIndex = '1';

        this.inputManager = new InputManager();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.setupSystems();
        
        // Gallery migrates the legacy frames lazily, without loading full PNGs on the menu.
        // Entities are setup on Start Game now
        // this.setupEntities();

        // Bind Buttons
        const storyBtn = document.getElementById('story-btn');
        if (storyBtn) storyBtn.addEventListener('click', () => this.startGame('story'));
        
        const createModeBtn = document.getElementById('create-mode-btn');
        if (createModeBtn) createModeBtn.addEventListener('click', () => this.showSelectionScreen('endless'));

        const defenseModeBtn = document.getElementById('defense-mode-btn');
        if (defenseModeBtn) defenseModeBtn.addEventListener('click', () => this.showSelectionScreen('defense'));
        document.getElementById('drawing-mode-btn')?.addEventListener('click', () => this.startGame('drawing'));
        document.getElementById('gallery-btn')?.addEventListener('click', () => { void this.openGallery(); });
        document.getElementById('gallery-save-confirm')?.addEventListener('click', () => { void this.saveToGallery(); });

        const startRunBtn = document.getElementById('start-run-btn');
        if (startRunBtn) startRunBtn.addEventListener('click', () => this.startGame(this.pendingMode));

        const backToMenuBtn = document.getElementById('back-to-menu-btn');
        if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => {
            this.state = GameState.MENU;
            this.selectionScreen.style.display = 'none';
            this.mainMenu.style.display = 'flex';
            this.paintingCanvas.style.display = 'none';
            this.setDefenseHudVisible(false);
            window.scrollTo(0, 0);
        });
        
        const editorBtn = document.getElementById('editor-btn');
        if (editorBtn) editorBtn.addEventListener('click', () => {
            window.location.href = '/editor.html';
        });

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.addEventListener('click', () => this.startGame(this.currentMode));
        document.getElementById('replay-btn')?.addEventListener('click', () => this.openArtReplay());

        // Save Button
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            this.showGallerySaveDialog();
        });
        
        // Frame Selection Modal Listeners
        const frameBtns = document.querySelectorAll('.frame-select-btn');
        frameBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '1');
                const saved = await this.saveImageToFrame(index);
                const modal = document.getElementById('frame-save-modal');
                if (saved && modal) modal.style.display = 'none';
            });
        });
        
        const cancelFrameBtn = document.getElementById('cancel-frame-save');
        document.getElementById('export-art-png')?.addEventListener('click', () => this.saveImage());
        window.addEventListener('export-art-png', () => this.saveImage());
        if (cancelFrameBtn) {
            cancelFrameBtn.addEventListener('click', () => {
                const modal = document.getElementById('frame-save-modal');
                if (modal) modal.style.display = 'none';
            });
        }

        window.addEventListener('add-entity', (e: any) => {
            this.addEntity(e.detail.entity);
        });
        window.addEventListener('explosion', (e: any) => {
            this.handleExplosion(e.detail.x, e.detail.y, e.detail.radius, e.detail.damage);
        });
        window.addEventListener('start-act1', () => {
            this.startAct1();
        });

        // Pause Listener
        window.addEventListener('game-pause', (e: any) => {
            if (this.state !== GameState.PLAYING && this.state !== GameState.STUDIO) return;
            if (e.detail.paused) {
                this.stop();
            } else {
                this.start();
            }
            this.clearInput();
        });
        window.addEventListener('game-over', (e: any) => this.gameOver(e.detail?.score, e.detail?.victory));
        window.addEventListener('player-painted', (e: Event) => {
            this.handleDefenseRepair((e as CustomEvent).detail);
        });
        window.addEventListener('magic-pen-drawn', (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (this.state !== GameState.PLAYING || !Array.isArray(detail?.strokes)) return;
            this.artRecording.log.recordMagicDrawing({
                type: detail.type, grade: detail.grade, strokes: detail.strokes,
                width: detail.width || 640, height: detail.height || 360,
            });
        });
        
        window.addEventListener('player-levelup', (e: any) => this.showLevelUpScreen(e.detail.entityId));
        window.addEventListener('boss-killed', (e: any) => this.showBossAwakeningScreen(e.detail.bossPhase));
        
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back to Main Menu';
        backBtn.id = 'back-main-btn';
        if (this.gameOverMenu) {
            this.gameOverMenu.appendChild(backBtn);
            const restartBtnEl = document.getElementById('restart-btn') as HTMLElement | null;
            if (restartBtnEl) {
                backBtn.className = restartBtnEl.className;
                backBtn.style.cssText = restartBtnEl.getAttribute('style') || backBtn.style.cssText;
            }
            backBtn.addEventListener('click', () => {
                this.stop();
                this.artReplay.close(false);
                this.artRecording.clear();
                this.state = GameState.MENU;
                if (this.mainMenu) this.mainMenu.style.display = 'flex';
                if (this.gameOverMenu) this.gameOverMenu.style.display = 'none';
                if (this.gameUI) this.gameUI.style.display = 'none';
                if (this.minimapCanvas) this.minimapCanvas.style.display = 'none';
                this.setCombatFieldNotesVisible(false);
                if (this.levelUpScreen) this.levelUpScreen.style.display = 'none';
                if (this.paintingCanvas) this.paintingCanvas.style.display = 'none';
                this.setDefenseHudVisible(false);
                window.scrollTo(0, 0);
            });
        }
        
        const exitBtn = document.getElementById('exit-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                try {
                    window.close();
                } catch {}
                setTimeout(() => {
                    window.location.href = 'about:blank';
                }, 0);
            });
        }
        
        // Settings listeners
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        const langZhBtn = document.getElementById('lang-zh-btn');
        const langEnBtn = document.getElementById('lang-en-btn');

        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
            });
        }
        if (closeSettingsBtn && settingsModal) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }
        if (langZhBtn) {
            langZhBtn.addEventListener('click', () => {
                setLang('zh');
                this.updateUITexts();
            });
        }
        if (langEnBtn) {
            langEnBtn.addEventListener('click', () => {
                setLang('en');
                this.updateUITexts();
            });
        }
        
        // Fullscreen toggle logic
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const windowedBtn = document.getElementById('windowed-btn');
        
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                // Check if running in electron
                if ((window as any).require) {
                    const { ipcRenderer } = (window as any).require('electron');
                    if (ipcRenderer) ipcRenderer.send('toggle-fullscreen', true);
                } else if (document.documentElement.requestFullscreen) {
                    // Browser fallback
                    document.documentElement.requestFullscreen().catch(e => console.log(e));
                }
            });
        }
        if (windowedBtn) {
            windowedBtn.addEventListener('click', () => {
                if ((window as any).require) {
                    const { ipcRenderer } = (window as any).require('electron');
                    if (ipcRenderer) ipcRenderer.send('toggle-fullscreen', false);
                } else if (document.exitFullscreen) {
                    // Browser fallback
                    document.exitFullscreen().catch(e => console.log(e));
                }
            });
        }

        // Initialize UI texts
        this.updateUITexts();
        
        // Frames grid disabled per new design
        
        // Frame Preview Listeners
        const previewModal = document.getElementById('frame-preview-modal');
        const previewImg = document.getElementById('frame-preview-img') as HTMLImageElement;
        
        if (previewModal) {
            previewModal.addEventListener('click', () => {
                previewModal.style.display = 'none';
            });
        }
        
        for (let i = 1; i <= 4; i++) {
            const frameDiv = document.getElementById(`frame-${i}`);
            if (frameDiv) {
                frameDiv.addEventListener('click', () => {
                    const dataUrl = this.frameUrls.get(i);
                    if (dataUrl && previewModal && previewImg) {
                        previewImg.src = dataUrl;
                        previewModal.style.display = 'flex';
                    }
                });
            }
        }
        
        // ESC modal bridge events
        window.addEventListener('save-art-local', () => {
            this.showGallerySaveDialog();
        });
        window.addEventListener('save-art-to-frame', (e: any) => {
            const idx = e.detail?.index;
            if (typeof idx !== 'number') return;
            this.saveImageToFrame(idx);
        });
        window.addEventListener('exit-run', () => {
            if (this.state !== GameState.PLAYING && this.state !== GameState.STUDIO) return;
            if (this.currentMode === 'drawing') { this.finishDrawing(); return; }
            this.settleCurrentRunCoins();
            this.stop();
            this.artReplay.close(false);
            this.artRecording.clear();
            this.state = GameState.MENU;
            if (this.mainMenu) this.mainMenu.style.display = 'flex';
            if (this.gameUI) this.gameUI.style.display = 'none';
            if (this.minimapCanvas) this.minimapCanvas.style.display = 'none';
            this.setCombatFieldNotesVisible(false);
            if (this.levelUpScreen) this.levelUpScreen.style.display = 'none';
            if (this.gameOverMenu) this.gameOverMenu.style.display = 'none';
            if (this.paintingCanvas) this.paintingCanvas.style.display = 'none';
            this.setDefenseHudVisible(false);
            window.scrollTo(0, 0);
        });
    }

    private setupSystems(): void {
        this.addSystem(new InputSystem(this.inputManager, this.camera));
        this.addSystem(new MovementSystem(this.worldWidth, this.worldHeight, (e) => this.addEntity(e), this.gameCtx, this.trailCtx, () => this.currentMode === 'endless'));
        this.addSystem(new WeaponSystem(this.inputManager, (entity) => this.addEntity(entity), this.gameCtx, this.trailCtx));
        this.addSystem(new EnemySystem(
            (entity) => this.addEntity(entity),
            this.trailCtx,
            () => this.currentMode === 'defense' && this.defensePainting.active ? this.defensePainting : null
        ));
        this.addSystem(new CollisionSystem((entity) => this.addEntity(entity), this.trailCtx));
        
        this.waveSystem = new WaveSystem((entity) => this.addEntity(entity), this.camera, () => this.currentMode === 'drawing' ? 'endless' : this.currentMode);
        this.addSystem(this.waveSystem);
        
        this.addSystem(new SkillSystem(this.inputManager, this.trailCtx, this.camera, (entity) => this.addEntity(entity), this.worldWidth, this.worldHeight));
        this.addSystem(new ParticleSystem());
        this.addSystem(new TrailSystem(this.trailCtx, this.camera));
        this.addSystem(new SkeletonSystem());
        this.addSystem(new ObjectiveSystem(this.worldWidth, this.worldHeight, (e) => this.addEntity(e)));
        this.addSystem(new LevelSystem(() => this.currentMode === 'drawing' ? 'endless' : this.currentMode));
        this.addSystem(new PrologueSystem(this.worldWidth, this.worldHeight));
        this.courtyardBoundary = new CourtyardBoundarySystem(() => this.currentMode === 'endless');
        this.addSystem(this.courtyardBoundary);
        this.addSystem(new RenderSystem(this.gameCtx, this.camera, this.worldWidth, this.worldHeight,
            () => this.currentMode === 'endless', () => this.currentMode === 'defense', () => this.currentMode === 'drawing', true));
        this.addSystem(new MinimapSystem(this.minimapCtx, this.worldWidth, this.worldHeight, this.camera, () => this.currentMode === 'endless'));
        this.addSystem(new UISystem());
        this.addSystem(new QuestSystem());
        const graffitiSystem = new GraffitiSystem(this.trailCtx);
        graffitiSystem.addEntityCallback = (e) => this.addEntity(e);
        this.addSystem(graffitiSystem);
        this.addSystem(new DamageTextSystem(this.gameCtx, this.camera));
        this.addSystem(new SummonSystem((entity) => this.addEntity(entity)));
        this.addSystem(new MagicPenSystem(
            (entity) => this.addEntity(entity),
            () => this.state === GameState.PLAYING && this.isRunning && this.currentMode !== 'drawing'
        ));
    }

    private setupEntities(): void {
        const player = PlayerFactory.create(
            this.width / 2, 
            this.height / 2, 
            this.currentMode === 'drawing' ? 'collector' : this.selectedCharacterId || undefined,
            this.currentMode === 'drawing' ? 0 : this.selectedWeaponId !== null ? this.selectedWeaponId : undefined
        );
        this.configurePlayerForMode(player);
        if(this.currentMode === 'endless' || this.currentMode === 'drawing') {
            const t=player.getComponent(Transform)!;
            t.x=this.worldWidth/2;t.y=this.worldHeight/2;
        }
        this.addEntity(player);
        if (this.currentMode === 'drawing') this.drawingHud.show(player);

        // Remove test enemies to prevent instant death at start
        // WaveSystem will handle spawning enemies
    }

    public resize(): void {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_GAME_DPR);
        
        this.gameCanvas.width = this.width * dpr;
        this.gameCanvas.height = this.height * dpr;
        this.gameCanvas.style.width = `${this.width}px`;
        this.gameCanvas.style.height = `${this.height}px`;
        this.gameCtx.scale(dpr, dpr); // Restore scale

        // A viewport resize must not clear the world painting or break replay.
        if (this.trailCanvas.width !== this.worldWidth || this.trailCanvas.height !== this.worldHeight) {
            this.trailCanvas.width = this.worldWidth;
            this.trailCanvas.height = this.worldHeight;
        }
        this.trailCanvas.style.width = `${this.worldWidth}px`;
        this.trailCanvas.style.height = `${this.worldHeight}px`;
        // No scale needed for trailCtx if it's 1:1 with world, but for high DPI screens we might want scaling.
        // Let's keep it simple: World pixels = Screen pixels at scale 1.
        // If we want high DPI, we'd need a larger canvas and scale ctx.
        // For performance on large canvas, let's stick to 1x for now or use dpr if performant.
        this.trailCtx.scale(1, 1);

        if (this.defensePainting) {
            this.defensePainting.resize(this.worldWidth, this.worldHeight);
        }

        // Minimap
        this.minimapCanvas.width = 150 * dpr;
        this.minimapCanvas.height = 150 * dpr;
        this.minimapCtx.scale(dpr, dpr);
    }

    public addEntity(entity: Entity): void {
        this.entities.set(entity.id, entity);
        for (const system of this.systems) {
            system.addEntity(entity);
        }
    }

    public removeEntity(entityId: string): void {
        const entity = this.entities.get(entityId);
        if (entity) {
            for (const system of this.systems) {
                system.removeEntity(entity);
            }
            this.entities.delete(entityId);
        }
    }

    public addSystem(system: System): void {
        this.systems.push(system);
    }

    private configurePlayerForMode(player: Entity): void {
        const exp = player.getComponent(Experience);
        const weapon = player.getComponent(Weapon);
        const quest = player.getComponent(Quest);
        const story = player.getComponent(StoryState);

        if (this.currentMode === 'drawing') {
            player.tags.add('drawing_mode');
            const stats = new PlayerStats();
            stats.characterId = 'collector';
            stats.infiniteAmmoUntil = Infinity;
            player.addComponent(stats);
            player.removeComponent(Skill);
            player.getComponent(Renderable)!.color = '#287ac0';
            player.getComponent(Trail)!.color = '#287ac0';
            if (weapon) {
                weapon.unlocked = new Set(WEAPONS.filter(config => PlayerProfile.load().unlockedWeaponIds.includes(config.id)).map(config => config.id));
                weapon.cooldown = 0;
                weapon.reloading = false;
            }
            if (exp) exp.next = Number.MAX_SAFE_INTEGER;
            if (quest) quest.active = false;
            if (story) story.chapter = 'Drawing';
            return;
        }

        if (weapon) {
            // Unlocked set should contain the starting weapon
            weapon.unlocked = new Set([weapon.currentWeaponIndex]);
            weapon.cooldown = 0;
            weapon.reloading = false;
            weapon.reloadTimer = 0;
        }

        if (quest) {
            quest.index = 0;
            for (const step of quest.steps) {
                step.done = false;
            }
        }

        if (this.currentMode === 'story') {
            if (weapon) {
                // In prologue, no weapons allowed initially
                weapon.unlocked = new Set();
                weapon.currentWeaponIndex = -1;
            }
            if (exp) {
                exp.level = 1;
                exp.xp = 0;
                exp.next = Number.MAX_SAFE_INTEGER;
            }
            // Spawn player at left side for prologue chase
            const pTransform = player.getComponent(Transform);
            if (pTransform) {
                pTransform.x = 400;
                pTransform.y = this.worldHeight / 2;
            }
            if (quest) {
                quest.active = true;
                quest.steps = [
                    { type: 'announce', text: '【序章：逃亡与生存】' },
                    { type: 'escape', text: '逃离巨型橡皮擦的抹除！' }, // Wait for PrologueSystem to complete
                    { type: 'announce', text: '【第一幕：未竟的草图】' },
                    { type: 'announce', text: '保护地图中心的“画眼”！抵御擦除教团的进攻！' },
                    { type: 'defend', duration: 120, text: '防守成功！画眼已被激活！' }, // 撑过120秒
                    { type: 'announce', text: '本测试关卡已通关，你可以继续体验融合技能。' }
                ];
                quest.index = 0;
            }
            if (story) {
                story.chapter = 'Prologue';
                story.flags = {};
            }
            
            // Note: Canvas Eye is now created inside startAct1()
            
        } else {
            if (exp) {
                exp.level = 1;
                exp.xp = 0;
                exp.next = 100;
            }
            if (this.currentMode === 'defense') {
                const pTransform = player.getComponent(Transform);
                if (pTransform) {
                    // Open on the centered painting, not a point below it.
                    pTransform.x = this.worldWidth / 2;
                    pTransform.y = this.worldHeight / 2;
                }
            }
            if (quest) {
                quest.active = false;
            }
            if (story) {
                story.chapter = this.currentMode === 'defense' ? 'Defense' : 'Endless';
                story.flags = {};
            }
        }
    }

    public showLevelUpScreen(entityId: string): void {
        if (this.currentMode === 'drawing') return;
        const player = this.entities.get(entityId);
        if (!player) return;
        const stats = player.getComponent(PlayerStats);
        if (!stats) return;

        // Pause the game
        window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: true } }));
        this.levelUpScreen.style.display = 'flex';

        // Select 4 random skills that can be upgraded or learned
        const availableSkills = SKILLS.filter(skill => {
            const currentLevel = stats.getSkillLevel(skill.id);
            if (currentLevel >= skill.maxLevel) return false;
            
            // 人物觉醒和武器觉醒技能现在由击败BOSS后掉落获取，不再出现在普通升级池中
            if (skill.category === SkillCategory.WEAPON_MASTERY || skill.category === SkillCategory.CHARACTER_AWAKENING) {
                return false;
            }

            if (skill.prerequisites) {
                for (const prereq of skill.prerequisites) {
                    if (!stats.hasSkill(prereq)) return false;
                }
            }
            return true;
        });

        // 完全随机抽取技能
        let selectedSkills = [];
        
        // 打乱可用技能池
        availableSkills.sort(() => 0.5 - Math.random());
        
        // 选取最多 4 个技能
        selectedSkills = availableSkills.slice(0, 4);

        const container = document.getElementById('level-up-cards');
        if (container) {
            container.innerHTML = '';
            if (selectedSkills.length === 0) {
                // No more skills to learn
                const el = document.createElement('div');
                el.className = 'upgrade-empty';
                el.innerText = getLang() === 'zh' ? '所有技能已升至满级！' : 'All skills are fully upgraded!';
                container.appendChild(el);
                
                setTimeout(() => {
                    this.levelUpScreen.style.display = 'none';
                    window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
                }, 1500);
                return;
            }

            selectedSkills.forEach((skill, index) => {
                const currentLevel = stats.getSkillLevel(skill.id);
                const nextLevel = currentLevel + 1;
                const levelConfig = skill.levels.find(l => l.level === nextLevel) || skill.levels[0];
                
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'card upgrade-card';

                card.innerHTML = `
                    <span class="upgrade-seal" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
                    <span class="upgrade-category">${t(skill.category)}</span>
                    <span class="upgrade-title">${t(skill.name)}</span>
                    <span class="upgrade-tier">${currentLevel === 0 ? t('新技能') : `${t('升级至 Lv.')}${nextLevel}`}</span>
                    <span class="upgrade-description">${t(levelConfig.description)}</span>
                `;

                card.onclick = () => {
                    // Get old values
                    const oldLevelConfig = currentLevel > 0 ? skill.levels.find(l => l.level === currentLevel) : null;

                    // Apply skill upgrade
                    stats.acquiredSkills[skill.id] = nextLevel;
                    
                    // Apply immediate stats logic
                    if (skill.category === '基础属性强化') {
                        const oldVal = oldLevelConfig ? (oldLevelConfig.value || 0) : 0;
                        const val = levelConfig.value || 0;
                        const diff = val - oldVal;

                        if (skill.id === 'base_firerate') stats.fireRateMultiplier += diff;
                        if (skill.id === 'base_speed') stats.speedMultiplier += diff;
                        if (skill.id === 'base_dodge') {
                            stats.dodgeChance += diff;
                            if (stats.dodgeChance > 0.5) stats.dodgeChance = 0.5;
                        }
                        if (skill.id === 'base_health') {
                            const hp = player.getComponent(Health);
                            if (hp) {
                                const bonus = diff * 100; // assuming baseHp was 100, wait, better use maxHp logic
                                // Let's just update player stats. Wait, Health is separate component!
                                hp.max += (stats.maxHp * diff); // Or properly apply. We'll leave health for now or fix it if needed.
                                hp.current += (stats.maxHp * diff);
                            }
                        }
                        if (skill.id === 'base_damage') stats.damageMultiplier += diff;
                        if (skill.id === 'base_reload') stats.reloadSpeedMultiplier += diff;
                        if (skill.id === 'base_trail') stats.trailWidthMultiplier += diff;
                        if (skill.id === 'base_pierce') stats.pierceBonus += diff;
                        if (skill.id === 'base_crit_chance') stats.critChance += diff;
                        if (skill.id === 'base_crit_damage') stats.critDamage += diff;
                    } else if (skill.category === '体型变异系') {
                        const oldSize = oldLevelConfig && oldLevelConfig.sizeMultiplier !== undefined ? oldLevelConfig.sizeMultiplier : 1.0;
                        const newSize = levelConfig.sizeMultiplier !== undefined ? levelConfig.sizeMultiplier : 1.0;
                        
                        const render = player.getComponent(Renderable);
                        if (render && render.shape === 'circle') {
                            render.radius = (render.radius / oldSize) * newSize;
                        }
                        
                        if (skill.id === 'body_enlarge') {
                            const oldHp = oldLevelConfig && oldLevelConfig.hpMultiplier !== undefined ? oldLevelConfig.hpMultiplier : 1.0;
                            const newHp = levelConfig.hpMultiplier !== undefined ? levelConfig.hpMultiplier : 1.0;
                            const hp = player.getComponent(Health);
                            if (hp) {
                                const baseMax = hp.max / oldHp;
                                hp.max = baseMax * newHp;
                                hp.current += baseMax * (newHp - oldHp);
                            }
                        } else if (skill.id === 'body_reduce') {
                            const oldDodge = oldLevelConfig && oldLevelConfig.dodgeBonus !== undefined ? oldLevelConfig.dodgeBonus : 0.0;
                            const newDodge = levelConfig.dodgeBonus !== undefined ? levelConfig.dodgeBonus : 0.0;
                            stats.dodgeChance += (newDodge - oldDodge);
                            // Clamp dodge chance to 50%
                            if (stats.dodgeChance > 0.5) stats.dodgeChance = 0.5;
                        }
                    }

                    // Hide UI and resume
                    this.levelUpScreen.style.display = 'none';
                    window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
                };

                container.appendChild(card);
            });
        }
    }

    public showBossAwakeningScreen(bossPhase: number = 1): void {
        const player = Array.from(this.entities.values()).find(e => e.hasComponent(PlayerStats));
        if (!player) return;
        const stats = player.getComponent(PlayerStats);
        const weaponComp = player.getComponent(Weapon);
        if (!stats || !weaponComp) return;

        // Pause the game
        window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: true } }));
        
        // Ensure UI elements exist (we can reuse the level-up screen or create a specialized one)
        this.levelUpScreen.style.display = 'flex';
        const container = document.getElementById('level-up-cards');
        if (!container) return;
        container.innerHTML = '';

        // Add a specialized title if possible, or just reuse the container
        const titleEl = this.levelUpScreen.querySelector<HTMLElement>('.title');
        const oldTitle = titleEl ? titleEl.innerText : '';
        if (titleEl) {
            let titleText = getLang() === 'zh' ? 'BOSS 击杀：专属觉醒！' : 'BOSS Kill: Unique Awakening!';
            if (bossPhase === 1) titleText = getLang() === 'zh' ? 'BOSS 1 击杀：人物觉醒 1' : 'BOSS 1 Kill: Character Awakening 1';
            else if (bossPhase === 2) titleText = getLang() === 'zh' ? 'BOSS 2 击杀：武器觉醒' : 'BOSS 2 Kill: Weapon Awakening';
            else if (bossPhase === 3) titleText = getLang() === 'zh' ? 'BOSS 3 击杀：人物觉醒 2' : 'BOSS 3 Kill: Character Awakening 2';
            titleEl.innerText = titleText;
        }

        const currentWeaponId = weaponComp.currentWeaponIndex;
        const currentWeaponType = WEAPONS.find(w => w.id === currentWeaponId)?.type;

        // Select available awakenings
        const availableSkills = SKILLS.filter(skill => {
            const currentLevel = stats.getSkillLevel(skill.id);
            if (currentLevel >= skill.maxLevel) return false;
            
            // BOSS 掉落规则：
            // BOSS1: 人物觉醒1
            // BOSS2: 武器觉醒
            // BOSS3: 人物觉醒2
            if (bossPhase === 1) {
                return skill.category === SkillCategory.CHARACTER_AWAKENING && skill.requiredCharacter === stats.characterId && skill.id.endsWith('_1');
            } else if (bossPhase === 2) {
                return skill.category === SkillCategory.WEAPON_MASTERY && skill.requiredWeapon === currentWeaponType;
            } else if (bossPhase === 3) {
                return skill.category === SkillCategory.CHARACTER_AWAKENING && skill.requiredCharacter === stats.characterId && skill.id.endsWith('_2');
            } else {
                // 如果是其他阶段，或者没有匹配到，提供剩余未学习的觉醒
                if (skill.category === SkillCategory.WEAPON_MASTERY) {
                    return skill.requiredWeapon === currentWeaponType;
                } else if (skill.category === SkillCategory.CHARACTER_AWAKENING) {
                    return skill.requiredCharacter === stats.characterId;
                }
                return false;
            }
        });

        // 打乱可用技能池
        availableSkills.sort(() => 0.5 - Math.random());
        
        // 选取最多 3 个技能
        const selectedSkills = availableSkills.slice(0, 3);

        const closeScreen = () => {
            this.levelUpScreen.style.display = 'none';
            if (titleEl) titleEl.innerText = oldTitle; // Restore old title
            window.dispatchEvent(new CustomEvent('game-pause', { detail: { paused: false } }));
        };

        if (selectedSkills.length === 0) {
            // No awakenings available, give massive gold and health
            const el = document.createElement('div');
            el.className = 'upgrade-empty awakening-empty';
            el.innerHTML = getLang() === 'zh' ? '已无专属觉醒<br><br>获得 500 金币与全面恢复！' : 'No awakenings available<br><br>Received 500 Coins & Full Heal!';
            container.appendChild(el);
            
            stats.gold += 500;
            const score = player.getComponent(Score);
            if (score) score.coins += 500;
            const hp = player.getComponent(Health);
            if (hp) hp.current = hp.max;

            setTimeout(closeScreen, 2000);
            return;
        }

        selectedSkills.forEach((skill, index) => {
            const currentLevel = stats.getSkillLevel(skill.id);
            const nextLevel = currentLevel + 1;
            const levelConfig = skill.levels.find(l => l.level === nextLevel) || skill.levels[0];
            
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'card upgrade-card awakening-card';

            card.innerHTML = `
                <span class="upgrade-seal" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
                <span class="upgrade-category">${t(skill.category)}</span>
                <span class="upgrade-title">${t(skill.name)}</span>
                <span class="upgrade-tier">${currentLevel === 0 ? t('觉醒降临') : `${t('觉醒提升 Lv.')}${nextLevel}`}</span>
                <span class="upgrade-description">${t(levelConfig.description)}</span>
            `;

            card.onclick = () => {
                stats.acquiredSkills[skill.id] = nextLevel;
                closeScreen();
            };

            container.appendChild(card);
        });
    }

    public showSelectionScreen(mode?: SelectablePlayMode): void {
        if (this.state === GameState.GALLERY) return;
        this.setCombatFieldNotesVisible(false);
        if (mode) this.pendingMode = mode;
        this.state = GameState.SELECTION;
        this.mainMenu.style.display = 'none';
        this.selectionScreen.style.display = 'flex';

        const isDefense = this.pendingMode === 'defense';
        this.artworkPicker.show(isDefense);
        const modeLabel = document.getElementById('selection-mode-label');
        const modeDescription = document.getElementById('selection-mode-description');
        if (modeLabel) modeLabel.textContent = isDefense ? '守卫模式 · 出击准备' : '创造模式 · 出击准备';
        if (modeDescription) {
            modeDescription.textContent = isDefense
                ? '守住原画，阻止橡皮擦；你的攻击会留下修复痕迹。'
                : '从空白画布开始，战斗并创造你的作品。';
        }

        const profile = PlayerProfile.load();
        if (!this.selectedCharacterId || !profile.unlockedCharacterIds.includes(this.selectedCharacterId)) {
            this.selectedCharacterId = profile.selectedCharacterId;
        }
        if (this.selectedWeaponId === null || !profile.unlockedWeaponIds.includes(this.selectedWeaponId)) {
            this.selectedWeaponId = WEAPONS.find(weapon => profile.unlockedWeaponIds.includes(weapon.id))?.id ?? null;
        }
        this.updateProfileCoins(profile);

        // Populate characters
        const charList = document.getElementById('character-list');
        if (charList) {
            charList.innerHTML = '';
            CHARACTERS.forEach(char => {
                const unlocked = profile.unlockedCharacterIds.includes(char.id);
                const el = document.createElement('button');
                el.type = 'button';
                el.className = `card char-card ${this.selectedCharacterId === char.id ? 'active' : ''} ${unlocked ? '' : 'locked'}`;
                el.setAttribute('aria-pressed', String(this.selectedCharacterId === char.id));
                el.innerHTML = `
                    <p class="card-title">${t(char.name)}</p>
                    <p class="card-desc">${t(char.description)}</p>
                    <p class="unlock-status ${unlocked ? 'is-unlocked' : 'is-locked'}">${unlocked ? this.profileText('unlocked') : this.profileText('locked', char.unlockPrice)}</p>
                `;
                el.onclick = () => {
                    this.selectedCharacterId = char.id;
                    if (unlocked) PlayerProfile.selectCharacter(char.id);
                    this.updateSelectionUI();
                };
                charList.appendChild(el);
            });
        }
        
        // Populate weapons
        const weapList = document.getElementById('weapon-list');
        if (weapList) {
            weapList.innerHTML = '';
            WEAPONS.forEach(weap => {
                const unlocked = profile.unlockedWeaponIds.includes(weap.id);
                const price = getWeaponUnlockPrice(weap.id);
                const el = document.createElement('button');
                el.type = 'button';
                el.className = `card weap-card ${this.selectedWeaponId === weap.id ? 'active' : ''} ${unlocked ? '' : 'locked'}`;
                el.setAttribute('aria-pressed', String(this.selectedWeaponId === weap.id));
                el.innerHTML = `
                    <p class="card-title">${t(weap.name)}</p>
                    <p class="card-desc">${getLang() === 'zh' ? '射速' : 'Rate'}: ${Math.round(1000 / weap.fireRate)} | ${getLang() === 'zh' ? '伤害' : 'Dmg'}: ${weap.damage}</p>
                    <p class="unlock-status ${unlocked ? 'is-unlocked' : 'is-locked'}">${unlocked ? this.profileText('unlocked') : this.profileText('locked', price)}</p>
                `;
                el.onclick = () => {
                    this.selectedWeaponId = weap.id;
                    this.updateSelectionUI();
                };
                weapList.appendChild(el);
            });
        }
        
        // Auto-select first if none
        if (!this.selectedCharacterId && CHARACTERS.length > 0) this.selectedCharacterId = CHARACTERS[0].id;
        if (this.selectedWeaponId === null && WEAPONS.length > 0) this.selectedWeaponId = WEAPONS[0].id;
        
        this.updateSelectionUI();
    }
    
    private updateSelectionUI(): void {
        const profile = PlayerProfile.load();
        this.updateProfileCoins(profile);
        // Update active classes
        document.querySelectorAll('.char-card').forEach((el, i) => {
            const character = CHARACTERS[i];
            el.classList.toggle('active', character.id === this.selectedCharacterId);
            el.setAttribute('aria-pressed', String(character.id === this.selectedCharacterId));
            el.classList.toggle('locked', !profile.unlockedCharacterIds.includes(character.id));
        });
        document.querySelectorAll('.weap-card').forEach((el, i) => {
            const weapon = WEAPONS[i];
            el.classList.toggle('active', weapon.id === this.selectedWeaponId);
            el.setAttribute('aria-pressed', String(weapon.id === this.selectedWeaponId));
            el.classList.toggle('locked', !profile.unlockedWeaponIds.includes(weapon.id));
        });
        
        // Update details panel
        const charDetail = document.getElementById('char-detail');
        const weapDetail = document.getElementById('weap-detail');
        const startBtn = document.getElementById('start-run-btn') as HTMLButtonElement;
        
        const selectedChar = CHARACTERS.find(c => c.id === this.selectedCharacterId);
        if (charDetail && selectedChar) {
            const unlocked = profile.unlockedCharacterIds.includes(selectedChar.id);
            const hpLbl = getLang() === 'zh' ? '基础生命' : 'Base HP';
            const spdLbl = getLang() === 'zh' ? '移速' : 'Speed';
            const skillLbl = getLang() === 'zh' ? '专属技能' : 'Unique Skill';
            charDetail.innerHTML = `
                <h4 class="detail-title">${t(selectedChar.name)}</h4>
                <p class="detail-description">${t(selectedChar.description)}</p>
                <p class="detail-stat">${hpLbl}: ${selectedChar.baseHp} | ${spdLbl}: ${selectedChar.baseSpeed}</p>
                <p class="detail-skill">${skillLbl}: [${t(selectedChar.uniqueSkillName)}] ${t(selectedChar.uniqueSkillDesc)}</p>
                ${unlocked ? `<p class="unlock-status is-unlocked">${this.profileText('unlocked')}</p>` : `<button id="unlock-character-btn" class="btn unlock-action" ${profile.coins < selectedChar.unlockPrice ? 'disabled' : ''}>${this.profileText('unlock', selectedChar.unlockPrice)}</button>`}
            `;

            const unlockBtn = document.getElementById('unlock-character-btn') as HTMLButtonElement | null;
            if (unlockBtn) {
                unlockBtn.onclick = () => this.purchaseSelectedCharacter(selectedChar.id, selectedChar.unlockPrice);
            }
        }
        
        const selectedWeap = WEAPONS.find(w => w.id === this.selectedWeaponId);
        if (weapDetail && selectedWeap) {
            const unlocked = profile.unlockedWeaponIds.includes(selectedWeap.id);
            const price = getWeaponUnlockPrice(selectedWeap.id);
            const isMelee = selectedWeap.type === 'melee';
            const typeStr = getLang() === 'zh' ? (isMelee ? '近战武器' : '远程武器') : (isMelee ? 'Melee Weapon' : 'Ranged Weapon');
            const dmgLbl = getLang() === 'zh' ? '伤害' : 'Dmg';
            const rateLbl = getLang() === 'zh' ? '射速' : 'Rate';
            const magLbl = getLang() === 'zh' ? '弹匣' : 'Mag';
            const rldLbl = getLang() === 'zh' ? '装填' : 'Reload';
            const secLbl = getLang() === 'zh' ? '秒' : 's';
            
            weapDetail.innerHTML = `
                <h4 class="detail-title">${t(selectedWeap.name)}</h4>
                <p class="detail-description">${typeStr}</p>
                <p class="detail-stat">${dmgLbl}: ${selectedWeap.damage} | ${rateLbl}: ${Math.round(1000 / selectedWeap.fireRate)}</p>
                <p class="detail-stat">${magLbl}: ${selectedWeap.magSize} | ${rldLbl}: ${(selectedWeap.reloadTime / 60).toFixed(1)}${secLbl}</p>
                ${unlocked ? `<p class="unlock-status is-unlocked">${this.profileText('unlocked')}</p>` : `<button id="unlock-weapon-btn" class="btn unlock-action" ${profile.coins < price ? 'disabled' : ''}>${this.profileText('unlock', price)}</button>`}
            `;

            const unlockBtn = document.getElementById('unlock-weapon-btn') as HTMLButtonElement | null;
            if (unlockBtn) {
                unlockBtn.onclick = () => this.purchaseSelectedWeapon(selectedWeap.id, price);
            }
        }

        if (startBtn) {
            const selectedUnlocked = !!selectedChar && profile.unlockedCharacterIds.includes(selectedChar.id);
            const selectedWeaponUnlocked = !!selectedWeap && profile.unlockedWeaponIds.includes(selectedWeap.id);
            startBtn.disabled = !selectedUnlocked || !selectedWeaponUnlocked;
            const isDefense = this.pendingMode === 'defense';
            startBtn.textContent = isDefense ? '进入守卫模式' : '进入创造模式';
            startBtn.dataset.mode = isDefense ? 'defense' : 'endless';
        }
    }

    private updateProfileCoins(profile: PlayerProfileData = PlayerProfile.load()): void {
        const el = document.getElementById('profile-coins');
        if (!el) return;
        el.textContent = getLang() === 'zh'
            ? `局外金币：${profile.coins}`
            : `Wallet: ${profile.coins} Coins`;
    }

    private profileText(kind: 'unlocked' | 'locked' | 'unlock', price?: number): string {
        if (getLang() === 'zh') {
            if (kind === 'unlocked') return '已解锁';
            if (kind === 'locked') return `未解锁 · ${price ?? 0} 金币`;
            return `花费 ${price ?? 0} 金币解锁`;
        }
        if (kind === 'unlocked') return 'Unlocked';
        if (kind === 'locked') return `Locked · ${price ?? 0} Coins`;
        return `Unlock for ${price ?? 0} Coins`;
    }

    private purchaseSelectedCharacter(characterId: string, price: number): void {
        const result = PlayerProfile.purchaseCharacter(characterId, price);
        if (!result.purchased) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: getLang() === 'zh' ? '金币不足，无法解锁该角色。' : 'Not enough coins to unlock this character.' } }));
            return;
        }

        this.selectedCharacterId = characterId;
        window.dispatchEvent(new CustomEvent('announce', { detail: { text: getLang() === 'zh' ? `已解锁：${CHARACTERS.find(char => char.id === characterId)?.name || characterId}` : 'Character unlocked!' } }));
        this.showSelectionScreen();
    }

    private purchaseSelectedWeapon(weaponId: number, price: number): void {
        const result = PlayerProfile.purchaseWeapon(weaponId, price);
        if (!result.purchased) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: getLang() === 'zh' ? '金币不足，无法解锁该武器。' : 'Not enough coins to unlock this weapon.' } }));
            return;
        }

        this.selectedWeaponId = weaponId;
        const weaponName = WEAPONS.find(weapon => weapon.id === weaponId)?.name || String(weaponId);
        window.dispatchEvent(new CustomEvent('announce', { detail: { text: getLang() === 'zh' ? `已解锁：${weaponName}` : 'Weapon unlocked!' } }));
        this.showSelectionScreen();
    }

    public startGame(mode: PlayMode = 'endless'): void {
        if (this.state === GameState.DEFENSE_INTRO || this.state === GameState.GALLERY) return;
        this.currentMode = mode;
        // 暂时屏蔽皮肤绘制提示，直接使用默认皮肤进入无尽模式
        /*
        const savedSkin = localStorage.getItem('player_custom_skin');
        if (!savedSkin) {
            const goEditor = window.confirm('检测到你还没有绘制角色皮肤。是否现在去绘制？选择“取消”将使用默认外观进入游戏。');
            if (goEditor) {
                window.location.href = '/editor.html';
                return;
            }
        }
        */
        this.hasSettledCurrentRun = false;
        this.reset();
        this.configureWorldForMode();
        if (mode === 'defense') {
            this.state = GameState.DEFENSE_INTRO;
            const generation = this.runGeneration;
            void this.artworkPicker.ready.then(() => {
                if (generation !== this.runGeneration || this.state !== GameState.DEFENSE_INTRO) return;
                const artwork = structuredClone(this.artworkPicker.selected);
                this.defenseIntro.play(artwork, () => {
                    if (generation !== this.runGeneration) return;
                    this.inputManager.keys.clear();
                    this.inputManager.mouse.down = false;
                    this.beginBattle(artwork);
                }, () => {
                    this.gameOverMenu.style.display = 'none';
                    this.showSelectionScreen('defense');
                });
            });
            return;
        }
        this.beginBattle();
    }

    private configureWorldForMode(): void {
        const world = this.currentMode === 'defense' || this.currentMode === 'drawing' ? DEFENSE_WORLD : CREATE_WORLD;
        this.worldWidth = world.width;
        this.worldHeight = world.height;
        // Update existing systems instead of constructing duplicate listeners.
        for (const system of this.systems) system.setWorldSize(world.width, world.height);
        this.resize();
    }

    private beginBattle(artwork?: DefenseArtwork): void {
        if (artwork) this.defensePainting.beginArtwork(artwork);
        this.artRecording.start(this.worldWidth, this.worldHeight, this.currentMode === 'defense', artwork,
            this.currentMode === 'endless' ? courtyard.points : this.currentMode === 'drawing' ? [
                { x: 0, y: 0 }, { x: this.worldWidth, y: 0 },
                { x: this.worldWidth, y: this.worldHeight }, { x: 0, y: this.worldHeight }
            ] : null);
        this.artRecording.isDrawing = this.currentMode === 'drawing';
        if (this.currentMode === 'drawing') {
            this.trailCtx.save();
            this.trailCtx.fillStyle = '#ffffff';
            this.trailCtx.fillRect(0, 0, this.worldWidth, this.worldHeight);
            this.trailCtx.restore();
        }
        const replayBtn = document.getElementById('replay-btn') as HTMLButtonElement | null;
        if (replayBtn) replayBtn.disabled = true;
        this.setupEntities();
        this.state = GameState.PLAYING;
        
        if (this.mainMenu) this.mainMenu.style.display = 'none';
        if (this.selectionScreen) this.selectionScreen.style.display = 'none';
        if (this.gameOverMenu) this.gameOverMenu.style.display = 'none';
        // The selection screen can be vertically scrolled on smaller displays.
        // Reset document scroll before revealing world-space canvases, otherwise
        // the camera appears offset and the painting starts partly off-screen.
        window.scrollTo(0, 0);
        if (this.gameUI) this.gameUI.style.display = 'flex';
        if (this.currentMode === 'drawing') this.gameUI.style.display = 'none';
        if (this.minimapCanvas) this.minimapCanvas.style.display = 'block';
        this.setCombatFieldNotesVisible(this.currentMode !== 'drawing');
        if (this.paintingCanvas) this.paintingCanvas.style.display = this.currentMode === 'defense' ? 'block' : 'none';
        this.setDefenseHudVisible(this.currentMode === 'defense');

        // Night courtyard needs visible pigment; this display opacity does not
        // alter recorded strokes, exported artwork or guard-mode readability.
        if (this.trailCanvas) this.trailCanvas.style.opacity = this.currentMode === 'drawing' ? '1' : this.currentMode === 'defense' ? '0.16' : this.currentMode === 'endless' ? '0.65' : '0.1';
        
        // Show Pause Button
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.style.display = this.currentMode === 'drawing' ? 'none' : 'block';
        this.clearInput();

        if (!this.isRunning) {
            this.start();
        }
    }
    
    public gameOver(score: number = 0, victory: boolean = false): void {
        if (this.state !== GameState.PLAYING && this.state !== GameState.STUDIO) return;
        this.state = GameState.GAMEOVER;
        this.stop();
        this.clearInput();
        this.drawingHud.hide();
        this.dismissPauseMenus();
        emitGameSound(victory ? 'victory' : 'defeat');
        this.artRecording.finish(this.paintingCanvas, this.trailCanvas);
        const replayBtn = document.getElementById('replay-btn') as HTMLButtonElement | null;
        if (replayBtn) replayBtn.disabled = false;
        const awardedCoins = this.settleCurrentRunCoins();

        const titleEl = this.gameOverMenu?.querySelector('h1');
        if (titleEl) {
            if (this.currentMode === 'drawing') {
                titleEl.innerText = '作品完成';
                titleEl.dataset.outcome = 'completed';
            } else if (victory) {
                titleEl.innerText = this.currentMode === 'defense' ? '守卫成功' : 'VICTORY';
                titleEl.dataset.outcome = 'victory';
            } else if (this.currentMode === 'defense' && this.defenseFailureMessage) {
                titleEl.innerText = this.defenseFailureMessage;
                titleEl.dataset.outcome = 'defeat';
            } else {
                titleEl.innerText = 'GAME OVER';
                titleEl.dataset.outcome = 'defeat';
            }
        }
        
        if (this.scoreDisplay) {
            const totalCoins = PlayerProfile.load().coins;
            const integritySuffix = this.currentMode === 'defense'
                ? (getLang() === 'zh'
                    ? `  |  画作完整度：${Math.round(this.defensePainting.getIntegrity() * 100)}%`
                    : `  |  Painting Integrity: ${Math.round(this.defensePainting.getIntegrity() * 100)}%`)
                : '';
            this.scoreDisplay.innerText = getLang() === 'zh'
                ? `最终分数：${score}  |  本局获得：${awardedCoins} 金币  |  持有金币：${totalCoins}${integritySuffix}`
                : `Final Score: ${score}  |  Earned: ${awardedCoins} Coins  |  Wallet: ${totalCoins}${integritySuffix}`;
        }

        if (this.currentMode === 'drawing' && this.scoreDisplay) {
            const seconds = Math.floor(this.drawingElapsed);
            this.scoreDisplay.innerText = `纯画画 · 创作 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒 · 无金币结算`;
        }

        if (this.gameUI) this.gameUI.style.display = 'none';
        if (this.minimapCanvas) this.minimapCanvas.style.display = 'none';
        this.setCombatFieldNotesVisible(false);
        this.setDefenseHudVisible(false);
        
        // Hide Pause Button
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        
        // 游戏结束结算，将地面画作透明度还原为1.0
        if (this.trailCanvas) this.trailCanvas.style.opacity = '1.0';
        
        if (this.gameOverMenu) this.gameOverMenu.style.display = 'flex';
        const player = [...this.entities.values()].find(entity => entity.tags.has('player'));
        const playerDead = (player?.getComponent(Health)?.current ?? 1) <= 0;
        if (this.currentMode !== 'drawing' && (victory || playerDead)) {
            this.outcomePortrait.show(victory ? 'victory' : 'defeat', player?.getComponent(Transform)?.rotation ?? 0, player?.getComponent(Weapon), player?.getComponent(PlayerStats)?.characterId);
        } else this.outcomePortrait.hide();
    }

    private openArtReplay(): void {
        if (this.state !== GameState.GAMEOVER || !this.artRecording.finalArtwork) return;
        this.stop();
        this.state = GameState.REPLAY;
        this.inputManager.keys.clear();
        this.inputManager.mouse.down = false;
        this.gameOverMenu.style.display = 'none';
        this.artReplay.open(this.artRecording, () => {
            this.state = GameState.GAMEOVER;
            this.gameOverMenu.style.display = 'flex';
            this.inputManager.keys.clear();
            this.inputManager.mouse.down = false;
        });
    }

    private settleCurrentRunCoins(): number {
        if (this.currentMode === 'drawing') { this.hasSettledCurrentRun = true; return 0; }
        if (this.hasSettledCurrentRun) return 0;

        let earnedCoins = 0;
        for (const entity of this.entities.values()) {
            if (!entity.tags.has('player')) continue;
            const score = entity.getComponent(Score);
            // Score 是局内金币的权威来源：它包含所有奖励，也会同步记录局内消费。
            earnedCoins = Math.max(earnedCoins, score?.coins || 0);
        }

        this.hasSettledCurrentRun = true;
        if (earnedCoins > 0) PlayerProfile.addCoins(earnedCoins);
        return earnedCoins;
    }

    public saveImage(): void {
        const level = (() => {
            for (const [, e] of this.entities) {
                if (!e.tags.has('player')) continue;
                const ex = e.getComponent(Experience);
                return ex ? ex.level : 0;
            }
            return 0;
        })();
        const exportCanvas = this.getExportCanvas();
        try {
            const dataUrl = exportCanvas.toDataURL('image/png');
            const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
            const bytes = base64ToBytes(b64);
            const out = injectTextChunks(bytes, [
                ['Software', 'DontEraseMe'],
                ['Version', '1'],
                ['CreationTime', new Date().toISOString()],
                ['Level', String(level)],
                ['WorldSize', `${this.worldWidth}x${this.worldHeight}`]
            ]);
            const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
            const blob = new Blob([ab], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `art-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            try {
                const fallback = exportCanvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = fallback;
                a.download = `art-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch {}
        }
        
        function base64ToBytes(b64: string): Uint8Array {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return arr;
        }
        function injectTextChunks(png: Uint8Array, pairs: [string, string][]): Uint8Array {
            const sig = png.slice(0, 8);
            let pos = 8;
            const ihdrLen = readUint32(png, pos);
            const ihdrType = readType(png, pos + 4);
            const ihdrEnd = pos + 8 + ihdrLen + 4;
            const head = png.slice(0, ihdrEnd);
            const rest = png.slice(ihdrEnd);
            const chunks: Uint8Array[] = [head];
            for (const [key, val] of pairs) {
                chunks.push(makeTextChunk(key, val));
            }
            chunks.push(rest);
            return concat(chunks);
        }
        function makeTextChunk(keyword: string, text: string): Uint8Array {
            const enc = (s: string) => new TextEncoder().encode(s);
            const keyBytes = enc(keyword);
            const textBytes = enc(text);
            const data = new Uint8Array(keyBytes.length + 1 + textBytes.length);
            data.set(keyBytes, 0);
            data[keyBytes.length] = 0;
            data.set(textBytes, keyBytes.length + 1);
            const type = enc('tEXt');
            const crcInput = new Uint8Array(type.length + data.length);
            crcInput.set(type, 0);
            crcInput.set(data, type.length);
            const crc = crc32(crcInput);
            const chunk = new Uint8Array(4 + 4 + data.length + 4);
            writeUint32(chunk, 0, data.length);
            chunk.set(type, 4);
            chunk.set(data, 8);
            writeUint32(chunk, 8 + data.length, crc);
            return chunk;
        }
        function readUint32(b: Uint8Array, i: number): number {
            return (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | (b[i + 3]);
        }
        function writeUint32(b: Uint8Array, i: number, v: number) {
            b[i] = (v >>> 24) & 0xff;
            b[i + 1] = (v >>> 16) & 0xff;
            b[i + 2] = (v >>> 8) & 0xff;
            b[i + 3] = v & 0xff;
        }
        function readType(b: Uint8Array, i: number): string {
            return String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
        }
        function concat(parts: Uint8Array[]): Uint8Array {
            let total = 0;
            for (const p of parts) total += p.length;
            const out = new Uint8Array(total);
            let offset = 0;
            for (const p of parts) {
                out.set(p, offset);
                offset += p.length;
            }
            return out;
        }
        function crc32(bytes: Uint8Array): number {
            let crc = 0xffffffff;
            for (let i = 0; i < bytes.length; i++) {
                crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
            }
            return (crc ^ 0xffffffff) >>> 0;
        }
        const table = (function makeTable() {
            const t = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let k = 0; k < 8; k++) {
                    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
                }
                t[i] = c >>> 0;
            }
            return t;
        })();
    }

    private getExportCanvas(): HTMLCanvasElement {
        // Settlement and replay must export the same immutable finished work,
        // even if an old burst-shot timer completes after the run has ended.
        if ((this.state === GameState.GAMEOVER || this.state === GameState.REPLAY) && this.artRecording.finalArtwork) {
            return this.artRecording.finalArtwork;
        }
        if (this.currentMode !== 'defense' || !this.defensePainting.active) {
            return this.trailCanvas;
        }

        const composite = document.createElement('canvas');
        composite.width = this.worldWidth;
        composite.height = this.worldHeight;
        const ctx = composite.getContext('2d');
        if (!ctx) return this.trailCanvas;
        ctx.drawImage(this.paintingCanvas, 0, 0);
        ctx.drawImage(this.trailCanvas, 0, 0);
        return composite;
    }

    private reset(): void {
        this.runGeneration++;
        this.defenseIntro.close();
        this.stop();
        this.artReplay.close(false);
        this.artRecording.clear();
        // Clear all entities
        for (const entity of this.entities.values()) entity.active = false;
        this.entities.clear();
        for (const system of this.systems) {
            system.entities.clear();
        }
        
        // Reset Wave System
        if (this.waveSystem) {
            this.waveSystem.reset();
        }

        // Clear canvases
        this.trailCtx.clearRect(0, 0, this.worldWidth, this.worldHeight);
        this.defensePainting.reset();
        this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        this.defenseElapsed = 0;
        this.drawingElapsed = 0;
        this.savedGalleryId = undefined;
        this.drawingHud.hide();
        this.dismissPauseMenus();
        this.clearInput();
        this.defenseIntegrityTick = 0;
        this.lastDefenseRepairAt = 0;
        this.defenseFailureMessage = '';
        this.setDefenseHudVisible(false);
        
        // Reset Camera
        this.camera.x = 0;
        this.camera.y = 0;
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrame = requestAnimationFrame((time) => this.loop(time));
    }

    public stop(): void {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
        // Legacy stop, now handled by gameOver()
    }

    private startAct1(): void {
        // Create the "Canvas Eye" (The sketch to defend)
        const canvasEye = new Entity();
        canvasEye.tags.add('canvas_eye');
        
        // Find player to spawn near them, or center of world
        let spawnX = this.worldWidth / 2;
        let spawnY = this.worldHeight / 2;
        for (const entity of this.entities.values()) {
            if (entity.tags.has('player')) {
                const t = entity.getComponent(Transform);
                if (t) {
                    spawnX = t.x;
                    spawnY = t.y;
                }
                const weapon = entity.getComponent(Weapon);
                if (weapon) {
                    weapon.unlocked = new Set([0]); // Give basic pencil back
                    weapon.currentWeaponIndex = 0;
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: '你捡起了一支掉落的【基础画笔】！' } }));
                }
                break;
            }
        }

        canvasEye.addComponent(new Transform(spawnX, spawnY, 0));
        const eyeRenderable = new Renderable('rgba(255, 255, 255, 0.8)', 40, 80, 80, 'circle');
        eyeRenderable.zIndex = 5;
        canvasEye.addComponent(eyeRenderable);
        canvasEye.addComponent(new Health(1000));
        
        this.addEntity(canvasEye);
    }

    private handleExplosion(x: number, y: number, radius: number, damage: number): void {
        if (this.currentMode === 'drawing') return;
        for (const entity of this.entities.values()) {
            if (entity.tags.has('player') || entity.tags.has('enemy') || entity.tags.has('canvas_eye')) {
                const t = entity.getComponent(Transform);
                if (t) {
                    const dx = t.x - x;
                    const dy = t.y - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < radius) {
                        const health = entity.getComponent(Health);
                        if (health) {
                            health.current -= damage;
                        }
                    }
                }
            }
        }
    }

    private loop(time: number): void {
        this.animationFrame = 0;
        if (!this.isRunning) return;

        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        
        // Cap dt to prevent huge jumps (e.g. tab switch)
        dt = Math.max(0, Math.min(0.1, dt));
        if (this.currentMode === 'drawing') dt = Math.min(dt, this.drawingDuration - this.drawingElapsed);
        if (this.state === GameState.PLAYING) this.artRecording.log.advance(Math.max(0, dt));

        // 1. Clear canvas first
        // Effect: Trail / Afterimage
        // Instead of clearRect, we fill with semi-transparent background
        // Wait, if we want persistent trails on the GAME canvas (e.g. bullet trails), we use this.
        // But the user said "player movement trail and attack effect... not leaving traces on canvas".
        // The TrailSystem draws to trailCtx (trailCanvas).
        // The RenderSystem draws to gameCtx (gameCanvas).
        
        // If trailCanvas is not showing up, maybe it's the CSS transform?
        // Or maybe it's being cleared somewhere?
        // We only clear trailCtx in reset().
        
        // Let's check the loop.
        // 1. Clear canvas first
        this.gameCtx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

        if (this.state === GameState.PLAYING) {
            // Share the immutable artwork boundary for this synchronous frame.
            // Decay, paint order and recording timestamps remain unchanged.
            this.artRecording.log.withPaintBoundary(this.trailCtx, () => {
                if (this.currentMode !== 'defense' && this.currentMode !== 'drawing') {
                    this.trailCtx.save();
                    this.trailCtx.globalCompositeOperation = 'destination-out';
                    const fadeAlpha = 0.05 * dt;
                    this.trailCtx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
                    this.trailCtx.fillRect(0, 0, this.worldWidth, this.worldHeight);
                    this.trailCtx.restore();
                }
                this.update(dt);
            });
        }
        if (this.state === GameState.STUDIO) {
            this.updateStudio(dt);
        }
        
        // 3. Update Trail Canvas Position (Camera + Shake)
        const shakeX = this.camera.shakeX || 0;
        const shakeY = this.camera.shakeY || 0;
        // Use translate3d for performance
        this.trailCanvas.style.transform = `translate3d(${-this.camera.x + shakeX}px, ${-this.camera.y + shakeY}px, 0)`;
        this.paintingCanvas.style.transform = `translate3d(${-this.camera.x + shakeX}px, ${-this.camera.y + shakeY}px, 0)`;

        // 4. Request next frame
        if (this.isRunning) this.animationFrame = requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number): void {
        try {
            for (const system of this.systems) {
                // console.log('Running system:', system.constructor.name);
                if (this.currentMode === 'drawing' && !this.isDrawingSystem(system)) continue;
                system.update(dt);
                if (this.state !== GameState.PLAYING || !this.isRunning) break;
            }
        } catch (e) {
            console.error('System update failed:', e);
        }
        // Catch post-render vehicle motion and any late knockback/teleport.
        this.courtyardBoundary.update(dt);
        if (this.state === GameState.GAMEOVER) {
            // Collision handling may finish its current draw after emitting death.
            this.artRecording.finish(this.paintingCanvas, this.trailCanvas);
            return;
        }
        this.artRecording.captureTail(this.paintingCanvas, this.trailCanvas);
        
        // Global cleanup of inactive entities
        // Iterate through all entities and remove those marked as inactive
        for (const [id, entity] of this.entities) {
            if (!entity.active) {
                this.removeEntity(id);
            }
            if (entity.tags.has('player')) {
                const stats = entity.getComponent(PlayerStats);
                if (stats) {
                    stats.survivalTime += dt;
                }
            }
        }
        
        if (this.currentMode === 'drawing') {
            this.drawingElapsed = Math.min(this.drawingDuration, this.drawingElapsed + dt);
            this.drawingHud.update(this.drawingDuration - this.drawingElapsed);
            if (this.drawingElapsed >= this.drawingDuration) this.finishDrawing();
            return;
        }
        this.lastRatingTick += dt;
        const activeEnemies = (() => {
            let c = 0;
            for (const [, e] of this.entities) if (e.tags.has('enemy')) c++;
            return c;
        })();
        this.ratingInterval = (activeEnemies > 40 || dt > 0.02) ? 3 : 1;
        if (this.lastRatingTick >= this.ratingInterval) {
            this.lastRatingTick = 0;
            this.evaluateRating();
        }

        if (this.currentMode === 'defense' && this.updateDefenseMode(dt)) {
            return;
        }
    }

    private updateDefenseMode(dt: number): boolean {
        if (this.state !== GameState.PLAYING || !this.defensePainting.active) return false;

        this.defenseElapsed += dt;
        this.defenseIntegrityTick += dt;

        if (this.defenseIntegrityTick >= 0.25) {
            this.defenseIntegrityTick = 0;
            const integrity = this.defensePainting.refreshIntegrity();
            this.updateDefenseHud(integrity);

            if (integrity <= 0.015) {
                this.defenseFailureMessage = '画作已被擦除';
                this.gameOver(this.getCurrentRunScore());
                return true;
            }
        }

        if (this.defenseElapsed >= 20 * 60) {
            this.gameOver(this.getCurrentRunScore(), true);
            return true;
        }

        return false;
    }

    private handleDefenseRepair(detail: any): void {
        if (this.currentMode !== 'defense' || this.state !== GameState.PLAYING || !this.defensePainting.active) return;
        if (!detail || !Number.isFinite(detail.x) || !Number.isFinite(detail.y)) return;

        const now = performance.now();
        const type = String(detail.type || 'standard');
        const minInterval = type === 'roller' || type === 'flamethrower' ? 80 : 105;
        if (now - this.lastDefenseRepairAt < minInterval) return;

        const strengthByType: Record<string, number> = {
            roller: 0.055,
            flamethrower: 0.07,
            shotgun: 0.12,
            melee: 0.24,
            sniper: 0.25,
            rocket: 0.2,
            ribbon: 0.13,
            ruler: 0.14
        };
        const strength = strengthByType[type] ?? 0.16;
        this.defensePainting.repairStroke(
            detail.x,
            detail.y,
            Number.isFinite(detail.rotation) ? detail.rotation : 0,
            Number.isFinite(detail.range) ? detail.range : 180,
            Number.isFinite(detail.width) ? detail.width : 32,
            strength
        );
        this.lastDefenseRepairAt = now;
    }

    private updateDefenseHud(integrity: number = this.defensePainting.getIntegrity()): void {
        if (!this.defenseHud || this.currentMode !== 'defense') return;

        let attackingErasers = 0;
        for (const entity of this.entities.values()) {
            if (!entity.active || !entity.tags.has('enemy')) continue;
            const behavior = entity.getComponent(EnemyBehavior);
            const transform = entity.getComponent(Transform);
            if (behavior?.type === 'eraser' && transform && this.defensePainting.isNearPainting(transform.x, transform.y, 80)) {
                attackingErasers++;
            }
        }

        renderDefenseHud(this.defenseHud, { name: this.defensePainting.name, integrity,
            attackers: attackingErasers, remaining: 20 * 60 - this.defenseElapsed, zh: getLang() === 'zh' });
    }

    private setCombatFieldNotesVisible(visible: boolean): void {
        if (!visible) for (const system of this.systems) {
            if (system instanceof RenderSystem) system.hideScenery();
        }
        const scene = document.getElementById('courtyardCanvas');
        if(scene && !visible)scene.style.display='none';
        const notes = document.getElementById('combat-field-notes');
        if (notes) notes.style.display = visible ? 'block' : 'none';
    }

    private setDefenseHudVisible(visible: boolean): void {
        if (!this.defenseHud) return;
        this.defenseHud.style.display = visible ? 'flex' : 'none';
        if (visible) this.updateDefenseHud();
    }

    private getCurrentRunScore(): number {
        for (const entity of this.entities.values()) {
            if (!entity.tags.has('player')) continue;
            return entity.getComponent(Score)?.value || 0;
        }
        return 0;
    }

    private render(): void {
        // Clear game canvas
        this.gameCtx.clearRect(0, 0, this.width, this.height);
        
        // Update Trail Canvas Position (Camera + Shake)
        const shakeX = this.camera.shakeX || 0;
        const shakeY = this.camera.shakeY || 0;
        this.trailCanvas.style.transform = `translate(${-this.camera.x + shakeX}px, ${-this.camera.y + shakeY}px)`;
        
        // Render logic will be handled by RenderSystem
    }
    
    private evaluateRating(): void {
        const x = Math.max(0, Math.min(this.worldWidth - this.width, this.camera.x));
        const y = Math.max(0, Math.min(this.worldHeight - this.height, this.camera.y));
        const w = Math.min(this.width, this.worldWidth - x);
        const h = Math.min(this.height, this.worldHeight - y);
        this.ratingCtx.clearRect(0, 0, 64, 64);
        this.ratingCtx.drawImage(this.trailCanvas, x, y, w, h, 0, 0, 64, 64);
        let density = 0;
        let contrast = 0;
        let edges = 0;
        const img = this.ratingCtx.getImageData(0, 0, 64, 64);
        const data = img.data;
        let prev = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a > 10) density++;
            const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722);
            contrast += Math.abs(lum - 128);
            const diff = Math.abs(lum - prev);
            if (diff > 25) edges++;
            prev = lum;
        }
        const totalPixels = (data.length / 4) || 1;
        const dScore = Math.min(100, (density / totalPixels) * 120);
        const cScore = Math.min(100, (contrast / totalPixels) * 0.8);
        const eScore = Math.min(100, (edges / totalPixels) * 1.2);
        const rating = Math.floor((dScore * 0.4) + (cScore * 0.3) + (eScore * 0.3));
        for (const [, e] of this.entities) {
            if (!e.tags.has('player')) continue;
            const sc = e.getComponent(Score);
            if (sc) sc.rating = rating;
        }
        if (rating >= 70 && (performance.now() - this.lastBuffTime > 10000)) {
            this.lastBuffTime = performance.now();
            for (const [, e] of this.entities) {
                if (!e.tags.has('player')) continue;
                const wpn = e.getComponent(Weapon);
                if (wpn) {
                    wpn.critChance = Math.min(0.8, wpn.critChance + 0.15);
                    setTimeout(() => {
                        wpn.critChance = Math.max(0, wpn.critChance - 0.15);
                    }, 8000);
                }
            }
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `评分加成：暴击提升` } }));
        }
        if (rating >= 85 && (performance.now() - this.lastEliteTime > 15000)) {
            this.lastEliteTime = performance.now();
            let px = 0, py = 0;
            for (const [, e] of this.entities) {
                if (!e.tags.has('player')) continue;
                const t = e.getComponent(Transform);
                if (t) { px = t.x; py = t.y; }
            }
            const elite = EnemyFactory.create('shield', px + 120, py);
            const hp = elite.getComponent(Health);
            const vel = elite.getComponent(Velocity);
            if (hp) { hp.max = Math.floor(hp.max * 1.5); hp.current = hp.max; }
            if (vel) { vel.speed *= 1.3; }
            this.addEntity(elite);
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `精英出现` } }));
        }
    }
    
    private buyStudioTime(sec: number): void {
        let coins = 0;
        for (const [, e] of this.entities) {
            if (!e.tags.has('player')) continue;
            const sc = e.getComponent(Score);
            if (sc) coins = sc.coins;
        }
        if (coins < sec) {
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `金币不足` } }));
            return;
        }
        for (const [, e] of this.entities) {
            if (!e.tags.has('player')) continue;
            const sc = e.getComponent(Score);
            if (sc) sc.coins -= sec;
        }
        this.studioTimeLeft += sec;
        this.enterStudio();
    }
    
    private enterStudio(): void {
        this.state = GameState.STUDIO;
        for (const [, e] of this.entities) {
            if (e.tags.has('enemy')) e.active = false;
        }
        if (this.gameOverMenu) this.gameOverMenu.style.display = 'none';
        if (this.gameUI) this.gameUI.style.display = 'block';
        if (!this.isRunning) {
            this.start();
        }
    }
    
    private updateStudio(dt: number): void {
        const allow = new Set(['InputSystem','MovementSystem','SkillSystem','TrailSystem','RenderSystem','UISystem','MinimapSystem']);
        try {
            for (const system of this.systems) {
                const name = (system as any).constructor.name;
                if (allow.has(name)) system.update(dt);
            }
        } catch (e) {
            console.error('System update failed:', e);
        }
        this.studioTimeLeft -= dt;
        if (this.studioTimeLeft <= 0) {
            this.studioTimeLeft = 0;
            for (const [, e] of this.entities) {
                if (!e.tags.has('player')) continue;
                const sc = e.getComponent(Score);
                if (sc) sc.coins = 0;
            }
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `创作时间结束` } }));
            window.dispatchEvent(new CustomEvent('open-esc'));
        }
        
        const shakeX = this.camera.shakeX || 0;
        const shakeY = this.camera.shakeY || 0;
        this.trailCanvas.style.transform = `translate3d(${-this.camera.x + shakeX}px, ${-this.camera.y + shakeY}px, 0)`;
    }
    
    private clearInput(): void {
        this.inputManager.clear();
    }

    private dismissPauseMenus(): void {
        for (const system of this.systems) if (system instanceof UISystem) system.dismissPause();
        const modal = document.getElementById('frame-save-modal');
        if (modal) modal.style.display = 'none';
    }

    private isDrawingSystem(system: System): boolean {
        // Use type identity rather than class names, which production builds minify.
        return system instanceof InputSystem || system instanceof MovementSystem || system instanceof WeaponSystem
            || system instanceof ParticleSystem || system instanceof TrailSystem || system instanceof SkeletonSystem
            || system instanceof RenderSystem || system instanceof MinimapSystem;
    }

    private finishDrawing(): void {
        if (this.currentMode !== 'drawing' || this.state !== GameState.PLAYING) return;
        this.gameOver(0, true);
    }

    private async openGallery(): Promise<void> {
        if (this.state !== GameState.MENU) return;
        this.setCombatFieldNotesVisible(false);
        this.stop();
        this.clearInput();
        this.state = GameState.GALLERY;
        this.mainMenu.style.display = 'none';
        this.gameCanvas.style.visibility = 'hidden';
        this.trailCanvas.style.visibility = 'hidden';
        const generation = ++this.galleryGeneration;
        const button = document.getElementById('gallery-btn') as HTMLButtonElement;
        button.disabled = true;
        const returnToMenu = () => {
            if (generation !== this.galleryGeneration) return;
            this.state = GameState.MENU;
            this.mainMenu.style.display = 'flex';
            this.clearInput();
            button.disabled = false;
        };
        try {
            const { ArtGallery } = await import('../gallery/ArtGallery');
            if (generation !== this.galleryGeneration || this.state !== GameState.GALLERY) return;
            this.gallery ??= new ArtGallery();
            this.mainMenu.style.display = 'none';
            this.gameCanvas.style.visibility = 'hidden';
            this.trailCanvas.style.visibility = 'hidden';
            this.setCombatFieldNotesVisible(false);
            await this.gallery.open(() => {
                this.gameCanvas.style.visibility = '';
                this.trailCanvas.style.visibility = '';
                returnToMenu();
            });
        } catch (error) {
            if (generation !== this.galleryGeneration) return;
            this.gallery?.close();
            this.gameCanvas.style.visibility = '';
            this.trailCanvas.style.visibility = '';
            returnToMenu();
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `画廊打开失败：${error instanceof Error ? error.message : '请重试'}` } }));
        } finally { button.disabled = false; }
    }

    private showGallerySaveDialog(): void {
        const modal = document.getElementById('frame-save-modal');
        const name = document.getElementById('gallery-art-name') as HTMLInputElement | null;
        if (!modal || !name) return;
        if (!this.savedGalleryId) {
            const label = this.currentMode === 'drawing' ? '自由创作' : this.currentMode === 'defense' ? '守卫画作' : '战斗画作';
            name.value = `${label} ${new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        }
        const status = document.getElementById('gallery-save-status');
        if (status && !this.savingGallery) status.textContent = this.savedGalleryId ? '本次作品已收藏，再次保存会更新这一幅。' : '保存在当前设备，可在主菜单「我的画廊」中查看。';
        modal.style.display = 'flex';
        this.clearInput();
        name.focus(); name.select();
    }

    private async saveToGallery(): Promise<void> {
        if (this.savingGallery) return;
        if (this.state !== GameState.GAMEOVER && !(this.state === GameState.PLAYING && !this.isRunning)) return;
        this.savingGallery = true;
        const button = document.getElementById('gallery-save-confirm') as HTMLButtonElement;
        const status = document.getElementById('gallery-save-status')!;
        const name = (document.getElementById('gallery-art-name') as HTMLInputElement).value.trim() || '未命名作品';
        button.disabled = true;
        status.textContent = '正在保存作品…';
        // Capture identity and pixels before any asynchronous storage operation.
        const generation = this.runGeneration;
        const mode = this.currentMode === 'story' ? 'endless' : this.currentMode;
        const canvas = this.getExportCanvas();
        const width = canvas.width, height = canvas.height;
        const id = this.savedGalleryId;
        try {
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片编码失败')), 'image/png'));
            const artwork = await GalleryStore.save({ id, name, mode, width, height, blob });
            if (generation === this.runGeneration) {
                this.savedGalleryId = artwork.id;
                status.textContent = '已保存到我的画廊 ✓（返回主菜单即可参观）';
            }
        } catch (error) {
            if (generation === this.runGeneration) status.textContent = `保存失败：${error instanceof Error ? error.message : '本地存储不可用'}。请重试或导出 PNG 备份。`;
        } finally { this.savingGallery = false; button.disabled = false; }
    }

    private async saveImageToFrame(frameIndex: number): Promise<boolean> {
        if (this.savingFrame) return false;
        this.savingFrame = true;
        const status = document.getElementById('frame-save-status');
        if (status) status.textContent = '正在保存，请稍候…';
        const buttons = document.querySelectorAll<HTMLButtonElement>('.frame-select-btn');
        buttons.forEach(button => button.disabled = true);
        // Guard Mode saves the whole collaboration: original art, battle scars,
        // and the player's upper-layer marks.
        try {
            const canvas = this.getExportCanvas();
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('图片编码失败，请重试。')), 'image/png'));
            await ArtworkStore.saveFrame(frameIndex, blob);
            if (status) status.textContent = `已保存至画框 ${frameIndex}`;
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `作品已保存至画框 ${frameIndex}！` } }));
            await this.loadFramesToMenu();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `dont_erase_me_art_${Date.now()}.png`;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            return true;
        } catch (e) {
            const message = e instanceof Error ? e.message : '本地存储不可用';
            if (status) status.textContent = `保存失败：${message}。可以重试，或仅导出 PNG。`;
            window.dispatchEvent(new CustomEvent('announce', { detail: { text: `画框保存失败：${message}。请重试，或使用“导出 PNG”。` } }));
            return false;
        } finally {
            this.savingFrame = false;
            buttons.forEach(button => button.disabled = false);
        }
    }

    public async loadFramesToMenu(): Promise<void> {
        const generation = ++this.frameLoadGeneration;
        let blobs: (Blob | null)[];
        try {
            // One damaged legacy slot must not hide healthy IndexedDB frames.
            await ArtworkStore.migrateLegacyFrames().catch(error => {
                console.warn('Legacy artwork migration deferred; original data retained.', error);
            });
            blobs = await Promise.all([1, 2, 3, 4].map(index => ArtworkStore.getFrame(index)));
        } catch (error) {
            if (!this.frameStorageWarningShown) {
                this.frameStorageWarningShown = true;
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: '本地画库读取失败，旧画作没有被删除。请检查存储空间后重试。' } }));
            }
            return;
        }
        if (generation !== this.frameLoadGeneration) return;
        for (let i = 1; i <= 4; i++) {
            const oldUrl = this.frameUrls.get(i);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            this.frameUrls.delete(i);
            const dataUrl = blobs[i - 1] ? URL.createObjectURL(blobs[i - 1]!) : null;
            if (dataUrl) this.frameUrls.set(i, dataUrl);
            const imgEl = document.getElementById(`frame-img-${i}`) as HTMLImageElement;
            const spanEl = document.querySelector(`#frame-${i} span`) as HTMLElement;
            
            if (imgEl && spanEl) {
                if (dataUrl) {
                    imgEl.src = dataUrl;
                    imgEl.style.display = 'block';
                    spanEl.style.display = 'none';
                } else {
                    imgEl.style.display = 'none';
                    spanEl.textContent = t(`画框 ${i}`);
                    spanEl.style.display = 'block';
                }
            }
        }
    }

    public updateUITexts(): void {
        const setText = (id: string, textKey: string) => {
            const el = document.getElementById(id);
            if (el) (el.querySelector('[data-ui-label]') || el).textContent = t(textKey);
        };

        setText('endless-btn', '开始游戏');
        setText('settings-btn', '设置');
        setText('exit-btn', '退出游戏');
        setText('restart-btn', '再玩一次');
        setText('save-btn', '保存作品');
        setText('back-main-btn', '返回主界面');
        const replayButton = document.getElementById('replay-btn');
        if (replayButton) replayButton.textContent = getLang() === 'zh' ? '回放本局画作' : 'Replay Artwork';
        setText('back-to-menu-btn', '返回主界面');
        setText('start-run-btn', '确认出击');
        
        // Character and Weapon Selection
        const selTitle = document.querySelector('#selection-screen h2') as HTMLElement;
        if (selTitle) selTitle.textContent = t('出击准备');
        
        const charTitle = document.querySelector('.selection-container > div:nth-child(1) h3') as HTMLElement;
        if (charTitle) charTitle.textContent = t('选择角色');
        
        const wpTitle = document.querySelector('.selection-container > div:nth-child(2) h3') as HTMLElement;
        if (wpTitle) wpTitle.textContent = t('选择初始画笔 (武器)');
        
        // Settings texts
        const settingsTitle = document.querySelector('#settings-modal h2');
        if (settingsTitle) settingsTitle.textContent = t('设置') + ' (Settings)';
        
        const langTitle = document.querySelector('#settings-modal h3:nth-of-type(1)');
        if (langTitle) langTitle.textContent = getLang() === 'zh' ? '语言 (Language)' : 'Language';
        const dispTitle = document.querySelector('#settings-modal h3:nth-of-type(2)');
        if (dispTitle) dispTitle.textContent = getLang() === 'zh' ? '显示 (Display)' : 'Display';
        
        setText('fullscreen-btn', '全屏模式 / Fullscreen');
        setText('windowed-btn', '窗口模式 / Windowed');
        setText('close-settings-btn', '返回 (Back)');
        document.getElementById('lang-zh-btn')?.setAttribute('aria-pressed', String(getLang() === 'zh'));
        document.getElementById('lang-en-btn')?.setAttribute('aria-pressed', String(getLang() === 'en'));

        // Saved artworks are now displayed by the on-demand gallery.
        
        // Re-render selection screen if it's visible
        if (this.state === GameState.SELECTION) {
            this.showSelectionScreen();
        }
    }
}
