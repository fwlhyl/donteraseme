import courtyardUrl from '../assets/paper-scenes/atelier-clarity-v1.webp';
import ruinsUrl from '../assets/paper-scenes/ruins-clarity-v1.webp';
import { sceneBounds, type CourtyardTheme } from './SceneLayout';
import { DOODLE_FLOOR, drawDoodleFloor, drawBlendedDoodleFloor, isDoodleFloorTextureReady } from './DoodleFloor';
import { drawDoodleLights } from './DoodleLights';

/** Separate scenery layer below painting/trails: never baked into saved art. */
export class CourtyardScene {
    private image=new Image();
    private ruinsImage=new Image();
    private canvas=document.createElement('canvas');
    private ctx:CanvasRenderingContext2D;
    private reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    private lastFrame='';
    constructor() {
        this.canvas.id='courtyardCanvas';
        this.canvas.style.cssText='position:absolute;inset:0;z-index:0;pointer-events:none;display:none';
        document.body.insertBefore(this.canvas,document.getElementById('paintingCanvas'));
        this.ctx=this.canvas.getContext('2d')!;
        this.image.src=courtyardUrl;
        this.ruinsImage.src=ruinsUrl;
    }
    draw(camera:{x:number;y:number},worldWidth:number,worldHeight:number,enabled:boolean,theme:CourtyardTheme='atelier',timeSeconds=0):void {
        this.canvas.style.display=enabled?'block':'none';
        if(!enabled){this.lastFrame='';return;}
        const ownsCanvas=this.canvas.dataset.scene===theme;
        this.canvas.dataset.scene=theme;
        const dpr=window.devicePixelRatio||1,w=window.innerWidth,h=window.innerHeight;
        const image=theme==='ruins'?this.ruinsImage:this.image;
        const ready=image.complete&&image.naturalWidth>0;
        // Static camera needs only 30 light frames/sec; cached pixels remain visible
        // in between. Moving cameras still redraw every frame to avoid judder.
        const lightTick=this.reducedMotion?.matches?0:Math.floor(timeSeconds*30);
        // A late-loading floor texture must also refresh a stationary or
        // reduced-motion scene; it is not tied to camera movement or flicker.
        const floorReady=isDoodleFloorTextureReady();
        const frameKey=[camera.x,camera.y,w,h,dpr,worldWidth,worldHeight,theme,ready,floorReady,lightTick].join(':');
        if(frameKey===this.lastFrame&&ownsCanvas)return;
        this.lastFrame=frameKey;
        if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)) {
            this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
            this.canvas.style.width=`${w}px`;this.canvas.style.height=`${h}px`;
        }
        this.ctx.setTransform(dpr,0,0,dpr,0,0);
        this.ctx.fillStyle=DOODLE_FLOOR;this.ctx.fillRect(0,0,w,h);
        this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';
        if(ready) {
            const bounds=sceneBounds(worldWidth,worldHeight,theme);
            this.ctx.drawImage(image,bounds.x-camera.x,bounds.y-camera.y,bounds.width,bounds.height);
            this.ctx.save();this.ctx.translate(-camera.x,-camera.y);
            drawDoodleLights(this.ctx,worldWidth,worldHeight,theme,this.reducedMotion?.matches?0:timeSeconds,{...camera,width:w,height:h});
            this.ctx.restore();
        }
        this.ctx.save();
        this.ctx.translate(-camera.x,-camera.y);
        if(ready)drawBlendedDoodleFloor(this.ctx,worldWidth,worldHeight,theme);
        else drawDoodleFloor(this.ctx,worldWidth,worldHeight,theme);
        this.ctx.restore();
    }
}
