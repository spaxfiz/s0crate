# Socrate — AI-Powered Learning Workspace

<p>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2f6f5e">
  <img alt="Platform: macOS" src="https://img.shields.io/badge/platform-macOS-111827">
  <img alt="Desktop: Tauri v2" src="https://img.shields.io/badge/desktop-Tauri%20v2-24c8db">
  <img alt="Backend: FastAPI" src="https://img.shields.io/badge/backend-FastAPI-009688">
  <img alt="Frontend: React + Vite" src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-646cff">
  <img alt="AI: LiteLLM" src="https://img.shields.io/badge/AI-LiteLLM-f97316">
</p>

**Socrate is a local-first AI learning workspace** that turns a single topic into a structured, navigable learning path — with AI-guided sessions, auto-generated syllabi, and durable Markdown notes saved to your machine.

> 从一个问题开始，生成一张学习地图，并把每一步沉淀成可复用的本地知识资产。

Socrate 是一个本地优先的 AI 学习工作台。它把「和 AI 聊天」升级成一套可持续的学习流程：先澄清目标，再生成大纲，围绕每个知识点逐步引导，并把学习过程沉淀为可长期保存的 Markdown 笔记。

它适合用来系统学习一个新领域、快速建立技术栈知识框架、拆解复杂课程，或把零散的 AI 问答整理成可复习、可继续推进的学习档案。

## What is Socrate?

Most AI chat tools give you a long conversation that drifts — context gets lost, topics scatter, and you can't tell where you are or what comes next.

Socrate is different: it acts as a **personal AI tutor** that first clarifies your background and goals, then generates a navigable **learning syllabus**, and guides you through each topic step by step. Everything is saved as local Markdown files you can open in Obsidian, Typora, or any editor.

**Who is it for?**

- Developers learning a new technology stack or framework
- Students structuring complex courses or curricula
- Knowledge workers building a personal second brain
- Researchers who want AI-guided deep dives with reusable notes

## Highlights

| Feature | Description |
|---|---|
| **Local-first** | Learning sessions, notes, and summaries saved as Markdown on your machine |
| **Structured learning** | Every session has a syllabus, progress tracking, and persistent context |
| **AI-guided** | Uses Socratic questioning to clarify goals before answering |
| **Durable knowledge** | Outputs work directly in Obsidian / Typora / Git workflows |
| **Desktop app** | Tauri v2 + self-contained Python sidecar — no separate install required |
| **Model-flexible** | LiteLLM backend supports OpenAI, DeepSeek, Anthropic, and more |
| **Mobile web** | Responsive H5 frontend for phone browsers |

## Tech Stack

