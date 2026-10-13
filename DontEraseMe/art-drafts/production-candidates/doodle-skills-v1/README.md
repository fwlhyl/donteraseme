# 涂鸦技能资源 V1

制作方式：内置 imagegen，透明背景；运行时使用原始 PNG 的裁切帧，不重采样修改源图。UI、玩法数值和画作记录不变。

## 完整生成提示词

```text
Use case: stylized-concept.
Asset type: ONE production sprite atlas for a top-down 2D doodle game, 4 columns by 3 rows, landscape 1536 by 1024, transparent background.
Primary request: Exactly 12 isolated friendly skill-object sprites in evenly spaced cells. All sprites must have rough confident thick near-black MS Paint outlines, intentionally naive charming school-notebook doodle shapes, 2-4 large flat opaque color blocks per object. At tiny 24-64px runtime size silhouettes must remain distinct. Not watercolor, not realistic, no gradients, no lighting glow, no shadow, no lettering, no card backgrounds or grid lines. Leave generous transparent gutters between cells, all complete silhouettes within their cells.
Row 1 left to right:
1. A flying DIGITAL STYLUS, cyan-and-cream pointed pen with two small wing fins, pen tip points RIGHT. Clearly a flying pen, no rotors.
2. A very simple STICKMAN ASSISTANT upper body: large cream round smiling head, crooked black dot eyes, black straight line torso, two black line arms with right arm holding a tiny orange pencil. Small orange neck scarf. NO LEGS OR FEET because separately animated code legs attach to bottom of torso. No hat, no full clothing.
3. A mustard/cream painter PALETTE, kidney shaped silhouette with thumb hole and only three big blue/red/green paint dots.
4. A small VAMPIRE SCYTHE: crooked dark burgundy handle and large cream crescent blade with one coral red accent, full object, diagonal hook-shaped silhouette.
Row 2 left to right:
5. An ERASER HUNTER DRONE, cream rectangular eraser body with coral top and two cyan rotor pods, simple black dot eyes, side/three-quarter view facing RIGHT. Must be distinct from the winged pen.
6. A CYAN PEN TURRET on a tiny cream stationary tripod/base with a short cyan digital-pen barrel aimed RIGHT, one orange control button, no letters.
7. One big SILVER PAPERCLIP with a dark thick double-line bent wire outline and a small cyan electrical accent. Tilted slightly right, transparent hole.
8. An INK DECOY: charcoal-black puddly humanoid/blob shape, white two dot eyes, one white crooked mouth, drippy bottom edge, minimal dark-grey patch so visible on a dark floor.
Row 3 left to right:
9. A GREEN DOODLE TANK piloted vehicle, side/top three-quarter view, squat mint green body, two black outlined cream track strips, orange cockpit dot, long pen-shaped cannon pointing RIGHT.
10. A BLUE DOODLE ROBOT piloted vehicle, front three-quarter, upright bulky simple square head/body, two short rectangular legs and big mitt fists, cream face, one orange cockpit window, few flat blue blocks.
11. A PINK PAPER BOMBER piloted vehicle, broad folded-paper wings, cream fuselage, pink/red big tail patches, orange cockpit dot, nose pointing RIGHT seen from above.
12. A single irregular CREAM FOLDED PAPER SHARD, black rough angular outline, pale-blue triangular folded corner. Simple 4-corner torn paper shield fragment, no symbols.
Scene/backdrop: genuine transparent alpha outside each object's silhouette, including paperclip hole. Each sprite independent, no environmental scenery, no contact shadows. Art consistency: playful rough black ink, solid fills, no glowing halos, no decorative scattered dots, no UI, no text.
```

## 文件与状态 · 2026-10-09

- `skills-v1.png`：生成原件副本，1536×1024 RGBA，真实 alpha；四角 alpha=0，程序裁切保留原像素，不做黑底抠图。内置工具的合成预览色晕不代表运行图集有背景。
- 正式运行副本：`../../../src/assets/doodle/skills-v1.png`（相对本目录应上溯三层至项目根）。
- 源生成文件：`/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/exec-c00c363e-9b30-4f02-8d74-91ecd0915d14.png`，保留原件；未使用 CLI 或外部 API 回退。
- `skill-review.jpg`：使用正式渲染器的军团组合＋放大资源＋护盾/气场完整审阅截图。
- 独立审阅：`art-drafts/skill-review.html`；实际技能清单与全部验证边界：`docs/DoodleSkillArt.md`。
- 构建、6 组渲染/边界/HUD 回归、审阅页类型检查通过。浏览器检查组合/两种场景/暂停与正常免费角色开局，控制台无 error/warn；高阶技能未通过修改存档来解锁，没有完成长局全技能战斗验收。

切片由 `src/art/DoodleSkillArt.ts` 使用实测边界；坦克和机器人的紧邻格不跨格留白。透明对象均已接入原渲染入口，机制、UI 与绘画日志未改变。火柴人下肢为代码动画，资源并非多帧动作表。

## 载具反馈修订

2026-10-09：坦克、机器人、轰炸机统一取消整图旋转，改为带垂直死区的左右翻转；运行显示放大 40%，原图和玩法尺寸不动。`vehicle-flip-v2.jpg` 为更新后正式渲染器的朝左审阅截图；原 `skill-review.jpg` 保留为首批尺寸的历史记录。
