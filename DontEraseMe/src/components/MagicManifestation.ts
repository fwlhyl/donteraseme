import { Component } from '../core/Component';

export type MagicManifestationType = 'tank' | 'robot' | 'bomber';
export type MagicPenGrade = 'A' | 'B' | 'C';

/** A short-lived combat creation made by the Magic Pen drawing board. */
export class MagicManifestation extends Component {
    /** Visual-only motion; combat and player movement remain authoritative. */
    public visualMoving = 0;
    public visualAttackFrames = 0;
    public visualAim = 0;
    public visualFacing: -1 | 1 = 1;
    constructor(
        public type: MagicManifestationType,
        public ownerId: string,
        public grade: MagicPenGrade,
        public damageMultiplier: number,
        public remainingFrames: number = 600,
        public attackCooldown: number = 0,
        public phase: number = 0
    ) {
        super();
    }
}
