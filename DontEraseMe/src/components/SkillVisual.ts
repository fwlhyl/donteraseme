import { Component } from '../core/Component';

/** Presentation metadata only; never consulted by movement or collision. */
export class SkillVisual extends Component {
    constructor(public kind: 'paper_shard' | 'pencil_shard' | 'desperate_burst') { super(); }
}
