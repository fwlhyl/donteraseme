import { Component } from '../core/Component';

export class Particle extends Component {
    constructor(
        public life: number = 60, // Frames
        public maxLife: number = 60,
        public decay: number = 0.95 // Speed decay per frame
    ) {
        super();
    }
}
