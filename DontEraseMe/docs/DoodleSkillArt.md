# 技能与召唤物涂鸦美术清单

更新日期：2026-10-09（本轮始于 10 月 8 日）。

状态：**独立技能实体、玩家环绕效果与相关命中特效已接入第一版**。下方盘点表保留制作前现状；实际完成项与验证边界见末尾“本轮交付”。纯属性技能不增加模型，写入画作的原始笔迹效果保持不变。

### 2026-10-09 无人机猎手朝向修订

- 用户补充要求无人机猎手也不整张旋转。`Summon.type='drone'` 改为直立、只左右翻转，使用与载具一致的 ±0.12 水平死区；按原 `rotation-PI/2` 读取实际移动方向，不改逻辑朝向。
- 维持原 32 px 显示、半径 15 占位数据、±1.2 px 悬浮与独立旋翼线条，不套用载具的 1.4 倍放大。数量、跟随、目标、射击与制导均不变；数位笔、卫星/镰刀和敌方纸飞机不受影响。
- 未加载/失败时由同一绘制入口显示直立橡皮擦几何回退，避免落入原来的旋转三角分支。只调整运行时绘制，原 PNG 和游戏 UI 不变。
- 构建、既有敌人步态回归和扩展技能测试通过：全角度、垂直翻转滞回、32 px 大小、悬浮周期、旋翼矩阵、三类加载失败、暂停、组件不变与 Canvas 平衡。
- 浏览器刷新后检查军团两架无人机均保持正立，控制台无 error/warn；截图 `art-drafts/production-candidates/doodle-skills-v1/drone-upright-v2.jpg`。

### 2026-10-09 载具朝向与体积反馈修订

- 坦克、机器人、轰炸机统一保持直立，只沿 X 轴左右翻转，不再随瞄准角度整张旋转或上下翻转。
- 显示尺寸统一乘以 1.4：坦克最长边 58 → 81.2 px，机器人 56 → 78.4 px，轰炸机 70 → 98 px；接地影同比调整。`Renderable` 原宽高/半径、玩家碰撞、移动、弹丸和发射角均未改。
- 接近垂直瞄准时保留上次左右朝向（水平分量死区 ±0.12），避免细小瞄准变化造成闪转。朝向缓存使用弱引用，仅属于美术状态。
- 图片未加载/加载失败的三个几何回退分支也遵守左右翻转与 1.4 倍显示，不会短暂恢复旋转。
- 技能审阅页新增载具瞄准选择，可演示完整一周与四个主方向。此修订只调整现有 PNG 的运行时绘制，不修改源图或新增游戏 UI。
- 本修订验证：构建、审阅页类型检查、人物/步态回归通过；`test-doodle-skills.mjs` 新增三种载具真实尺寸、每 15° 完整转向、负角度、垂直滞回、加载失败、驾驶员隐藏与组件不变断言，全部通过。浏览器朝右→朝左→朝上检查通过，控制台无 error/warn；截图 `art-drafts/production-candidates/doodle-skills-v1/vehicle-flip-v2.jpg`。

## 目标与边界

沿用已确认的简约涂鸦风格：不规则深色轮廓、少量平涂色块、清晰剪影和克制的纸笔质感。与人物、武器、地图保持同一家族。技能存在时必须看得清，但不能用大面积不透明色块、强发光和满屏细线遮住画板。

- 本轮面向局内技能实体、玩家周围的伴随物与状态效果；现有菜单、HUD、技能卡片布局不在修改范围。
- 美术可以读取现有状态、计时器、朝向和等级，不改伤害、射速、寿命、数量、轨道、目标选择和碰撞范围。
- 名字并不等于实体：例如“素描分身”是分裂弹，“颜料滑板”是移速/伤害转换，不应因为名字就新增伙伴或改变移动方式。
- 以下“现状”指本轮开始盘点时的表现，后续实现可能替换对应基础几何图形。

## 一、召唤物与数位笔：需要独立识别的对象

