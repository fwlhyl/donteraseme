# 墨团收藏家 v2 · 简约方向候选

日期：2026-10-05。用户认为已接入的 64 px 人物过于小清新，希望参考《土豆兄弟》的简约角色表达。本轮探索头身一体、大轮廓、少量色块的原创墨团角色；不是复制土豆造型，也不是已经确认的最终角色设定。

输出：`collector-ink-flat-v2.png`（透明 PNG）。内建 ImageGen 生成后做一次减高光、扁平色块编辑；完整提示词见下方。原始自动保存图保留，未覆盖。

保留：两只眼睛、短腿、画筒、金黄背带、青色画笔。移除：人类发型、分开的头身、复杂衣服、围巾、旅行插画装饰。64 px 仍是拟用显示框，但本轮没有实机小尺寸验证。

边界：仅草稿。没有替换 `src/assets/characters/collector-brush-v1.png`，没有改变角色代码、动画、碰撞、场景或 UI。正式接入前需确认墨团物种是否符合用户预期，并验证夜景和颜料密集背景可读性；如接入需重新标定透明边距，不能假设相同图片框等于相同身体大小。

## 初始生成提示词

Use case: stylized-concept.
Asset type: ONE original extremely simple 2D top-down arena-survivor game character concept, transparent PNG, designed for a 64px square display.
Primary request: the starter COLLECTOR for DontEraseMe reimagined as a living INK BLOB, not a human/chibi adventurer. Borrow only the broad economical visual grammar of simple arena roguelike characters: a single head-body mass, bold silhouette, very few flat color shapes, easy to recognize at tiny scale. Do NOT depict a potato or copy a specific existing character.
Subject: one squat irregular dark teal ink-drop body with a single small blunt ink nib point on its top, head and torso are the SAME shape. TWO off-white narrow oval eyes with slightly slanted upper edges, deadpan stubborn determined expression. No mouth, no nose, no hair, no ears, no separate human face. Two tiny charcoal stub feet and one simple detached round mitten hand. The body is wide and compact, not tall.
Collector identity: exactly one flat mustard ochre diagonal bag strap, one small cream rolled-art tube peeking from behind its shoulder, no elaborate backpack detail. The hand holds ONE chunky SHORT paintbrush at its side, facing diagonally up-right, wooden ochre handle, plain cream ferrule, vivid cyan paint tip; brush length roughly half body height.
Style: extremely pared-down hand-ink cartoon sprite illustration, thick near-black slightly irregular outline, flat dry marker fill, one shadow block at most, minimal texture. No fussy internal details. Keep silhouette light enough in value to read on dark slate blue ground. Mood is scrappy and stoic, not pastel cute.
Composition: full isolated single character in a slightly elevated front three-quarter view, all feet and brush visible, centered in square with 10% transparent margin. Genuine transparent alpha background.
No scenery, no text, no labels, no sample panels, no ground shadow, no UI, no weapons other than the one brush. Avoid human anatomy, clothing layers, big sparkling eyes, rosy cheeks, scarves, badges, jewelry, realistic rendering, smooth gradients, 3D, pixel art. This should look like a compact game token, not an elaborate character illustration.

## 扁平化编辑提示词

Use case: precise-object-edit. Edit the supplied original DontEraseMe ink-blob collector concept.
Preserve exactly its single teardrop body silhouette, two stern cream eyes, stub feet, ochre diagonal strap, cream artwork tube, held cyan-tipped brush, pose and framing.
Change ONLY the rendering and body value: flatten to extremely simple opaque solid color fills. Remove every glossy spot, shine blob, specular reflection, smooth gradient, internal texturing and airbrush shading. Body main fill medium desaturated teal #367684, with just ONE small darker flat cel-shadow area #285460. Keep very thick matte near-black outlines. Strap flat mustard, paper/ferrule flat cream, handle flat ochre, brush tip flat cyan. Eye whites flat cream. Feet a readable muted charcoal grey. No new costume, no extra details.
Aim for an economical 64px arena-survivor sprite, dry flat ink cartoon not a glossy slime. Genuine transparent alpha background, no ground/shadow, no text, no border, no scene. Keep full figure and transparent margins.
