/** Small in-memory compatibility images; no retired artwork is loaded from disk. */
const images = new Map<string, HTMLImageElement>();
export function neutralArtImage(kind: 'player' | 'enemy' | 'weapon' | 'skill'): HTMLImageElement {
    const cached = images.get(kind);
    if (cached) return cached;
    const shapes = {
        player: '<path d="M22 7h20v17H22zM18 25h28v24H18zM20 49h9v13h-9zM35 49h9v13h-9z" fill="#292b28"/><path d="M27 13h14v9H27z" fill="#d7d5cb"/>',
        enemy: '<path d="M8 19h45l4 25H7l7-9-7-6z" fill="#d7d5cb" stroke="#292b28" stroke-width="2"/><path d="M40 19h13l4 25H40zM8 29l14 4-12 8z" fill="#292b28"/>',
        weapon: '<path d="M8 23h37v5h15v8H43v5H24l-4 14H10l6-17H8z" fill="#292b28"/><path d="M20 27h21v5H20z" fill="#b8bab0"/>',
        skill: '<path d="M9 25h46v17H9zM29 14h6v11h-6zM22 42h20v6H22z" fill="#292b28"/><path d="M14 29h36v8H14z" fill="#d7d5cb"/>',
    };
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${shapes[kind]}</svg>`)}`;
    images.set(kind, image);
    return image;
}
