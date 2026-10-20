# 暗纸场景制作记录

布局于2026-10-17开始制作，内置image_gen生成与游戏接入于2026-10-18完成。目录日期保持不迁移。

## 图像来源

生成器：内置image_gen，默认保存目录 `/Users/fwl/.codex/generated_images/01a0f665-cd1a-7ef1-98a0-278657c1f339/`。

| 工作区源图 | 默认目录中的生成文件 |
| --- | --- |
| atelier-candidate-v1.png | exec-6cc40fb2-3226-493f-bc99-8098d06765ea.png |
| ruins-candidate-v1.png | exec-252cf4e0-aa21-4b0b-9ee0-56fdf2aece3c.png |
| floor-v1.png | exec-509ef9cb-4db6-438e-b5a1-66bf9cf2c2ee.png |
| atelier-v1.png | exec-cb634732-a067-4785-9548-0854b63e296d.png |
| ruins-v1.png | exec-8d6bd9ef-d15d-4d8a-aec9-e83fb0f96be6.png |
| drawing-studio-v1.png | exec-b2300f0c-dd15-47ea-949b-5d2d6d2d6af1.png |
| gallery-wall-v1.png | exec-aa422f9e-a867-48fe-9192-e1bc4283c7a7.png |

五张最终源图复制到本目录并编码至 `src/assets/paper-scenes/`，Sharp WebP quality90（墙纹quality88），没有裁剪、拼贴或烘焙UI。墙纹生成目标1024方形，实际输出1281×1228；保留真实尺寸，用作可重复的材质纹理。

## 提示词与约束

- `prompts.json`：精确完整首轮提示词。使用已确认 `combat-ui-v2.png` 为风格参考；场景另用各自 `*-layout.png` 为几何参考。
- `refinement-prompts.json`：第二轮只修正空地区域/外围摆放，输入为candidate图与布局图。
- `drawing-studio-prompt.txt`：纯画画背景；中心留给真实白纸，不将纹理或道具写入作品。
- `gallery-wall-prompt.txt`：墙面材质，参考floor-v1纸纤维，不带场景、文字或画框。
- `*-layout.svg/png`：代码生成的制作约束图，不是游戏素材。

运行情况、隔离测试与审阅截图汇总见 `docs/DarkPaperScenesImplementation.md`。
