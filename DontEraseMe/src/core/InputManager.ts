export class InputManager {
    public keys: Map<string, boolean> = new Map();
    public mouse: { x: number, y: number, down: boolean } = { x: 0, y: 0, down: false };

    // Joystick data (for mobile)
    public leftJoystick: { active: boolean, dx: number, dy: number } = { active: false, dx: 0, dy: 0 };
    public rightJoystick: { active: boolean, angle: number } = { active: false, angle: 0 };

    constructor() {
        this.setupListeners();
    }

    private setupListeners(): void {
        window.addEventListener('keydown', (e) => {
            // Toolbar buttons retain focus after a click; that must not trap
            // subsequent movement keys. Only actual editing fields own typing.
            const editing = e.target instanceof Element && Boolean(e.target.closest(
                'input, select, textarea, [contenteditable="true"]'
            ));
            if (!editing) this.keys.set(e.key.toLowerCase(), true);
        });
        window.addEventListener('keyup', (e) => this.keys.set(e.key.toLowerCase(), false));

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            this.mouse.down = e.button === 0 && !this.isInteractiveTarget(e.target);
        });
        window.addEventListener('mouseup', () => this.mouse.down = false);
        window.addEventListener('blur', () => this.clear());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.clear();
        });

        // TODO: Add Touch/Joystick listeners later
    }

    private isInteractiveTarget(target: EventTarget | null): boolean {
        return target instanceof Element && Boolean(target.closest(
            'button, input, select, textarea, a, [contenteditable="true"], [data-game-input-block], .palette-swatch'
        ));
    }

    public clear(): void {
        this.keys.clear();
        this.mouse.down = false;
        this.leftJoystick = { active: false, dx: 0, dy: 0 };
        this.rightJoystick = { active: false, angle: 0 };
    }

    public isKeyDown(key: string): boolean {
        return this.keys.get(key.toLowerCase()) || false;
    }
}