| 现有 ID / 状态 | 可见名称 | 创建与更新入口 | 盘点时渲染入口 / 现状 | 必须保留的行为 |
| --- | --- | --- | --- | --- |
| `summon_stickman` → `Summon.type='stickman'` | 火柴人助手 | `SummonSystem.syncSummons/createSummon/updateSummons` | `RenderSystem` 的 `rect`；白色 15×30 占位矩形 | 1 级 1 个，2/3 级 2 个；跟随玩家、射击最近敌人；3 级射击间隔减半 |
| `summon_palette` → `palette` | 调色盘卫星 | 同上 | `rect`；橙色 20×16 占位矩形 | 1/2/3 级 2/3/4 个；轨道半径 80，等级 3 加快旋转；接触伤害半径仍为 12 |
| `summon_scythe` → `scythe` | 吸血镰刀 | 同上 | `rect`；暗红色 30×10 占位矩形 | 始终 1 把；轨道半径 80，2 级起 120；接触伤害半径 20；保留吸血和 3 级附加效果 |
| `summon_drone` → `drone` | 无人机（橡皮擦猎手） | 同上 | `triangle`；半径 15 青色三角形 | 1 级 1 架，2/3 级 2 架；只对橡皮擦敌人开火；3 级增强弹体伤害与制导 |
| `synergy_legion` | 双生·军团降临：微型调色盘卫星 | `SummonSystem.updateSummons` 判定；`RenderSystem` 的召唤物附加效果分支绘制 | 每个火柴人旁有 2 个橙色 8×8 方块 | 只是火柴人的附加绘制，不另建召唤实体；视觉轨道半径 25；原伤害检测位于火柴人中心附近 |
| `PlayerStats.hasDigitalPassive` | 数位笔浮游炮 | `PlayerFactory` 激活；`WeaponSystem.updateDigitalPassive` | `RenderSystem` 的数位笔 overlay；青色小三角 | 不是 `Summon` 实体；围绕玩家、复制最近一次攻击配置 |
| `awakening_digital_1` | 宏指令覆盖：双数位笔 | 同上 | 同一浮游炮分支增加对面的第二支 | 数量 2 支；保留实际轮流射击位置与既有冷却规则 |
| `awakening_digital_2` + `PlayerStats.digitalTurrets` | Ctrl+V 阵列：固定炮台 | `WeaponSystem.updateDigitalPassive` | 同一 overlay；圆形底座、矩形炮管、寿命弧线 | 替代跟随浮游炮；在触发位置落地，寿命 300 帧；朝最近目标开火，保留倒计时语义 |

### 四种“飞机”不能混为一类

1. 数字板绘师的数位笔浮游炮：贴近玩家的专属文具伴随物。
2. 通用无人机：橡皮擦猎手，远近与跟随方式由 `SummonSystem` 管理。
3. 敌方纸飞机：`EnemyBehavior.type='paper_plane'`，属于敌人图集，不是友方技能。
4. 神笔轰炸机：临时驾驶载具，替代玩家形象，不是小跟宠。

友方文具应有区别于敌人粉红/危险色的稳定识别色，但不改变原本用于伤害或画迹的颜色字段。

## 二、玩家身边的护盾、气场与提示

| 现有 ID / 状态 | 名称 | 逻辑入口 | 盘点时可见表现 | 接入约束 |
| --- | --- | --- | --- | --- |
| `Skill.eraserShieldFrames`；工具 `eraser` | 橡皮盾 | `SkillSystem` | 玩家外半径 60 蓝圈；逻辑每帧擦除对应区域的画迹 | 外观不能缩小或扩大实际半径；不能误称为折纸盾 |
| `hasClassicalShield` / `classicalShieldStacks` | 厚涂护盾 | `PlayerFactory`、`SkillSystem`、`CollisionSystem.applyDamageToPlayer` | 金色圆环 | 仅古典油画家；层数可辨；普通 1 层、多层觉醒最多 3 层 |
| `awakening_classical_1` | 不朽名作 | 同上 | 复用多层厚涂盾 | 不能将金圈层数与剩余实际层数脱节 |
| `defense_shield` / `hasOrigamiShield` | 折纸盾牌 | `SkillSystem` 与 `CollisionSystem` | 旋转白虚线六边形 | 独立于厚涂盾；只在确有盾时显示；保留破盾事件和等级 3 纸屑 |
| `hasCalligrapherPassive` / `calligrapherDamageStacks` | 入木三分气场 | `PlayerStats` 与相关移动/攻击逻辑 | 红色圆圈和 `+N%` 文字 | 圈强度依层数；不新增常驻伤害范围；文字仍反映真实增伤 |
| `defense_desperate_explosion` / `explosionCooldownFrames` | 绝境爆炸触发提示 | `CollisionSystem.applyDamageToPlayer` | 冷却刚开始的 60 帧红色脉冲环 | 这是触发后的反馈，不是延迟爆炸预警；不能画成尚未触发的倒数危险圈 |

