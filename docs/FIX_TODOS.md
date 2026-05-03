# Socrate 修复 Todo 清单

本文档把 `docs/PRD.md` 与 `docs/design/` 对照检查后的修复计划拆成可执行 Todo。目标是先恢复最小可用学习闭环，再补齐 PRD 中 v1 必须具备的功能。

## 0. 执行原则

- [x] 每完成一个阶段都运行对应验收命令，并把失败项继续拆成 Todo。
- [x] 先修断链路，再做体验优化；视觉稿已基本接近，不作为第一优先级。
- [x] 前后端合同同步修改：后端模型、API 响应、前端类型、store 处理必须一起更新。
- [x] 涉及会话结构或文件输出时，同步检查 `learning-output/{session}/session.json` 的兼容性。
- [x] 不把 API Key 写入 Git；只验证保存/读取行为和脱敏状态。

## 1. 前端构建与静态质量

目标：项目先能通过前端构建，解除 Tauri build 的第一道阻塞。

- [x] 移除 [src/src/App.tsx](../src/src/App.tsx) 中未使用的 `clearCurrent`。
- [x] 移除或实际接线 [src/src/components/Chat/ChatView.tsx](../src/src/components/Chat/ChatView.tsx) 中未使用的 `navigateBack`、`navigateToNode`。
- [x] 移除 [src/src/components/Settings/SettingsModal.tsx](../src/src/components/Settings/SettingsModal.tsx) 中未使用的 `load`。
- [x] 移除 [src/src/stores/sessionStore.ts](../src/src/stores/sessionStore.ts) 中只赋值不使用的 `action` 变量，或把 action 纳入状态处理。
- [x] 修复 [src/src/components/Sidebar/Sidebar.tsx](../src/src/components/Sidebar/Sidebar.tsx) 中 `no-unused-expressions` 的三元副作用写法。
- [x] 给 [src/src/lib/api.ts](../src/src/lib/api.ts) 的 API 返回值补明确类型，去掉 `any`。
- [x] 给 [src/src/stores/sessionStore.ts](../src/src/stores/sessionStore.ts) 的 SSE data、action、messages 返回值补明确类型，去掉 `any`。
- [x] 给 [src/src/components/Chat/ChatView.tsx](../src/src/components/Chat/ChatView.tsx) 的 `findNode` 补明确 `SyllabusNode` 类型，去掉 `any`。
- [x] 处理空 `catch {}`：至少记录错误或设置可展示错误状态。
- [x] 处理 `react-hooks/exhaustive-deps` 警告：`App.tsx` 初始化加载函数依赖稳定化或显式说明。
- [x] 处理 `react-hooks/set-state-in-effect`：不要在 `messages.length` effect 中同步 reset `optionsHidden`，改为以消息 id/长度派生或在发送完成处重置。
- [x] 运行 `npm run build`。
- [x] 运行 `npm run lint`。

验收：

```bash
cd src
npm run build
npm run lint
```

## 2. 会话模型与 questioning 阶段持久化

目标：新建学习会话后，反向提问阶段可以保存完整上下文，刷新页面后能恢复。

- [x] 在 [backend/api/models.py](../backend/api/models.py) 的 `LearningSession` 中增加 root/questioning 对话历史字段，例如 `conversation_history: list[ChatMessage]`。
- [x] 确认旧 `session.json` 缺少新字段时仍可加载，默认空列表。
- [x] 修改 [backend/learning/phases.py](../backend/learning/phases.py) 的 `_build_history`：当没有 current node 时使用 session 级 root history。
- [x] 修改 `handle_initial_question`：把用户原始问题写入 session 级 root history，而不是依赖 `Navigator.get_current_node()`。
- [x] 修改 `_handle_questioning`：AI 反问写入 session 级 root history。
- [x] 修改 [backend/api/routes.py](../backend/api/routes.py) 的 `/api/sessions/{id}` 响应：questioning 阶段返回 session 级 root messages。
- [x] 修改 `/api/sessions/{id}/messages`：questioning 阶段返回 session 级 root messages。
- [x] 修改 `/api/sessions/{id}/chat`：questioning 阶段用户消息写入 session 级 root history。
- [x] 确保 `sessions.save(session)` 后 `updated_at` 更新，而不是 `_append_message` 绕过 `SessionManager.save` 导致时间不变。
- [x] 写一个后端 smoke 脚本或临时命令验证：create session -> start SSE -> get session 能看到用户原始问题和 AI 消息。

