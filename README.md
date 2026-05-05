# Socrate

<p>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-2f6f5e">
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-111827">
  <img alt="Desktop" src="https://img.shields.io/badge/desktop-Tauri%20v2-24c8db">
  <img alt="Backend" src="https://img.shields.io/badge/backend-FastAPI-009688">
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-646cff">
  <img alt="AI" src="https://img.shields.io/badge/AI-LiteLLM-f97316">
</p>

<p>
  <strong>AI-native learning workspace.</strong>
  从一个问题开始，生成一张学习地图，并把每一步沉淀成可复用的本地知识资产。
</p>

Socrate 是一个本地优先的 AI 学习工作台。它把「和 AI 聊天」升级成一套可持续的学习流程：先澄清目标，再生成大纲，围绕每个知识点逐步引导，并把学习过程沉淀为可长期保存的 Markdown 笔记。

它适合用来系统学习一个新领域、快速建立技术栈知识框架、拆解复杂课程，或把零散的 AI 问答整理成可复习、可继续推进的学习档案。

## Highlights

- Local-first: 学习记录、笔记、总结默认保存在本机
- Structured learning: 每个会话都有大纲、进度和上下文
- AI-guided: 用反问澄清目标，而不是直接堆答案
- Durable notes: Markdown 输出可进入 Obsidian / Typora / Git
- Desktop-ready: Tauri + 自包含后端 sidecar，面向桌面分发
- Model-flexible: LiteLLM 接入多模型供应商

## 产品理念

大多数 AI 学习体验会停留在一条越来越长的对话里。上下文会漂移，知识点会散落，用户也很难知道自己学到哪里、下一步该学什么。

Socrate 的核心假设是：学习不应该只是回答问题，而应该是一条有地图、有节奏、有记录的路径。

因此 Socrate 会：

- 通过反问理解你的背景、目标和约束
- 根据主题生成可导航的学习大纲
- 为每个知识点维护独立对话和学习状态
- 在学习过程中保留全局上下文，避免重复和跑偏
- 把会话、大纲、笔记和总结保存到本地文件系统

## 核心能力

### 引导式开场

输入想学习的主题后，Socrate 不会立即开始长篇讲解，而是先提出 2-4 轮背景问题，确认你的基础、目标和偏好，再生成学习计划。

### 结构化学习地图

每个会话都会生成一棵学习大纲。你可以看到当前主题、子主题、完成状态，以及下一步可以进入哪里。

### 知识点级对话

每个大纲节点都有自己的对话上下文。你可以围绕某个概念追问、要求例子、要求简化解释，也可以回到大纲切换到另一个知识点。

### 本地文件记忆

Socrate 默认把学习数据写入本地 Markdown 和 JSON 文件。你可以把这些文件放进 Obsidian、Typora 或自己的知识库继续整理。

### 多模型支持

后端基于 LiteLLM，支持不同模型供应商，并区分快速模型和专业模型。日常问答可以用低延迟模型，大纲、总结和深度讲解可以用更强模型。

### 桌面应用和移动 Web

Socrate 提供 Tauri 桌面端，也提供面向手机浏览器的 H5 版本。两者共用同一个 FastAPI 后端和学习数据模型。

## 使用方式

### 桌面应用

macOS 桌面包通过 Tauri 打包，后端以自包含 sidecar 形式随应用发布。目标机器不需要安装 `uv` 或 Python 后端依赖。

打包产物示例：

```text
src-tauri/target/release/bundle/dmg/Socrate_0.1.0_x64.dmg
```

桌面应用运行后，配置、日志和学习数据会写入用户数据目录。macOS 默认路径：

```text
~/Library/Application Support/Socrate/
```

### 本地开发

复制环境变量示例：

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入模型和 API Key：

```bash
SOCRATE_DEFAULT_MODEL=deepseek/deepseek-v4-pro
SOCRATE_FAST_MODEL=deepseek/deepseek-chat
SOCRATE_PRO_MODEL=deepseek/deepseek-v4-pro
SOCRATE_API_KEYS='{"deepseek":"sk-...","openai":"sk-...","anthropic":"sk-..."}'
```

启动桌面 Web 开发环境：

```bash
bash scripts/dev.sh
```

打开：

```text
http://localhost:1420
```

## 架构

```text
Desktop / H5
    |
    | /api/*
    v
FastAPI backend
    |
    | LiteLLM
    v
AI provider
    |
    v
Local learning files
```

代码结构：

