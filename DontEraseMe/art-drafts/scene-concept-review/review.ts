import { drawPaperCollector, getPaperCollector } from '../../src/art/PaperCollectorArt';
import { drawChaserDraft } from '../../src/art/ChaserArt';
import { drawEraser } from '../../src/art/EraserArt';
import { drawShooterDraft } from '../../src/art/ShooterArt';
import { Weapon } from '../../src/components/Weapon';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const button = document.getElementById('actors') as HTMLButtonElement;
const figure = getPaperCollector(), weapon = new Weapon(0);
const background = new Image();
background.src = './scene-frame-v4.png';
let actors = true, time = 0, previous = performance.now(), failed = false;
background.onerror = () => { failed = true; };
button.onclick = () => { actors = !actors; button.setAttribute('aria-pressed', String(actors)); };

function draw(now: number) {
    time += Math.min(.05, (now - previous) / 1000); previous = now;
    ctx.fillStyle = '#faf9f5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (background.complete && background.naturalWidth) {
        // Preserve the generated image's aspect ratio; show the entire composition.
        const scale = Math.min(canvas.width / background.naturalWidth, canvas.height / background.naturalHeight);
        const width = background.naturalWidth * scale, height = background.naturalHeight * scale;
        ctx.drawImage(background, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        if (actors) {
            const place = (x: number, y: number, render: () => void) => { ctx.save(); ctx.translate(x, y); render(); ctx.restore(); };
            place(500, 300, () => drawPaperCollector(ctx, figure, 52, false, 0, undefined, weapon));
            place(675, 270, () => { ctx.scale(-1, 1); drawEraser(ctx, 70, time * 7, 1); });
            place(355, 370, () => drawChaserDraft(ctx, 68, time * 6, 1));
            place(735, 390, () => drawShooterDraft(ctx, 50, time * 6, 1));
        }
    } else {
        ctx.fillStyle = '#687060'; ctx.textAlign = 'center'; ctx.font = '16px system-ui';
        ctx.fillText(failed ? '场景图尚未载入，请确认 scene-frame-v4.png 已生成。' : '正在载入场景图…', canvas.width / 2, canvas.height / 2);
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
