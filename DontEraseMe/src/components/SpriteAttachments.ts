import { Component } from '../core/Component';

export type AttachmentPart = {
    image: HTMLImageElement;
    bone: string;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    rotationOffset: number;
    z: number;
};

export class SpriteAttachments extends Component {
    parts: AttachmentPart[] = [];
    addPart(part: AttachmentPart) {
        this.parts.push(part);
    }
}
