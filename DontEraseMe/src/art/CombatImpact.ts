import type { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Projectile } from '../components/Projectile';
const hits=new WeakMap<Entity,number>();
export function combatImpact(enemy:Entity,bullet:Entity):void {
    const now=performance.now(), p=bullet.getComponent(Projectile), t=enemy.getComponent(Transform), b=bullet.getComponent(Transform);
    if(!p || !t || !b || now-(hits.get(enemy) ?? -1000)<90) return;
    if(['flamethrower','gravity','mine'].includes(p.type)) return;
    hits.set(enemy,now);
    const angle=b.rotation;
    const boss=enemy.tags.has('boss');
    const push=(p.type==='shotgun'?5:p.type==='melee'?12:p.type==='rocket'?14:p.type==='sniper'?6:2)*(boss?.15:1);
    t.x+=Math.cos(angle)*push;t.y+=Math.sin(angle)*push;
}
