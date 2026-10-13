import { SOUND_CUES, type SoundCue, type SoundOptions } from './AudioEvents';
import { loadAudioSettings, sanitizeAudioSettings, saveAudioSettings, type AudioSettings } from './AudioSettings';

export type MusicTrack = 'menu' | 'atelier' | 'ruins';
export type AudioScene = { music: MusicTrack | null; combat: boolean; paused: boolean; x: number; y: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan?: StereoPannerNode; priority: number; combat: boolean };
type MusicVoice = { source: AudioBufferSourceNode; gain: GainNode };
const UI_CUES = new Set<SoundCue>(['ui-click', 'level-up', 'victory', 'defeat']);
const PRIORITY: Partial<Record<SoundCue, number>> = { hurt: 5, shield: 4, magic: 4, explosion: 3, 'hit-heavy': 2,
    'level-up': 6, victory: 6, defeat: 6, 'ui-click': 5, pickup: 0 };
const COOLDOWN: Partial<Record<SoundCue, number>> = { hit: .065, 'hit-heavy': .08, kill: .11, pickup: .13,
    hurt: .2, shield: .16, explosion: .15, skill: .2, 'shot-airbrush': .095, 'shot-ribbon': .075, 'ui-click': .045 };
const GAIN: Partial<Record<SoundCue, number>> = { hit: .48, kill: .50, pickup: .30, 'ui-click': .4,
    'shot-airbrush': .36, 'shot-ribbon': .48, 'hit-heavy': .78, hurt: .85, explosion: .9, magic: .85 };
