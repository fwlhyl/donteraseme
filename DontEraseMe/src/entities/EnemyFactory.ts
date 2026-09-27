import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { Health } from '../components/Health';
import { EnemyBehavior } from '../components/EnemyBehavior';
import type { EnemyType } from '../components/EnemyBehavior';

export class EnemyFactory {
    public static create(type: EnemyType, x: number, y: number): Entity {
        const enemy = new Entity();
        
        enemy.addComponent(new Transform(x, y));
        
        if (type === 'chaser') {
            const radius = 10 + Math.random() * 15; // 10-25
            const color = `hsl(${Math.random() * 360}, 70%, 50%)`; // Random color
            const hp = Math.floor(radius); // HP proportional to size
            
            enemy.addComponent(new Velocity(0, 0, 1.5)); // Speed 1.5 (Reduced from 3)
            enemy.addComponent(new Renderable(color, radius, 0, 0, 'circle', 10));
            enemy.addComponent(new Health(hp, hp));
        } else if (type === 'eraser') {
            const radius = 25 + Math.random() * 5; // 25-30
            enemy.addComponent(new Velocity(0, 0, 1.0)); // Speed 1.0 (Reduced from 2)
            enemy.addComponent(new Renderable('#ffffff', radius, radius * 2, radius * 2, 'rect', 10)); // White square
            enemy.addComponent(new Health(50, 50));
        } else if (type === 'shield') {
            const radius = 22;
            enemy.addComponent(new Velocity(0, 0, 1.1)); // Speed 1.1 (Reduced from 2.2)
            enemy.addComponent(new Renderable('#66ccff', radius, 0, 0, 'circle', 20));
            enemy.addComponent(new Health(90, 90));
            enemy.addComponent(new EnemyBehavior('shield', 80, 80, 0, 0, 0, 0));
        } else if (type === 'shooter') {
            const radius = 18;
            enemy.addComponent(new Velocity(0, 0, 0.8)); // Speed 0.8 (Reduced from 1.2)
            enemy.addComponent(new Renderable('#ff66aa', radius, 0, 0, 'circle', 20));
            enemy.addComponent(new Health(40, 40));
            enemy.addComponent(new EnemyBehavior('shooter', 0, 0, 0, 0, 0, 0));
        } else if (type === 'summoner') {
            const radius = 20;
            enemy.addComponent(new Velocity(0, 0, 0.9)); // Speed 0.9 (Reduced from 1.8)
            enemy.addComponent(new Renderable('#bb88ff', radius, 0, 0, 'circle', 20));
            enemy.addComponent(new Health(50, 50));
            enemy.addComponent(new EnemyBehavior('summoner', 0, 0, 0, 0, 0, 0));
        } else if (type === 'paper_plane') {
            const radius = 10;
            enemy.addComponent(new Velocity(0, 0, 3.5)); // 移速极快
            enemy.addComponent(new Renderable('#ccffff', radius, 0, 0, 'triangle', 10));
            enemy.addComponent(new Health(10, 10)); // 血量极低
            enemy.addComponent(new EnemyBehavior('paper_plane', 0, 0, 0, 0, 0, 0));
        } /* else if (type === 'blackhole') {
            const radius = 30;
            enemy.addComponent(new Velocity(0, 0, 0.5)); // 缓慢移动
            enemy.addComponent(new Renderable('#222222', radius, 0, 0, 'circle', 20));
            enemy.addComponent(new Health(150, 150));
            enemy.addComponent(new EnemyBehavior('blackhole', 0, 0, 0, 0, 0, 0));
        } */ else if (type === 'boss_prism') {
            const radius = 40;
            enemy.addComponent(new Velocity(0, 0, 1.0));
            enemy.addComponent(new Renderable('#ffffff', radius, 0, 0, 'circle', 30));
            enemy.addComponent(new Health(1000, 1000)); // 第1关血量 1000
            enemy.addComponent(new EnemyBehavior('boss_prism', 1000, 1000, 0, 0, 0, 1));
        } else if (type === 'boss_roller') {
            const radius = 60;
            enemy.addComponent(new Velocity(0, 0, 1.2));
            enemy.addComponent(new Renderable('#555555', radius, radius * 2, radius, 'rect', 30));
            enemy.addComponent(new Health(1500, 1500)); // 第2关血量 1500
            enemy.addComponent(new EnemyBehavior('boss_roller', 0, 0, 0, 0, 0, 2));
        } else if (type === 'boss_slime') {
            const radius = 60;
            enemy.addComponent(new Velocity(0, 0, 0.6));
            enemy.addComponent(new Renderable('#000000', radius, 0, 0, 'circle', 30));
            enemy.addComponent(new Health(2500, 2500)); // 第3关血量 2500
            enemy.addComponent(new EnemyBehavior('boss_slime', 0, 0, 0, 0, 0, 3));
        } else if (type === 'boss_eraser') {
            const radius = 80;
            enemy.addComponent(new Velocity(0, 0, 0.4));
            enemy.addComponent(new Renderable('#eeeeee', radius, radius * 2, radius * 2, 'rect', 30));
            enemy.addComponent(new Health(4000, 4000)); // 第4关终极BOSS血量 4000
            enemy.addComponent(new EnemyBehavior('boss_eraser', 0, 0, 0, 0, 0, 4));
        } else if (type === 'boss') {
            const radius = 40;
            enemy.addComponent(new Velocity(0, 0, 0.8)); // Speed 0.8 (Reduced from 1.6)
            enemy.addComponent(new Renderable('#ffcc00', radius, 0, 0, 'triangle', 30));
            enemy.addComponent(new Health(600, 600));
            enemy.addComponent(new EnemyBehavior('boss', 120, 120, 0, 0, 0, 0));
        }
        
        if (!enemy.getComponent(EnemyBehavior)) {
            enemy.addComponent(new EnemyBehavior(type));
        }
        enemy.tags.add('enemy');
        if (type.startsWith('boss')) {
            enemy.tags.add('boss');
        }
        
        return enemy;
    }
}
