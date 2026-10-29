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
import { PlayerArtwork } from '../components/PlayerArtwork';
import { getPaperCollector } from '../art/PaperCollectorArt';
import { PLAYER_PRESENTATION } from '../config/PlayerPresentation';

export class PlayerFactory {
    public static create(x: number, y: number, characterId?: string, weaponId?: number): Entity {
        const player = new Entity();
        
        console.log('Creating player at', x, y);
        
        // Find selected character or default to the first one
        const charConfig = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[0];
        const initialWeapon = weaponId !== undefined ? weaponId : 0;

        
        player.addComponent(new Transform(x, y));
        player.addComponent(new Velocity());
        
        const { hitRadius, displaySize } = PLAYER_PRESENTATION;
        const renderable = new Renderable('#ffffff', hitRadius, hitRadius * 2, hitRadius * 2, 'circle', 70);
        // Appearance and collision share one scale, including subsequent body-size upgrades.
        player.addComponent(renderable);
        player.addComponent(new PlayerArtwork(getPaperCollector(), displaySize, hitRadius, undefined, false, 'neutral-player', charConfig.id));
        
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
