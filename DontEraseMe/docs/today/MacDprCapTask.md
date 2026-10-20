# Mac 卡顿优化任务书：游戏画布 DPR 封顶（2026-10-16 定稿）

> 状态：2026-10-20 根据用户实测反馈，将游戏画布 DPR 上限从 1.5 调为 1 进行 A/B；当前只做优化，Electron 打包暂缓。此前结果与本轮记录见末尾。执行人：Codex；验收人：用户。
> 背景数据：仓库根目录 `prof-mac-report.txt`（2026-10-15 Mac 五场景实测）。

## 一、背景结论（已用数据锁定，勿重复排查）

1. **JS 逻辑健康**：300 敌人最重场景全部系统合计 2.85ms/帧、loop 真实执行 3.17ms——代码层无热点可优化。
2. **瓶颈在浏览器渲染管线（栅格+合成）**：帧均 29.75ms 中 26.89ms 是渲染管线开销；0 敌人场景渲染管线底价也达 15.91ms（贴着 60fps 的边）。
3. **两个回归嫌疑已排除**：关闭每帧 clip（31fps）、关闭全画布消隐（32fps）均无改善（基线 34fps）。
4. **关键事实**：测试窗口是 Playwright 默认 1280×720@dpr1；真实 Mac 游玩约 2700×1800@dpr2 → gameCanvas 像素差约 **21 倍**。测试是"最乐观情形"，真实游玩只会更差——这解释了"开局就卡"。
5. 跨平台对照：同脚本同窗口 Windows（Iris Xe 弱核显）满 60fps——同负载 Mac 更贵（Mac 侧渲染回退嫌疑，二阶段再查），但第一步先消除确定性的 21 倍像素税。

## 二、改动内容（最小范围：只动一个文件）

文件：`src/core/Game.ts` 的 `resize()`（约 523-556 行）。

原理：gameCanvas 目前按 `window.devicePixelRatio` 开物理画布（Mac=2 → 像素 ×4）。把倍率封顶，渲染管线负担降为 1/2.25（1.5）~1/4（1）。ctx 已按 dpr 做过 scale 变换，全部绘制代码用 CSS 像素坐标——**封顶后绘制代码零改动**。

```ts
// 文件顶部或 resize 附近定义（便于 A/B 一键切换）
const MAX_GAME_DPR = 1; // 2026-10-20：1.5 已明显改善但仍卡，现按预留方案试 1

public resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_GAME_DPR); // ← 唯一语义改动

    this.gameCanvas.width = this.width * dpr;
    this.gameCanvas.height = this.height * dpr;
    this.gameCanvas.style.width = `${this.width}px`;
    this.gameCanvas.style.height = `${this.height}px`;
    this.gameCtx.scale(dpr, dpr); // 保持 CSS 像素坐标，绘制代码无需改动

    // …… trailCanvas 部分完全不动（见第三节）

    // 小地图同封顶（150×2 开销可忽略，为一致建议同改）
    this.minimapCanvas.width = 150 * dpr;
    this.minimapCanvas.height = 150 * dpr;
    this.minimapCtx.scale(dpr, dpr);
}
```

注意：
- `MinimapSystem.ts:36-38` 有自己的 dpr 读取；小地图开销可忽略，可不动，验收时决定。
- 3D 画廊（ArtGallery / CourtyardScene）已自带 dpr 1.5 封顶，不动。

## 三、为什么不伤画作清晰度

画作导出/画廊走**作品层**（trailCanvas + paintingCanvas，世界分辨率 3000×2000 / 1800×1200），与**屏幕呈现层**（gameCanvas）是两张独立画布。本次封顶只降"屏幕上的锐度"，不降"作品的清晰度"——trailCanvas 保持世界尺寸 1x，一行都不要动。涂鸦风（粗线条+大色块）对呈现层 1.5/1 倍率的主观损失很小，这正是选此方案的原因。

## 四、验收清单

1. **现有测试全绿**：跑仓库现有全部测试（含 `scripts/test-drawing-boundary.mjs` 的 DPR 1/2 用例）。若某用例断言 gameCanvas 物理尺寸 = dpr×窗口，按封顶语义更新期望（属预期变化）。
2. **真实游玩 20-30 分钟**（Mac，测试前关掉其他程序）：创造模式开局（此前"开局就卡"的复现点）+ 后期敌潮 + 守卫模式；重点感受帧率是否稳定。
3. **画面验收**：对比封顶前后截图，确认涂鸦风呈现无肉眼可辨劣化；**特别检查 HUD/UI 文字可读性**（UI 是 Canvas 绘制，小字锐度随 dpr 下降——这是唯一主观风险点，交给用户拍板）。
4. **画作验收**：结算导出 PNG + 画廊展示清晰度与改动前一致。
5. **A/B**：`MAX_GAME_DPR` 改 1 再玩一轮，由用户拍板最终值。
6. **Electron 打包验收（暂缓）**：用户明确要求先只做优化；安装包验收留待后续，不属于当前工作范围。

## 五、明确不要做

- 不要动 trailCanvas / paintingCanvas 分辨率与导出链路。
- 不要改消隐、每帧 clip（数据已证明不是瓶颈）。
- 不要做"根据 fps 动态调 dpr"的自适应（过度设计；静态封顶先验证）。
- 不要顺手改渲染管线结构或 UI 重写（那是发布后的事）。
- 不要改世界尺寸、边界裁剪逻辑。

## 六、如果 1.5 仍不够（二阶段，等验收数据回来再定）

按顺序收集：①`chrome://gpu` 里 Canvas 是否为 Hardware accelerated ②macOS"低电量模式"是否开启 ③`prof-mac-report.sh` 加真实尺寸场景（viewport 2700×1800 + deviceScaleFactor=2）。把结果发回再定第二步，勿自行扩大优化范围。


