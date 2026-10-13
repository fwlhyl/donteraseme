# 守卫模式 · 残败夜景

生成方式：内置 imagegen；2026-10-04。已接入独立资源 `src/assets/environment/guard-ruins-night-v1.png`，不覆盖创造模式资源。

## 首版提示词

Use case: style-transfer.
Asset type: production 2D game background, full landscape 1536x1024, no UI.
Input image 1: style reference, the existing hand-inked nighttime Mediterranean artist courtyard. Create its ruined guard-mode counterpart.
Primary request: an abandoned, badly damaged Mediterranean artists' town square at night. Preserve the reference's charming hand-drawn ink outlines, watercolor/marker wash, detailed architectural illustration and high elevated nearly top-down gameplay view. Not photorealistic, not 3D.
Composition MUST support a large rectangular gameplay area: the entire central rectangle from x=230 to x=1306, y=154 to y=870 must be flat unobstructed continuous dark slate-blue stone paving. No buildings, rubble, stairs, trees, tall objects, furniture or bright lights inside that rectangle. No visible rectangle outline. At the four outer margins and corners, tightly compose dense ruined architecture with organic jagged silhouettes: partly collapsed terracotta roofs exposing timber rafters, cracked stucco exposing masonry, broken windows and shutters, torn blue-and-cream awnings, leaning shop signs without lettering, crumbling low walls, snapped iron railings, chipped stone stairs, sparse dry vines and broken pots. Rubble remains outside the clear central rectangle, clustered against buildings.
Lighting: deep desaturated midnight indigo/slate blue, restrained violet shadows, only a few surviving warm amber windows and lanterns amid mostly dark empty windows. Atmospheric and melancholy but readable. No fire, no smoke or fog obscuring the floor. Interior paving should be very low contrast, subtle widely spaced seams, no big cracks or striking bright patch competing with colored player artwork.
Constraints: no people, monsters, vehicles, weapon, drawn artwork, UI, HUD, labels, words, watermark, cream paper border, horizon or sky. Full bleed scene. Architecture on all four sides, not a perspective street vanishing point. Keep the entire central safe rectangle genuinely empty and readable. Same handcrafted illustration quality and visual family as reference.

## 最终构图修订提示词

Use case: precise-object-edit.
Input image: ruined nighttime courtyard edit target.
Recompose the architecture to the extreme outside edges for use as a real game map. IMPORTANT: do NOT keep the existing courtyard silhouette. The reference currently intrudes too far into the center. Push ALL buildings, rubble, stairs, vegetation and furniture outward, reducing their footprint, so the large axis-aligned rectangle between x=154 and x=1382 and y=102 and y=922 (80% of total width and height, centered) contains ONLY dark low-contrast slate-blue flat stone floor. Every corner of that rectangle must be empty floor too, not diagonal building walls. The architecture forms a narrow but exquisitely detailed broken ring OUTSIDE this rectangle at the extreme outer edges, mostly cropped by the image borders. The inner silhouettes can be irregular within that outer 10% band. No border stroke around the empty rectangle.
Keep the ruined Mediterranean hand-inked watercolor visual style: shattered terracotta roofs, exposed rafters, chipped purple stucco, fractured masonry, boarded windows, torn blue awnings, dead ivy, a few warm dim windows and broken lanterns. Midnight indigo stone ground. Rich illustrated ruin detail within the very narrow peripheral strip; do not make buildings tall enough to project inward into the safe rectangle. High top-down view with shallow facades, no horizon.
Do NOT add anything at all to the center: no art, characters, vegetation, objects, cracks with strong contrast, lamps, text or UI. Do not brighten the floor. Landscape 1536x1024 full bleed. The centered 80%-by-80% blank floor rectangle takes precedence over all other compositional details.

## 接入边界

最终图仍保留了不规则角部露台，所以渲染时保守使用中央 2/3 作为原有战斗地图，外围画布扩展 25%。外围不属于新的可行走范围；不会缩放、裁剪或修改原画笔迹。镜头可在靠边时显示废墟边景，原画和导出保持独立。
