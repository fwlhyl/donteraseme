import { Component } from '../core/Component';

export class Paperclip extends Component {
    constructor(
        public isConnected: boolean = false,
        public connectedToId: string | null = null
    ) {
        super();
    }
}