验收：

```bash
uv run python -m compileall backend
uv run python - <<'PY'
from fastapi.testclient import TestClient
from backend.main import app

c = TestClient(app)
r = c.post("/api/sessions", json={"question": "我想学习 Python"})
print(r.status_code, r.json()["messages"])
PY
```

## 3. SSE 错误、完成同步与中断

目标：AI 调用失败时用户能看到错误；流式完成后前端状态以服务端为准；Stop 按钮可用。

- [x] 在 [src/src/lib/types.ts](../src/src/lib/types.ts) 定义 `SSEErrorChunk`、`SSEDoneChunk`、`SSEPhaseChangeChunk`、`SSESyllabusUpdateChunk`。
- [x] 在 [src/src/stores/sessionStore.ts](../src/src/stores/sessionStore.ts) 增加 `errorMessage` 状态。
- [x] `readSSEStream` 解析 `event: error` 对应 data，不只看 `data:` 行。
- [x] `startSession` 收到 `error` 后停止 streaming，写入 `errorMessage`，不追加空 assistant message。
- [x] `sendMessage` 收到 `error` 后停止 streaming，写入 `errorMessage`，保留用户消息并允许重试。
- [x] `done` 后调用 `api.getSession(current.id)` 刷新完整 session，避免只在前端拼消息。
- [x] 给 `api.startSession` 和 `api.chat` 支持 `AbortSignal`。
- [x] store 中维护当前 `AbortController`。
- [x] [src/src/components/Chat/ChatView.tsx](../src/src/components/Chat/ChatView.tsx) 的 Stop 按钮调用 abort。
- [x] Escape 键触发 abort。
- [x] abort 后 UI 从 streaming 状态恢复，并给出“已停止生成”的轻提示。
- [x] 后端 SSE 捕获 `asyncio.CancelledError`，不写入半截 assistant message。

验收：

- [x] 临时断开 API Key 或设置错误模型，前端展示错误。
- [x] 开始 streaming 后点击 Stop，按钮可用且输入框恢复。
- [x] Stop 后刷新会话，不出现半截 AI 消息。

## 4. 大纲生成链路

目标：反向提问足够后能够稳定生成 syllabus，进入 deep dive，并正确落盘。

- [x] 确认 `QUESTIONING_PROMPT` 的 `action: "generate_syllabus"` 被 `_split_response` 稳定解析。
- [x] `_generate_syllabus` 生成后保存 `session.syllabus`。
- [x] 生成后设置 `session.current_node_id` 为第一个可学习节点。
- [x] 第一个节点状态设为 `in_progress`。
- [x] 生成后设置 `session.phase = deep_dive`。
- [x] 写入 `learning-output/{session}/syllabus.md`。
- [x] `syllabus_update` event 中返回完整 syllabus。
- [x] `phase_change` event 中明确返回 `deep_dive` 或在刷新 session 后体现。
- [x] 前端收到大纲更新后刷新完整 session。
- [x] [src/src/components/Sidebar/Sidebar.tsx](../src/src/components/Sidebar/Sidebar.tsx) 展示大纲树。
- [x] [src/src/components/MapView.tsx](../src/src/components/MapView.tsx) 展示大纲图。
- [x] [src/src/components/Chat/ChatView.tsx](../src/src/components/Chat/ChatView.tsx) 展示当前节点标题、描述、folio。
- [x] 验证生成失败时不会进入半成品 deep dive。

