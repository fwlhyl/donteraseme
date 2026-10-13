# 夜间庭院背景 v7：立体体块 + 简洁水彩

日期：2026-10-06

## 本次交付

- 图像：`atelier-night-background-v7.png`，1536 × 1024，独立背景候选。
- 生成方式：内置 ImageGen，参考图风格转绘。模拟 3D 体块配手绘材质的观感；没有建立或交付 3D 模型，也不是经 3D 软件实渲的资产。
- 风格参考：`../sketch-wash-v4/user-style-reference.png`。
- 构图参考：`../../../src/assets/environment/atelier-courtyard-night-v1.png`（相对于本目录）。

## 视觉方向

简洁立体建筑、厚实屋檐与花池、块状树冠、少量大面积水彩明暗面、克制的轮廓线。保持夜间冷蓝地面与外围暖灯，四周不规则建筑围合，中央不摆放障碍物，为笔迹与战斗留空。

## 审阅状态与限制

已目视检查：无角色、敌人或 UI；中心连续留空，建筑集中外围。相比旧背景，细碎装饰和笔触有所减少，保留前后遮挡、侧面和投影体现体积。

这是风格试稿，尚未接入游戏；没有更改 UI、运行背景或游戏逻辑。本图轮廓与原碰撞并非逐像素一致，正式接入前须核对可走边界、笔迹裁剪和场景比例。地面铺砖与树冠色块的简洁程度仍待用户审阅。

## 完整提示词

```text
Use case: style-transfer.
Asset type: full-scene background candidate for the 2D game DontEraseMe; one finished opaque landscape image, 3:2.
Input images: Image 1 is the PRIMARY STYLE REFERENCE (simple volumetric hand-painted street). Image 2 is the COMPOSITION / NIGHT COURTYARD LAYOUT to reinterpret, NOT the rendering style to retain.
Primary request: re-render the night courtyard from Image 2 to look like an actual simple low-poly environment rendered with hand-painted watercolor textures and subtle irregular ink outlines, matching the three-dimensional spatial solidity and SIMPLE LARGE COLOR AREAS of Image 1. A 2D background image with convincing modeled volume, not a flat watercolor illustration.
Keep the elevated overhead three-quarter game camera and a large continuous EMPTY central courtyard occupying roughly 60 percent of the picture. Buildings, trees, art shop, striped awnings, cafe terrace, stairs, planters and streetlamps form an irregular varied perimeter on all four edges, like Image 2. Preserve the overall open playable footprint; details may be simplified substantially. No street vanishing point, horizon or sky. Do not put props in the center.
STYLE PRIORITIES:
1. Chunky simple solid forms with clear top/front/side planes, thick roofs and awnings, inset windows, raised planters, visible thickness of stairs, coherent perspective and restrained soft contact shadows. The modeled shape is the foundation.
2. Each large surface has one clean luminous wash and one broad shade; watercolor pigment subtly drifts inside these broad regions. No thousands of paint patches. Trees have single plump angular crowns, 2-3 LARGE green planes, no individual leaves or cauliflower clusters. A gently inflated jelly-like fullness but opaque matte surfaces, not actual gelatin or shiny toys.
3. Thin slightly imperfect dark contours on silhouettes and selected structural edges, like Image 1. Not thick black comic contours, not dense sketch hatching.
4. Architectural richness comes from varied LARGE silhouettes, overlapping heights and a few useful recognizable props, not excessive flowers, roof tiles, tiny stone blocks or texture marks. Merge or omit most small details from Image 2.
Night palette: calm slate blue ground, desaturated blue-violet and teal wall shadow planes, muted terracotta roofs, olive green crowns. Small warm ochre window and lamp pools contrast with cool ambient moonlight. Night but readable forms, not black or muddy.
Floor: a very quiet broad dark blue watercolor plane reserved for bright player paint marks. Only sparse low-contrast LARGE paving seams, barely visible broad pigment variation. No cracks, speckles, checkerboard color patches, scattered objects or bright central light pool.
Avoid: photorealism, plastic gloss, clay render, excessive bloom, heavily mottled watercolor paper overlay, ornate European illustration detail, flat vector shapes, crowds, people, player character, enemies, cars, paint trails, UI, text, logos, white borders, floating island / diorama base. Fill the whole rectangular image with the environment.
```
