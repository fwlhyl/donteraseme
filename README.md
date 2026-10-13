# DontEraseMe

以战斗作画为核心的 2D 涂鸦风格游戏。当前主要模式为创造模式和守卫模式，使用 TypeScript、Canvas、Vite，提供 Electron 桌面入口。

## 启动项目

安装 Node.js 和 npm 后，在当前开发目录运行：

```sh
cd DontEraseMe
npm ci
npm run dev
```

浏览器打开终端显示的本地地址。构建网页版本：

```sh
npm run build
```

Electron 本地运行：

```sh
npm run electron:start
```

## 目录

- `DontEraseMe/src/`：当前游戏源码、运行美术及音频资源。
- `DontEraseMe/art-drafts/`：美术方案、候选资源、独立审阅与验证页面。
- `DontEraseMe/docs/`：设计与实现记录。
- `DontEraseMe/scripts/`：回归测试及音频生成脚本；具体运行要求见各脚本说明。
- `DontEraseMe/PROJECT_MEMORY.md`：已确认的产品方向及最新决定，优先于历史方案。
- 根目录其他版本号目录：历史版本归档，不是当前开发入口。

`node_modules`、`dist`、桌面打包产物、环境变量文件与本机编辑器配置不进入版本控制。重新克隆后需执行 `npm ci`。

玩家金币、解锁、设置、导入画作等本机存档不包含在仓库中，也不会随 Git 同步。

## 当前验证入口

启动开发服务器后，可通过以下相对路径查看独立页面（不会更改玩家存档）：

- `/art-drafts/projectile-review.html`：十二种武器弹体与 Eyedropper 墨滴。
- `/art-drafts/recording-performance-review.html`：绘画批处理、回放像素及加速长笔迹压力验证。
- `/art-drafts/enemy-gait-review.html`：地面敌人步态。
- `/art-drafts/audio-review.html`：音乐与音效。

自动测试和加速压力测试不代替完整长局及打包设备验收。仓库未授予第三方使用许可；美术与音频来源和制作记录保留在相应资源、文档目录中。
