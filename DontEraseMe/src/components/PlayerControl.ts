import { Component } from '../core/Component';

export class PlayerControl extends Component {
    public dashFrames: number = 0;
    public dashSpeed: number = 0;
    public dashDirX: number = 0;
    public dashDirY: number = 0;
    public dashInvincible: boolean = false;
    
    // 武器后坐力机制
    public recoilFrames: number = 0;
    public recoilSpeed: number = 0;
    public recoilDirX: number = 0;
    public recoilDirY: number = 0;
    
    // Marker component for player
    constructor(
        public speed: number = 3
    ) {
        super();
    }
}
