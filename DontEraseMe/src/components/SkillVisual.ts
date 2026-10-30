import { Component } from '../core/Component';

/** Presentation metadata only; never consulted by movement or collision. */
export class SkillVisual extends Component {
    constructor(public kind: 'paper_shard' | 'pencil_shard' | 'desperate_burst' | 'scraper_sweep' | 'thumbtack' | 'paint_bloom' | 'electric_arc' | 'mirror_cut' | 'ice_steam' | 'impact_tick' | 'tank_wave' | 'robot_wave' | 'bomber_wave') { super(); }
}
