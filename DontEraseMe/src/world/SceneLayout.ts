import { comicAtelierBounds } from './ComicAtelierLayout';

export type CourtyardTheme = 'atelier' | 'ruins';

/** Guard scenery lives outside the unchanged, rectangular gameplay board. */
export function sceneBounds(width: number, height: number, theme: CourtyardTheme) {
    if (theme === 'atelier') return comicAtelierBounds(width, height);
    // Conservative central 2/3 safe area also excludes the corner terraces.
    const margin = theme === 'ruins' ? 0.25 : 0;
    return { x: -width * margin, y: -height * margin,
        width: width * (1 + 2 * margin), height: height * (1 + 2 * margin) };
}

export function sceneCameraAxis(player: number, viewport: number, world: number, margin = 0): number {
    // Preserve centered artwork when the viewport can already see the board.
    if (viewport >= world) return (world - viewport) / 2;
    // A contained wide illustration has inset top/bottom edges. A viewport can
    // fit the picture before it fits the logical artwork board: center it then.
    if (world + 2 * margin <= viewport) return (world - viewport) / 2;
    return Math.max(-margin, Math.min(player - viewport / 2, world + margin - viewport));
}
