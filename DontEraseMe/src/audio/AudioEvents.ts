export const SOUND_CUES = [
    'shot-brush', 'shot-spray', 'shot-scrape', 'shot-chain', 'shot-ruler', 'shot-ribbon',
    'shot-vortex', 'shot-bucket', 'shot-pen', 'shot-airbrush', 'shot-compass', 'shot-dropper',
    'hit', 'hit-heavy', 'kill', 'hurt', 'shield', 'dash', 'skill', 'explosion', 'pickup',
    'reload', 'level-up', 'victory', 'defeat', 'ui-click', 'magic',
] as const;
export type SoundCue = typeof SOUND_CUES[number];
export type SoundOptions = { x?: number; y?: number; gain?: number; pitch?: number };
type Listener = (cue: SoundCue, options: SoundOptions) => void;
const listeners = new Set<Listener>();
/** Pure optional presentation bus: combat works identically without an audio device. */
export function emitGameSound(cue: SoundCue, options: SoundOptions = {}): void {
    for (const listener of listeners) {
        try { listener(cue, options); } catch { /* Audio must never interrupt damage/loot. */ }
    }
}
export function listenGameSounds(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
