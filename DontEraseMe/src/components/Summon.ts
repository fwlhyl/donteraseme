import { Component } from '../core/Component';

export type SummonType = 'stickman' | 'palette' | 'scythe' | 'drone';

export class Summon extends Component {
    public visualAim = 0;
    public visualFireFrames = 0;
    constructor(
        public type: SummonType,
        public ownerId: string,
        public level: number = 1,
        public index: number = 0, // Index among same type (e.g. 0, 1, 2 for palettes)
        public angle: number = 0,
        public distance: number = 50,
        public speed: number = 0.05,
        public fireTimer: number = 0,
        public maxFireTimer: number = 60,
        public targetId: string | null = null,
        public lifeTimer: number = 0
    ) {
        super();
    }
}
