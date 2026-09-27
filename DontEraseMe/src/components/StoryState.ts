import { Component } from '../core/Component';

export class StoryState extends Component {
    constructor(
        public chapter: string = 'Prologue',
        public flags: Record<string, boolean> = {}
    ) {
        super();
    }
}
