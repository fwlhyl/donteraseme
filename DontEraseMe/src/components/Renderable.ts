import { Component } from '../core/Component';

export type ShapeType = 'circle' | 'rect' | 'line' | 'sprite' | 'triangle' | 'diamond' | 'crescent' | 'shockwave' | 'wall_line';

export class Renderable extends Component {
    // Animation properties for squash and stretch
    public scaleX: number = 1.0;
    public scaleY: number = 1.0;
    public squashTimer: number = 0;
    
    // Optional image element for custom skins
    public image?: HTMLImageElement;
    
    // Optional bone attachment for sprite
    public attachmentBone?: string;
    public attachmentRotationOffset: number = 0;
    public offsetX: number = 0;
    public offsetY: number = 0;

    constructor(
        public color: string = '#ffffff',
        public radius: number = 10, // for circle
        public width: number = 20,  // for rect/line (endX) / sprite width
        public height: number = 20, // for rect/line (endY) / sprite height
        public shape: ShapeType = 'circle',
        public zIndex: number = 0,
        public visible: boolean = true
    ) {
        super();
    }
}
