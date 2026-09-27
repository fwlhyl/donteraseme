import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Experience } from '../components/Experience';
import { Weapon } from '../components/Weapon';
import { Health } from '../components/Health';
import { Skill } from '../components/Skill';

export class LevelSystem extends System {
    constructor(
        private getMode: () => 'story' | 'endless' = () => 'endless'
    ) {
        super();
    }

    public update(dt: number): void {
        if (this.getMode() === 'story') {
            return;
        }
        for (const e of this.entities) {
            if (!e.tags.has('player')) continue;
            const exp = e.getComponent(Experience);
            if (!exp) continue;
            while (exp.xp >= exp.next) {
                exp.xp -= exp.next;
                exp.level += 1;
                exp.next = Math.floor(exp.next * 1.2 + 50);
                const weapon = e.getComponent(Weapon);
                const skill = e.getComponent(Skill);
                
                // Unlocks are handled by the skill card system now, so we just dispatch the event
                window.dispatchEvent(new CustomEvent('player-levelup', { detail: { level: exp.level, entityId: e.id } }));
            }
        }
    }
}
