# 指尖圣诞魔法：手势圣诞树

一个基于 React、Three.js 和 MediaPipe 的 Web 互动项目。用户可以通过摄像头识别手势，控制 3D 粒子圣诞树在“聚合圣诞树”“星云散开”“照片特写”三种状态之间切换，并上传自己的照片作为场景中的漂浮相片。

## 项目特色

- 3D 粒子圣诞树：使用 `@react-three/fiber` 和自定义 Shader 绘制发光粒子树。
- 手势交互：通过 MediaPipe Hand Landmarker 识别手势并驱动画面变化。
- 照片星云：支持上传多张本地图片，图片会在星云模式中漂浮展示。
- 照片特写：在星云模式下做捏合手势，可随机进入照片放大查看模式。
- 节日视觉效果：包含辉光、暗角、闪烁粒子、圣诞灯串、节日字体和动效。
- 响应式适配：针对不同屏幕宽度调整 3D 场景缩放。

## 交互说明

打开页面后，点击左侧的摄像头按钮开启手势识别。

| 手势 | 效果 |
| --- | --- |
| 握拳 | 粒子聚合为圣诞树形态 |
| 张开手掌 | 粒子散开为星云形态 |
| 捏合 | 在星云模式下进入照片特写模式 |

右侧图片按钮可以上传本地照片，支持一次选择多张图片。

## 技术栈

- React 19
- TypeScript
- Vite
- Three.js
- @react-three/fiber
- @react-three/drei
- @react-three/postprocessing
- MediaPipe Tasks Vision
- Tailwind CSS CDN

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

启动后根据终端提示访问本地地址，通常是：

```text
http://localhost:5173
```

### 3. 构建生产版本

```bash
npm run build
```

### 4. 本地预览构建结果

```bash
npm run preview
```

## 目录结构

```text
.
├── App.tsx                  # 应用主入口，管理模式、照片和手势状态
├── index.tsx                # React 挂载入口
├── index.html               # 页面模板、字体、Tailwind CDN 和全局样式
├── types.ts                 # 应用模式、手势状态和照片数据类型
├── components
│   ├── HandManager.tsx      # 摄像头、MediaPipe 初始化和手势识别逻辑
│   ├── Scene.tsx            # Three.js 3D 场景、粒子树、照片和后处理
│   └── UIOverlay.tsx        # 页面按钮、状态提示和手势说明 UI
├── package.json             # 项目脚本和依赖配置
├── tsconfig.json            # TypeScript 配置
└── vite.config.ts           # Vite 配置
```

## 核心逻辑

项目通过 `App.tsx` 维护当前应用状态：

- `TREE`：圣诞树形态
- `CLOUD`：星云散开形态
- `ZOOM`：照片特写模式

`HandManager.tsx` 负责加载 MediaPipe 手部识别模型，并通过摄像头视频流持续检测手部关键点。识别到的手势会回传给 `App.tsx`，再由 `App.tsx` 控制 `Scene.tsx` 中的 3D 动画状态。

`Scene.tsx` 使用自定义顶点着色器和片元着色器生成粒子系统，通过 `uExpand` uniform 在圣诞树和星云两种粒子分布之间平滑过渡。

## 浏览器权限与注意事项

- 需要浏览器允许摄像头权限，否则无法使用手势控制。
- MediaPipe 模型和 wasm 文件从 CDN 加载，首次进入页面时需要网络连接。
- 摄像头通常要求在 `localhost` 或 HTTPS 环境下运行。
- 如果页面中手势识别没有立即生效，可以等待模型加载完成，或刷新后重新开启摄像头。
- 上传的图片使用 `URL.createObjectURL` 在本地浏览器中展示，不会上传到服务器。

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建产物 |

## 项目定位

这个项目适合用于节日互动展示、创意前端作品、WebGL/手势识别学习案例，或者作为带有照片展示能力的沉浸式网页互动 demo。