验收：

- [x] 浏览器新建主题，完成反问后能看到大纲。
- [x] `learning-output/{session}/syllabus.md` 存在且内容可读。
- [x] 刷新页面后大纲和当前节点仍存在。

## 5. 知识点 deep dive 链路

目标：点击任意大纲节点后进入独立对话，完成后生成对应 Markdown 笔记。

- [x] `/api/sessions/{id}/navigate` 返回目标节点 messages。
- [x] 前端点击侧边栏节点调用 navigate 并切换到 chat。
- [x] `sendMessage` 在 deep dive 阶段写入当前 node 的 `conversation_history`。
- [x] AI 回复写入当前 node 的 `conversation_history`。
- [x] `topic_complete` 后节点状态改为 `completed`。
- [x] `topic_complete` 后保存 `{topic-name}.md`。
- [x] `topic_complete` 后更新 `session.context_summary`。
- [x] `topic_complete` 后保存 session，确保刷新仍显示 completed。
- [x] 补 `/api/sessions/{id}/next` 或复用已有 `Navigator.navigate_next()` 暴露 API。
- [x] 前端“跳到下一节”快捷按钮调用 next API，而不是只把文字发给 AI。
- [x] next API 找不到下一节时返回明确状态，前端提示可生成总结。
- [x] navigate overview 应返回 root/overview messages 或至少不让 ChatView 空白崩溃。

验收：

- [x] 点击节点 A，发送消息，刷新后消息仍在节点 A。
- [x] 点击节点 B，不显示节点 A 的独立消息。
- [x] 标记完成后生成 topic markdown。
- [x] “跳到下一节”真实切换当前节点。

## 6. 总结阶段与文件输出

目标：PRD 阶段 4 可用，生成 `summary.md`。

- [x] 暴露生成总结入口，可以是顶部按钮、快捷操作或所有节点完成后的提示。
- [x] 后端增加 `/api/sessions/{id}/summary` 或在 chat action 中处理 `save_summary`。
- [x] `_handle_summary` 使用 `SUMMARY_PROMPT`，传入已学 topic 和 context summary。
- [x] summary 阶段 AI 消息写入 session 级 summary/root history。
- [x] action `save_summary` 后调用 `FilesystemMemory.save_summary_md`。
- [x] 保存后 `session.phase = summarization` 或保持 summary view 可恢复。
- [x] 前端 ChatView 渲染 summary 阶段。
- [x] 刷新后 summary 消息可恢复。

验收：

- [x] 触发总结后 `learning-output/{session}/summary.md` 存在。
- [x] 总结包含关键概念、概念关系、待深入领域、下一步建议。

## 7. 设置与 API Key 持久化

目标：设置面板保存后重启仍生效，符合 PRD 的本地 `.env` 存储要求。

- [x] 明确唯一 `.env` 位置：建议使用 [backend/.env](../backend/.env)，或迁移到项目根 `.env` 后删除歧义。
- [x] 修改 [backend/config.py](../backend/config.py) 的 `env_file`，确保实际读取目标 `.env`。
- [x] 设计 `.env` 键名：`SOCRATE_DEFAULT_MODEL`、`SOCRATE_API_KEYS` 或按 provider 拆成 `SOCRATE_OPENAI_API_KEY` 等。
- [x] 修改 Settings 解析逻辑，把 `.env` 中的 provider key 映射到 `engine.api_keys`。
- [x] 修改 `/api/settings` 保存逻辑，真实写入目标 `.env`。
- [x] 保存新 key 时保留其他 provider 既有 key。
- [x] 保存模型时写入 `.env`。
- [x] `/api/settings` 返回脱敏状态，不返回明文 key。
- [x] 设置面板保存后清空 plaintext editing key。
- [x] provider 已配置时显示 masked 状态。
- [x] 如果当前模型 provider 没有 key，chat 前返回明确错误。
- [x] README 补充 `.env` 配置位置和格式。

验收：

