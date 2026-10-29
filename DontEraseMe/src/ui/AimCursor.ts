/** Mouse aiming indicator; its viewport coordinates match InputManager's aim. */
export class AimCursor {
    private readonly marker = document.createElement('div');
    private position: { x: number; y: number } | null = null;

    constructor(private readonly isPlaying: () => boolean) {
        this.marker.className = 'aim-cursor';
        this.marker.setAttribute('aria-hidden', 'true');
        this.marker.innerHTML = '<span></span>';
        document.body.appendChild(this.marker);
        window.addEventListener('pointermove', event => {
            if (event.pointerType !== 'mouse') return;
            this.position = { x: event.clientX, y: event.clientY };
            this.sync();
        });
        window.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'mouse') this.hide();
        });
        document.addEventListener('pointerout', event => {
            if (!event.relatedTarget) this.hide();
        });
        window.addEventListener('blur', () => this.hide());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.hide(); });
    }

    public sync(): void {
        const point = this.position;
        const target = point && document.elementFromPoint(point.x, point.y);
        const interactive = target?.closest('button, input, select, textarea, a, [contenteditable="true"], [data-game-input-block], .palette-swatch');
        const show = !!point && this.isPlaying() && !!target && !interactive;
        this.marker.classList.toggle('is-visible', show);
        document.body.classList.toggle('aiming-cursor', show);
        if (show && point) this.marker.style.transform = `translate(${point.x}px, ${point.y}px)`;
    }

    private hide(): void {
        this.position = null;
        this.sync();
    }
}
