import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Renderable } from '../components/Renderable';
import { PlayerControl } from '../components/PlayerControl';
import { Trail } from '../components/Trail';
import { Weapon } from '../components/Weapon';
import { Skill } from '../components/Skill';

import { Health } from '../components/Health';
import { Score } from '../components/Score';
import { Skeleton, Bone } from '../components/Skeleton';
import { Experience } from '../components/Experience';
import { StoryState } from '../components/StoryState';
import { Quest } from '../components/Quest';
import type { QuestStep } from '../components/Quest';
import { PlayerStats } from '../components/PlayerStats';
import { CHARACTERS } from '../config/EndlessConfig';
import { SpriteAnimation } from '../components/SpriteAnimation';
import { PlayerAnimation } from '../components/PlayerAnimation';
import type { AnimConfig } from '../components/PlayerAnimation';

// 导入测试用的免费素材
import IdleDownImg from '../ui/CXK/Idle/Idle_Down.png';
import IdleLeftImg from '../ui/CXK/Idle/Idle_Left.png';
import IdleRightImg from '../ui/CXK/Idle/Idle_Right.png';
import IdleUpImg from '../ui/CXK/Idle/Idle_Up.png';

import DashDownImg from '../ui/CXK/Dash/Dash_Down.png';
import DashLeftImg from '../ui/CXK/Dash/Dash_Left.png';
import DashRightImg from '../ui/CXK/Dash/Dash_Right.png';
import DashUpImg from '../ui/CXK/Dash/Dash_Up.png';

import HitLeftImg from '../ui/CXK/Hit/CXKLeftHit.png';
import HitRightImg from '../ui/CXK/Hit/CXKRightHit.png';

export class PlayerFactory {
    public static create(x: number, y: number, characterId?: string, weaponId?: number): Entity {
        const player = new Entity();
        
        console.log('Creating player at', x, y);
        
        // Find selected character or default to the first one
        const charConfig = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
        const initialWeapon = weaponId !== undefined ? weaponId : 0;

        
        player.addComponent(new Transform(x, y));
        player.addComponent(new Velocity());
        
        const renderable = new Renderable('#ffffff', 20, 40, 40, 'circle', 70);
        // 放大人物渲染尺寸以匹配逻辑碰撞体积 (原图偏小，可以进行缩放)
        renderable.scaleX = 1.5;
        renderable.scaleY = 1.5;
        
        player.addComponent(renderable);

        // ===== 挂载序列帧动画 =====
        // 提前预加载所有方向的动画素材
        const anims: Record<string, AnimConfig> = {};
        
        // 自己的美术素材（提供真实的左和右两个方向）
        // 原图单行 256x32，每帧 32x32
        const createCXKConfig = (src: string): AnimConfig => {
            const img = new Image();
            img.src = src;
            return {
                image: img,
                row: 0,
                totalFrames: 8,
                frameWidth: 32,
                frameHeight: 32
            };
        };

        // 受击动画（改为 4 帧）
        const createHitConfig = (src: string): AnimConfig => {
            const img = new Image();
            img.src = src;
            return {
                image: img,
                row: 0,
                totalFrames: 4,
                frameWidth: 32,
                frameHeight: 32
            };
        };

        anims['idle_left'] = createCXKConfig(IdleLeftImg);
        anims['idle_right'] = createCXKConfig(IdleRightImg);
        anims['dash_left'] = createCXKConfig(DashLeftImg);
        anims['dash_right'] = createCXKConfig(DashRightImg);
        anims['hit_left'] = createHitConfig(HitLeftImg);
        anims['hit_right'] = createHitConfig(HitRightImg);

        // 为了防止旧代码初始化报错，这里随便绑一个
        anims['idle_down'] = createCXKConfig(IdleLeftImg);

        player.addComponent(new PlayerAnimation(anims));

        // 默认用 idle_left 初始化
        const initAnim = anims['idle_left'];
        const spriteAnim = new SpriteAnimation(
            initAnim.image, 
            initAnim.frameWidth,
            initAnim.frameHeight,
            initAnim.totalFrames,
            5,     // 播放速度稍微调快一点
            true,  // 循环播放
            0.5,   // 轴心点X：中心
            0.5,   // 轴心点Y：中心
            initAnim.row
        );
        player.addComponent(spriteAnim);
        // ========================
        
        // Add PlayerStats based on selection
        const stats = new PlayerStats();
        stats.characterId = charConfig.id;
        stats.speedMultiplier = charConfig.baseSpeed / 5.0; // Assuming 5.0 is base normal speed
        stats.maxHp = charConfig.baseHp;
        
        if (charConfig.id === 'classical') {
            stats.hasClassicalShield = true;
            stats.shieldCooldownFrames = 0;
            stats.maxShieldCooldownFrames = 1200; // 20 seconds
        } else if (charConfig.id === 'sketcher') {
            // 速写漫画家被动：射速和换弹速度提升 30% (倍率越高，速度越快，或者冷却时间越短)
            stats.fireRateMultiplier = 1.3;
            stats.reloadSpeedMultiplier = 1.3;
        } else if (charConfig.id === 'watercolor') {
            // 水彩插画师被动：击杀敌人后留下水痕毒沼
            stats.hasWatercolorPassive = true;
        } else if (charConfig.id === 'digital') {
            stats.hasDigitalPassive = true;
            stats.digitalPenCooldown = 0;
            stats.maxDigitalPenCooldown = 180; // 3 seconds
        } else if (charConfig.id === 'calligrapher') {
            stats.hasCalligrapherPassive = true;
            stats.pierceBonus += 5; // 极强穿透力
        } else if (charConfig.id === 'ink') {
            stats.hasInkPassive = true;
        }
        
        player.addComponent(stats);

        // Base values from character config
        player.addComponent(new PlayerControl(charConfig.baseSpeed));
        player.addComponent(new Trail('rgba(255, 255, 255, 0.5)', 30, 0.2)); 
        player.addComponent(new Weapon(initialWeapon)); // Start with selected weapon
        player.addComponent(new Skill()); 
        player.addComponent(new Health(charConfig.baseHp, charConfig.baseHp)); 
        player.addComponent(new Score(0)); 
        player.addComponent(new Experience(1, 0, 100)); 
        player.addComponent(new StoryState('Prologue', {}));

        const steps: QuestStep[] = [
            { type: 'announce', text: '序章开始' },
            { type: 'rating', target: 60 },
            { type: 'kills', target: 10 },
            { type: 'announce', text: '进入擦除之夜' }
        ];
        player.addComponent(new Quest(steps, 0, true));
        
        const bones = [
            new Bone('root', 0, 0, 0, 20),
            new Bone('spine', 0, 0, 0, 24, 'root'),
            new Bone('arm_r', 24, 0, 0, 22, 'spine'),
            new Bone('forearm_r', 22, 0, 0, 18, 'arm_r')
        ];
        player.addComponent(new Skeleton(bones, 'root'));
        
        player.tags.add('player');
        
        return player;
    }
}