以上当前主要位于 `RenderSystem` 的玩家 `circle` 绘制后。遗留 `SpriteAnimation` 分支也有厚涂盾、折纸盾、绝境爆炸圈的重复代码；当前 `PlayerFactory` 使用 `circle + PlayerArtwork`，未创建 `SpriteAnimation`。修改主分支时须保留遗留回退的合理性，避免误判它是当前入口。

### 可读状态，但没有现成独立模型的提示

- `killReaperReady`：死神收割就绪；当前以公告和下一次攻击结算为主。
- `killFrenzyStacks`：墨滴狂热；实际为有过期时间的移速/射速层数。
- `skateboardFrames` / `skateboardDamageBonus`：颜料滑板蓄能和开火转换。
- `staticFrames` / `staticDamageBonus`：静止蓄能；玩家移动后重置。
- `Weapon.inspirationLevel`：灵感爆发的下一发强化状态。
- `dummySpeedBuffFrames`：替身触发后的暂时加速状态。

若增加提示，只能读取真实状态并做轻量视觉反馈；不应为了美术新增计时器去决定伤害或改变已有状态持续时间。

## 三、替身、陷阱、地面与受击效果

| 现有标识 | 名称 | 实际入口 | 当前表现 / 注意事项 |
| --- | --- | --- | --- |
| `defense_dummy` / tag `ink_dummy` | 墨水替身 | `CollisionSystem.applyDamageToPlayer` 创建，`EnemySystem` 更新 | 半径 20 灰圆；带 `EnemyBehavior('ink_dummy')`，**不带 `enemy` tag**；不可按敌方图集条件遗漏它 |
| `gadget_paperclip` / `Paperclip` / tag `paperclip` | 磁力曲别针 | `SkillSystem.update` 创建 | 8×16 灰矩形；保留掉落位置、配对和一次触发后消失的规则 |
| `Paperclip.connectedToId` | 曲别针高压电线 | `CollisionSystem` 的配对与线段碰撞处理 | 青色虚线，直接写入 `trailCtx`；非 `Renderable` 线实体 |
| `WaterMark` | 水彩水痕、闭合图形颜料沼泽 | `DeathHandler`、`CollisionSystem` 等 | 基础为半透明圆；有 `erasedParts` 擦除缺口，不能让美术补回已经失效的区域 |
| `InkCloud` | 墨染 / 深渊墨池 | `CollisionSystem.handlePlayerHit` | 黑色半透明圆形致盲区域；普通半径 300、觉醒扩大；外形装饰不可声称有额外判定 |
| `Puddle` | 颜料倾倒、圆规冲刺留圈等 | `WeaponSystem.startReload` 与 `CollisionSystem` | 半透明圆、按寿命变淡；部分敌方技能也复用 `Puddle`，要保持敌友识别 |
| `defense_hedgehog` | 刺猬装甲铅笔芯 | `CollisionSystem.handlePlayerHit` | 8/16/24 枚灰色圆弹；应表达尖芯，不可变成常驻护盾 |
| `defense_shield` 等级 3 | 折纸盾破碎纸屑 | `CollisionSystem.applyDamageToPlayer` | 8 枚灰色矩形弹体；复用标准弹体行为 |
| `awakening_classical_2` | 荆棘画框破盾冲击波 | 同上 | `Renderable.shape='shockwave'`、`Projectile.type='shockwave_fx'`；扩张半径读取 `maxRadius` |
| `defense_desperate_explosion` | 绝境爆炸命中区 | 同上 | 短命红色半透明圆实体和爆炸粒子；与玩家身边的触发提示环是两层不同表现 |
| `move_mirror` | 镜像位移 | `SkillSystem.triggerMoveMirror` | 直接往 `trailCtx` 画起点圆、紫色粗带、白色核心线，起止点爆粒 |
| `reload_thumbtack` | 图钉禁锢 | `WeaponSystem.startReload` | 写敌人的 `frozenFrames`，复用冻结状态；没有独立图钉实体 |

### 敌人身上的技能状态

- `EnemyBehavior.frozenFrames`：当前蓝色半透明冻结罩。
- `burnFrames`：当前橙色旋转虚线圈。
- `corrosiveStacks`：当前头顶绿色圆点，数量反映层数。
- `blindFrames`：当前头顶 `???`。
- `confusedFrames`：致幻水彩可以持续施加；盘点时没有对应独立混乱装饰分支。
- `Stunned`：工具“定点钉住”的实际状态组件；盘点时没有独立图钉图形。

