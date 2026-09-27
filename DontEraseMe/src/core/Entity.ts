import { v4 as uuidv4 } from 'uuid';
import { Component } from './Component';

export class Entity {
    public id: string;
    public components: Map<any, Component> = new Map();
    public active: boolean = true;
    public tags: Set<string> = new Set();
    public attacking: boolean = false;

    constructor() {
        this.id = uuidv4();
    }

    public addComponent<T extends Component>(component: T): T {
        this.components.set(component.constructor, component);
        return component;
    }

    public getComponent<T extends Component>(type: new (...args: any[]) => T): T | undefined {
        return this.components.get(type) as T;
    }

    public removeComponent<T extends Component>(type: new (...args: any[]) => T): void {
        this.components.delete(type);
    }

    public hasComponent<T extends Component>(type: new (...args: any[]) => T): boolean {
        return this.components.has(type);
    }
}
