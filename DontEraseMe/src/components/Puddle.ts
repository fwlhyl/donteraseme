import { Component } from '../core/Component';

export class Puddle extends Component {
    constructor(
        public radius: number,
        public durationFrames: number, // Remaining life in frames
        public maxDuration: number,    // For alpha fade out
        public damagePerFrame: number,
        public slowFactor: number,
        public color: string
    ) {
        super();
    }
}
