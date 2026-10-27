import { CREATE_WORLD } from '../config/WorldConfig';
import { COMIC_ATELIER_SOURCE, COMIC_WALKABLE, comicAtelierBounds } from './ComicAtelierLayout';

export interface Point { x: number; y: number }

/** Courtyard walkable edge traced in pixels on atelier-courtyard-v1.png
 * (1536 × 1024). The outside is solid scenery; vertices follow the inner
 * faces of planters, shop displays, terrace railings and stairs. */
export const LEGACY_COURTYARD_OUTLINE: ReadonlyArray<readonly [number, number]> = [
    [250,280],[330,238],[407,204],[520,160],[572,129],[685,152],
    [722,137],[858,137],[928,165],[985,218],[1130,275],[1175,266],
    [1240,344],[1340,407],[1372,445],[1335,490],[1335,557],
    [1278,634],[1192,704],[1200,760],[1120,834],[1070,847],
    [990,840],[915,883],[832,910],[808,962],[720,962],[673,914],
    [639,899],[581,824],[540,843],[430,831],[355,782],[344,729],
    [313,711],[328,645],[346,605],[305,548],[290,487],[324,438],
    [323,400],[287,381],[281,334],[249,311],
];

// Retain the normalized 1536×1024 API used by floor/debug/3D consumers. The
// actual playable polygon is authored on the new plate, not the older street.
const normalizedBounds = comicAtelierBounds(1536, 1024);
export const COURTYARD_OUTLINE: ReadonlyArray<readonly [number, number]> = COMIC_WALKABLE.map(([x, y]) => [
    normalizedBounds.x + x / COMIC_ATELIER_SOURCE.width * normalizedBounds.width,
    normalizedBounds.y + y / COMIC_ATELIER_SOURCE.height * normalizedBounds.height,
] as const);

function closest(p: Point, a: Point, b: Point): Point {
    const dx = b.x-a.x, dy = b.y-a.y;
    const t = Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    return { x:a.x+t*dx, y:a.y+t*dy };
}

export class CourtyardGeometry {
    readonly points: Point[];
    readonly center: Point;
    // A cell is accepted only when its WHOLE area is safely inside the same
    // polygon. Near walls we retain the original exact test and tolerance.
    // This avoids 44 temporary nearest-point objects for every actor/substep.
    private readonly clearanceCell = 48;
    private readonly clearance = new Map<number, number>();
    private readonly clearanceCols: number;
    constructor(readonly width: number, readonly height: number) {
        const bounds = comicAtelierBounds(width, height);
        this.points = COMIC_WALKABLE.map(([x,y]) => ({
            x: bounds.x + x / COMIC_ATELIER_SOURCE.width * bounds.width,
            y: bounds.y + y / COMIC_ATELIER_SOURCE.height * bounds.height,
        }));
        this.center = {x:width/2,y:height/2};
        this.clearanceCols = Math.ceil(width / this.clearanceCell);
    }
    contains(p: Point): boolean {
        let inside = false;
        for(let i=0,j=this.points.length-1;i<this.points.length;j=i++) {
            const a=this.points[i], b=this.points[j];
            if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
        }
        return inside;
    }
    fits(p: Point, radius=0): boolean {
        if (this.cellSafelyFits(p, radius)) return true;
        if(!this.contains(p)) return false;
        for(let i=0;i<this.points.length;i++) {
            const q=closest(p,this.points[i],this.points[(i+1)%this.points.length]);
            if((p.x-q.x)**2+(p.y-q.y)**2 < radius*radius-0.001) return false;
        }
        return true;
    }
    private cellSafelyFits(p: Point, radius: number): boolean {
        if (!Number.isFinite(radius) || !Number.isFinite(p.x) || !Number.isFinite(p.y)
            || p.x < 0 || p.y < 0 || p.x >= this.width || p.y >= this.height) return false;
        const x = Math.floor(p.x / this.clearanceCell), y = Math.floor(p.y / this.clearanceCell);
        const key = y * this.clearanceCols + x;
        let safeRadius = this.clearance.get(key);
        if (safeRadius === undefined) {
            const center = { x: (x + .5) * this.clearanceCell, y: (y + .5) * this.clearanceCell };
            safeRadius = -1;
            if (this.contains(center)) {
                let distanceSquared = Infinity;
                for (let i = 0; i < this.points.length; i++) {
                    const q = closest(center, this.points[i], this.points[(i + 1) % this.points.length]);
                    distanceSquared = Math.min(distanceSquared, (center.x - q.x) ** 2 + (center.y - q.y) ** 2);
                }
                // Distance to a polygon edge is 1-Lipschitz. Subtract the cell's
                // half diagonal and a safety epsilon; never approximate a wall.
                safeRadius = Math.sqrt(distanceSquared) - this.clearanceCell * Math.SQRT1_2 - .00001;
            }
            this.clearance.set(key, safeRadius);
        }
        return safeRadius >= Math.abs(radius);
    }
    /** Radius-aware recovery for spawns, growth and teleport/knockback. */
    project(p: Point, radius: number): Point {
        if(this.fits(p,radius)) return {...p};
        let best: Point|undefined, distance=Infinity;
        for(let i=0;i<this.points.length;i++) {
            const a=this.points[i],b=this.points[(i+1)%this.points.length];
            const q=closest(p,a,b), len=Math.hypot(b.x-a.x,b.y-a.y);
            // Clockwise screen-space polygon: left normal points inward.
            const candidate={x:q.x-(b.y-a.y)/len*(radius+1),y:q.y+(b.x-a.x)/len*(radius+1)};
            const d=Math.hypot(candidate.x-p.x,candidate.y-p.y);
            if(d<distance && this.fits(candidate,radius)) {best=candidate;distance=d;}
        }
        if(best) return best;
        // Very large bodies at a tight corner move toward the broad open centre.
        for(let t=.02;t<=1.001;t+=.02) {
            const q={x:p.x+(this.center.x-p.x)*t,y:p.y+(this.center.y-p.y)*t};
            if(this.fits(q,radius)) return q;
        }
        return {...this.center};
    }
    segmentClear(a: Point,b: Point,radius: number): boolean {
        const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12));
        for(let i=0;i<=steps;i++) {
            if(!this.fits({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},radius)) return false;
        }
        return true;
    }
    /** Small swept steps prevent fast dashes from crossing an entire terrace.
     * Projection removes the normal component, allowing smooth edge sliding. */
    move(from: Point,to: Point,radius: number): Point {
        let p=this.project(from,radius);
        const dx=to.x-from.x,dy=to.y-from.y;
        const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(4,Math.min(12,radius/2))));
        for(let i=0;i<steps;i++) p=this.project({x:p.x+dx/steps,y:p.y+dy/steps},radius);
        return p;
    }
}

