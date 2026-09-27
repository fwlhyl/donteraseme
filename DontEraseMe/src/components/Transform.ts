import { Component } from '../core/Component';

export class Transform extends Component {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public rotation: number = 0,
        public scale: number = 1
    ) {
        super();
    }
}
