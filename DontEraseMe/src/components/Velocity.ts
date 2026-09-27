import { Component } from '../core/Component';

export class Velocity extends Component {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public speed: number = 0,
        public friction: number = 1 // 1 = no friction, < 1 = friction
    ) {
        super();
    }
}
