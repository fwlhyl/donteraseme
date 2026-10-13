import { drawArtwork, type DefenseArtwork } from './DefenseArtwork';

/** An isolated opening: no simulation, enemies, timers or replay clock yet. */
export class DefenseIntro {
    private overlay: HTMLDivElement | null = null;
    private frame = 0;
    private cleanupKeys: (() => void) | null = null;

    public play(artwork: DefenseArtwork, onFinish: () => void, onCancel: () => void): void {
        this.close();
        const overlay = document.createElement('div');
        this.overlay = overlay;
        overlay.id = 'defense-intro';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', '正在印画');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:15000;background:#14151cf5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:18px;box-sizing:border-box;color:#f6eedc';
        const title = document.createElement('h2');
        title.textContent = `正在印画 · ${artwork.name}`;
        title.style.cssText = 'margin:0;max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const canvas = document.createElement('canvas');
        canvas.width = artwork.width;
        canvas.height = artwork.height;
        canvas.style.cssText = 'position:static;display:block;background:#222;width:auto;height:auto;max-width:92vw;max-height:65vh;object-fit:contain;border-radius:8px';
        const caption = document.createElement('div');
        caption.textContent = '这幅画交给你了。印画完成后开始守卫 20 分钟。';
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:14px';
        const skip = document.createElement('button');
        skip.id = 'skip-defense-intro';
        skip.textContent = '跳过印画，开始守卫';
        const back = document.createElement('button');
        back.id = 'cancel-defense-intro';
        back.textContent = '返回准备';
        for (const button of [skip, back]) button.style.cssText = 'padding:10px 18px;cursor:pointer;border-radius:6px;font:inherit';
        const finish = () => {
            if (this.overlay !== overlay) return;
            this.close();
            onFinish();
        };
        const cancel = () => {
            if (this.overlay !== overlay) return;
            this.close();
            onCancel();
        };
        skip.onclick = finish;
        back.onclick = cancel;
        actions.append(skip, back);
        overlay.append(title, canvas, caption, actions);
        document.body.append(overlay);
        const keys = (event: KeyboardEvent) => {
            event.stopImmediatePropagation();
            if (event.key === 'Escape') { event.preventDefault(); cancel(); }
            if (event.key === 'Tab') {
                event.preventDefault();
                (document.activeElement === skip ? back : skip).focus();
            }
        };
        window.addEventListener('keydown', keys, true);
        this.cleanupKeys = () => window.removeEventListener('keydown', keys, true);
        skip.focus();
        const ctx = canvas.getContext('2d')!;
        let elapsed = 0;
        let previous = performance.now();
        const tick = (time: number) => {
            if (this.overlay !== overlay) return;
            elapsed += Math.min(100, time - previous);
            previous = time;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawArtwork(ctx, artwork, Math.min(1, elapsed / 3500));
            if (elapsed >= 4000) finish();
            else this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
    }

    public close(): void {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.cleanupKeys?.();
        this.cleanupKeys = null;
        this.overlay?.remove();
        this.overlay = null;
    }
}
