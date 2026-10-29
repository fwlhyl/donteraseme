import { Component } from '../core/Component';

export type QuestStepType = 'kills' | 'announce' | 'defend' | 'survive' | 'escape';

export interface QuestStep {
    type: QuestStepType;
    target?: number;
    text?: string;
    done?: boolean;
    duration?: number; // 持续时间（帧或秒）
    elapsed?: number;  // 已过去的时间
}

export class Quest extends Component {
    constructor(
        public steps: QuestStep[] = [],
        public index: number = 0,
        public active: boolean = true
    ) {
        super();
    }
}