```text
Socrate
|-- backend/         FastAPI API、AI 引擎、学习流程、文件记忆
|-- src/             桌面端 React + Vite 前端
|-- h5/              移动端 React + Vite 前端
|-- src-tauri/       Tauri v2 桌面壳和打包配置
|-- docs/            产品文档、设计稿、实现计划
|-- scripts/         开发、依赖检查、桌面打包脚本
`-- learning-output/ 本地学习产物，默认不加入 git
```

## 本地数据格式

开发模式下，学习数据默认保存在：

```text
learning-output/{session-slug}/
|-- session.json
|-- syllabus.md
|-- ai-log.jsonl
|-- {topic-name}.md
`-- summary.md
```

这些文件是 Socrate 的长期价值核心：即使离开应用，也能保留完整学习轨迹。

## 安装开发环境

基础依赖：

- Python `>=3.13`
- `uv`
- Node.js 和 npm
- LiteLLM 兼容模型 API Key

桌面端开发/打包额外需要：

- Rust toolchain
- macOS 上需要 Xcode Command Line Tools

自动安装和检查：

```bash
bash scripts/bootstrap.sh
```

包含 Tauri/Rust：

```bash
bash scripts/bootstrap.sh --tauri
```

## 开发命令

后端：

```bash
uv run uvicorn backend.main:app --reload --port 8421
uv run python -m compileall backend
```

桌面前端：

```bash
cd src
npm run dev
npm run build
npm run lint
```

H5 前端：

```bash
cd h5
npm run dev
npm run build
```

Tauri 开发：

```bash
bash scripts/tauri-dev.sh
```

Tauri 打包：

```bash
bash scripts/package-tauri.sh
```

打包脚本会：

1. 检查 Python、npm、Rust 依赖
2. 安装 Python 和前端依赖
3. 用 PyInstaller 生成自包含后端 sidecar
4. 执行 `npx tauri build`
5. 输出 `.app` 和 `.dmg`

如需使用依赖本机 `uv` / `python3` 的调试启动器：

```bash
bash scripts/package-tauri.sh --launcher-sidecar
```

## 配置

配置文件：

```text
backend/.env
```

示例文件：

```text
backend/.env.example
```

常用配置：

```bash
SOCRATE_HOST=127.0.0.1
SOCRATE_PORT=8421
SOCRATE_OUTPUT_DIR=learning-output
SOCRATE_LOG_DIR=logs
SOCRATE_LOG_LEVEL=INFO
```

上下文和生成长度：

```bash
SOCRATE_CONTEXT_WINDOW_TOKENS=1000000
SOCRATE_COMPRESSION_THRESHOLD_RATIO=0.8
SOCRATE_COMPRESSION_RECENT_MESSAGES=12
SOCRATE_COMPRESSION_MAX_TOKENS=262144
SOCRATE_QUESTIONING_MAX_TOKENS=32768
SOCRATE_SYLLABUS_MAX_TOKENS=262144
SOCRATE_REVIEW_MAX_TOKENS=65536
SOCRATE_DEEP_DIVE_MAX_TOKENS=131072
SOCRATE_SUMMARY_MAX_TOKENS=262144
```

`backend/.env` 不应提交到 git。

## API

主要后端路由：

- `GET /api/health`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/{session_id}`
- `DELETE /api/sessions/{session_id}`
- `POST /api/sessions/{session_id}/start`
- `POST /api/sessions/{session_id}/chat`
- `POST /api/sessions/{session_id}/navigate`
- `POST /api/sessions/{session_id}/back`
- `POST /api/sessions/{session_id}/overview`
- `POST /api/sessions/{session_id}/next`
- `POST /api/sessions/{session_id}/summary`
- `GET /api/settings`
- `POST /api/settings`

流式接口使用 Server-Sent Events。

## 路线图

- 更完整的大纲编辑能力
- 更稳定的桌面发布流程
- 更细粒度的模型策略
- 更丰富的学习总结和复习视图
- 更完善的 H5 部署和同步体验

## 文档

- 产品需求：`docs/PRD.md`
- H5 实现计划：`docs/H5_PLAN.md`
- 修复记录：`docs/FIX_TODOS.md`
- 设计稿和原型：`docs/design/`

## 贡献

欢迎提交 Issue 和 PR。请先阅读 `CONTRIBUTING.md`，并在提交前运行对应范围的构建或检查。

## 安全

请阅读 `SECURITY.md`。不要在公开 Issue 或 PR 中提交 API Key、私有服务器信息、用户数据或可利用漏洞细节。

## License

MIT。详见 `LICENSE`。
