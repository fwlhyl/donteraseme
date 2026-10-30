import { SkillVisual } from '../components/SkillVisual';
import { EnemyBehavior } from '../components/EnemyBehavior';
import { System } from '../core/System';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { Particle } from '../components/Particle';
import { ParticleFactory } from '../entities/ParticleFactory';

export class ParticleSystem extends System {
    public update(dt: number): void {
        const entitiesToRemove: import('../core/Entity').Entity[] = [];
        
        let count = 0;

        for (const entity of this.entities) {
            const particle = entity.getComponent(Particle);
            const transform = entity.getComponent(Transform);
            const velocity = entity.getComponent(Velocity);
            const renderable = entity.getComponent(Renderable);

            if (particle && entity.hasComponent(SkillVisual)) {
                const visual = entity.getComponent(SkillVisual)!;
                if (visual.kind === 'thumbtack' && visual.target) {
                    const targetTransform = visual.target.getComponent(Transform);
                    if (!visual.target.active || !targetTransform || !(visual.target.getComponent(EnemyBehavior)?.frozenFrames)) {
                        entitiesToRemove.push(entity);
                        continue;
                    }
                    if (transform) { transform.x = targetTransform.x; transform.y = targetTransform.y; }
                }
                particle.life--;
                if (particle.life <= 0) entitiesToRemove.push(entity);
                continue;
            }
            if (particle && transform && velocity && renderable) {
                count++;
                // Life decay
                particle.life--;
                
                // Fade out alpha based on life
                // We need to parse color or just assume it handles it?
                // Canvas fillStyle handles color strings. 
                // To fade out, we'd need to parse rgba or hsla.
                // For simplicity, let's shrink the radius instead!
                renderable.radius = (particle.life / particle.maxLife) * 5; // Assuming max radius 5
                
                // Velocity friction
                velocity.x *= particle.decay;
                velocity.y *= particle.decay;
                
                // Movement is handled by MovementSystem
                // But wait, MovementSystem moves EVERYTHING with Velocity.
                // So we don't need to move here.
                
                if (particle.life <= 0) {
                    entitiesToRemove.push(entity);
                }
            }
        }

        for (const entity of entitiesToRemove) {
            this.removeEntity(entity);
            entity.active = false;
        }
        
        ParticleFactory.totalParticles = count;
    }
}
