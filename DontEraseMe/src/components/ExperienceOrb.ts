import { Component } from '../core/Component';

export class ExperienceOrb extends Component {
    constructor(
        public amount: number = 20,
        public lifetime: number = 1800 // Orbs disappear after 30 seconds (at 60fps) or can be infinite? Let's say infinite for now or long enough.
    ) {
        super();
    }
}
