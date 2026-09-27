import { Component } from '../core/Component';

export class Health extends Component {
    constructor(
        public current: number = 100,
        public max: number = 100,
        public invincibleFrames: number = 0
    ) {
        super();
    }
}
