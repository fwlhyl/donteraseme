# 暗纸手绘 UI v2 — 实现资源

日期：2026-10-17。用户批准按第二版主菜单与局内参考图制作真实 UI；人物暂定独立手脚 v2，本轮不接入人物。

## 不可覆盖的基准

- `../dark-paper-ui-2026-10-16/main-menu-v2.png`
- `../dark-paper-ui-2026-10-16/combat-ui-v2.png`

配色：炭灰 `#252621`、米白 `#eee4c8`、锈红 `#b74736`。干笔、轻磨损、简约线框；不使用暗金雕花、糖果色、彩虹稀有度或 emoji。

## 资源与来源

- `menu-background-source.png`：使用内置 **image_gen** 编辑主菜单基准图，清除右侧四个按钮及底部功能文字，保留标题、人物、笔刷与废墟构图。工具生成原件为 `/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/exec-8a5b07ad-cc7b-4f9a-a806-92f396f54c83.png`。未使用 CLI/API 替代生成。
- `../../src/assets/ui/paper-menu-v2.webp`：上述源图通过 Sharp 编码为 quality 94 WebP；不再次绘制、不改变构图，约 378 KB。
- `../../src/assets/ui/rough-frame.svg`：代码原生的透明不规则线框，用于真实按钮与小地图，非整张 UI 截图。
- `../../src/assets/ui/paper-grain.svg`：静态轻纸纹，无逐帧噪声与动态模糊。
- `screenshots/`：隔离浏览器 UI 回归产生的实机截图，不是新的概念图；其中场景、人物仍为旧运行版本。
- `generation-notes.md`：背景编辑约束摘要。

所有按钮、HUD 数字、进度条和弹窗由真实 DOM / Canvas 驱动。只有主菜单插画和装饰标题是位图；可访问标题另以真实 HTML 提供。

## SHA-256

```text
main-menu-v2.png            793ede4cdeb9abb38c60cc4d7b3d7ebb9360c37350ee94add1f08f38c90967df
combat-ui-v2.png            0ee97f86e4bd81ff6ef9862c064fed78b2717a07be5e7d62052273becda49f41
menu-background-source.png 32b2aebcf615b9e189fde808e12d764641a4aea91c7abba52dc9371d33115a7b
paper-menu-v2.webp          428696700abca8871add03cf2b827aa9eb582a108860d19a19279d7498ad60ad
```

参考图校验值保持不变。未删除旧素材、草稿或存档；运行 UI 的范围与验证见 `../../docs/DarkPaperUIImplementation.md`。
