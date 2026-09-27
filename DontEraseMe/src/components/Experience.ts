import { Component } from '../core/Component';

export class Experience extends Component {
    constructor(
        public level: number = 1,
        public xp: number = 0,
        public next: number = 100
    ) {
        super();
    }
}
