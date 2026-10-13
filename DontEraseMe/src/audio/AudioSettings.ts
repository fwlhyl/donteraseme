export type AudioSettings = { master: number; music: number; effects: number; muted: boolean };
export const AUDIO_SETTINGS_KEY = 'dont_erase_me_audio_v1';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { master: .8, music: .32, effects: .8, muted: false };
export function sanitizeAudioSettings(raw: unknown): AudioSettings {
    const settings = { ...DEFAULT_AUDIO_SETTINGS };
    if (!raw || typeof raw !== 'object') return settings;
    const input = raw as Record<string, unknown>;
    for (const key of ['master', 'music', 'effects'] as const) {
        if (typeof input[key] === 'number' && Number.isFinite(input[key])) settings[key] = Math.max(0, Math.min(1, input[key]));
    }
    if (typeof input.muted === 'boolean') settings.muted = input.muted;
    return settings;
}
export function loadAudioSettings(): AudioSettings {
    try { return sanitizeAudioSettings(JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) || 'null')); }
    catch { return { ...DEFAULT_AUDIO_SETTINGS }; }
}
export function saveAudioSettings(settings: AudioSettings): boolean {
    try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(sanitizeAudioSettings(settings))); return true; }
    catch { return false; }
}
