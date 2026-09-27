import './style.css'
import { Game } from './core/Game';
import { ElementDictionary, PaletteSystem } from './systems/PaletteSystem';
import { Weapon } from './components/Weapon';

// Type definitions for global variables
declare global {
    interface Window {
        gameInstance: Game;
        audioManager: any; // 暂时用 any 绕过类型检查
    }
}

// Initialize game
const game = new Game();
window.gameInstance = game; // Expose to global for UI and systems

// Start game loop
game.start();

console.log('Game initialized');

// Palette UI Listeners
const paletteUI = document.getElementById('palette-ui');
let currentBaseElement: any = null;
let currentModifierElement: any = null;

document.getElementById('base-slot')?.addEventListener('click', () => {
    // Mock selecting a base element
    currentBaseElement = ElementDictionary['geo_ray'];
    const slot = document.getElementById('base-slot');
    if (slot) {
        slot.innerText = currentBaseElement.name;
        slot.style.borderColor = '#4caf50';
    }
});

document.getElementById('modifier-slot')?.addEventListener('click', () => {
    // Mock selecting a modifier element
    currentModifierElement = ElementDictionary['con_neon'];
    const slot = document.getElementById('modifier-slot');
    if (slot) {
        slot.innerText = currentModifierElement.name;
        slot.style.borderColor = '#ff9800';
    }
});

document.getElementById('fuse-btn')?.addEventListener('click', () => {
    if (currentBaseElement && currentModifierElement) {
        const result = PaletteSystem.fuseElements(currentBaseElement, currentModifierElement);
        const resultDiv = document.getElementById('fusion-result');
        if (resultDiv && result) {
            resultDiv.innerHTML = `<strong>获得新技能：${result.name}</strong><br><span style="font-size:12px">${result.description}</span><br><br><span style="color:#4caf50;">按 0 键装备此武器！</span>`;
            
            // Give player the new weapon in game
            if (window.gameInstance && window.gameInstance.entities) {
                // Find player entity
                let playerEntity = null;
                for (const [, entity] of window.gameInstance.entities) {
                    if (entity.tags.has('player')) {
                        playerEntity = entity;
                        break;
                    }
                }
                
                if (playerEntity) {
                    // Get the Weapon component properly using the class constructor
                    const WeaponComponent = playerEntity.getComponent(Weapon);
                    if (WeaponComponent) {
                        WeaponComponent.unlocked.add(result.weaponId);
                        WeaponComponent.currentWeaponIndex = result.weaponId;
                        // init ammo for this new weapon
                        const config = WeaponComponent.config;
                        if (config) {
                            WeaponComponent.ammo[result.weaponId] = config.magSize;
                            WeaponComponent.damageBonus[result.weaponId] = 0;
                            console.log("Player equipped new fused weapon:", config.name);
                        }
                    } else {
                        console.error("Weapon component not found on player entity!");
                    }
                }
            }
        }
    } else {
        const resultDiv = document.getElementById('fusion-result');
        if (resultDiv) resultDiv.innerText = "请先选择基础形态和修饰属性！";
    }
});

document.getElementById('close-palette-btn')?.addEventListener('click', () => {
    if (paletteUI) paletteUI.style.display = 'none';
    // Resume game here if needed
});

// Press 'P' to open Palette in Story Mode
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p' && window.gameInstance?.currentMode === 'story') {
        if (paletteUI) {
            paletteUI.style.display = paletteUI.style.display === 'none' ? 'block' : 'none';
        }
    }
});
