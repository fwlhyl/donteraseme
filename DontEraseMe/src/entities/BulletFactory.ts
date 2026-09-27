import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { Projectile } from '../components/Projectile';
import type { WeaponConfig } from '../components/Weapon';

export class BulletFactory {
    private static parseColorToRGB(color: string): {r: number, g: number, b: number} {
        if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            const num = parseInt(hex, 16);
            return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
        }
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                return { r: parseInt(match[0], 10), g: parseInt(match[1], 10), b: parseInt(match[2], 10) };
            }
        }
        const named: Record<string, number[]> = {
            'red': [255,0,0], 'green': [0,255,0], 'blue': [0,0,255],
            'yellow': [255,255,0], 'cyan': [0,255,255], 'magenta': [255,0,255],
            'white': [255,255,255], 'black': [0,0,0], 'orange': [255,165,0]
        };
        const c = named[color.toLowerCase()];
        if (c) return { r: c[0], g: c[1], b: c[2] };
        return { r: 255, g: 68, b: 0 }; // default orange-red
    }

    public static create(
        config: WeaponConfig, 
        ownerX: number, 
        ownerY: number, 
        angle: number,
        bulletColor: string,
        ownerId: string,
        speedMul: number = 1.0,
        radiusMul: number = 1.0
    ): Entity {
        const bullet = new Entity();
        
        bullet.addComponent(new Transform(ownerX, ownerY, angle));
        
        const effSpeed = config.speed * speedMul;
        const velocity = new Velocity(
            Math.cos(angle) * effSpeed,
            Math.sin(angle) * effSpeed
        );
        bullet.addComponent(velocity);
        
        // Use the passed color
        let color = bulletColor;
        // 如果是火焰喷射器，且玩家当前颜色是默认的白色，则使用武器本身的默认颜色（橙红色）
        if (config.type === 'flamethrower' && (color === 'white' || color === '#ffffff' || color === 'rgba(255, 255, 255, 0.8)')) {
            color = config.color;
        }
        
        const r = config.radius * radiusMul;
        let renderable: Renderable;
        if (config.type === 'mine') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'circle', 5);
        } else if (config.type === 'compass') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'triangle', 6);
        } else if (config.type === 'shotgun') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'circle', 5);
        } else if (config.type === 'rocket') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'circle', 5);
        } else if (config.type === 'gravity') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'circle', 4);
        } else if (config.type === 'flamethrower') {
            renderable = new Renderable(color, r, r * 2, r * 2, 'circle', 6);
        } else {
            renderable = new Renderable(color, r, r * 2, r * 2, 'rect', 5);
        }
        
        bullet.addComponent(renderable);
        
        let life = 0;
        if (config.type === 'gravity') {
            life = 120;
        } else if (config.type === 'sniper') {
            life = 0; // sniper handled as beam elsewhere
        } else if (config.type === 'flamethrower') {
            life = 30; // Short lifespan for flames
        } else if (config.type === 'compass') {
            life = 90; // 30 forward, 30 spin, 30 return
        } else if (config.type === 'mine') {
            life = 600; // Mine lasts for 10 seconds
        } else {
            life = Math.ceil((config.range || 600) / effSpeed);
        }
        
        const projComp = new Projectile(config.type, config.damage, ownerId, life);
        if (config.type === 'flamethrower') {
            projComp.baseColorRGB = BulletFactory.parseColorToRGB(color);
        }
        bullet.addComponent(projComp);
        
        bullet.tags.add('projectile');
        
        return bullet;
    }
}
