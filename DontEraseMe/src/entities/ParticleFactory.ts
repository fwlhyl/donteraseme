import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { Particle } from '../components/Particle';

export class ParticleFactory {
    public static totalParticles: number = 0; // 记录当前存在的粒子数量
    public static maxParticles: number = 100; // 同屏最大粒子限制

    public static createExplosion(x: number, y: number, color: string, count: number = 10): Entity[] {
        // 如果同屏粒子数量已经太多，直接限制生成或减半
        if (ParticleFactory.totalParticles > ParticleFactory.maxParticles) {
            return [];
        } else if (ParticleFactory.totalParticles > ParticleFactory.maxParticles * 0.7) {
            count = Math.floor(count / 2);
        }

        count = Math.ceil(count * .55);
        const particles: Entity[] = [];
        
        for (let i = 0; i < count; i++) {
            const particle = new Entity();
            
            // Random direction and speed
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            
            particle.addComponent(new Transform(x, y));
            particle.addComponent(new Velocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                speed,
                0.9 // Friction
            ));
            
            // Random size
            const size = Math.random() * 3 + 2;
            particle.addComponent(new Renderable(color, size, 0, 0, 'circle', 5));
            
            // Random life
            const life = Math.floor(Math.random() * 18 + 18);
            particle.addComponent(new Particle(life, life, 0.95));
            
            particles.push(particle);
        }
        
        return particles;
    }
}
