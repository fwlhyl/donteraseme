import { Component } from '../core/Component';

export class ControlPoint extends Component {
    constructor(
        public radius: number = 80,
        public progress: number = 0,
        public required: number = 300, // frames in zone to capture (~5s)
        public active: boolean = true
    ) {
        super();
    }
}
