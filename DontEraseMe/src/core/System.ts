import { Entity } from './Entity';

export abstract class System {
    public entities: Set<Entity> = new Set();
    public abstract update(dt: number): void;
    
    // Optional methods
    public onEntityAdded(entity: Entity): void {}
    public onEntityRemoved(entity: Entity): void {}

    public addEntity(entity: Entity): void {
        this.entities.add(entity);
        this.onEntityAdded(entity);
    }

    public removeEntity(entity: Entity): void {
        if (this.entities.has(entity)) {
            this.entities.delete(entity);
            this.onEntityRemoved(entity);
        }
    }
}
