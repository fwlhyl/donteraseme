import { Component } from '../core/Component';

export class Trail extends Component {
    constructor(
        public color: string = '#ffffff',
        public width: number = 20,
        public alpha: number = 0.05,
        public lastX: number = 0,
        public lastY: number = 0,
        public initialized: boolean = false
    ) {
        super();
    }
}
