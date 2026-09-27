import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { ExperienceOrb } from '../components/ExperienceOrb';

export class XPOrbFactory {
    public static MAX_ORBS = 100; // 同屏最大经验球数量，超过则强制合并

    public static drop(
        x: number, 
        y: number, 
        amount: number, 
        entities: Set<Entity> | IterableIterator<Entity>, 
        addEntityCallback: (e: Entity) => void
    ): void {
        let orbCount = 0;
        let targetOrb: Entity | null = null;
        let fallbackOrb: Entity | null = null;
        let minDistance = Infinity;

        for (const e of entities) {
            if (e.tags.has('xp_orb') && e.active) {
                orbCount++;
                fallbackOrb = e;
                const t2 = e.getComponent(Transform);
                if (t2) {
                    const dist = Math.hypot(t2.x - x, t2.y - y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetOrb = e;
                    }
                }
            }
        }

        // 经验球合并逻辑：如果在合并范围内(80)，或者同屏数量超限，则与最近的经验球合并
        if (targetOrb && (minDistance < 80 || orbCount >= XPOrbFactory.MAX_ORBS)) {
            const mergeOrb = (minDistance < 80) ? targetOrb : (targetOrb || fallbackOrb);
            if (mergeOrb) {
                const oData = mergeOrb.getComponent(ExperienceOrb);
                const rData = mergeOrb.getComponent(Renderable);
                if (oData && rData) {
                    oData.amount += amount;
                    // 根据合并后的总经验值改变颜色和大小
                    if (oData.amount >= 500) {
                        rData.color = '#ff00ff';
                        rData.radius = 15;
                    } else if (oData.amount >= 100) {
                        rData.color = '#00ffff';
                        rData.radius = 10;
                    } else {
                        rData.radius = Math.min(12, rData.radius + 0.2);
                    }
                }
                return;
            }
        }

        // 如果不需要合并，则创建新的经验球
        const orb = new Entity();
        orb.tags.add('xp_orb');
        orb.addComponent(new Transform(x, y));
        orb.addComponent(new ExperienceOrb(amount));
        
        let orbColor = '#00ff00';
        let orbRadius = 6;
        if (amount >= 500) {
            orbColor = '#ff00ff';
            orbRadius = 15;
        } else if (amount >= 100) {
            orbColor = '#00ffff';
            orbRadius = 10;
        }
        
        orb.addComponent(new Renderable(orbColor, orbRadius, 0, 0, 'diamond'));
        addEntityCallback(orb);
    }
}