状态符号可统一为涂鸦语汇，但不能去掉冰冻/燃烧/腐蚀之间的可辨性，也不能让轮廓覆盖角色本体。

## 四、神笔载具与专属弹体

| 实际类型 / 标识 | 名称 | 创建 / 更新入口 | 渲染入口 | 行为边界 |
| --- | --- | --- | --- | --- |
| `MagicManifestation.type='tank'` | 坦克 | `MagicPenSystem.createManifestation/updateTank` | `magic_tank` | 默认宽 58、高 38、radius 24；跟随玩家位置，炮口朝目标 |
| `type='robot'` | 机器人 | `createManifestation/updateRobot` | `magic_robot` | 默认宽 44、高 56、radius 26；近距能量拳弹体，保留玩家移动 |
| `type='bomber'` | 轰炸机 | `createManifestation/updateBomber` | `magic_bomber` | 默认宽 70、高 42、radius 30；玩家移动速度存在既有加成，不能被美术调整覆盖 |
| tag `magic-pen-projectile` | 神笔火箭 / 爆弹 | `MagicPenSystem.fireRocket` | 复用武器弹体绘制 | 坦克与轰炸机的发射弹，保留实际 `Projectile` 配置 |
| tags `magic-pen-projectile`、`magic-robot-pulse` | 机器人能量拳 | `MagicPenSystem.fireRobotPulse` | 复用标准弹体绘制 | 不要凭美术名称改成接触攻击 |

载具是临时驾驶形态，不是独立跟宠。`startPiloting()` 把玩家的 `Renderable.visible` 设为 `false`，载具逐帧复制玩家坐标；结束时恢复原可见状态。现有玩家移动/碰撞保持权威，不能给新图形再添加一套玩家碰撞。神笔绘画板的参考路径与评分属于功能/UI，本轮不因换皮擅自调整。

## 五、工具轮现有五种技能

`Skill.activeTool` 的可选值以及 `SkillSystem` 内实际逻辑如下；不是历史文档中全部想法都已进入代码。

| ID | 名称 | 当前表现 | 边界 |
| --- | --- | --- | --- |
| `curve` | 画圆 | 绘制玩家到鼠标距离为半径的圆形轨迹 | 写入 `trailCtx` 并瞬时命中圆环；不能只换成无判定关系的漂亮法阵 |
| `pin` | 定点钉住 | 周围敌人获得 `Stunned` | 可增加状态标记，但不增加额外攻击实体 |
| `symmetry` | 对称镜像 | 持续绘制镜像轨迹，结束传送到镜像末点 | 轨迹具有玩法与绘画含义；不能用纯装饰层替代真实轨迹 |
| `eraser` | 橡皮盾 | 清除玩家周围画迹并绘制蓝圈 | 见护盾表 |
| `explosion` | 爆炸 | 爆粒与溅墨、范围伤害 | 保留原画迹和命中规则 |

实际通过工具轮选择、`F` 触发；各工具有等级解锁和共享冷却。Space 爆炸入口已移除，不应复活旧操作。

## 六、复用效果与纯属性类：不一技能一模型

### 复用弹体、爆粒或状态效果

- 冰霜颜料 `element_ice`、腐蚀墨水 `element_corrosive`、焦油燃烧 `element_fire`：使用已有命中状态。
- 静电导电 `element_electric`：命中传导；不创建围身卫星。
- 素描分身 `hit_sketch_clone`：额外分裂弹，不创建人物分身。
- 色彩爆炸 `hit_explosion`、颜料绽放 `kill_bloom`、双生·冰火两重天 `synergy_ice_fire`：复用命中/击杀爆炸表达。
- 残影连击 `awakening_sketcher_1`：额外免费子弹，不是助手实体。
- 墨影杀阵 `awakening_ink_2`：致盲目标增伤及墨团消失时爆炸，不是环绕笔阵。
- 水性蔓延 / 致幻水彩：复用 `WaterMark` 与混乱状态。
- 绝对领域 / 高压喷罐：涂鸦闭合图形、沼泽、爆发波纹的强化。
- 武器精通的 12 项效果：弹丸分裂、散布、剑气、链条、射线、波浪弹道、黑洞、集束炸弹、狙击连发、火焰、圆规回旋、地雷；与武器弹体层共用视觉规范，不要再复制一套围身技能模型。

### 数值或条件为主，不要求独立模型