export const courtyard = new CourtyardGeometry(CREATE_WORLD.width, CREATE_WORLD.height);

/** Shared reverse breadth-first routes: one field per body-size bucket and
 * target cell, reused by the whole wave instead of doing A* per enemy. */
export class CourtyardNavigation {
    private cell=40;
    private cols:number;
    private rows:number;
    private fields=new Map<number,{ target:number; valid:Uint8Array; distances:Int32Array }>();
    constructor(private geometry: CourtyardGeometry) {
        this.cols=Math.ceil(geometry.width/this.cell);
        this.rows=Math.ceil(geometry.height/this.cell);
    }
    private point(index:number):Point { return {x:(index%this.cols+.5)*this.cell,y:(Math.floor(index/this.cols)+.5)*this.cell}; }
    private index(p:Point):number { return Math.max(0,Math.min(this.rows-1,Math.floor(p.y/this.cell)))*this.cols+Math.max(0,Math.min(this.cols-1,Math.floor(p.x/this.cell))); }
    waypoint(from:Point,target:Point,radius:number):Point {
        const r=Math.ceil(radius/24)*24+4;
        let field=this.fields.get(r);
        if(!field) {
            const valid=new Uint8Array(this.cols*this.rows);
            for(let i=0;i<valid.length;i++) valid[i]=+this.geometry.fits(this.point(i),r+29);
            field={target:-1,valid,distances:new Int32Array(valid.length)}; this.fields.set(r,field);
        }
        const safe=this.geometry.project(target,r+30);
        let dest=this.index(safe);
        if(!field.valid[dest]) {
            let best=Infinity;
            for(let i=0;i<field.valid.length;i++) if(field.valid[i]) {
                const p=this.point(i),d=(p.x-safe.x)**2+(p.y-safe.y)**2;
                if(d<best){best=d;dest=i;}
            }
        }
        if(field.target!==dest) {
            field.target=dest; field.distances.fill(-1); field.distances[dest]=0;
            const queue=[dest];
            for(let head=0;head<queue.length;head++) {
                const current=queue[head];
                for(const n of this.neighbors(current)) if(field.valid[n] && field.distances[n]<0) {
                    field.distances[n]=field.distances[current]+1;queue.push(n);
                }
            }
        }
        const start=this.index(from);
        let best=-1,score=Infinity;
        // Start can lie between the boundary and the conservative routing grid.
        const row=Math.floor(start/this.cols),col=start%this.cols;
        for(let y=Math.max(0,row-4);y<=Math.min(this.rows-1,row+4);y++) for(let x=Math.max(0,col-4);x<=Math.min(this.cols-1,col+4);x++) {
            const n=y*this.cols+x;
            if(field.distances[n]<0) continue;
            const p=this.point(n),d=field.distances[n]*this.cell+Math.hypot(p.x-from.x,p.y-from.y);
            if(d<score && this.geometry.segmentClear(from,p,radius)){best=n;score=d;}
        }
        return best<0 ? this.geometry.project(target,radius) : this.point(best);
    }
    private neighbors(i:number):number[] {
        const out:number[]=[];
        if(i%this.cols>0)out.push(i-1);if(i%this.cols<this.cols-1)out.push(i+1);
        if(i>=this.cols)out.push(i-this.cols);if(i<this.cols*(this.rows-1))out.push(i+this.cols);
        return out;
    }
}
