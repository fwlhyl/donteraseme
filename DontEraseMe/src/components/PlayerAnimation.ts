import { Component } from '../core/Component';

export interface AnimConfig {
    image: HTMLImageElement;
    row: number;         // 第几行 (从 0 开始)
    totalFrames: number; // 这一行动画总共有多少帧
    frameWidth: number;  // 每帧宽
    frameHeight: number; // 每帧高
}

export class PlayerAnimation extends Component {
    public animations: Record<string, AnimConfig> = {};
    public currentAnim: string = '';
    public hitTimer: number = 0; // >0 表示正在播放受击动画

    constructor(animations: Record<string, AnimConfig>) {
        super();
        this.animations = animations;
    }
}
