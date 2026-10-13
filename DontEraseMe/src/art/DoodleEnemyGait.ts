import type { EnemyType } from '../components/EnemyBehavior';
import type { AtlasFrame } from './AtlasFrame';
import { drawAtlasFrame } from './AtlasFrame';
import type { DoodlePose } from './DoodleMotion';

type Point = readonly [number, number];
interface EnemyGait {
    /** Original atlas coordinates: the lower body contour excludes the baked-in feet. */
    bottom: readonly Point[];
    hips: readonly [Point, Point];
    floor: number;
    cycleDistance: number;
    stride: number;
}

/** Only grounded walkers get articulated legs. Flying shapes keep their hover motion. */
export const ENEMY_GAITS: Readonly<Partial<Record<EnemyType, EnemyGait>>> = {
    chaser: { bottom: [[103,325],[140,326],[146,335],[175,342],[214,342],[240,337],[271,326],[299,326]],
        hips: [[170,335],[235,333]], floor: 368, cycleDistance: 64, stride: 4 },
    eraser: { bottom: [[385,323],[405,336],[466,341],[644,342],[686,332],[707,317]],
        hips: [[469,333],[620,334]], floor: 367, cycleDistance: 88, stride: 3.5 },
    shield: { bottom: [[754,374],[778,374],[796,342],[813,341],[824,374],[936,374],[939,347],[948,334],[963,355],[969,374],[1074,374]],
        hips: [[811,333],[945,330]], floor: 368, cycleDistance: 74, stride: 3.5 },
    shooter: { bottom: [[1137,334],[1170,345],[1191,355],[1298,358],[1325,343],[1403,334]],
        hips: [[1201,347],[1292,348]], floor: 376, cycleDistance: 72, stride: 3.8 },
    summoner: { bottom: [[47,665],[94,665],[111,656],[126,658],[215,655],[278,643],[313,642],[348,642]],
        hips: [[125,647],[232,644]], floor: 682, cycleDistance: 78, stride: 3.6 },
    boss: { bottom: [[748,661],[807,654],[916,653],[1027,665]],
        hips: [[831,646],[944,647]], floor: 686, cycleDistance: 136, stride: 3.5 },
    boss_roller: { bottom: [[1083,649],[1172,652],[1183,671],[1205,688],[1238,689],[1260,673],[1281,654],[1418,649]],
        hips: [[1196,674],[1248,674]], floor: 700, cycleDistance: 148, stride: 3.4 },
    boss_eraser: { bottom: [[742,995],[804,996],[838,1009],[1009,1008],[1038,992],[1073,990]],
        hips: [[833,998],[1009,997]], floor: 1033, cycleDistance: 148, stride: 3.3 },
};

export function getEnemyGait(kind: string | undefined): EnemyGait | undefined {
    return kind ? ENEMY_GAITS[kind as EnemyType] : undefined;
}

/** Draw the same atlas body at the same size, replacing only its fixed feet. */
export function drawWalkingDoodleEnemy(
    ctx: CanvasRenderingContext2D, image: HTMLImageElement, source: AtlasFrame,
    gait: EnemyGait, size: number, heading: number, pose?: DoodlePose
): boolean {
    const scale = size / Math.max(source.width, source.height), ratio = size / 64;
    const originX = source.x + source.width / 2;
    const originY = source.y + source.height * (source.pivotY ?? .5);
    const step = pose?.step ?? 0;
    const bob = (pose?.y ?? 0) * ratio;
    const recoil = (pose?.attack ?? 0) * 2 * ratio;
    const bodyX = (pose?.x ?? 0) * ratio - Math.cos(heading) * recoil;
    const bodyY = bob - Math.sin(heading) * recoil;
    const facing = Math.cos(heading) < -.12 ? -1 : 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#11130f'; ctx.lineWidth = 2.5 * ratio;
    for (let i = 0; i < gait.hips.length; i++) {
        const hip = gait.hips[i];
        const phase = step * (i === 0 ? -1 : 1);
        const hipX = (hip[0] - originX) * scale;
        const hipY = (hip[1] - originY) * scale;
        const stride = phase * gait.stride * ratio;
        const footY = (gait.floor - originY) * scale - Math.max(0, phase) * 2.5 * ratio;
        // Feet are planted independently of the torso's small bounce/recoil.
        ctx.beginPath(); ctx.moveTo(hipX + bodyX, hipY + bodyY);
        ctx.lineTo(hipX + stride * .4, footY - 2.8 * ratio);
        ctx.lineTo(hipX + stride, footY);
        ctx.lineTo(hipX + stride + facing * 2.8 * ratio, footY);
        ctx.stroke();
    }
    ctx.save(); ctx.translate(bodyX, bodyY);
    ctx.beginPath();
    ctx.moveTo(-source.width * scale / 2, -source.height * scale * (source.pivotY ?? .5));
    ctx.lineTo(source.width * scale / 2, -source.height * scale * (source.pivotY ?? .5));
    for (let i = gait.bottom.length - 1; i >= 0; i--) {
        const p = gait.bottom[i]; ctx.lineTo((p[0] - originX) * scale, (p[1] - originY) * scale);
    }
    ctx.closePath(); ctx.clip();
    const drawn = drawAtlasFrame(ctx, image, source, size);
    ctx.restore();
    return drawn;
}
