import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { courtyard } from '../world/CourtyardGeometry';

export function courtyardRadius(entity:Entity):number {
    const r=entity.getComponent(Renderable);
    if(!r)return 15;
    return r.shape==='rect' ? Math.max(r.radius,Math.hypot(r.width,r.height)/2) : r.radius;
}

export class CourtyardBoundarySystem extends System {
    constructor(private enabled:()=>boolean){super();}
    override onEntityAdded(entity:Entity):void { this.constrain(entity); }
    private constrain(entity:Entity):void {
        if(!this.enabled()||!entity.active||(!entity.tags.has('player')&&!entity.tags.has('enemy')))return;
        const t=entity.getComponent(Transform);if(!t)return;
        const p=courtyard.project(t,courtyardRadius(entity));t.x=p.x;t.y=p.y;
    }
    update(_dt:number):void { if(this.enabled())for(const entity of this.entities)this.constrain(entity); }
}
