import heroesUrl from '../assets/doodle/heroes-body-v2.png';
import enemiesUrl from '../assets/doodle/enemies-v1.png';
import type { AtlasFrame } from './AtlasFrame';
import { drawAtlasFrame } from './AtlasFrame';
import type { EnemyType } from '../components/EnemyBehavior';
import { applyDoodlePose, drawDoodleAccent, type DoodlePose } from './DoodleMotion';
import { drawWalkingDoodleEnemy, getEnemyGait } from './DoodleEnemyGait';

// Measured alpha bounds + 2px padding; generated sheets are NOT uniform grids.
const frame = (x: number, y: number, width: number, height: number, pivotY = .5): AtlasFrame =>
    ({ x: x - 2, y: y - 2, width: width + 4, height: height + 4, pivotY });

export const HERO_FRAMES: Readonly<Record<string, AtlasFrame>> = {
    collector: frame(41,137,301,344,.58), graffiti: frame(402,113,327,368,.58),
    classical: frame(802,109,297,372,.58), sketcher: frame(1192,118,294,365,.58),
    watercolor: frame(16,576,336,338,.58), digital: frame(432,583,297,331,.58),
    calligrapher: frame(782,582,322,333,.58), ink: frame(1156,583,333,332,.58),
};

export const ENEMY_FRAMES: Readonly<Partial<Record<EnemyType, AtlasFrame>>> = {
    chaser: frame(105,129,192,243), eraser: frame(387,162,318,209),
    shield: frame(756,149,316,223), shooter: frame(1139,71,262,309),
    summoner: frame(49,432,297,264), paper_plane: frame(390,471,337,199),
    boss: frame(750,416,275,273), boss_roller: frame(1085,431,331,273,.25),
    boss_prism: frame(59,728,243,304), boss_slime: frame(341,775,383,258),
    boss_eraser: frame(744,715,327,322), blackhole: frame(1105,746,318,291),
};

let heroes: HTMLImageElement | undefined, enemies: HTMLImageElement | undefined;
export function getDoodleHeroes(): HTMLImageElement {
    if (!heroes) { heroes = new Image(); heroes.src = heroesUrl; }
    return heroes;
}
export function getDoodleEnemies(): HTMLImageElement {
    if (!enemies) { enemies = new Image(); enemies.src = enemiesUrl; }
    return enemies;
}

/** Only replaces the body. Caller still draws shield/status/attack telegraphs. */
export function hasDoodleEnemyArtwork(type: EnemyType | undefined): boolean {
    if (!type || !ENEMY_FRAMES[type]) return false;
    const image=getDoodleEnemies();
    return image.complete && image.naturalWidth>0 && image.naturalHeight>0;
}

export function drawDoodleEnemy(ctx: CanvasRenderingContext2D, type: EnemyType | undefined, radius: number, rotation: number, pose?: DoodlePose, bossTimer?: number): boolean {
    const source = type && ENEMY_FRAMES[type];
    if (!source) return false;
    const image = getDoodleEnemies();
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
    ctx.save();
    ctx.shadowBlur = 0; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const size=radius*2.5;
    const gait = getEnemyGait(type);
    if (pose) {
        const floorY = gait ? (gait.floor-source.y-source.height*(source.pivotY??.5))*size/Math.max(source.width,source.height) : size*.35;
        ctx.fillStyle='#0c15294d';ctx.beginPath();ctx.ellipse(0,floorY,size*.25*pose.shadowScale,size*.055,0,0,Math.PI*2);ctx.fill();
    }
    ctx.save();
    let drawn: boolean;
    if (gait) {
        drawn = drawWalkingDoodleEnemy(ctx,image,source,gait,size,rotation,pose);
    } else {
        applyDoodlePose(ctx,pose,size,rotation);
        if (type === 'paper_plane') ctx.rotate(rotation);
        drawn = drawAtlasFrame(ctx, image, source, size);
    }
    ctx.restore();
    drawDoodleAccent(ctx,pose,size,rotation);
    // PNG bodies do not inherit Renderable.color. Preserve actual boss warning phases.
    if (bossTimer !== undefined) drawDoodleWarning(ctx,type,radius,rotation,bossTimer);
    ctx.restore();
    return drawn;
}

function drawDoodleWarning(ctx:CanvasRenderingContext2D,type:EnemyType|undefined,r:number,heading:number,timer:number):void {
    const roller=type==='boss_roller' && timer%360<210;
    const eraser=type==='boss_eraser' && timer%600>=400;
    if (!roller&&!eraser) return;
    ctx.save();ctx.strokeStyle=Math.floor(timer/6)%2?'#fff1c0':'#f06a6a';ctx.lineWidth=3;
    ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(0,0,r*1.35,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    if (roller) {
        ctx.rotate(heading);ctx.beginPath();ctx.moveTo(r*1.4,-9);ctx.lineTo(r*1.4+18,0);ctx.lineTo(r*1.4,9);ctx.stroke();
    } else {
        ctx.beginPath();ctx.moveTo(0,-r*1.5);ctx.lineTo(0,-r*1.5-10);ctx.moveTo(0,-r*1.5-15);ctx.lineTo(0,-r*1.5-18);ctx.stroke();
    }
    ctx.restore();
}