- 基础属性：`base_speed`、`base_firerate`、`base_dodge`、`base_health`、`base_damage`、`base_reload`、`base_trail`、`base_pierce`、`base_crit_chance`、`base_crit_damage`。
- 体型：`body_enlarge`、`body_reduce`；现有体型/碰撞变化是技能逻辑，不能用视觉大小反向覆盖。
- 攻击增益：灵感爆发 `reload_inspiration`、致命穿透 `crit_pierce`、吸血鬼之触 `crit_vampire`、收笔一击 `hit_last_strike`。
- 击杀增益：墨滴狂热 `kill_frenzy`、经验磁铁 `kill_magnet`、死神收割 `kill_reaper`。
- 走位增益：颜料滑板 `move_skateboard`、静止蓄能 `move_static_charge`、跑酷大师 `move_parkour`、动如脱兔 `move_rabbit`。
- 暴击溢出 `synergy_crit_overflow` 以及重金悬赏、行云流水、极限截稿等角色数值强化。

这些可以按需要配克制的就绪、充能、治疗或速度提示；不以“每个名字都画一个常驻环”为目标。

## 七、休眠、历史与不可误认内容

- `Skill.rulerArmed`、`Skill.active` 是遗留字段，不能据它们认定有新的已启用技能。
- `curveStage` 等旧曲线阶段字段仍存在，但当前画圆流程不是多段摆点曲线绘制。
- 当前 `PlayerFactory` 未挂载 `SpriteAnimation`；`RenderSystem` 的对应支持不等于当前玩家使用该路径。
- 旧设计文档中的“黏土护卫巨兽”等未出现在当前四类 `SummonType` 和召唤工厂里，不属于本轮现成功能换皮。
- 代码未找到独立“笔阵”召唤物；数位笔、卫星和气场应按真实类型分别列出。
- 盘点中标签或注释不是最终事实：例如 `laser_guided` 虽被注释为视觉标签，`MovementSystem` 实际会处理其制导行为。

## 八、实施约束与验收计划

### 坐标、朝向与动画

1. 数位笔发射位置与显示位置必须一致。当前 `WeaponSystem` 和 `RenderSystem` 均用 `Date.now()/300` 和 `renderable.radius + 20` 计算轨道；不能只替换一侧的时钟或半径。
2. `SummonSystem` 对火柴人和无人机都会写入运动方向 `atan2(vy,vx)+π/2`。火柴人图形宜保持直立、按方向左右翻转；若无人机资源尖端朝右，要正确适配旧三角尖朝上的局部坐标。
3. 调色盘与镰刀的自转、轨道由 `SummonSystem` 决定，不能在渲染器再次推进玩法角度。
4. 绘制只读游戏组件；不要通过随机美术效果消耗玩法随机数，也不要在渲染期间改变生命、伤害、冷却或等级。
5. 小尺寸优先清晰轮廓。火柴人腿可有轻量步态，但不恢复玩家已明确不喜欢的整个人物左右摇摆。

### 图层与画板

1. 地面范围效果应在角色下方；友方伴随物应清晰但不盖住主角与危险提示。
2. `WaterMark.erasedParts` 必须在新绘制中维持真实缺口；已擦除区不应重新呈现为有效区域。
3. 曲别针电线、镜像颜色带和工具轨迹直接写 `trailCtx`。更换视觉时需明确哪些是画作内容，不能误改绘画记录、评分或导出。
4. 不用纯装饰的外延轮廓暗示额外命中范围；若有淡色装饰，主判定边缘仍应清楚。
5. 不用图形占位替换 UI 文案、快捷键或技能等级提示。

### 完整验收目标（本轮覆盖情况见下一节）

- 构建与现有人物、武器、地图、HUD 回归。
- 每种召唤物至少检查初级与最高等级，确认数量、方向、透明度和遮挡。
- 数位笔单支、双支、固定炮台分别检查，确认实际弹丸起点。
- 单盾、多层盾、折纸盾、橡皮盾与气场可同时存在且能区分。
- 墨水替身、曲别针连接与消失、水痕擦除缺口的视觉正确。
- 三种神笔载具进入/退出后角色可见性恢复，移动与碰撞不变。
- 停止/暂停/继续不会累积绘制状态；Canvas `save/restore` 成对，图片失败有可用回退。
- 实际对局和独立审阅页完成视觉检查，再补充本文件的完成项与验证结果。

## 九、本轮交付 · 2026-10-09

### 已应用到正式渲染

