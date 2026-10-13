import { Component } from '../core/Component';
import type { AtlasFrame } from '../art/AtlasFrame';

/** Visual-only prototype: does not change Renderable's collision geometry. */
export class PlayerArtwork extends Component {
    public facingLeft = false;

    constructor(
        public readonly image: HTMLImageElement,
        public readonly displaySize = 64,
        public readonly baseRadius = 20,
        public readonly frame?: AtlasFrame,
        public readonly articulated = false
    ) { super(); }
}
