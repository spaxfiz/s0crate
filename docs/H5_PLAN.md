# H5 版本实现计划

## 核心思路

在项目根新建 `h5/` 作为独立的 Vite + React 项目。逻辑层（`stores`、`lib/api`、`lib/types`）**完整复用**，只重写布局组件适配移动端。后端 FastAPI 不动。

## 桌面版 → H5 的关键差异

| 桌面版 | H5 版 |
|--------|-------|
| 268px 固定侧边栏 | 底部导航 + 抽屉式面板 |
| `padding: '14px 56px'` | `padding: '12px 16px'` |
| 首页 56px 大标题 / 双列 grid | 紧凑标题 / 单列卡片 |
| 相位进度条横向 4 步 | 折叠为当前阶段 badge |
| desktop `height: 100vh` | 兼容移动端 URL bar + 安全区（`dvh`） |
| 新建会话时可选快速 / 专业模型 | 仅快速模型，不暴露选项 |
| 设置中分两组配置快速 / 专业模型 | 设置中只展示快速模型配置 |

---

## 模型分级设计

### 模型定义

| 级别 | 用途 | 典型模型示例 |
|------|------|------------|
| **快速模型**（Fast） | 日常学习对话，延迟低、成本低 | claude-haiku-4-5、gpt-4o-mini |
| **专业模型**（Pro） | 深度讲解、大纲生成，质量优先 | claude-sonnet-4-6、gpt-4o |

### 行为规则

- 默认使用快速模型
- 桌面版：新建会话时在输入框旁提供 **Fast / Pro** 切换，选择后绑定到该会话
- 桌面版设置面板：分两组分别配置快速模型和专业模型的 API Key 与型号
- **H5 版：始终使用快速模型，新建会话无选项，设置面板只展示快速模型配置**

### 涉及改动范围

**后端**
- `POST /api/sessions` 请求体新增可选字段 `model_tier: "fast" | "pro"`（默认 `"fast"`）
- `GET /api/settings` / `POST /api/settings` 响应结构区分 `fast_model` 和 `pro_model` 两组配置
- Session 元数据记录 `model_tier`，后续所有 AI 调用按此选择模型

**桌面前端**
- `lib/types.ts`：`LearningSession` 新增 `modelTier: 'fast' | 'pro'`；`SettingsResponse` 拆分为 `fastModel` / `proModel`
- `HomeView.tsx`：输入框旁加 Fast / Pro 切换 pill（默认 Fast）
- `stores/settingsStore.ts`：存储并暴露 `fastModel` / `proModel`
- `Settings/SettingsModal.tsx`：两组配置 UI

**H5 前端**
- `lib/types.ts`：同桌面，保持类型同步
- `stores/settingsStore.ts`：同桌面复用
- `HomeView.tsx`：**不渲染模型切换**，`createSession` 始终传 `model_tier: "fast"`
- `Settings/SettingsModal.tsx`：**只展示快速模型配置**，专业模型配置不可见

---

## Todo

### Phase 1 — 项目脚手架

- [ ] 创建 `h5/package.json`（依赖：react, react-dom, vite, @vitejs/plugin-react, zustand, react-markdown, remark-gfm, typescript）
- [ ] 创建 `h5/vite.config.ts`（端口 1421，`/api` proxy → `localhost:8421`）
- [ ] 创建 `h5/index.html`（含 `<meta name="viewport" content="width=device-width, initial-scale=1">`、iOS web-app meta）
- [ ] 创建 `h5/tsconfig.json`

### Phase 2 — 模型分级：后端 + 桌面前端改造（先于 H5 落地）

> 这部分改动在桌面版上实现，H5 版直接复用改造后的类型和 API。