const finite = (value: number | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** One Web Audio graph. Asset decoding and voice limits never run inside combat logic. */
export class AudioDirector {
    settings = loadAudioSettings();
    private context?: AudioContext;
    private master?: GainNode;
    private musicBus?: GainNode;
    private effectsBus?: GainNode;
    private buffers = new Map<string, AudioBuffer>();
    private loading = new Map<string, Promise<AudioBuffer | undefined>>();
    private failed = new Set<string>();
    private voices = new Set<Voice>();
    private musicVoices = new Set<MusicVoice>();
    private currentMusic?: MusicTrack;
    private requestedMusic: MusicTrack | null = null;
    private musicPending?: MusicTrack;
    private lastCue = new Map<string, number>();
    private events: number[] = [];
    private serial = 0;
    private duckUntil = 0;
    private blocked = true;
    private disposed = false;
    private unsubscribeState?: () => void;
    private statusListener?: (message: string) => void;
    status = '点击或按键后启用声音';

    constructor(private urls: Record<string, string>, private readScene: () => AudioScene) {}
    onStatus(listener: (message: string) => void): void { this.statusListener = listener; listener(this.status); }
    private report(message: string): void { this.status = message; this.statusListener?.(message); }
    get diagnostics() { return { state: this.context?.state ?? 'locked', voices: this.voices.size,
        musicVoices: this.musicVoices.size, track: this.currentMusic, decoded: this.buffers.size, failed: [...this.failed] }; }

    async unlock(): Promise<void> {
        if (this.disposed) return;
        try {
            if (!this.context) {
                this.context = new AudioContext({ latencyHint: 'interactive' });
                this.master = this.context.createGain(); this.musicBus = this.context.createGain(); this.effectsBus = this.context.createGain();
                const compressor = this.context.createDynamicsCompressor();
                compressor.threshold.value = -10; compressor.knee.value = 8; compressor.ratio.value = 8;
                compressor.attack.value = .003; compressor.release.value = .16;
                this.musicBus.connect(this.master); this.effectsBus.connect(this.master);
                this.master.connect(compressor); compressor.connect(this.context.destination);
                this.applyLevels();
                // Load one copy per sound, once. Never replay stale events after decoding.
                for (const cue of SOUND_CUES) void this.load(cue);
            }
            if (!document.hidden && this.context.state !== 'running') await this.context.resume();
            this.report(this.context.state === 'running' ? '声音已启用' : '请再次点击以启用声音');
            this.sync();
        } catch { this.report('音频暂不可用，游戏仍可正常进行；点击可重试'); }
    }

    private load(name: string): Promise<AudioBuffer | undefined> {
        const cached = this.buffers.get(name);
        if (cached) return Promise.resolve(cached);
        const pending = this.loading.get(name); if (pending) return pending;
        const url = this.urls[name], context = this.context;
        if (!url) { this.failed.add(name); this.report('部分声音资源缺失，游戏仍可正常进行'); return Promise.resolve(undefined); }
        if (!context || this.failed.has(name)) return Promise.resolve(undefined);
        const promise = fetch(url).then(response => {
            if (!response.ok) throw new Error(`Audio ${response.status}`);
            return response.arrayBuffer();
        }).then(data => context.decodeAudioData(data)).then(buffer => {
            if (!this.disposed) this.buffers.set(name, buffer);
            return buffer;
        }).catch(() => { if (!this.disposed) { this.failed.add(name); this.report('部分声音未加载，其他声音和游戏不受影响'); } return undefined; })
            .finally(() => this.loading.delete(name));
        this.loading.set(name, promise); return promise;
    }

    setSettings(patch: Partial<AudioSettings>): boolean {
        this.settings = sanitizeAudioSettings({ ...this.settings, ...patch });
        this.applyLevels();
        if (this.settings.muted || this.settings.master === 0 || this.settings.effects === 0) this.stopEffects();
        const saved = saveAudioSettings(this.settings);
        if (!saved) this.report('音量本次已生效，但本地保存失败');
        return saved;
    }
    private target(param: AudioParam, value: number, smoothing = .04): void {
        const now = this.context!.currentTime;
        param.cancelScheduledValues(now); param.setTargetAtTime(value, now, smoothing);
    }
    private applyLevels(): void {
        if (!this.context || !this.master || !this.musicBus || !this.effectsBus) return;
        const scene = this.readScene();
        this.target(this.master.gain, this.settings.muted ? 0 : this.settings.master);
        this.target(this.effectsBus.gain, this.settings.effects);
        this.target(this.musicBus.gain, this.settings.music * (scene.paused ? .25 : 1)
            * (this.context.currentTime < this.duckUntil ? .55 : 1), .12);
    }
    /** Called even when the game's simulation is stopped, so menu/replay changes are safe. */
    sync(): void {
        if (!this.context || this.disposed) return;
        const scene = this.readScene();
        const blocked = !scene.combat || scene.paused || document.hidden;
        if (blocked && !this.blocked) this.stopEffects(true);
        this.blocked = blocked; this.requestedMusic = scene.music;
        if (document.hidden) return;
        this.applyLevels();
        if (scene.music === null) {
            if (this.currentMusic || this.musicPending) this.fadeMusic();
            this.currentMusic = undefined; this.musicPending = undefined;
        } else if (this.currentMusic !== scene.music && this.musicPending !== scene.music && !this.failed.has(scene.music)) {
            const name = scene.music; this.musicPending = name;
            void this.load(name).then(buffer => {
                if (this.musicPending === name) this.musicPending = undefined;
                if (!buffer || this.disposed || this.requestedMusic !== name || this.currentMusic === name || document.hidden) return;
                this.fadeMusic();
                const ctx = this.context!, source = ctx.createBufferSource(), gain = ctx.createGain();
                source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(this.musicBus!);
                gain.gain.value = 0; gain.gain.linearRampToValueAtTime(1, ctx.currentTime + .8);
                const voice = { source, gain }; this.musicVoices.add(voice);
                source.onended = () => { this.musicVoices.delete(voice); source.disconnect(); gain.disconnect(); };
                source.start(); this.currentMusic = name;
            });
        }
    }
    private fadeMusic(): void {
        if (!this.context) return;
        // Keep only one fading predecessor even during rapid menu/mode changes.
        const voices = [...this.musicVoices];
        for (let i = 0; i < voices.length; i++) {
            const voice = voices[i];
            if (i < voices.length - 1) { voice.source.stop(); this.musicVoices.delete(voice); }
            else {
                const now = this.context.currentTime;
                voice.gain.gain.cancelScheduledValues(now);
                voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
                voice.gain.gain.linearRampToValueAtTime(0, now + .65); voice.source.stop(now + .7);
            }
        }
    }

    play(cue: SoundCue, options: SoundOptions = {}): boolean {
        const ctx = this.context, buffer = this.buffers.get(cue);
        if (!ctx || ctx.state !== 'running' || !buffer || this.disposed || document.hidden
            || this.settings.muted || !this.settings.master || !this.settings.effects) return false;
        const scene = this.readScene(), combat = !UI_CUES.has(cue);
        if (combat && (!scene.combat || scene.paused)) return false;
        const now = ctx.currentTime, priority = PRIORITY[cue] ?? 1;
        if (now - (this.lastCue.get(cue) ?? -Infinity) < (COOLDOWN[cue] ?? .055)) return false;
        const hasPosition = Number.isFinite(options.x) && Number.isFinite(options.y);
        const dx = hasPosition ? options.x! - scene.x : 0, dy = hasPosition ? options.y! - scene.y : 0;
        const distance = Math.hypot(dx, dy);
        if (distance > 1250) return false;
        this.events = this.events.filter(time => now - time < 1);
        if (this.events.length >= 36 && priority < 3) return false;
        if (this.voices.size >= 18) {
            const weakest = [...this.voices].sort((a, b) => a.priority - b.priority)[0];
            if (weakest.priority > priority) return false;
            weakest.source.stop(); this.voices.delete(weakest);
        }
        this.events.push(now); this.lastCue.set(cue, now);
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        const pan = ctx.createStereoPanner();
        source.buffer = buffer;
        const variation = ((++this.serial * 16807 % 97) / 96 - .5) * .08;
        source.playbackRate.value = Math.max(.7, Math.min(1.3, finite(options.pitch, 1) + (UI_CUES.has(cue) ? 0 : variation)));
        gain.gain.value = (GAIN[cue] ?? .65) * Math.max(0, Math.min(1.5, finite(options.gain, 1))) / (1 + distance / 500);
        pan.pan.value = Math.max(-.65, Math.min(.65, dx / 650));
        source.connect(gain); gain.connect(pan); pan.connect(this.effectsBus!);
        const voice: Voice = { source, gain, pan, priority, combat }; this.voices.add(voice);
        source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); pan.disconnect(); };
        source.start();
        if (priority >= 3 && cue !== 'ui-click') { this.duckUntil = now + .24; this.applyLevels(); }
        return true;
    }
    private stopEffects(combatOnly = false): void {
        for (const voice of this.voices) if (!combatOnly || voice.combat) { voice.source.stop(); this.voices.delete(voice); }
    }
    async setHidden(hidden: boolean): Promise<void> {
        if (!this.context || this.disposed) return;
        try {
            if (hidden) { this.stopEffects(); await this.context.suspend(); }
            else { await this.context.resume(); this.sync(); }
        } catch { this.report('点击以恢复声音'); }
    }
    attachCleanup(cleanup: () => void): void { this.unsubscribeState = cleanup; }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.unsubscribeState?.(); this.stopEffects();
        for (const voice of this.musicVoices) voice.source.stop();
        this.musicVoices.clear(); void this.context?.close();
    }
}