- **Desktop shell**: [Tauri v2](https://tauri.app/) (Rust)
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) + [LiteLLM](https://github.com/BerriAI/litellm) (Python ≥ 3.13, packaged with PyInstaller)
- **Frontend**: React 18 + Vite (TypeScript)
- **AI**: Any LiteLLM-compatible provider — OpenAI, Anthropic Claude, DeepSeek, Ollama, etc.
- **Storage**: Local Markdown + JSONL files (no database required)
- **Streaming**: Server-Sent Events (SSE)

## 产品理念

大多数 AI 学习体验会停留在一条越来越长的对话里。上下文会漂移，知识点会散落，用户也很难知道自己学到哪里、下一步该学什么。

Socrate 的核心假设是：学习不应该只是回答问题，而应该是一条有地图、有节奏、有记录的路径。

因此 Socrate 会：

- 通过反问理解你的背景、目标和约束
- 根据主题生成可导航的学习大纲
- 为每个知识点维护独立对话和学习状态
- 在学习过程中保留全局上下文，避免重复和跑偏
- 把会话、大纲、笔记和总结保存到本地文件系统

## Core Features

### Socratic Onboarding

Instead of dumping a wall of text, Socrate asks 2–4 clarifying questions about your background, goals, and constraints before generating a learning plan. This is the "Socratic method" the name references.

### Structured Learning Syllabus (知识地图)

Every session generates a navigable topic tree. You can see current topic, subtopics, completion status, and jump between nodes at any time.

### Node-level Conversations (知识点级对话)

Each syllabus node maintains its own conversation context. Ask follow-up questions, request examples, or simplify explanations — then switch to another node without losing context.

### Local File Memory (本地文件记忆)

All learning data is written to local Markdown and JSON files. Drop them into Obsidian, Typora, or your own Git repository for long-term review.

### Multi-model Support (多模型支持)

Backed by LiteLLM, Socrate separates fast models (for quick Q&A) from pro models (for syllabus generation, summaries, and deep explanations). Configure any provider.

### Desktop + Mobile Web

Tauri desktop app for macOS + H5 web frontend for mobile browsers. Both share the same FastAPI backend and learning data model.

## 使用方式 / Getting Started

### Desktop App (macOS)

The macOS desktop package bundles the backend as a self-contained sidecar via Tauri. No `uv` or Python installation required on the target machine.

Example build artifact:

```text
src-tauri/target/release/bundle/dmg/Socrate_0.1.0_x64.dmg
```

App data (config, logs, learning files) is written to:

```text
~/Library/Application Support/Socrate/
```

### Local Development

Copy the environment config:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your model and API keys:

```bash
SOCRATE_DEFAULT_MODEL=deepseek/deepseek-v4-pro
SOCRATE_FAST_MODEL=deepseek/deepseek-chat
SOCRATE_PRO_MODEL=deepseek/deepseek-v4-pro
SOCRATE_API_KEYS='{"deepseek":"sk-...","openai":"sk-...","anthropic":"sk-..."}'
```

Start the development environment:

```bash
bash scripts/dev.sh
```

Open in browser:

```
http://localhost:1420
```

## Architecture

```
Desktop App / Mobile H5
        │
        │  /api/*  (HTTP + SSE)
        ▼
  FastAPI Backend
        │
        │  LiteLLM
        ▼
  AI Provider (OpenAI / DeepSeek / Anthropic / Ollama …)
        │
        ▼
  Local Markdown Files
```

Project layout:

```
socrate/
├── backend/          FastAPI API, AI engine, learning flow, file memory
├── src/              Desktop React + Vite frontend
├── h5/               Mobile React + Vite frontend
├── src-tauri/        Tauri v2 shell and packaging config
├── docs/             Product docs, design, implementation plans
├── scripts/          Dev, dependency check, packaging scripts
└── learning-output/  Local learning artifacts (gitignored by default)
```

## Local Data Format

In development mode, learning data is saved to:

```text
learning-output/{session-slug}/
├── session.json      session metadata and state
├── syllabus.md       generated learning syllabus
├── ai-log.jsonl      full AI conversation log
├── {topic-name}.md   per-topic notes
└── summary.md        session summary
```

These files are the core long-term value: even if you stop using Socrate, your complete learning history stays on your machine in plain text.

## Installation

### Prerequisites

- Python `≥ 3.13`
- `uv`
- Node.js and npm
- API key for any [LiteLLM-compatible model](https://docs.litellm.ai/docs/providers)

For desktop builds, additionally:

- Rust toolchain
- macOS: Xcode Command Line Tools

### Bootstrap

```bash
bash scripts/bootstrap.sh
```

With Tauri/Rust support:

```bash
bash scripts/bootstrap.sh --tauri
```

## Development Commands

**Backend:**

```bash
uv run uvicorn backend.main:app --reload --port 8421
uv run python -m compileall backend
```

**Desktop frontend:**

```bash
cd src
npm run dev
npm run build
npm run lint
```

**H5 frontend:**

```bash
cd h5
npm run dev
npm run build
```

**Tauri dev:**

```bash
bash scripts/tauri-dev.sh
```

**Tauri package (DMG):**

```bash
bash scripts/package-tauri.sh
```

The packaging script:
1. Checks Python, npm, Rust dependencies
2. Installs Python and frontend dependencies
3. Builds a self-contained backend sidecar with PyInstaller
4. Runs `npx tauri build`
5. Outputs `.app` and `.dmg`

For a debug launcher that depends on the host's `uv` / `python3`:

```bash
bash scripts/package-tauri.sh --launcher-sidecar
```

## Configuration

Config file: `backend/.env`  
Example: `backend/.env.example`

Common settings:

```bash
SOCRATE_HOST=127.0.0.1
SOCRATE_PORT=8421
SOCRATE_OUTPUT_DIR=learning-output
SOCRATE_LOG_DIR=logs
SOCRATE_LOG_LEVEL=INFO
```

Context window and generation length:

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

`backend/.env` should not be committed to git.

## API Reference

Main backend routes:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions/{id}` | Get session details |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `POST` | `/api/sessions/{id}/start` | Start Socratic onboarding |
| `POST` | `/api/sessions/{id}/chat` | Send a message (SSE stream) |
| `POST` | `/api/sessions/{id}/navigate` | Navigate to a syllabus node |
| `POST` | `/api/sessions/{id}/back` | Go back in the syllabus |
| `POST` | `/api/sessions/{id}/overview` | Get syllabus overview |
| `POST` | `/api/sessions/{id}/next` | Advance to next topic |
| `POST` | `/api/sessions/{id}/summary` | Generate session summary |
| `GET` | `/api/settings` | Get app settings |
| `POST` | `/api/settings` | Update app settings |

All streaming endpoints use Server-Sent Events (SSE).

## Roadmap

- More complete syllabus editing
- Smoother desktop release pipeline
- Finer-grained model routing strategy
- Richer learning summary and review views
- Better H5 deployment and sync experience

## Documentation

- Product requirements: `docs/PRD.md`
- H5 implementation plan: `docs/H5_PLAN.md`
- Fix log: `docs/FIX_TODOS.md`
- Design and prototypes: `docs/design/`

## Contributing

Issues and PRs are welcome. Please read `CONTRIBUTING.md` first and run the relevant build or lint checks before submitting.

## Security

Please read `SECURITY.md`. Do not submit API keys, private server info, user data, or exploitable vulnerability details in public issues or PRs.

## License

MIT. See `LICENSE`.
