import { Component } from '../core/Component';

export class WaterMark extends Component {
    public damagePerFrame: number;
    public radius: number;
    public durationFrames: number;
    public color: string;
    public erasedParts: {x: number, y: number, radius: number}[] = [];

    constructor(damagePerFrame: number = 0.5, radius: number = 60, durationFrames: number = 300, color: string = 'rgba(0, 150, 255, 0.4)') {
        super();
        this.damagePerFrame = damagePerFrame;
        this.radius = radius;
        this.durationFrames = durationFrames;
        this.color = color;
    }
}
