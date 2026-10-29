import { drawMagicTank } from '../../src/art/MagicTankArt';
import { drawMagicRobot } from '../../src/art/MagicRobotArt';
import { drawMagicBomber } from '../../src/art/MagicBomberArt';
import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { Weapon } from '../../src/components/Weapon';

type Vehicle = 'tank' | 'robot' | 'bomber';
type Mode = 'idle' | 'move' | 'attack';
const art = { tank: { draw: drawMagicTank, size: 81.2 }, robot: { draw: drawMagicRobot, size: 78.4 }, bomber: { draw: drawMagicBomber, size: 98 } };
const collector = getPaperCollector(), weapon = new Weapon(0);
let mode: Mode = 'move', left = false, seconds = 0, last = performance.now();
const aimInput = document.getElementById('aim') as HTMLInputElement;
const aimValue = document.getElementById('aim-value') as HTMLOutputElement;
aimInput.oninput = () => { aimValue.textContent = `${aimInput.value}°`; };
const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
for (const name of ['idle', 'move', 'attack'] as const) button(name).onclick = () => {
    mode = name;
    for (const id of ['idle', 'move', 'attack']) button(id).setAttribute('aria-pressed', String(id === mode));
};
button('flip').onclick = () => { left = !left; button('flip').setAttribute('aria-pressed', String(left)); };

function draw(canvas: HTMLCanvasElement, name: Vehicle): void {
    const ctx = canvas.getContext('2d')!, {draw: vehicle, size} = art[name];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#faf9f4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#686c60'; ctx.font = '13px system-ui';
    ctx.fillText('放大对照', 16, 23); ctx.fillText('游戏尺寸', 426, 23);
    ctx.strokeStyle = '#d1d1c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(15, 252); ctx.lineTo(705, 252); ctx.stroke();
    const pulse = mode === 'attack' ? Math.max(0, 1 - (seconds % 1.15) / .38) : 0;
    const moving = mode === 'move' ? 1 : 0;
    const place = (x: number, y: number, fn: () => void) => { ctx.save(); ctx.translate(x, y); fn(); ctx.restore(); };
    const player = (x: number, sz: number) => place(x, 252 - sz * .45, () => drawPaperCollector(ctx, collector, sz, left, left ? Math.PI : 0, undefined, weapon));
    const model = (x: number, sz: number) => place(x, 252 - sz * .44, () => {
        ctx.fillStyle = 'rgba(34,37,32,.16)'; ctx.beginPath(); ctx.ellipse(0, sz * .44, sz * .35, sz * .06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.scale(left ? -1 : 1, 1);
        const aim = -Number(aimInput.value) * Math.PI / 180;
        if (name === 'tank') drawMagicTank(ctx, sz, seconds, moving, pulse, aim);
        else if (name === 'robot') drawMagicRobot(ctx, sz, seconds * 7, moving, pulse, aim);
        else vehicle(ctx, sz, seconds, moving, pulse);
    });
    player(70, 110); model(275, size * 2.1); player(455, 52); model(605, size);
}
function loop(now: number): void {
    seconds += Math.min(.05, (now - last) / 1000); last = now;
    for (const name of ['tank', 'robot', 'bomber'] as const) draw(document.getElementById(name) as HTMLCanvasElement, name);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
