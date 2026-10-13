# 收藏家 64 px 试装 · 2026-10-05

> 历史记录：2026-10-08 已由全角色涂鸦图集与剪纸式动态替代，水彩文件仅保留回退。当前运行接入、测试及限制以 [DoodleArtImplementation.md](DoodleArtImplementation.md) 为准。以下内容描述当时的单角色试装，不代表当前工厂状态。

用户确认将简化收藏家样稿按 64 px 放进游戏试用，随后确认以水彩墨团替换人形版本。当前候选源图和生成提示词在 `art-drafts/production-candidates/heroes/collector-watercolor-v3/`，运行副本为 `src/assets/characters/collector-watercolor-v3.png`。原始透明图片 1254×1254，显示框仍为 64×64（包含透明边距），保持居中缩放、不加工源图。旧人形 v1 文件保留用于回退，不再由角色工厂引用。

## 接入范围

- `PlayerFactory` 只给 `collector`（含默认初始角色）添加 `PlayerArtwork` 组件；同一张 Image 缓存复用。创造和守卫两种模式共用角色工厂。
- 原 `Renderable` 保持 circle / radius 20 / width 40 / height 40，保持颜料颜色、碰撞、技能与数值逻辑。
- `RenderSystem` 在原圆形身体绘制位置换用图片，原有技能覆盖层保留；图片未就绪或加载失败时回退原占位。
- 图片始终直立；按真实瞄准角左右镜像，垂直瞄准附近使用小死区避免翻转抖动。无整个人物旋转，无新动画状态机。
- 图片采用平滑缩小；不加白色光晕。受伤半透明闪烁沿用原画布 alpha，体型变化按当前 radius / 20 同比缩放。载具通过既有 visible 开关隐藏角色，结束后恢复。
- 图中自带画笔，因此图片显示成功时不再画红色矩形占位武器。

## 当前限制

仍是单姿态试装，不是动作精灵。手持画笔与身体一体，不会独立跟随瞄准角，也暂不随所选武器改变；弹道/攻击判定仍按实际装备与瞄准运行。后续确认试用效果后再拆人物与武器层、统一锚点及制作动作。

## 验证

- 水彩 v3 接入后重新通过下列构建/自动测试；测试新增核对工厂实际加载的 PNG 字节，防止误用旧人形资源。浏览器正常进入创造模式已确认水彩墨团显示，当前实机截图：`art-drafts/production-candidates/heroes/collector-watercolor-v3/collector-watercolor-gameplay.jpg`。守卫共用工厂，未另外进行守卫长局验证。
- `npm run build` 通过，Vite 构建包含带哈希的角色 PNG。
- `node scripts/test-player-artwork.mjs` 通过：实际工厂与 RenderSystem 的 64 px 输出、碰撞不变、其他角色隔离、图片复用、朝向/垂直死区、体型缩放、受伤闪烁、护盾、隐藏/恢复及图片失败回退。载具这里验证既有 visibility 契约，不代表完整神笔具现实机验收。
- `node scripts/test-courtyard.mjs`、`node scripts/test-combat-hud.mjs` 通过。
- 浏览器正常进入创造模式确认显示；实机图：`art-drafts/production-candidates/heroes/collector-v1/collector-64-gameplay.jpg`。未修改玩家存档或使用调试方式解锁角色。
