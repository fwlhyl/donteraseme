import type { WeaponType } from '../components/Weapon';

// Pixel silhouettes in the held-weapon coordinate system: the grip is at (0, 3),
// the firing direction is +X, and the hand/aim/reload rig is applied by the caller.
const INK = '#272c28', METAL = '#536056', EDGE = '#93a092';
const WOOD = '#8b795e', PAPER = '#c8c2aa', DARK = '#353d37';

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** The shared rig draws arms and muzzle effects; only the tool and magazine live here. */
export function drawWeaponShapeA(
    ctx: CanvasRenderingContext2D, type: WeaponType, reloading: boolean, magazineShift: number,
): boolean {
    const r = (color: string, x: number, y: number, w: number, h: number) => rect(ctx, color, x, y, w, h);
    switch (type) {
        case 'standard': {
            // A brush-shaped pistol: wood handle, ferrule and a squared bristle tip.
            // Silhouette ends at x=25 to meet the existing muzzle flash.
            r(INK,-6,-5,25,9); r(DARK,-4,-4,21,7);
            r(WOOD,-3,-3,13,5); r(PAPER,-2,-3,10,1);
            r(INK,9,-5,5,9); r(METAL,10,-4,3,7); r(EDGE,11,-4,1,6);
            r(INK,14,-4,8,7); r(PAPER,15,-3,7,5);
            r(EDGE,17,-3,1,5); r(METAL,20,-3,1,5); r(INK,22,-2,3,3);
            r(INK,-3,3,7,10); r(WOOD,-2,4,4,7); r(DARK,-1,5,1,5);
            r(INK,3,3,7,2); r(INK,8,4,2,4); r(INK,3,8,7,2);
            if (reloading) { r(INK,0,12+magazineShift,4,7); r(METAL,1,13+magazineShift,2,4); }
            return true;
        }
        case 'shotgun': {
            // Double-spray canister: twin outlets and a ribbed trigger/pump.
            r(INK,-8,-5,23,10); r(DARK,-6,-4,19,8);
            r(METAL,-4,-3,17,3); r(EDGE,-3,-3,13,1);
            r(INK,12,-8,10,15); r(METAL,13,-7,8,13); r(EDGE,14,-6,2,10);
            r(INK,21,-6,6,5); r(INK,21,1,6,5);
            r(PAPER,24,-5,4,2); r(PAPER,24,2,4,2); r(INK,27,-5,2,3); r(INK,27,2,2,3);
            r(INK,-3,4,7,8); r(WOOD,-2,5,4,5);
            r(INK,6,4,10,5); r(WOOD,7,5,8,3);
            r(DARK,9,5,2,3); r(DARK,13,5,2,3);
            r(INK,6,7+magazineShift,6,8); r(METAL,7,8+magazineShift,3,5);
            return true;
        }
        case 'melee': {
            // Palette knife: a narrow wooden handle and broad, stepped scraper blade.
            r(INK,-7,-2,12,5); r(WOOD,-5,-1,8,3); r(PAPER,-4,-1,5,1);
            r(INK,3,-5,4,10); r(METAL,4,-4,2,8);
            r(INK,7,-6,17,13); r(INK,24,-5,4,11); r(INK,28,-3,3,7);
            r(METAL,8,-4,16,9); r(EDGE,10,-4,14,2);
            r(PAPER,10,3,15,2); r(PAPER,25,1,3,3);
            r(DARK,11,-1,12,1);
            return true;
        }
        case 'chain': {
            // Ink spool and linked barrel: the alternating gaps give a chain silhouette.
            r(INK,-8,-5,20,10); r(DARK,-6,-4,16,8);
            r(METAL,-4,-3,13,3); r(EDGE,-3,-3,10,1);
            r(INK,-3,4,7,8); r(WOOD,-2,5,4,5);
            r(INK,5,-9,11,16); r(METAL,6,-8,9,14);
            r(DARK,7,-6,7,10); r(EDGE,8,-5,5,2); r(EDGE,8,1,5,2);
            r(INK,14,-3,15,6); r(METAL,15,-2,13,4);
            for (const x of [16,20,24]) { r(INK,x,-2,2,4); r(EDGE,x+1,-1,1,2); }
            r(INK,27,-3,2,6);
            r(INK,6,7+magazineShift,6,8); r(METAL,7,8+magazineShift,3,5);
            return true;
        }
        default:
            return false;
    }
}
