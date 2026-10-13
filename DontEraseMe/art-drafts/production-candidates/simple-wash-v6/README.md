# 简约水彩局部样稿 v6

日期：2026-10-06

## 本轮方向

根据反馈减少 v5 的细碎色块，改用大面积、简洁的水彩色面表现柔软、饱满、近似果冻的体积感；不是透明果冻材质或高光塑料。

- 树冠收敛为连贯的大形及少量明暗色面。
- 墙面、花池、遮阳棚减少碎斑，用整体受光面与背光面体现厚度。
- 地面保留暗蓝底色、少量铺砖线及暖色灯光，降低纹理干扰。
- 蓝色墨滴角色同步简化上色，保留小体量及落地阴影。

## 文件与状态

- 选定输出：`night-corner-simple-v6.png`（1536 × 1024）。
- 工具模式：内置 ImageGen，连续两次参考图编辑，采用第二次结果。
- 初始目标：`../volume-wash-v5/night-corner-study-v5.png`。
- 风格参考：`../sketch-wash-v4/user-style-reference.png`。
- 这是供审阅的局部构图样稿，不是完整地图、精确 64px 角色预览或生产就绪精灵。
- 未修改运行资源、UI、游戏逻辑或碰撞；旧稿保留。等待视觉确认后再考虑完整地图与独立角色素材。

## 第一轮提示词

```text
Use case: style-transfer. Image 1 is the EDIT TARGET (night courtyard corner with ink-drop hero). Image 2 is the PRIMARY guide for how SIMPLE the color masses and watercolor surfaces must look.
User correction: previous result has far too many tiny patchwork paint marks. They want simple, plump, jelly-like VOLUME expressed in a few clean watercolor washes, like the reference. NOT mosaic gouache, NOT thousands of pigment chips.
Preserve Image 1's camera, composition, building/awning/door/window positions, tree, planter, streetlamp, small ink-drop hero, nighttime mood and light direction. Keep character identity and scale unchanged. Change SURFACE PAINTING and simplify forms only.
MAKE A STRONG SIMPLIFICATION:
- Each wall face is ONE broad uninterrupted base wash plus ONE shadow/light wash. Remove all little chipped patches and speckles. Big areas of tranquil color, subtle wet pigment pooling only near some edges.
- Tree crown should look like 3 to 5 plump rounded-angular inflated masses, soft jelly-like fullness, only 2-3 green values over the entire crown. NO individually painted leaves, NO dozens of overlapping patches. Large soft olive-to-yellow-green wash transitions and one deep green underside establish volume.
- Awning has a few clean broad blue/cream stripes with one simple darker underside, soft fullness, no noisy brush marks.
- Planter: clear top/front/side planes, each essentially one color, with gently softened edges.
- Ground: one very quiet cool slate-indigo base wash and one broad restrained warm lamp pool. Sparse thin tile seams only. Remove nearly ALL the ragged patches, scratch marks, mottling, hatching and little multicolored strokes. The floor must be a calm dark drawing surface.
- Hero: keep recognizable blue drop, cream eyes, ochre strap, tube and brush. Body painted with two main large translucent-looking blue watercolor washes, gently rounded volume, not patchwork. One soft light patch is enough. Keep its grounded small shadow.
Retain slender imperfect ink contours and selective sharp corners matching reference2, with natural soft wet edges within the color. Light and shadow still show solid thickness; do NOT flatten objects into vector stickers.
The 'jelly' quality means soft plump form and luminous clean color, NOT transparent gelatin, plastic toys, strong glossy reflections, glass, 3D product rendering or airbrushed photorealism.
Match reference2's economy, spacious color areas and naive hand-drawn charm. No uniform grain filter. At least 80 percent of each object's surface should be visually calm. Same opaque landscape framing as Image1. No text, no UI, no frame, no extra objects.
```

## 第二轮提示词（选定结果）

```text
Use case: precise-object-edit. Edit this night-courtyard draft to remove the REMAINING small paint patches. Keep exact composition, all objects, camera, blue character, night lighting and shadows.
The required change is specifically LARGE SIMPLE COLOR AREAS WITH SOFT JELLY-LIKE FULLNESS:
Tree: replace the current cauliflower-like overlapping round clumps and many tiny green patches with ONE plump slightly angular canopy silhouette. Inside the canopy use ONLY THREE large contiguous green wash regions: yellow-green lit upper/right face, olive middle face, deep blue-green lower/left underside. Gently blend just their meeting edges as wet watercolor. Absolutely no leaf texture, no scalloped cloud clumps, no speckle islands, no tiny marks. This tree must feel full and almost inflated, with a thin loose dark outline.
Walls, awning, planter and floor: erase every little patchwork paint island. Preserve broad light versus shadow planes but make each plane a clean broad luminous watercolor wash, near-uniform across the majority of its area with ONLY a faint soft wet pigment variation at a few edges. The whole scene should be calm and airy, not mottled. Floor one dark slate-blue wash + one warm lamp wash + sparse existing paving seams. Do NOT add new strokes.
Character: retain small blue ink-drop body and brush; broad simple blue wash and one soft shadow, cream eyes, gold strap, muted thin contour.
This is not flat vector: volume comes from a FEW large shaded planes and broad soft watercolor transitions, not busy texture. No shiny plastic, no gelatin transparency, no tiny shiny dots. Existing object scale, poses, colors, shadows and opaque 3:2 framing unchanged. No text/UI.
```
