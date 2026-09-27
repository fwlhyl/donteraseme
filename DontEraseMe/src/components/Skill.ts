import { Component } from '../core/Component';

export class Skill extends Component {
    constructor(
        public cooldown: number = 0,
        public maxCooldown: number = 300, // 5 seconds at 60fps
        public radius: number = 200,      // Damage radius
        public damage: number = 1000,     // High damage
        public active: boolean = false,
        public rulerArmed: boolean = false,
        public curveStage: number = 0,
        public curveAX: number = 0,
        public curveAY: number = 0,
        public symmetryFrames: number = 0,
        public symmetryAxisX: number = 0,
        public symmetryLastX: number = 0,
        public symmetryLastY: number = 0,
        public eraserShieldFrames: number = 0,
        public activeTool: 'curve' | 'symmetry' | 'eraser' | 'pin' | 'explosion' = 'curve',
        public toolCooldown: number = 0,
        public toolMaxCooldown: number = 300
    ) {
        super();
    }
}
