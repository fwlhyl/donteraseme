import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Skeleton, Bone } from '../components/Skeleton';

export class SkeletonSystem extends System {
    public update(dt: number): void {
        for (const entity of this.entities) {
            const t = entity.getComponent(Transform);
            const sk = entity.getComponent(Skeleton);
            if (!t || !sk) continue;
            const order = Array.from(sk.bones.values());
            for (const bone of order) {
                if (!bone.parent) {
                    bone.worldX = t.x + bone.x;
                    bone.worldY = t.y + bone.y;
                    bone.worldRotation = t.rotation + bone.rotation;
                } else {
                    const parent = sk.getBone(bone.parent);
                    if (parent) {
                        const cos = Math.cos(parent.worldRotation);
                        const sin = Math.sin(parent.worldRotation);
                        const rx = bone.x * cos - bone.y * sin;
                        const ry = bone.x * sin + bone.y * cos;
                        bone.worldX = parent.worldX + rx;
                        bone.worldY = parent.worldY + ry;
                        bone.worldRotation = parent.worldRotation + bone.rotation;
                    }
                }
            }
        }
    }
}
