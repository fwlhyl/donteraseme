# 局部体积与淡彩效果稿 v5 · 待审阅

日期：2026-10-06。用户指出 v4 仍缺参考图的水彩表现与立体感，并强调目标是参考图的视觉效果，不是更换 3D 技术。已同意先做建筑＋树＋路灯＋墨团的局部联合样张。

## 交付与边界

- `night-corner-study-v5.png`：1536×1024 单张局部绘画，夜间店铺、树冠、花池、路灯、暗地面与角色同画。
- 重点：建筑前侧面和凹进门洞、树冠层叠明暗、暖灯与冷色暗部、角色落地阴影；笔触沿形体变化，不叠统一颗粒滤镜。
- 这不是完整地图、透明角色切片或实机截图。角色已做一次缩小编辑，但图像生成没有精确执行 64 px 的要求；不可据此声称完成 64 px 实机验收。运行中的 64 px 显示设置不变。
- 中央地面目前有较明显的绘画笔触。若用户认可画法，铺开全地图时仍需压低玩法区域纹理对比，并校验颜料可读性。
- 完全未修改运行资源、UI、碰撞边界、玩法与引擎。不能将此局部构图直接覆盖现有全地图。
- 不宣称已完全匹配参考图，等待用户审阅。原始生成第一版（较大角色）仍保留在工具默认生成目录。
- 工具：内建 ImageGen。风格参考：`../sketch-wash-v4/user-style-reference.png`；角色身份参考：`src/assets/characters/collector-watercolor-v3.png`。

## 初始生成提示词

Use case: stylized-concept.
Asset type: ONE local scene visual-development sample for the 2D game DontEraseMe. Landscape 1536x1024 composition. This is NOT a whole map or a UI screen.
Image 1 is the PRIMARY style reference: match the street scene's actual hand-painted visual effect, especially its chunky dimensional trees, broad painted building planes, colored shadows, imperfect contours and softly varied washes. Ignore all text/UI, ignore its road, vehicle and daytime. Image 2 is CHARACTER IDENTITY reference only, NOT the painting style: retain the small blue ink-drop Collector, ochre shoulder strap, rolled cream drawing tube, little brush and determined eyes.

Scene: a small corner of a NIGHTTIME Mediterranean artist courtyard, viewed from the game's elevated oblique top-down camera (look down about 50 degrees; no horizon or street-level vanishing-point view). A simple two-storey ochre-blue corner art shop at top-left, visibly substantial wall thickness, offset corner with both front and side walls, deep inset doorway and a blue/cream canvas awning projecting outward. Beside it, one tree with a FULL VOLUMINOUS compact angular canopy, a box planter with clearly visible top lip, front face and side face, and ONE simple standing warm-lit streetlamp. Objects confined to upper/left perimeter. Lower/right two thirds are continuous OPEN dark slate-blue paved drawing space, quiet and uncluttered.
One small blue ink-drop Collector stands on the open floor, right of the tree and below the lamp. Keep its original simple silhouette/eyes/strap/tube/brush, make its body convincingly rounded using a cool shadow side and warm lamp-facing plane, and a compact contact shadow. Character occupies only about 6 percent of image height (target about 64px at 1024px image height), NOT a big mascot portrait. No other characters.

CRITICAL style: reproduce the PRIMARY reference's tactile watercolour/gouache washed surfaces with strong visible VOLUME. Tree canopy built from a handful of irregular broad masses with upper light planes, subdued middle planes and deep undersides, not leaf outlines. Walls: differently colored front/side planes with patchy translucent vertical brushstrokes, deep recess shadows. Thick awning fold volumes with painted undersides. Irregular slender graphite/ink contours, varied broken edges rather than thick comic ink borders. Soft broad pigment variation FOLLOWS each surface direction and the form. Some edges dissolve slightly, some corners stay crisply drawn. Do not cover everything with uniform paper noise. Both buildings and the character are painted with the SAME pigments, edge softness, light direction and hand-drawn language.
Light: clear cool indigo night ambient plus restrained warm ochre lamp/window light. One consistent cast-shadow direction from the lamp; tree trunk/planter/lamp/character visibly grounded. Floor stays muted and DARK so gameplay paint will read. This is hand-painted dimensional illustration, not flat vector, not glossy toy, not architectural line-art coloring book. Emphasize depth through face separation, occlusion, projected shadows and foreground overlaps, not through hyperdetail.
Do not recreate the previous ornate fantasy illustration. No tiny bricks/leaves/flowers/street clutter, no stippled watercolor texture overlay. No flat paper cutouts or sticker character, no plastic shine, no heavy black contour, no bloom, no lens effects, no text, no UI, no borders, no comparison panels. Do not change the simple ink-drop into a human. Output one cohesive nighttime local-scene painting.

## 角色尺寸与融合编辑提示词

Use case: precise-object-edit.
Input image: EDIT TARGET, a local night courtyard style study.
Keep every background element, camera, building, tree, lamp, paving, palette, light and shadow EXACTLY unchanged.
Edit ONLY the ink-drop character and its contact/cast shadow:
1. It is currently about 140 pixels tall on this 1536x1024 image. Reduce its full visible silhouette (including top nib and feet, including brush in the width) to about 64 pixels high, approximately half its current linear size. Keep its FEET anchored at the same ground position, roughly x850 y660 in the 1536x1024 image. Restore the exposed floor naturally.
2. Preserve its blue ink-drop silhouette, eyes, gold strap, cream tube and brush. Paint it with the SAME soft blocked watercolor/gouache wash treatment as the environment. Remove the thick black sticker border: use a restrained dark-blue hand-drawn contour, some softer edges on lit sides. Add a muted warm lamp-facing plane and cool blue-violet shadow plane. Do not add details or plastic highlights. Keep the cream eyes legible.
3. Shrink and soften its ground shadow proportionally so it is grounded, light direction matching the lamp.
This must remain a single coherent local scene, not a sheet. Preserve 1536x1024 framing. No text, no UI, no extra figures, no large portrait inset. Background is opaque.
