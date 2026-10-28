import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { DoodleMotion, type DoodlePose } from '../../src/art/DoodleMotion';
import { Weapon } from '../../src/components/Weapon';
import { CHARACTERS } from '../../src/config/EndlessConfig';
import { PLAYER_PRESENTATION } from '../../src/config/PlayerPresentation';

const source = getPaperCollector();
const weapon = new Weapon(0);
const character = document.getElementById('character') as HTMLSelectElement;
for (const item of CHARACTERS) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; character.append(option); }
const direction = document.getElementById('direction') as HTMLSelectElement;
const aimInput = document.getElementById('aim') as HTMLInputElement;
let action = 'idle', paused = false, x = 0, facingLeft = false;
let hp = 100, attackSerial = 0, reloadTime = -1, outcomeTime = 0;
let outcome: 'defeat' | 'victory' | null = null;
const motion = new DoodleMotion(0, {x: 0, y: 0, hp: 100, attackSerial: 0, kind: 'player'});
let pose: DoodlePose = {x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, attack: 0, hit: 0, shadowScale: 1, step: 0, moving: 0};

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    button.onclick = () => {
        action = button.dataset.action!; outcome = null;
        document.querySelectorAll('[data-action]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    };
});
document.getElementById('shot')!.onclick = () => { outcome = null; attackSerial++; };
document.getElementById('reload')!.onclick = () => { outcome = null; reloadTime = 0; };
document.getElementById('hit')!.onclick = () => { outcome = null; hp--; };
for (const type of ['defeat', 'victory'] as const) document.getElementById(type)!.onclick = () => { outcome = type; outcomeTime = 0; };
aimInput.oninput = () => { document.getElementById('aim-value')!.textContent = `${aimInput.value}°`; };
document.getElementById('pause')!.onclick = event => {
    paused = !paused; (event.currentTarget as HTMLButtonElement).textContent = paused ? '播放' : '暂停';
};

function draw(canvas: HTMLCanvasElement, scale: number, aim: number, currentPose: DoodlePose) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d1d5c9'; ctx.beginPath();
    ctx.moveTo(30, canvas.height / 2 + 24 * scale); ctx.lineTo(canvas.width - 30, canvas.height / 2 + 24 * scale); ctx.stroke();
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#30382b18'; ctx.beginPath(); ctx.ellipse(0, 23 * scale, 14 * scale, 2.5 * scale, 0, 0, Math.PI * 2); ctx.fill();
    drawPaperCollector(ctx, source, PLAYER_PRESENTATION.displaySize * scale, facingLeft, aim, currentPose, weapon, outcome ? {type: outcome, progress: Math.min(1, outcomeTime / 1.2)} : undefined, character.value);
    ctx.restore();
}
let last = performance.now();
function loop(now: number) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const aim = Number(aimInput.value) * Math.PI / 180;
    if (Math.cos(aim) < -PLAYER_PRESENTATION.facingDeadZone) facingLeft = true;
    else if (Math.cos(aim) > PLAYER_PRESENTATION.facingDeadZone) facingLeft = false;
    if (!paused) {
        if (action === 'walk' && !outcome) x += Number(direction.value) * 170 * dt;
        if (outcome) outcomeTime += dt;
        const reloadDuration = (weapon.config?.reloadTime ?? 60) / 60;
        if (reloadTime >= 0) { reloadTime += dt; if (reloadTime >= reloadDuration) reloadTime = -1; }
        weapon.reloading = reloadTime >= 0;
        pose = motion.update({x, y: 0, hp, attackSerial, kind: 'player', aim, reloading: weapon.reloading, reloadProgress: weapon.reloading ? reloadTime / reloadDuration : 0}, dt);
    }
    draw(document.getElementById('large') as HTMLCanvasElement, 4, aim, pose);
    draw(document.getElementById('native') as HTMLCanvasElement, 1, aim, pose);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
