import { drawPaperCollector, getPaperCollector } from '../art/PaperCollectorArt';
import { drawVariantAHead } from '../art/CharacterVariantsA';
import { drawVariantBHead } from '../art/CharacterVariantsB';
import { drawVariantCHead } from '../art/CharacterVariantsC';

/** Transparent pixel portrait drawn from the same head art as the game rig. */
export function createCharacterPortrait(characterId: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    canvas.setAttribute('aria-hidden', 'true');
    // The game globally positions canvases absolutely; portraits participate in
    // the button's layout instead. Styling can still size the portrait itself.
    canvas.style.position = 'static';
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;

    if (characterId === 'collector') {
        // The collector's head is private to the rig. Clip that exact head out
        // of the original drawing without duplicating its art or drawing a torso.
        ctx.save();
        ctx.translate(32, 54);
        ctx.scale(1.6, 1.6);
        ctx.beginPath(); ctx.rect(-22, -40, 44, 33); ctx.clip();
        drawPaperCollector(ctx, getPaperCollector(), 64, false, 0, undefined, null, undefined, 'collector');
        ctx.restore();
    } else {
        // Variant head functions draw the real hair, hats and accessories,
        // including the long braid, separately from their body and weapon.
        ctx.save();
        ctx.translate(32, 51);
        ctx.scale(1.3, 1.3);
        drawVariantAHead(ctx, characterId) || drawVariantBHead(ctx, characterId) || drawVariantCHead(ctx, characterId);
        ctx.restore();
    }
    return canvas;
}
