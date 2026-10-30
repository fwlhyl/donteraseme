import { System } from '../core/System';

interface DamageText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
    velocityY: number;
    damageValue: number;
    isCrit: boolean;
    isSuperCrit: boolean;
    scale: number;
}

export class DamageTextSystem extends System {
    private texts: DamageText[] = [];
    
    // Use a static instance for easy access from anywhere
    private static instance: DamageTextSystem;

    constructor(
        private ctx: CanvasRenderingContext2D,
        private camera: { x: number, y: number }
    ) {
        super();
        DamageTextSystem.instance = this;
    }

    public static addDamageText(x: number, y: number, damage: number, color: string = '#ff4444', isCrit: boolean = false, customText?: string) {
        if (!DamageTextSystem.instance) return;
        // Check global setting
        if ((window as any).gameInstance && (window as any).gameInstance.showDamageNumbers === false) return;
        
        const isSuperCrit = color === '#ff0000' && isCrit;
        
        if (customText === undefined) {
            // ===== 伤害数字合并逻辑 =====
            // 查找附近50像素内、生命周期还比较新的同类型伤害数字
            const mergeDist = 50;
            const existing = DamageTextSystem.instance.texts.find(t => 
                t.isCrit === isCrit && 
                t.isSuperCrit === isSuperCrit &&
                t.life > 0.4 && // 只有较新的数字才合并，防止飞到天上去了还合在一起
                Math.hypot(t.x - x, t.y - y) < mergeDist
            );

            if (existing) {
                // 合并伤害
                existing.damageValue += damage;
                existing.text = isSuperCrit ? `${Math.ceil(existing.damageValue)}!!` : (isCrit ? `${Math.ceil(existing.damageValue)}!` : `${Math.ceil(existing.damageValue)}`);
                // 刷新位置、生命和缩放特效
                existing.x = (existing.x + x) / 2; // 位置取中点
                existing.y = Math.min(existing.y, y); // 保持在较高的位置
                existing.life = existing.maxLife; // 刷新生命周期
                existing.scale = Math.min(1.2, existing.scale + 0.03); // 每次合并变大一点点，最高2倍
                return;
            }
        }

        let text = customText !== undefined ? customText : (isCrit ? `${Math.ceil(damage)}!` : `${Math.ceil(damage)}`);
        if (isSuperCrit && customText === undefined) {
            text = `${Math.ceil(damage)}!!`;
        }

        DamageTextSystem.instance.texts.push({
            x: x + (Math.random() * 20 - 10),
            y: y + (Math.random() * 10 - 5),
            text: text,
            color: isSuperCrit ? '#ce8c80' : isCrit ? '#c5ad75' : customText !== undefined ? color : '#bcb8a8',
            life: 0.6,
            maxLife: 0.6,
            velocityY: -40,
            damageValue: damage,
            isCrit: isCrit,
            isSuperCrit: isSuperCrit,
            scale: 1.0
        });
    }

    public update(dt: number): void {
        if (this.texts.length === 0) return;

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            if (t.life <= 0) {
                this.texts.splice(i, 1);
                continue;
            }

            t.y += t.velocityY * dt;

            // 缓动缩小scale，回归原本大小
            if (t.scale > 1.0) {
                t.scale -= dt * 2;
                if (t.scale < 1.0) t.scale = 1.0;
            }

            const alpha = Math.max(0, t.life / t.maxLife);
            // 杂兵/小伤害数字降低透明度，减少视觉干扰
            const finalAlpha = (t.damageValue < 20 && !t.isCrit) ? alpha * 0.5 : alpha;
            this.ctx.globalAlpha = finalAlpha;
            
            this.ctx.fillStyle = t.color;
            
            let baseSize = t.isSuperCrit ? 22 : (t.isCrit ? 18 : 14);
            const currentSize = baseSize * t.scale;
            
            this.ctx.font = `bold ${currentSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 3 * t.scale;
            this.ctx.strokeText(t.text, t.x, t.y);
            this.ctx.fillText(t.text, t.x, t.y);
        }

        this.ctx.restore();
    }
}
