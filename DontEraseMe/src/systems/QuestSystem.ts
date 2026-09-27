import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Quest } from '../components/Quest';
import { Score } from '../components/Score';
import { StoryState } from '../components/StoryState';

export class QuestSystem extends System {
    public update(dt: number): void {
        for (const entity of this.entities) {
            if (!entity.tags.has('player')) continue;
            const quest = entity.getComponent(Quest);
            if (!quest || !quest.active) continue;
            const score = entity.getComponent(Score);
            const story = entity.getComponent(StoryState);
            if (!score) continue;
            if (quest.index >= quest.steps.length) {
                quest.active = false;
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: '任务完成' } }));
                continue;
            }
            const step = quest.steps[quest.index];
            if (step.done) {
                quest.index += 1;
                continue;
            }
            if (step.type === 'announce') {
                const t = step.text || '';
                window.dispatchEvent(new CustomEvent('announce', { detail: { text: t } }));
                step.done = true;
                quest.index += 1;
                continue;
            }
            if (step.type === 'rating') {
                const r = score.rating || 0;
                const target = step.target || 0;
                if (r >= target) {
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: `评分达标 ${target}` } }));
                    step.done = true;
                    quest.index += 1;
                    continue;
                }
            }
            if (step.type === 'kills') {
                const kills = Math.floor((score.value || 0) / 10);
                const target = step.target || 0;
                if (kills >= target) {
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: `击杀达标 ${target}` } }));
                    step.done = true;
                    quest.index += 1;
                    if (story) {
                        story.flags['kills_ok'] = true;
                    }
                    continue;
                }
            }
            if (step.type === 'survive' || step.type === 'defend' || step.type === 'escape') {
                if (step.elapsed === undefined) step.elapsed = 0;
                step.elapsed += 1; // Assuming dt is essentially 1 frame per tick
                
                // For escape, we let the PrologueSystem handle the completion manually
                if (step.type === 'escape') {
                    // Do nothing, PrologueSystem will set step.done = true
                    continue;
                }

                const durationFrames = (step.duration || 120) * 60; // 默认 120 秒，转换为帧
                if (step.elapsed >= durationFrames) {
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: step.text || '防守成功！' } }));
                    step.done = true;
                    quest.index += 1;
                    continue;
                }
            }
        }
    }
}
