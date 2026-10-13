# 涂鸦第一批动态 / 守卫废墟 v2

日期：2026-10-08。此目录保存新守卫场景源图和验证图，不被游戏代码直接引用。

- ruins-v2.png：内置 ImageGen 编辑生成，参考已确认的 ../doodle-v1/ruins-v1.png。运行副本为 src/assets/doodle/ruins-v2.png。
- doodle-animation-review.jpg：动态审阅页截图，含全图、8 位角色和敌人样稿；不是实际守卫对局。
- doodle-gameplay.jpg：浏览器实际创造对局截图，包含原 UI、玩家、追击敌人、弹道和受伤反馈。

其余角色与敌人原图复用 ../doodle-v1/。本次动画为运行时剪纸式变换，不提供或声称新逐帧手绘动作表。实现和测试见 ../../../docs/DoodleArtImplementation.md。

## 生成记录

工具：内置 image_gen；输入：已确认的 ruins-v1.png；输出尺寸 1536×1024，不透明背景。原始生成输出：

/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/exec-edbf44a0-3c38-41ed-8cbd-201553ebd9d1.png

生成图原样复制，无后处理绘图。实际可走区另由 Canvas 地面层统一覆盖，保证与玩法边界一致。

## 完整提示词

Use case: precise-object-edit. Edit the attached approved naive MS Paint doodle ruined night courtyard game background. Keep its SAME simple flat fills, uneven black mouse-drawn contours, muted slate-blue night ground, pale ruined walls, yellow window rectangles, blue torn awnings and original 3:2 overhead view. User likes this exact style but the perimeter buildings look too straight and rectangular.
Make ONLY the outer architecture silhouette a little more irregular: broken walls of staggered heights, short diagonal wall sections, a few collapsed corners, crooked fences, off-center stairs, unequal clusters of rubble and dead trees. Let the perimeter ground boundary meander modestly with little bays and notches rather than forming four perfectly straight inner edges. Group debris in small irregular clusters, do not create a noisy continuous confetti border.
CRITICAL GAMEPLAY SAFE AREA: central rectangle from x=256 to1280 and y=171 to853 in a1536x1024 canvas MUST remain entirely free of buildings, debris, lamps, trees or props. Vary all architecture outward from this rectangle, in the outer margins only. Do not shrink this clear central rectangle. Match its dark blue-gray floor approximately #2c3747. No bright lamps in center. Do not draw a rectangular border line around the clear area.
No characters, enemies, text, UI, labels, new perspective, paper border, watercolor, shading gradients, realistic detail, bright daytime or extra colors. A slight asymmetry adjustment, not a completely different map.

## 来源与发布检查

背景、角色与敌人使用项目内已确认的 AI 生成候选，不引入第三方图库。用户提供参考仅作风格观察。保留生成记录不等于法律或平台审核结论，发布前仍需按项目规范检查商用来源与 Steam AI 内容披露。
