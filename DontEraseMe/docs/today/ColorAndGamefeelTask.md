# ColorAndGamefeelTask — 颜色系统 + 打击感专项（2026-10-27 合并定稿）

> 本文档 = `docs/today/` 唯一现行文档（其余已删：ArtBatchTask / ArtDirection / ArtStyleFinal / CharacterActionTask / MacDprCapTask / PerformanceProfiling——必要内容已折入本文）。
> 执行者：Codex（代码+参数）+ 用户（实机试打验收，唯一裁判）。
> 死线：10-31 内部 demo 前完成第一轮。

## 〇、背景（一次读完）

- 10-26 美术终定稿三要素（冻结）：场景=细线涂鸦 / 人物怪物=深色像素 / 武器子弹=多彩色。
- 10-27 模型生产方式已变：**人物像素模型=Codex 手搓（代码生成）**，图生视频转帧产线正式退役（用户实测：效果不错、比视频转帧流畅；剩余优化点=动作+造型）。
- 10-27 用户优先级声明：**打击感/爽感=最最主要优化点，决定游戏本身好不好玩**。

## 一、时间颜色系统（天空/地面分层）

已拍板：

1. 触发 = **局内 20 分钟渐变**（不是电脑本地时间）：白纸（开场）→ 橙黄（黄昏）→ 深蓝夜（最后几分钟）。渐变平滑插值，不跳变。
2. 三色一次做完；夜态 = **深蓝纸色替代纯黑**。
3. 天空/地面分层：
   - 天空层：渐变全量（情绪层）
   - **地面层：浅色，只反射少量光** → `地面色 = mix(纸白, 天空色, 0.08~0.15)`（低混合系数）
   - 地面层细线保持深色（对比度基石不动）；天空层细线随态换色（白昼黑线 / 黄昏棕线 / 夜里亮线）
4. 待拍板（默认建议做）：**天黑对齐最后一波**——入夜 = 总攻信号，颜色系统变成关卡节奏的一部分。
5. 可选顺手项：夜态天空涂鸦星星/月亮点缀（Codex 有余力就做）。

实现要点：

- 与现有 20 分钟计时（elapsed）挂钩，本质 = `bgPalette(t)` 一个函数驱动背景/场景/UI 色调。
- 夜态人物亮描边**纯代码做**：像素角色 8 方向偏移画亮色底，零新美术资产。
- 默认时间分段（待调参）：0-8 白 / 8-14 橙黄 / 14-20 深蓝夜。

## 二、手电筒（夜态）

- 朝向 = **武器朝向一致**（复用现有瞄准向量，零新输入；自动瞄准照最近敌人、手动瞄准跟鼠标，两种情况都对）。
- 默认值（待调参）：锥角 ~50° / 射程 ~500px / 玩家周身环境光 ~100px / 软边渐变。
- 实现：Canvas 2D 黑夜遮罩层 + `destination-out` 打光（与笔迹消隐同技术族）；光锥内笔迹/敌人/纸面显形——"手电筒照亮你的画" = 夜态验收标准。
- ⚠️ 性能观察点：遮罩层 = 新全屏合成层，须在 Mac dpr 封顶（MAX_GAME_DPR=1.5）配置下复测三场景 fps。
- 范围纪律：光只做"看见"；敌人趋光/潜行/省电条等衍生机制一律进发布后清单。

## 三、打击感/爽感专项（最最主要优化点）

### 现状（10-13 六味盘点）

屏幕震动 ✅ / 击退 ✅ / 受击动画 ✅ / 伤害飘字 ✅ / 命中音效 ✅ / **hit-stop ❌ 缺**（唯一现存 freeze=冰冻状态）。

### 任务 1（Codex，代码小改）：补 hit-stop 30-80ms

- 命中瞬间停顿；受击方与攻击方停顿时长可独立参数；勿与冰冻状态 freeze 冲突。

### 任务 2（用户，真玩调参）：逐味调参手册

- **顺序铁律：新人物动作到位后再调**（震动幅度/击退/hit-stop 时长与动作时长匹配；旧资产上调=调两遍）。
- 方法：每味一档一档试（如 hit-stop 30/50/80ms 各打一局），只有用户实机是裁判；只改数字不动机制。
- 12 武器 4 套动作骨架仍适用（hit 时长按变体分档调）：A 参数分档 7 把（Pistol/Shotgun/Chain/Ribbon/Sniper/Ruler/Rocket）/ B 近战挥舞（Scraper）/ C 持续喷射（Airbrush）/ D 抛掷放置（Compass/Vortex/Rocket/Mine）。

### 动作优化（10-27 用户报的剩余优化点：动作+造型）

