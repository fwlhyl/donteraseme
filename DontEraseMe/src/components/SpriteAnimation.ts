import { Component } from '../core/Component';

export class SpriteAnimation extends Component {
    public currentFrame: number = 0;
    public elapsedFrames: number = 0;
    public isPlaying: boolean = true;
    public row: number = 0; // 新增：指定渲染哪一行

    constructor(
        public image: HTMLImageElement,
        public frameWidth: number,
        public frameHeight: number,
        public totalFrames: number,
        public frameDuration: number, // How many game ticks/frames each animation frame lasts
        public loop: boolean = true,
        public pivotX: number = 0.5, // 0-1, 0.5 is center
        public pivotY: number = 0.5, // 0-1, 0.5 is center
        row: number = 0
    ) {
        super();
        this.row = row;
    }
}
