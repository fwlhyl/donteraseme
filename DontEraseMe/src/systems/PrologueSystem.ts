import { System } from '../core/System';
import { Entity } from '../core/Entity';
import { Transform } from '../components/Transform';
import { Renderable } from '../components/Renderable';
import { StoryState } from '../components/StoryState';
import { Quest } from '../components/Quest';
import { Health } from '../components/Health';

export class PrologueSystem extends System {
    private eraserEntity: Entity | null = null;
    private phase: 'wander' | 'chase' | 'deadend' | 'awaken' | 'finished' = 'wander';
    private timer: number = 0;
    private nextBombTime: number = 0;
    private citySpawned: boolean = false;
    
    constructor(private worldWidth: number, private worldHeight: number) {
        super();
    }

    public override setWorldSize(width: number, height: number): void {
        this.worldWidth = width;
        this.worldHeight = height;
    }

    public update(dt: number): void {
        let player: Entity | null = null;
        let story: StoryState | null = null;
        let quest: Quest | null = null;

        for (const entity of this.entities) {
            if (entity.tags.has('player')) {
                player = entity;
                story = entity.getComponent(StoryState) || null;
                quest = entity.getComponent(Quest) || null;
                break;
            }
        }

        // If no player or not in Prologue, we should make sure we reset our internal state 
        // in case we restarted the game.
        if (!player || !story || story.chapter !== 'Prologue') {
            this.phase = 'wander';
            this.timer = 0;
            this.eraserEntity = null;
            this.citySpawned = false;
            return;
        }

        this.timer += dt;

        const pTransform = player.getComponent(Transform);
        if (!pTransform) return;

        if (!this.citySpawned) {
            this.spawnCity(pTransform.x);
            this.citySpawned = true;
        }

        // Ensure we are in the escape quest step
        const isEscapeQuest = quest && quest.active && quest.steps[quest.index] && quest.steps[quest.index].type === 'escape';

        switch (this.phase) {
            case 'wander':
                if (isEscapeQuest) {
                    this.phase = 'chase';
                    this.timer = 0;
                    this.spawnGiantEraser();
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: '糟糕！是巨型橡皮擦！快往右边跑！' } }));
                }
                break;

            case 'chase':
                if (this.eraserEntity) {
                    const eTransform = this.eraserEntity.getComponent(Transform);
                    if (eTransform) {
                        // Move eraser to the right
                        eTransform.x += 150 * dt; // 150 pixels per second
                        
                        // Check collision with player
                        if (pTransform.x < eTransform.x + 200) { // 200 is half width of eraser roughly
                            // Player caught by eraser!
                            const pHealth = player.getComponent(Health);
                            if (pHealth) pHealth.current = 0;
                        }

                        // Erase city and citizens
                        for (const entity of this.entities) {
                            if (entity.tags.has('city_building') || entity.tags.has('citizen')) {
                                const t = entity.getComponent(Transform);
                                if (t && t.x < eTransform.x + 200) {
                                    entity.active = false; // Erased!
                                    // Optional: spawn some particle effects
                                } else if (t && entity.tags.has('citizen')) {
                                    // Make citizen run away!
                                    t.x += 120 * dt; // Run right
                                }
                            }
                        }
                    }
                }

                // Reduced Random bombs to lower difficulty
                if (this.timer > this.nextBombTime) {
                    this.spawnBomb(pTransform.x + 200 + Math.random() * 400, Math.random() * this.worldHeight);
                    this.nextBombTime = this.timer + 3 + Math.random() * 4; // timer is in seconds
                }

                // Check dead end
                if (pTransform.x > this.worldWidth - 600) {
                    this.phase = 'deadend';
                    this.timer = 0;
                    window.dispatchEvent(new CustomEvent('announce', { detail: { text: '没路了...' } }));
                }
                break;

            case 'deadend':
                // Eraser catches up slowly
                if (this.eraserEntity) {
                    const eTransform = this.eraserEntity.getComponent(Transform);
                    if (eTransform) {
                        eTransform.x += 100 * dt;
                        if (eTransform.x > pTransform.x - 300 && this.timer > 3) {
                            this.phase = 'awaken';
                            this.timer = 0;
                            // Flash effect
                            const flashDiv = document.createElement('div');
                            flashDiv.style.position = 'fixed';
                            flashDiv.style.top = '0';
                            flashDiv.style.left = '0';
                            flashDiv.style.width = '100vw';
                            flashDiv.style.height = '100vh';
                            flashDiv.style.backgroundColor = 'white';
                            flashDiv.style.zIndex = '9999';
                            flashDiv.style.transition = 'opacity 2s';
                            document.body.appendChild(flashDiv);
                            
                            setTimeout(() => {
                                flashDiv.style.backgroundColor = 'black';
                                flashDiv.innerHTML = '<div style="color:white; font-size: 5rem; text-align:center; margin-top: 40vh; font-family: monospace;">DONT ERASE ME!</div>';
                            }, 500);

                            setTimeout(() => {
                                flashDiv.style.opacity = '0';
                                setTimeout(() => flashDiv.remove(), 2000);
                                this.transitionToAct1(story, quest);
                            }, 4000);
                        }
                    }
                }
                break;

            case 'awaken':
                // Waiting for transition
                break;
        }
    }

    private spawnCity(playerX: number) {
        const startX = playerX || 0;
        
        const walls = [
            // Top and Bottom Borders (Thicker and closer to center)
            { x: startX + 1000, y: this.worldHeight / 2 - 400, w: 3000, h: 200 },
            { x: startX + 1000, y: this.worldHeight / 2 + 400, w: 3000, h: 200 },
            
            // Obstacles / Maze blocks (Starting right in front of the player)
            { x: startX + 200, y: this.worldHeight / 2 - 150, w: 100, h: 300 },
            { x: startX + 200, y: this.worldHeight / 2 + 250, w: 100, h: 200 },
            
            { x: startX + 600, y: this.worldHeight / 2 - 250, w: 150, h: 400 },
            { x: startX + 600, y: this.worldHeight / 2 + 250, w: 150, h: 300 },
            
            { x: startX + 1100, y: this.worldHeight / 2 - 100, w: 100, h: 600 },
            
            { x: startX + 1600, y: this.worldHeight / 2 - 300, w: 150, h: 400 },
            { x: startX + 1600, y: this.worldHeight / 2 + 200, w: 150, h: 400 },
            
            { x: startX + 2100, y: this.worldHeight / 2 - 200, w: 100, h: 500 },
        ];

        // Spawn Collidable Maze Walls
        for (const w of walls) {
            const building = new Entity();
            building.tags.add('city_building');
            building.tags.add('wall'); // Adds collision
            building.addComponent(new Transform(w.x, w.y, 0));
            // Make walls very bright and visible
            const color = `rgba(${150+Math.random()*105}, ${150+Math.random()*105}, 255, 0.9)`;
            const render = new Renderable(color, 0, w.w, w.h, 'rect');
            render.zIndex = 5; 
            building.addComponent(render);
            window.dispatchEvent(new CustomEvent('add-entity', { detail: { entity: building } }));
        }

        // Spawn Background Scenery (non-collidable)
        for (let i = 0; i < 30; i++) {
            const bgBuilding = new Entity();
            bgBuilding.tags.add('city_bg');
            const bx = startX - 500 + Math.random() * 3000;
            const by = this.worldHeight / 2 - 800 + Math.random() * 1600;
            const bw = 100 + Math.random() * 200;
            const bh = 100 + Math.random() * 300;
            
            bgBuilding.addComponent(new Transform(bx, by, 0));
            const color = `rgba(${50+Math.random()*50}, ${50+Math.random()*50}, ${100+Math.random()*50}, 0.3)`;
            const render = new Renderable(color, 0, bw, bh, 'rect');
            render.zIndex = -10; // Behind player and maze
            bgBuilding.addComponent(render);
            window.dispatchEvent(new CustomEvent('add-entity', { detail: { entity: bgBuilding } }));
        }

        // Spawn some running citizens
        for (let i = 0; i < 15; i++) {
            const x = startX + Math.random() * 1000;
            const y = this.worldHeight / 2 + Math.random() * 600 - 300;
            
            const citizen = new Entity();
            citizen.tags.add('citizen');
            citizen.addComponent(new Transform(x, y, Math.random() * Math.PI * 2));
            const render = new Renderable('#00ffcc', 15, 0, 0, 'circle');
            render.zIndex = 5;
            citizen.addComponent(render);
            window.dispatchEvent(new CustomEvent('add-entity', { detail: { entity: citizen } }));
        }
    }

    private spawnGiantEraser() {
        this.eraserEntity = new Entity();
        this.eraserEntity.tags.add('giant_eraser');
        this.eraserEntity.addComponent(new Transform(-500, this.worldHeight / 2, 0));
        
        // Huge rectangle
        const render = new Renderable('rgba(20, 20, 20, 0.9)', 0, 1000, this.worldHeight * 2, 'rect');
        render.zIndex = 100;
        this.eraserEntity.addComponent(render);
        
        // Dispatch event to add to game
        window.dispatchEvent(new CustomEvent('add-entity', { detail: { entity: this.eraserEntity } }));
    }

    private spawnBomb(x: number, y: number) {
        const bomb = new Entity();
        bomb.addComponent(new Transform(x, y, 0));
        const render = new Renderable('rgba(255, 0, 0, 0.3)', 100, 0, 0, 'circle');
        render.zIndex = 10;
        bomb.addComponent(render);
        window.dispatchEvent(new CustomEvent('add-entity', { detail: { entity: bomb } }));

        // Flash and explode after 2 seconds
        setTimeout(() => {
            render.color = 'rgba(255, 0, 0, 0.8)';
            setTimeout(() => {
                bomb.active = false;
                // Deal damage if player is near
                window.dispatchEvent(new CustomEvent('explosion', { detail: { x, y, radius: 100, damage: 20 } }));
            }, 200);
        }, 2000);
    }

    private transitionToAct1(story: StoryState, quest: Quest | null) {
        this.phase = 'finished';
        story.chapter = 'Act1';
        if (this.eraserEntity) this.eraserEntity.active = false;
        
        // Dispatch to Game.ts to setup Act 1
        window.dispatchEvent(new CustomEvent('start-act1'));
        
        if (quest && quest.steps[quest.index]) {
            quest.steps[quest.index].done = true;
            quest.index++;
        }
    }
}
