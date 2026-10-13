# 水彩墨团收藏家 v3 · 已确认并接入试用

后续确认：用户选定此风格并要求应用到游戏。已将本图复制为 `src/assets/characters/collector-watercolor-v3.png`，收藏家在创造/守卫模式中共用，64 px 显示框、原碰撞与攻击不变。旧人形图保留，不再引用。下文保留生成时的草稿记录；运行状态以本段和 `docs/CollectorArtImplementation.md` 为准。

2026-10-05：用户认可简约墨团方向，并要求水彩表现。本轮只改变已认可的角色材质与墨线质量，不重新复杂化造型，不替换运行资源。

- 文件：`collector-watercolor-v3.png`，透明 PNG。
- 保留头身一体、两眼、短腿、金黄背带、画筒和画笔。
- 蓝青水彩叠色、纸张颗粒、颜料沉积与不规则水痕；深墨轮廓和眼睛保持清晰。
- 生成方式：内建 ImageGen 编辑，输入为 `../collector-ink-v2/collector-ink-flat-v2.png`。
- 64 px 是既定试用显示框；本次未进行该新图的局内验证，需确认后校准透明边距与夜景下的可读性。
- 当前游戏仍使用人形收藏家 v1。用户要求水彩化的是本轮角色，未授权全项目场景/UI重制。
- 这条角色材质指示晚于旧 ArtDirection 中“不要水彩”的约束，角色后续生产以最新用户指示为准；该具体输出尚待确认。

## 完整编辑提示词

Use case: style-transfer.
Asset type: transparent 2D game character watercolor concept, for DontEraseMe.
Input image 1 is the EDIT TARGET: the approved simple ink-blob Collector.
Primary request: change ONLY the painting medium to expressive traditional WATERCOLOR AND INK. Preserve the exact compact teardrop head-body silhouette, body proportions, determined two cream eyes, short feet, ochre diagonal strap, single cream art tube, one round mitten hand holding the cyan paintbrush, same pose and framing. No redesign or new accessories.
Rendering: visible cold-press watercolor-paper grain INSIDE the painted figure only, organic blue-teal pigment granulation, wet-on-wet pooling, soft irregular tide marks, two or three broad overlapping washes, a few pale dry-paper flecks. Clearly handmade watercolor, NOT a flat vector recolor and NOT a glossy slime. Body remains medium-value blue teal with deeper indigo in its bottom shadow, ochre strap becomes warm ochre wash, paper tube warm cream wash, brush tip lively cyan watercolor. Do not desaturate everything into pastel.
Retain a strong continuous deep-charcoal outer contour, now drawn with slightly variable hand-ink thickness and subtle dry-brush edges. Interior marks sparse; eyes and shape separation stay crisp. Watercolor texture is subordinate to the large simple shapes, suitable for a 64px game character on dark slate night ground. Keep stoic scrappy expression; no blush or sweet anime face.
Composition: ONE complete isolated character, identical framing and transparent margins. Preserve true transparent alpha background. Paper texture only within opaque character shapes; no paper rectangle, no background wash, no ground shadow, no floating splashes, no text, no panel, no watermark.
Avoid extra costume detail, hair, humanoid anatomy, extra limbs, smooth digital gradients, 3D, plastic highlights, glowing outline, blurry silhouette. Preserve identity, silhouette, palette family, objects and transparency; change only medium and line quality.
