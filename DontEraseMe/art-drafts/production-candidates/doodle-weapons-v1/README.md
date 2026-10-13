# 独立武器与角色拆层 · 2026-10-08

用户确认沿用涂鸦风格，并要求不同武器外观、腿部交替运动及稳定身体。本目录为生产源稿与验证记录；运行副本均在 src/assets/doodle/，不直接引用草稿目录。

- heroes-body-v2.png：8 角色的无工具/无手臂/无腿身体图，1536×1024 RGBA。保留表情、帽子、背包、围巾等识别特征。运行时添加线条腿和手持工具。
- weapons-v1.png：12 种独立手持工具，1536×1024 RGBA。所有资源以水平向右为标准方向，裁剪和握点见 src/art/DoodleWeapons.ts。未修改 UI 图标。
- weapon-review.jpg：正式绘制函数生成的持握总览截图，不是战斗截图。
- weapon-gameplay.jpg：喷漆罐实际创造对局截图，保留原 HUD、弹道与机制。

## 工具与原始文件

使用内置 image_gen（非 CLI），transparent_background=true；源 PNG 原样复制，无后处理绘图。按透明边界测量切片，使用 drawImage 源矩形，不把图集按网格硬切。旧 heroes-v1.png 保留。

身体编辑参考：src/assets/doodle/heroes-v1.png。
身体原始输出：/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/exec-0ea4b41b-b08e-4fb4-a1bf-7277ce9e6cab.png
武器原始输出：/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/exec-bfd90f9e-c4fb-4562-98ad-545da92b32f0.png

## 完整身体编辑提示词

Use case: precise-object-edit.
Asset type: transparent 2D game CHARACTER BODY atlas, 8 sprites.
Input Image 1 is the exact approved character atlas to edit, NOT a general inspiration.
Change ONLY the detachable parts: remove ALL external held paintbrushes, pencil, pen, spray can and palette; remove ALL arms/hands and ALL legs/feet. Cleanly close each blob's body contour where these parts attached. Leave the SAME 8 original blob bodies, exact faces, colors, tongue-out smiles, shapes, hats, satchel, scarves, glasses and headband unchanged. No redesign. The yellow oil painter should keep its red beret but not the palette or brush.
Keep 4 columns by 2 rows, same character ordering and generous clear separation. Each character is an upright legless, armless BODY ONLY facing front/slightly right. Remove the short curved arm stroke on the torso too. Bottom of body is a clean closed black rounded contour. Do not add limb stubs.
Style: identical naive MS Paint mouse-drawn uneven black outline and simple flat fills. No realistic textures, watercolor, glow, gradients, shadows, lighting or new ornaments. Important: isolated bodies on REAL TRANSPARENT background with no glow/halo or background colors. No labels, grids, text, frames or extra items. Intended for 64px characters with separate programmatically articulated stick legs and separate weapon assets.

## 完整武器生成提示词

Use case: stylized-concept.
Asset type: one transparent 2D game atlas of exactly 12 SEPARATE handheld art-tool weapon sprites in a 4-column by 3-row grid, 1536x1024 landscape.
Style reference: the established DontEraseMe naive MS Paint doodles: rough uneven nearly black outlines, slightly crooked hand-mouse-drawn shapes, flat fill, only 2-3 clear color blocks each, readable at 35-48 pixels. NO watercolor, gradients, realism, 3D lighting, paper texture, glows, particles or shadows.
Each item centered in its own generously separated cell, isolated on REAL transparent background. ALL tools have their long axis HORIZONTAL, rear handle/grip on LEFT and active tip/front facing RIGHT. This is a game held-weapon atlas, NOT a UI icon board. No hands, people, labels, grid, captions, numbers, frames or scenery.
EXACT order left-to-right:
Top row: 1 a wooden-handled round paintbrush with blue bristle tip on right; 2 a short orange spray paint can laid horizontally, blue button/nozzle facing right; 3 a broad steel palette scraper with brown handle left and trapezoid blade right; 4 an ink-chain wand, pale short grip left, three chunky linked blue-black chain loops extending right.
Middle row: 5 a mint green short thick ruler with black measurement ticks, horizontal; 6 a short pink ribbon spool/grip left with a single pink ribbon curl extending right; 7 a purple handheld paint mixer/vortex wand with round spiral mixing head right; 8 a small red paint bucket cannon laid sideways, dark red handle/grip left, cream rim and red paint opening right.
Bottom row: 9 a long dark blue fountain pen with golden nib to right; 10 a compact cyan airbrush with small yellow paint cup on top, grip left and spray tip right; 11 a drafting compass lying sideways, gold hinge left and two open pale-blue pointed arms right; 12 a green liquid eyedropper with dark green rubber bulb left and thin glass pipette tip right.
Keep silhouette simple and bold, no decorations between cells. Transparent negative space at least 40px between objects.

## 实现与验证

见 ../../../docs/DoodleArtImplementation.md。身体不再整体摇晃；双腿与武器分层、步幅随真实移动推进。已通过构建、5 组回归及独立预览的类型检查，浏览器检查 12 种持握、朝左工具和实际喷漆罐对局。长局、所有装备实战组合与低端设备性能不在本次验收范围。
