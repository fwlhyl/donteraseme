import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { Particle } from '../components/Particle';
import { SkillVisual } from '../components/SkillVisual';
export function skillVfx(x:number,y:number,kind:SkillVisual['kind'],radius:number,color:string,frames=24,angle=0):Entity {
    const e=new Entity(); e.addComponent(new Transform(x,y,angle));
    e.addComponent(new Renderable(color,radius)); e.addComponent(new Particle(frames,frames));
    e.addComponent(new SkillVisual(kind)); return e;
}