- [x] 在设置面板保存 key 和 model。
- [x] 重启后端后 `/api/settings` 仍显示已配置。
- [x] 错误 key/缺 key 时前端展示可理解错误。

## 8. Tauri sidecar 与桌面可运行性

目标：开发和打包桌面应用都能自动启动后端。

- [x] 保留开发模式 `scripts/dev.sh` 用于同时启动 FastAPI + Vite。
- [x] 修改 [src-tauri/src/lib.rs](../src-tauri/src/lib.rs)：开发模式可继续 `uv run`，打包模式使用 Tauri sidecar。
- [x] 使用 `tauri_plugin_shell` 或 Tauri v2 推荐方式加载 `binaries/socrate-backend`。
- [x] 去掉打包路径中硬编码的 `/Users/chenlei/Documents/...`。
- [x] 检查 [src-tauri/binaries/socrate-backend-x86_64-apple-darwin](../src-tauri/binaries/socrate-backend-x86_64-apple-darwin) 是否应为真实可执行产物，而不是依赖源码路径的 shell script。
- [x] 如果继续用 shell launcher，明确生产环境依赖，并在 README 中标注；优先改为自包含可执行。
- [x] Tauri 启动后轮询 `/api/health`，后端未 ready 时前端显示连接中。
- [x] 后端启动失败时前端显示明确错误，不是空页面。
- [x] `npm run tauri:dev` 验证。
- [x] `npm run tauri:build` 验证。

验收：

- [x] `npm run tauri:dev` 打开窗口后能新建会话。
- [x] 打包 app 启动后 `/api/health` 可用。

## 9. 会话管理与恢复

目标：首页历史会话符合 PRD，能恢复、删除、显示进度。

- [x] 首页 Past Inquiries 显示 topic、更新时间、阶段、进度。
- [x] 会话列表按 `updated_at` 倒序。
- [x] 点击会话恢复当前阶段和当前节点。
- [x] 删除会话按钮或菜单接入 `/api/sessions/{id}` DELETE。
- [x] 删除当前会话后回到 home。
- [x] 删除后本地 `learning-output/{session}` 被移除。
- [x] 会话列表 100 个 session 的加载耗时做一次简单测量。
- [x] 空列表状态设计与 design 风格一致。

验收：

- [x] 创建多个会话后列表顺序正确。
- [x] 删除会话后页面和文件系统都更新。
- [x] 刷新页面后仍可恢复之前学习状态。

## 10. 浏览器 E2E smoke

目标：用真实前端验证 PRD 最小学习闭环。

- [x] 启动后端和前端。
- [x] 打开 `http://localhost:1420`。
- [x] 输入新主题并点击 Begin。
- [x] 等待 AI 第一轮反问。
- [x] 点击一个 option。
- [x] 自定义输入一轮回答。
- [x] 继续回答直到生成大纲。
- [x] 点击侧边栏第一个节点。
- [x] 发送“举个例子”。
- [x] 点击“理解了，继续”。
- [x] 触发 topic complete。
- [x] 跳到下一节。
- [x] 生成总结。
- [x] 刷新页面，确认会话、当前节点、消息、大纲、进度仍存在。
- [x] 检查 `learning-output/{session}` 下四类文件存在。

验收文件：

- [x] `session.json`
- [x] `syllabus.md`
- [x] 至少一个 topic markdown
- [x] `summary.md`

## 11. 最终验收命令

全部修复完成后运行：

```bash
uv run python -m compileall backend
cd src && npm run build
cd src && npm run lint
curl -sS http://localhost:8421/api/health
npm run tauri:dev
npm run tauri:build
```

最终人工验收：

- [x] 首页视觉与 `docs/design` 主风格一致。
- [x] 新建学习会话完整可走通。
- [x] AI 错误可见且可重试。
- [x] 文件记忆系统真实落盘。
- [x] 重启前后 API Key、会话、进度不丢失。
- [x] 打包桌面应用不依赖源码路径。
