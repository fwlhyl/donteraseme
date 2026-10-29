import type { WeaponType } from '../components/Weapon';

// Weapon-local pixel blocks. Origin is the trigger hand; +X is the muzzle.
// This palette matches the muted ink and material tones of the collector rig.
const ink = '#272c28', dark = '#3e4841', metal = '#68766a', edge = '#a4ad96';
const wood = '#8f8062', paper = '#c1b8a0', glass = '#879d99';
function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = ink): void {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
}

/** Draws the tool, in the shared held-weapon coordinate system. */
export function drawWeaponShapeC(ctx: CanvasRenderingContext2D, type: WeaponType, reloading = false, magazineShift = 0): boolean {
    if (type === 'sniper') {
        // Fountain pen: a slender barrel, a broad drafting nib and a sighting clip.
        pixel(ctx,-9,-3,35,7); pixel(ctx,-6,-2,29,3,metal); pixel(ctx,-4,-2,23,1,edge);
        pixel(ctx,-10,-2,5,7); pixel(ctx,-9,-1,3,5,wood);
        pixel(ctx,0,3,6,9); pixel(ctx,1,4,3,6,wood);
        pixel(ctx,4,-7,14,4); pixel(ctx,6,-6,10,1,edge); pixel(ctx,7,-3,2,2,dark);
        pixel(ctx,24,-4,5,8); pixel(ctx,25,-3,3,6,paper);
        pixel(ctx,29,-3,4,6); pixel(ctx,33,-2,3,4); pixel(ctx,36,-1,3,2);
        pixel(ctx,30,-1,6,2,paper); pixel(ctx,34,0,4,1,dark);
        if (reloading) { const y = 6 + Math.round(magazineShift); pixel(ctx,7,y,5,7); pixel(ctx,8,y+1,3,5,glass); }
        return true;
    }
    if (type === 'flamethrower') {
        // Airbrush: upper paint cup and nozzle are the silhouette's identifying features.
        pixel(ctx,-8,-4,28,9); pixel(ctx,-6,-3,24,3,metal); pixel(ctx,-5,-3,18,1,edge);
        pixel(ctx,-9,-1,5,7); pixel(ctx,-8,0,3,4,wood);
        pixel(ctx,0,3,6,9); pixel(ctx,1,4,3,6,wood);
        pixel(ctx,7,-8,9,5); pixel(ctx,5,-13,13,7); pixel(ctx,6,-12,11,5,metal);
        pixel(ctx,7,-14,9,2,edge); pixel(ctx,8,-11,7,1,paper);
        pixel(ctx,20,-3,6,7); pixel(ctx,25,-2,4,5,dark); pixel(ctx,28,-1,3,3,edge);
        pixel(ctx,11,4,7,5); pixel(ctx,12,5,5,2,wood);
        if (reloading) { const y=8+Math.round(magazineShift); pixel(ctx,7,y,6,6); pixel(ctx,8,y+1,4,4,glass); }
        return true;
    }
    if (type === 'compass') {
        // A drawing compass held at its hinge: two long legs with a clear gap.
        pixel(ctx,-6,-3,10,7); pixel(ctx,-4,-2,6,3,metal); pixel(ctx,-2,3,5,7,wood);
        pixel(ctx,3,-4,7,7); pixel(ctx,5,-3,3,3,edge);
        pixel(ctx,9,-7,5,4); pixel(ctx,13,-9,5,4); pixel(ctx,17,-11,5,4);
        pixel(ctx,21,-10,5,4); pixel(ctx,25,-8,3,4); pixel(ctx,27,-6,3,3,paper);
        pixel(ctx,9,3,5,4); pixel(ctx,13,5,5,4); pixel(ctx,17,7,5,4);
        pixel(ctx,21,8,5,4); pixel(ctx,25,10,3,3); pixel(ctx,27,11,3,2,edge);
        pixel(ctx,10,-6,3,2,metal); pixel(ctx,14,-8,4,2,metal); pixel(ctx,18,-10,4,2,metal);
        pixel(ctx,10,4,3,2,metal); pixel(ctx,14,6,4,2,metal); pixel(ctx,18,8,4,2,metal);
        return true;
    }
    if (type === 'mine') {
        // Eyedropper: squeeze bulb, glass barrel and a narrow ink tip.
        pixel(ctx,-8,-5,12,11); pixel(ctx,-10,-3,3,7); pixel(ctx,-6,-7,8,2);
        pixel(ctx,-7,-4,9,7,dark); pixel(ctx,-5,-5,5,2,metal);
        pixel(ctx,3,-4,18,8); pixel(ctx,5,-3,14,6,glass); pixel(ctx,6,-2,10,1,edge);
        pixel(ctx,8,0,10,2,dark); pixel(ctx,18,-4,4,8); pixel(ctx,19,-3,2,6,paper);
        pixel(ctx,22,-3,4,6); pixel(ctx,26,-2,3,4); pixel(ctx,29,-1,3,2,edge);
        pixel(ctx,-3,5,6,7); pixel(ctx,-2,6,4,4,wood);
        if (reloading) { const y=6+Math.round(magazineShift); pixel(ctx,7,y,6,6); pixel(ctx,8,y+1,4,4,glass); }
        return true;
    }
    return false;
}
