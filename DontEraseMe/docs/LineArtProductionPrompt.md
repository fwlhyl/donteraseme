# 白纸细线世界 · 文生图 prompt + 规范（给 Codex，2026-10-24）

> 用途：等 Codex 图像额度刷新后，用本文的 prompt 直接生成「荒废画室」庭院场景盘（clean plate）。方向与验收标准以 `ArtBible.md` 为准；本文只负责把可执行 prompt 焊死。

## 一、给 image_gen 的场景盘 prompt（可直接粘贴）

```
Fine-line doodle world in the style of Hidden Folks. A hand-drawn abandoned atelier courtyard, slightly elevated view, like an enlarged hand-drawn map.

STRICT MONOCHROME: near-white paper background (#faf9f5) with black and grey fine pen lines only (#232220 / #44423d / #7b786f). NO color in the environment — color is reserved exclusively for the player's fluorescent ink.

COMPOSITION: rich clusters of tiny hand-drawn objects only around the PERIMETER — a printing press, easels, paint barrels, crates, buckets, rocks, wooden fences, shrubs, trees, an arched gate, windows and doors, a few birds. The CENTRAL playable floor stays CLEAR — only sparse irregular flagstones, no props, no dense texture.

LINE QUALITY: simple, slightly irregular pen lines; leaning walls, sagging rooflines, non-90° corners, occasional line overruns — organic and hand-drawn, never tidy grids or perfect right angles.

A living hand-drawn world. NO 3D shading, NO volumetric lighting, NO night lamps, NO gradients, NO photographic textures.

Deliver a clean background plate: no characters, no monsters, no paint strokes, no UI, no text.
```

## 二、硬约束清单（生成后逐条核对）

1. **单色**：整张图只有白纸 + 黑灰线，环境里零彩色（暖灯、锈红、琥珀一律不要）。
2. **中央留白**：中央可走地面只有稀疏石板，无小物件、无密集纹理。
3. **密度在外围**：小物件成簇（工坊/画架/花园），不是均匀撒点。
4. **手绘不规则**：墙歪、屋脊下垂、角非 90°、有过笔抖动；不能工整。
5. **无线框角色**：角色/敌人不出现在场景盘里（后续单独做不透明黑白主体）。

## 三、角色/敌人方向（后续批次，先记下，不在本盘生成）

- **玩家**：深色不透明实心（近黑 `#232220`）+ 白巩膜黑瞳 + 朝向提示（笔/武器）。
- **敌人（橡皮擦）**：**浅灰**不透明实心 `#cfcbc0`（不是白色！白色 = 纸 = 消失）+ 深轮廓 + 深橡皮套 + 大眼。
- 两者靠明度值分离：玩家深、敌人浅灰，落在白纸明度轴两端，一眼可分。

## 四、验收 = 三态可读性

生成后必须过 `doodle-preview.html` 的「压力测试」同款判据：开局空白 / 战斗中 / 满地彩色三态下，玩家、敌人、攻击预告都能一眼看清。单张空场景漂亮不算过。
