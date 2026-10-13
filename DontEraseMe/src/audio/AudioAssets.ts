// Vite emits hashed local files; no network service, CDN or streaming dependency.
const urls = import.meta.glob<string>('../assets/audio/*.wav', { eager: true, as: 'url' });
export const AUDIO_URLS = Object.fromEntries(Object.entries(urls).map(([path, url]) =>
    [path.slice(path.lastIndexOf('/') + 1, -4), url]));
