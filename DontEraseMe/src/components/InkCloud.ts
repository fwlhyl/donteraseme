import { Component } from '../core/Component';

export class InkCloud extends Component {
    public radius: number;
    public durationFrames: number;
    public color: string;

    constructor(radius: number = 150, durationFrames: number = 300, color: string = 'rgba(0, 0, 0, 0.7)') {
        super();
        this.radius = radius;
        this.durationFrames = durationFrames;
        this.color = color;
    }
}
