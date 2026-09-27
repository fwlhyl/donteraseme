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
        window.addEventListener('keydown', (e) => this.keys.set(e.key.toLowerCase(), true));
        window.addEventListener('keyup', (e) => this.keys.set(e.key.toLowerCase(), false));
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);

        // TODO: Add Touch/Joystick listeners later
    }

    public isKeyDown(key: string): boolean {
        return this.keys.get(key.toLowerCase()) || false;
    }
}
