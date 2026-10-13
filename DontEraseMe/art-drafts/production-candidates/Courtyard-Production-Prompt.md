# 街景制作记录

## 夜景编辑提示词（内置 imagegen）

Use case: lighting-weather. Edit target: the supplied complete hand drawn game courtyard image. Change ONLY time of day, lighting and color grading into a beautiful deep nighttime version.
STRICT INVARIANTS: pixel-aligned composition, same camera, same framing, same 1536x1024 3:2 dimensions, exact same buildings, stairs, planting beds, railings, trees, props and their contours/positions. The existing game's collision polygon is traced on this image so do not move, remove or add any object. No crop, no perspective change.
Make the entire open floor dark desaturated slate blue / midnight blue-gray, approximate base colors #293747 through #374553. Keep very subtle paving details with low contrast. Absolutely no cream / white / light beige floor remaining. This central floor will be a canvas for colorful painted trails so it must be dark, quiet and uniformly legible with no decorative paint or sparkles.
Buildings get cool indigo moonlit shade with muted existing pigments, subtly readable ink lines. Existing window panes and existing streetlamp lanterns glow softly warm amber. Local tiny warm light pools at the perimeter ONLY, never wash out the central floor. Cozy nighttime artist quarter, subtle graphite and marker texture consistent with original, not photorealistic, no neon. Keep original black ink drawing style and every silhouette exactly. No characters, no text, no HUD, no added sky or moon.

工具：内置 imagegen；参考图角色：仅作风格参考。生成后原图复制至 `src/assets/environment/atelier-courtyard-v1.png`，未修改旧候选素材。

## 最终提示词

Use case: stylized-concept. Asset type: FINAL playable 2D game arena background, landscape 3:2, 2700x1800 intended world coordinates.
Reference image: STYLE REFERENCE ONLY. Match its richly detailed ink-and-marker Mediterranean street illustrations. Generate ONE seamless complete overhead/isometric city courtyard scene, NOT a concept sheet, no UI.
Critical layout: dense colorful buildings, tiled roofs, blue striped awnings, art shops, easels, flower boxes, lush trees, wrought iron railings, cafe umbrellas and lamps form a continuous irregular perimeter around all FOUR edges. Perspective consistent from above, north at top. Boundary between architecture and courtyard steps in and out with angled corners, rounded planting beds and little cafe terraces; no perfectly rectangular inner edge.
The entire central 65 percent of image width and 65 percent height must be an EMPTY warm cream drawing plaza. Very faint paper grain and tiny sparse paving hints ONLY. No objects, no furniture, NO characters, no monsters, no paint splashes, no writing inside this central area. All architectural details strictly confined to outer approximately 15-22 percent border strips. Empty center is continuous with edge paving, not a framed white rectangle.
High-quality lively travel sketchbook style: confident irregular black ink contours, chunky marker fills, delicate graphite hatching, rich warm terracotta, mustard stucco, cornflower blue, lilac facades, leafy greens; directional lilac shadows under buildings. Architecture should feel crafted, layered, intricate, charming like reference, not flat geometric icons. Rich edge vignette supports completely clear center. No lettering, no labels, no game UI, no inset panels, no watermark. Fill entire image edge to edge.