- 新增 `src/assets/doodle/skills-v1.png`：1536×1024 RGBA 图集，12 帧为数位笔、火柴人上身、调色盘、镰刀、双旋翼无人机、炮台、曲别针、墨水替身、坦克、机器人、轰炸机、折纸碎片。
- `src/art/DoodleSkillArt.ts` 记录实测边界、按比例裁切。坦克/机器人接壤处不加跨格留白，避免邻格黑线串入。资源未加载/失败时走原有几何回退。
- 数位笔基础 1 支、宏指令 2 支、Ctrl+V 固定炮台复用实际状态；轨道仍用 `Date.now()/300` 与 `radius+20`，朝向查找逻辑对应原攻击目标，炮台保留 300 帧寿命弧。未改变发射逻辑。**数位笔既有时钟规则仍是墙上时间，不宣称这条轨道已改成模拟时钟。**
- 火柴人绘制独立双腿，步相来自实际位移；身体直立、左右翻转、轻微上下浮动。无人机有轻量悬浮和转子线条；卫星/镰刀读取真实轨道和自转；军团微型调色盘只改变绘制，不新增碰撞实体。
- 替身和曲别针替换原灰色占位。三种神笔载具共享图集；后续反馈修订为统一直立、只左右翻转与 1.4 倍显示，详见文首；原玩家隐藏/恢复流程不改。
- `DoodleSkillEffects.ts` 统一厚涂多层盾、折纸盾、橡皮盾、书法家气场与绝境爆炸触发反馈。橡皮盾仍明确标出半径 60；其他环读取旧半径公式。使用克制线条、无大面积不透明填充，继承受伤闪烁 alpha。
- 冻结、燃烧、腐蚀和致盲状态使用折线冰壳、小火苗、滴状层数点和 `???`，覆盖圆形/矩形/三角形敌人；混乱、钉住仅显示实际组件存在时的轻量符号。
- 火柴人/无人机及神笔专属弹体根据现有来源 tag 绘制小铅笔芯/墨色菱形；不影响普通武器弹道或涂色。
- `CollisionSystem` 只增加三个只读 `SkillVisual` 元数据：折纸碎片、刺猬铅笔芯、绝境爆炸区域。碰撞、伤害、数量、寿命与速度均未改；爆炸区域从大片实色减为淡填充和边缘。荆棘画框冲击波保留原扩张半径，去掉强霓虹光晕。

### 不在本轮改写的画作内容

`WaterMark.erasedParts`、墨池/颜料池、曲别针电线、镜像位移色带、工具轮绘画轨迹仍沿用原画布流程。它们已有绘画/擦除/存档语义，不将其随意变成另一种永久装饰；本轮没有修改 `trailCtx`、`StrokeLog`、修复 mask 或作品导出。纯数值增益和并不存在的角色分身/笔阵不添加模型。全武器投射物、死亡消散及拾取物尚不是“全套重绘完成”。

### 验证与审阅

- `npm run build` 通过。
- `node scripts/test-doodle-skills.mjs` 通过：12 帧与 alpha 继承、原工厂 1/2/3 级召唤数量/军团附属、数位笔精确轨道、单/双/固定分支、炮台剩余时间圈、火柴人直立、盾层数/状态/碎片、组件不被渲染修改、暂停与失败回退、Canvas 平衡。
- 原有 5 组 `test-player-artwork`、`test-doodle-motion`、`test-scene-layout`、`test-courtyard`、`test-combat-hud` 全部通过。冻结测试从旧圆圈改为新折线冰壳颜色与火苗轨道断言，并扩展到所有敌人形状。
- 人物与技能两份独立审阅脚本的 TypeScript 检查通过。
- 浏览器审阅 `art-drafts/skill-review.html`：使用正式 `RenderSystem`、`SummonSystem`，验证军团、双笔、炮台、多盾、三种载具、移动/停步、暂停及两种场景；控制台无 error/warn。该页不写存档，不是完整战斗模拟。
- 正式游戏用已有免费收藏家正常进入创造模式，HUD/人物/敌人运行正常并暂停；控制台无 error/warn。数字板绘师等在该浏览器存档仍未解锁，未修改存档或金币绕过；高阶技能由真实组件/工厂渲染测试与审阅页覆盖，**未声称完成所有技能的长局实战触发**。
- 未进行 20 分钟密集战斗、全部升级组合、全套技能触发/消失端到端或打包设备性能验收。

图集原件、内置 imagegen 完整提示词与截图保存在 `art-drafts/production-candidates/doodle-skills-v1/`。此批为单姿态图集＋程序关节/覆盖层动画，并非多帧手绘动画表。
