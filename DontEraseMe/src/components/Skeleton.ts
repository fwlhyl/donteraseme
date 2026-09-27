import { Component } from '../core/Component';

export class Bone {
    name: string;
    parent?: string;
    x: number;
    y: number;
    rotation: number;
    length: number;
    worldX: number = 0;
    worldY: number = 0;
    worldRotation: number = 0;
    constructor(name: string, x: number, y: number, rotation: number, length: number, parent?: string) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.length = length;
        this.parent = parent;
    }
}

export class Skeleton extends Component {
    bones: Map<string, Bone> = new Map();
    root: string;
    constructor(bones: Bone[], root: string) {
        super();
        for (const b of bones) this.bones.set(b.name, b);
        this.root = root;
    }
    getBone(name: string): Bone | undefined {
        return this.bones.get(name);
    }
}
