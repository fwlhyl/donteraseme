import { HealthHud, WeaponHud } from '../src/ui/CombatHud';
import { courtyard } from '../src/world/CourtyardGeometry';

new HealthHud(document.getElementById('health')!).update({ id: 'review', hp: 800, max: 800, level: 1, xp: 0, next: 100, shield: '', zh: true }, 0);
new WeaponHud(document.getElementById('weapon')!).update({ key: '0', name: 'Pistol (Brush)', type: 'standard', ammo: 12, capacity: 12, reloading: false, reloadProgress: 0, zh: true });

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overview = document.getElementById('overview') as HTMLCanvasElement;
const portrait = document.getElementById('portrait') as HTMLImageElement;
const status = document.getElementById('status')!;
const boundary = document.getElementById('boundary') as HTMLInputElement;
const paint = document.getElementById('paint') as HTMLInputElement;
const oldButton = document.getElementById('old')!;
const newButton = document.getElementById('new')!;
const cameraButton = document.getElementById('camera')!;
let variant: 'old' | 'new' = 'new', center = false;

function image(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`图片加载失败：${url}`)); img.src = url;
    });
}
function outline(ctx: CanvasRenderingContext2D) {
    ctx.beginPath(); courtyard.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
}
async function main() {
    const [oldMap, oldHero, newMap, newHero] = await Promise.all([
        image('../src/assets/environment/atelier-courtyard-night-v1.png'),
        image('../src/assets/characters/collector-watercolor-v3.png'),
        image('./production-candidates/sketch-wash-v4/atelier-sketch-night-v4.png'),
        image('./production-candidates/sketch-wash-v4/collector-sketch-v4.png')
    ]);
    function render() {
        const map = variant === 'new' ? newMap : oldMap;
        const hero = variant === 'new' ? newHero : oldHero;
        const width = canvas.clientWidth, height = canvas.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const player = center ? { x: 1350, y: 900 } : { x: 1950, y: 640 };
        const camera = { x: player.x - width / 2, y: player.y - height * .65 };
        ctx.translate(-camera.x, -camera.y);
        ctx.drawImage(map, 0, 0, courtyard.width, courtyard.height);
        if (paint.checked) {
            ctx.save(); outline(ctx); ctx.clip(); ctx.globalAlpha = .65; ctx.lineCap = 'round';
            ['#2aa9e0', '#ef4b4b', '#f4bf32'].forEach((color, i) => {
                ctx.strokeStyle = color; ctx.lineWidth = 12;
                ctx.beginPath(); ctx.moveTo(player.x - 220, player.y + 40 + i * 25);
                ctx.bezierCurveTo(player.x - 110, player.y - 20 + i * 25, player.x + 70, player.y + 100 + i * 25, player.x + 170, player.y + 25 + i * 25); ctx.stroke();
            }); ctx.restore();
        }
        if (boundary.checked) { outline(ctx); ctx.strokeStyle = '#8ae1bc'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.stroke(); ctx.setLineDash([]); }
        // Preview-only contact shadow; no source image or gameplay changes.
        if (variant === 'new') {
            ctx.fillStyle = '#101b3270'; ctx.beginPath(); ctx.ellipse(player.x, player.y + 20, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.drawImage(hero, player.x - 32, player.y - 32, 64, 64);
        overview.width = 1080; overview.height = 720;
        const full = overview.getContext('2d')!;
        full.drawImage(map, 0, 0, 1080, 720); full.scale(1080 / courtyard.width, 720 / courtyard.height);
        if (boundary.checked) { outline(full); full.strokeStyle = '#80f2bd'; full.lineWidth = 4; full.stroke(); }
        full.strokeStyle = '#f6d880'; full.lineWidth = 3; full.strokeRect(camera.x, camera.y, width, height);
        full.drawImage(hero, player.x - 32, player.y - 32, 64, 64);
        portrait.src = hero.src;
        newButton.setAttribute('aria-pressed', String(variant === 'new'));
        oldButton.setAttribute('aria-pressed', String(variant === 'old'));
        cameraButton.textContent = center ? '查看临街区域' : '查看中央画板';
        status.textContent = `${variant === 'new' ? '速写淡彩候选' : '当前运行素材对照'} · ${center ? '中央画板' : '临街区域'} · 1 世界单位 = 1 CSS px（浏览器 100% 缩放） · 静态效果稿，非实机截图`;
    }
    newButton.onclick = () => { variant = 'new'; render(); };
    oldButton.onclick = () => { variant = 'old'; render(); };
    cameraButton.onclick = () => { center = !center; render(); };
    boundary.onchange = paint.onchange = render;
    new ResizeObserver(render).observe(canvas.parentElement!);
    render();
}
main().catch(error => { status.textContent = String(error); });