- [ ] **后端** `POST /api/sessions`：请求体新增 `model_tier: "fast" | "pro"`（默认 `"fast"`），写入 session 元数据，AI 调用时按 tier 选模型
- [ ] **后端** `GET/POST /api/settings`：响应结构拆分为 `fast_model`（型号 + API Key）和 `pro_model`（型号 + API Key）两组
- [ ] **桌面** `src/src/lib/types.ts`：`LearningSession` 新增 `modelTier: 'fast' | 'pro'`；`SettingsResponse` 拆分为 `fastModel` / `proModel`
- [ ] **桌面** `src/src/stores/settingsStore.ts`：存储并暴露 `fastModel` / `proModel`
- [ ] **桌面** `src/src/components/HomeView.tsx`：输入框旁加 Fast / Pro 切换 pill，默认 Fast，`createSession` 带上 `model_tier`
- [ ] **桌面** `src/src/components/Settings/SettingsModal.tsx`：拆分为两组配置 UI（快速模型 / 专业模型）

### Phase 3 — 复用逻辑层（基于改造后的桌面版复制）

- [ ] `h5/src/lib/types.ts` — 从改造后的 `src/src/lib/types.ts` 复制
- [ ] `h5/src/lib/api.ts` — 从 `src/src/lib/api.ts` 复制
- [ ] `h5/src/stores/sessionStore.ts` — 从 `src/src/stores/sessionStore.ts` 复制
- [ ] `h5/src/stores/settingsStore.ts` — 从 `src/src/stores/settingsStore.ts` 复制

### Phase 4 — 设计系统

- [ ] `h5/src/index.css`：复用全部 CSS 变量（`--paper`、`--ink`、`--accent` 等）+ 移动端 reset（`safe-area-inset`、`dvh`、软键盘适配）+ 共享动画类（`.dot-pulse`、`.stream-caret`）

### Phase 5 — H5 专属组件

- [ ] **`App.tsx`** — 移动端 shell：管理 `view` 状态（home/chat）、抽屉开关、backend 健康检查重试
- [ ] **`BottomNav.tsx`** — 固定底部导航：Home · Chat · Menu 三个 Tab（含选中高亮、当前会话进度 badge）
- [ ] **`DrawerNav.tsx`** — 左侧抽屉（覆盖式，点击背景关闭）：上半会话列表 + 下半大纲树，逻辑与桌面 `Sidebar` 一致
- [ ] **`HomeView.tsx`** — 移动首页：单列布局，输入框固定在视口中部，历史会话卡片单列；**不渲染模型切换，`createSession` 始终传 `model_tier: "fast"`**
- [ ] **`ChatView.tsx`** — 全屏聊天：面包屑 compact 化（只显示最后一段）、阶段 strip 折叠为 badge、options chip 换行排列、快捷操作按钮水平滚动、输入框 sticky bottom + 软键盘 resize 适配
- [ ] **`Settings/SettingsModal.tsx`** — 底部 Sheet 形式（从底部滑入）；**只展示快速模型配置，专业模型配置不可见**

### Phase 6 — 联调验证

- [ ] `npm install` + 启动 `h5/` dev server（`vite --port 1421`）
- [ ] 验证完整流程：新建会话 → 反向提问（chip 点选）→ 大纲生成 → 知识点学习 → 生成总结
- [ ] 验证抽屉导航、节点状态同步、SSE 流式输出在移动浏览器正常工作

---

## 目录结构

```
h5/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── lib/
    │   ├── api.ts                   # 复用
    │   └── types.ts                 # 复用
    ├── stores/
    │   ├── sessionStore.ts          # 复用
    │   └── settingsStore.ts         # 复用
    └── components/
        ├── BottomNav.tsx            # H5 专属
        ├── DrawerNav.tsx            # H5 专属（替代 Sidebar）
        ├── HomeView.tsx             # H5 专属
        ├── ChatView.tsx             # H5 专属
        └── Settings/
            └── SettingsModal.tsx    # H5 专属（底部 Sheet）
```

## 工作量估计

| Phase | 内容 | 预计时间 |
|-------|------|---------|
| Phase 1 | H5 脚手架 | 20 min |
| Phase 2 | 模型分级：后端 + 桌面前端改造 | 1.5-2 h |
| Phase 3 | 复用层复制 | 10 min |
| Phase 4 | 设计系统 | 20 min |
| Phase 5 | H5 组件（ChatView 最重） | 3-4 h |
| Phase 6 | 联调验证 | 1 h |
| **合计** | | **~6-8 h** |