## 七、执行记录（2026-10-19）

- 生产代码仅修改 `src/core/Game.ts`：新增 `MAX_GAME_DPR = 1.5`，`resize()` 使用 `Math.min(window.devicePixelRatio || 1, MAX_GAME_DPR)`。保留 CSS 坐标变换、作品层尺寸、导出、消隐、clip、世界尺寸和边界逻辑。未覆盖工作区已有改动。
- DPR 2 的游戏显示画布像素降至原来的 56.25%（减少 43.75%）。2700×1800 窗口的 gameCanvas 从 5400×3600 降至 4050×2700；此为像素量变化，不等同于实测帧率提升。
- 现有 `test-drawing-boundary.mjs` 改用实际 context transform 将物理像素换算到 CSS 坐标，同时检查封顶倍率与物理尺寸。DPR 1/2 的四边越界、旋转画笔、回放和导出检查通过。
- `npm run build` 通过（仍有现有的大于 500 kB 分包提示）。现有 33 个测试脚本已全部执行：16 个非浏览器测试通过；17 个浏览器测试中 16 个通过。`test-paper-ui.mjs` 在原 5174 开发服务出现资源加载失败，切换新 5176 服务后通过。
- 唯一未通过的是 `test-paper-drawing.mjs` 的 `shared canvas ownership invalidates a same-camera cached desk` 断言。在隔离浏览器中分别使用当前封顶与恢复原始 DPR 的版本，均重现相同失败；未修改该断言或扩大本次优化范围。不能将当前回归结果记为“全部绿”。
- 补充矩阵：DPR 1 / 1.25 / 1.5 / 2 / 3 × 创造 / 守卫 / 纯画画，15/15 通过，共 180 次 `resize()`；包含 2700×1800@2 和奇数宽高窗口。无缩放累积，trail / painting / 导出画布的完整像素及尺寸、录制事件数均不变。当前实际创造作品为 2700×1800，守卫及纯画画为 1800×1200。
- 已生成同一冻结画面的 DPR 2 / 1.5 / 1 对照与 HUD 截图（隔离浏览器临时倍率，代码默认值仍为 1.5），背景与作品数据保持一致。审阅页：`/tmp/dont-erase-me-dpr-review/index.html`；截图与检查数据同目录。该对照不代替用户视觉验收或实时 A/B 长局体验。
- 实现差异说明：当前 `MinimapSystem` 每帧按原生 DPR 设置小地图，`CourtyardScene` / `DrawingScene` 也使用独立的原生 DPR 画布；任务书关于这些背景画布已有封顶的描述与当前代码不一致。本次按最小范围保留，未宣称全部画布都已封顶。
- `npm run electron:build` 已尝试；Web 构建成功后因 `electron-builder: command not found` 退出（项目当前未提供此打包依赖），未生成安装包。
- 仍待验收：Mac 20–30 分钟真实游玩、后期敌潮及守卫体验、用户确认 HUD/画质与 DPR 1 的 A/B 取舍，以及补齐 Electron 打包环境后的安装包实测。本轮当时默认上限保留 1.5；后续已按第八节改为 1，不提前认定卡顿已完全解决。

本轮临时验证记录：`/tmp/dont-erase-me-dpr-unit-tests/summary.json`、`/tmp/dont-erase-me-dpr-browser-tests/results.json`、`/tmp/dont-erase-me-dpr-baseline/results.json`、`/tmp/dont-erase-me-dpr-resize-results.json`。


## 八、DPR 1 A/B（2026-10-20）

- 用户实测反馈：DPR 1.5 后比之前明显改善，但仍有轻微卡顿；按原方案的下一步将 `MAX_GAME_DPR` 从 1.5 改为 1。静态封顶方式不变，不增加自动调节或分层缓存，不执行 Electron 打包。
- 同步现有绘画边界测试的 DPR 上限期望，仍根据实际绘制变换检查边界；其他独立画布的 DPR 及其测试不改。
- 在原生 DPR 至少为 1.5 的相同窗口下，gameCanvas 像素量相较上轮再减少约 55.56%；2700×1800 窗口的显示画布由 4050×2700 降至 2700×1800。对原生 DPR 2 的最初版本则减少 75%。这些比例仅指游戏显示画布像素量，不是帧率提升保证。
- 作品层、导出、世界尺寸、边界、消隐、clip 均不改；独立背景和小地图仍维持自身 DPR，3D 画廊维持自身 1.5 上限，不是全局所有画布都降为 1。
- 本轮验证：网页构建、DPR 1/2 绘画边界及导出、创造/守卫回放通过；5 种原生 DPR × 3 模式共 15 组验证、180 次窗口缩放通过，作品层与导出完整像素及尺寸、录制事件数均保持一致。报告：`/tmp/dont-erase-me-dpr1-tests/results.json`、`/tmp/dont-erase-me-dpr1-resize-results.json`。
- 接下来由用户在同一 Mac / 浏览器 / 窗口下比较开局、敌潮和守卫模式的流畅度及人物、弹体等显示锐度。如果仍卡，再在实际游玩的 Chrome 中打开 `chrome://gpu`，查看 Canvas、WebGL、WebGL2 与合成相关加速状态；本次未修改 Chrome 加速设置，也不将隔离无头浏览器的 GPU 状态当作实际游玩环境的结论。
- DPR 1 仍卡本身不能证明环境因素主导，需结合实际 GPU 加速信息与实测再决定下一步。特别是独立背景画布仍按原生 DPR 绘制，不能据此认定全部像素负担都已排除。