- 姿态剧本遗产：走射占 90% 游玩时间、第一优先——鞋交替 / 躯干先转向 / 肩先手后 50ms 联动 / 后坐 / 过冲回弹；缓动禁线性。

### 爽感层（六味之外）

- 击杀密度 / 成长反馈 / **笔迹变化=构筑反馈**（颜色/粗细/特效随 build 变化 = 本作独家优势，同类给不了）。

## 四、风格锁速记（自 ArtStyleFinal 折入，勿丢）

- 场景 = 细线涂鸦 fine-line doodle；**人物怪物 = 深色像素**（32×32 基准，像素块小尺寸不糊）；武器子弹 = 多彩色。
- 场景风格锁英文提示词（用户原文，照用）：

> Act as the art director for an original game. Establish fine-line doodle illustration as the global visual language for the entire project. Apply this direction consistently to characters, environments, props, items, UI, icons, visual effects, animation, loading screens and promotional art. Keep the project's existing genre, mechanics, camera and target platform; when one is unspecified, state an assumption before proposing assets.
>
> Draw a dense but organized world from thin, slightly irregular contours and many small, individually readable scenes. Choose monochrome or a restrained light-fill palette, and use line shape and spacing as the primary means of differentiation. Keep realistic volume and directional shading minimal. Establish a consistent line-to-object scale across people, foliage, machinery, props and icons. Group details into navigable clusters with breathing room, and use simple line animations for feedback. UI should resemble the same hand-drawn map while reserving clean text areas. Avoid thick cartoon outlines, dense crosshatching and detail so small that targets become indistinguishable.
>
> Create a compact art bible with a locked palette, silhouette and proportion rules, material examples, lighting hierarchy, UI/icon rules, motion guidelines and a short list of visual mistakes to avoid. Define measurable asset specifications appropriate to the chosen platform and camera, then keep them consistent across every batch. Preserve gameplay readability, accessible text and clear interactive targets at the actual display size. Use original designs and compositions rather than copying a particular game's characters, logos or artwork. When asked for one asset, deliver that asset within this art direction; do not redesign the style for each request.

- ⚠️ 提示词里的 characters 字样被深色像素风覆盖——人物怪物不走细线。
- 三层颜色预算：场景 0-10% 饱和（让位）/ 人物 40-60%（深色+少量识别色）/ 武器特效 80-100%（唯一色彩焦点）。
- 动画规格：人物=奔跑×1 方向（另一方向代码镜像，资产只画一个方向；武器层不镜像、枪口永远朝敌人）+ 待机×1；死亡全员共用（粒子溶解+通用倒地帧，资产归零）；怪物除 BOSS 只有跑+死（攻击=贴脸碰撞+代码抖动，无攻击动画）；BOSS 4 个完整动画；武器单独制作、代码附着到人物锚点。
- 人物本体不拿武器（10-22 定案）。
- 验收三问（每批必过）：①深色像素在细线场景一眼可辨 ②细线在实机显示尺寸不乱不糊 ③子弹色与场景/人物两层对比不冲突（建议语义化：敌人弹=警告色系 / 自己弹=安全色系 / 地面特效=低饱和）。
- 批次（10-27 简化）：一人打样（动作+造型验收）→ 其余角色动作复刻；背景场景=细线涂鸦提示词出图、渐进替换。
- 作废勿再用：HD-2D 3D 场景线 / 视频转帧产线（含 40 帧实验与六步手册）/ 水彩·土豆涂鸦·阿瑞斯病毒·"无表情"UI 方向。

## 五、验收清单

1. 夜态下画一笔，隔 2 秒一眼认出画在哪（手电筒照画成立）。
2. 深色像素人物+亮描边在深蓝夜底上可辨（"一眼可辨"夜间版）。
3. 渐变全程无跳变；20 分钟时间轴对齐无漂移。
4. hit-stop 生效且不与冰冻 freeze 冲突；四档武器变体各自 hit 时长手感。
5. Mac dpr 封顶（MAX_GAME_DPR=1.5）配置下遮罩层不新增卡顿（三场景 fps 对比）。
6. 白/橙黄/深蓝三态下"验收三问"各过一遍。

## 六、勿做清单

- 不做电脑本地时间驱动颜色。
- 不做敌人趋光/潜行/省电条等衍生机制。
- 不为颜色系统改波次设计（颜色跟随波次，不反过来）。
- 不做夜态人物新美术资产（亮描边=代码 8 方向偏移）。
- 不在旧资产上调打击感（先等新动作）。
- 不把纯黑当夜态底色。

## 死线

- 10-31 内部 demo 前完成第一轮；打击感调参 = 真玩迭代，demo 试玩本身就是调参场。
