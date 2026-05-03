# Socrate - 产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品名称
Socrate

### 1.2 产品定位
一款 AI 驱动的引导式学习桌面应用。以苏格拉底式提问法为核心，帮助用户系统化地学习任何主题。

### 1.3 核心问题
用户在使用 AI 聊天学习时面临三个痛点：
1. **上下文丢失** — 对话变长后 AI 无法回到全局视角，学习偏离初衷
2. **缺乏结构** — 知识点零散，没有系统的目录和进度追踪
3. **无法复习** — 学完即忘，没有可回顾的学习材料

### 1.4 解决方案
- AI 先反向提问，理解用户背景后生成结构化学习大纲
- 大纲以树形目录呈现，每个节点独立对话，支持自由导航
- 所有内容自动落盘为 Markdown 文件，方便日后复习
- 始终保持"我在哪里、学了什么、接下来学什么"的全局感知

---

## 2. 目标用户

| 用户类型 | 场景 |
|---------|------|
| 自学者 | 想系统学习一个新领域，但不知道从哪开始 |
| 开发者 | 需要快速掌握某个技术栈或框架 |
| 学生 | 课程学习中需要 AI 辅助理解复杂概念 |
| 终身学习者 | 对任何话题感兴趣，希望深度而非碎片化地学习 |

---

## 3. 用户旅程

### 3.1 完整学习流程

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  用户提问    │ ──→ │ AI 反向提问   │ ──→ │ 生成学习大纲  │ ──→ │ 逐个深入学习  │
│ "我想学ML"  │     │ "你的基础?"  │     │ [树形目录]    │     │ [流式讲解]    │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                            ┌─────────┴─────────┐
                                                            ↓                   ↓
                                                     ┌──────────────┐    ┌──────────────┐
                                                     │  继续下一节   │    │  学习总结     │
                                                     │ [导航到下一个] │    │ [知识点回顾]  │
                                                     └──────────────┘    └──────────────┘
```

### 3.2 详细交互流程

**阶段 1：提问与反向提问**
1. 用户输入想学习的主题（如"我想学习机器学习"）
2. AI 返回结构化 JSON：一个问题 + 2-4 个可点击选项
3. 用户点击选项或自由输入回答
4. 经过 2-4 轮对话，AI 认为信息足够
5. AI 返回 `action: "generate_syllabus"`，前端识别后触发大纲生成

**阶段 2：生成学习大纲**
1. AI 根据用户背景生成结构化大纲（JSON 格式）
2. 后端解析大纲为树形数据结构
3. 前端侧边栏渲染大纲目录树
4. 同时生成 `syllabus.md` 文件落盘
5. AI 用自然语言向用户介绍学习计划，建议从哪里开始

**阶段 3：逐个知识点深入**
1. 用户点击目录树中的某个节点（或 AI 建议的下一个节点）
2. 进入该知识点的独立对话空间
3. AI 根据知识点内容进行苏格拉底式讲解，返回结构化 JSON（content + options）
4. 用户点击选项或自由输入追问
5. AI 定期通过选项确认理解程度，询问是否继续深入或跳到下一个
6. 知识点学完后，AI 返回 `action: { type: "topic_complete" }`
7. 该节点状态变为"已完成"，生成对应的 `.md` 文件
8. 用户可以回到大纲选择下一个知识点，或继续深入

**阶段 4：学习总结**
1. 用户主动触发"生成总结"（或所有知识点完成后提示）
2. AI 汇总所有已学内容，生成结构化知识总结
3. 总结包含：关键概念、概念间关系、待深入领域、下一步建议
4. 总结内容落盘为 `summary.md`

---

## 4. 功能需求

### 4.1 核心功能

#### F1: 新建学习会话
- 用户在首页输入想学习的主题
- 系统创建新会话，进入"反向提问"阶段
- 会话持久化到本地文件系统

#### F2: AI 反向提问
- AI 根据用户的问题，提出 1 个背景了解问题
- 每个问题附带 2-4 个可点击选项 + 自定义输入
- AI 返回结构化 JSON（content + options + action）
- 用户点击选项或自由输入回答
- 经过 2-4 轮后，AI 返回 action: "generate_syllabus" 触发大纲生成

#### F3: 学习大纲生成与展示
- AI 根据主题实际复杂度生成大纲，不人为凑数
- 简单主题可能只有 1-2 个节点，复杂主题可以有 5-6 个节点
- 最大深度 3 层，但大多数主题 1-2 层足够
- 侧边栏以树形目录展示，每个节点显示状态（待学习/进行中/已完成）
- 大纲可编辑（用户可以调整顺序、删除、添加节点）— v2 实现

#### F4: 知识点深入学习
- 点击大纲节点进入该知识点的对话空间
- AI 进行流式讲解，支持 Markdown 渲染
- 每个知识点有独立的对话历史
- 支持追问、请求举例、要求简化解释等

#### F5: 导航系统
- **面包屑导航**：始终显示当前位置路径（首页 > 主题 > 子主题）
- **返回上级**：点击面包屑任意节点跳转
- **回到总览**：一键回到大纲根节点
- **下一个**：跳到同级的下一个未学知识点
- 切换知识点时，当前对话历史保留，回来后可以继续

#### F6: 流式交互
- AI 响应以流式方式逐字输出
- 输出过程中实时渲染 Markdown（标题、列表、代码块、表格等）
- 输出过程中显示"正在思考..."的动画
- 用户可以按 Escape 中断当前输出

#### F7: 文件记忆系统
- 每个会话生成一个独立目录：`learning-output/{session-slug}/`
- 目录下包含：
  - `session.json` — 会话元数据和状态
  - `syllabus.md` — 学习大纲（人类可读的 Markdown）
  - `{topic-name}.md` — 每个知识点的学习笔记
  - `summary.md` — 学习总结（阶段 4 生成）
- 文件格式规范，可直接用 Obsidian/Typora 等工具阅读

#### F8: 多 AI 供应商支持
- 通过 LiteLLM 统一接口，支持：
  - Anthropic (Claude)
  - OpenAI (GPT-4o)
  - Google (Gemini)
- 设置面板中配置 API Key 和选择供应商
- API Key 存储在本地 `.env` 文件，不上传

#### F9: 会话管理
- 首页显示所有历史学习会话列表
- 每个会话显示：主题名、创建时间、学习进度（已完成/总数）
- 点击会话恢复之前的进度，继续学习
- 支持删除会话

#### F10: 学习上下文记忆
- 跨知识点的上下文感知：AI 在教新知识点时知道用户已经学了什么
- 每个知识点学完后，AI 自动更新 `context_summary`
- `context_summary` 作为额外上下文传入后续的 AI 调用
- 避免重复讲解已学内容

---

### 4.2 界面需求

#### UI1: 整体布局
```
┌─────────────────────────────────────────────────────────┐
│  Socrate                              [设置] [新会话]    │
├──────────┬──────────────────────────────────────────────┤
│          │  面包屑: 会话名 > 主题 > 子主题               │
│  会话列表 ├──────────────────────────────────────────────┤
│          │                                              │
│  ──────  │         对话/内容区域                         │
│          │         (流式 Markdown 渲染)                  │
│  大纲树   │                                              │
│  ├─ 主题1 │                                              │
│  │ ├─子1  │                                              │
│  │ └─子2  │                                              │
│  ├─ 主题2 │──────────────────────────────────────────────┤
│  └─ 主题3 │  [输入框]                           [发送]   │
├──────────┴──────────────────────────────────────────────┤
│  状态栏: 当前阶段 | AI 供应商 | 连接状态                 │
└─────────────────────────────────────────────────────────┘
```

#### UI2: 侧边栏
- 上半部分：会话列表（可折叠）
- 下半部分：当前会话的大纲树
- 大纲树节点颜色/图标表示状态：
  - 灰色圆点 = 待学习
  - 蓝色圆点 + 脉冲动画 = 进行中
  - 绿色勾 = 已完成
- 点击节点跳转到该知识点

#### UI3: 对话区域
- 消息气泡样式：用户消息靠右，AI 消息靠左
- AI 消息支持完整 Markdown 渲染：
  - 标题层级 (h1-h4)
  - 有序/无序列表
  - 代码块（带语法高亮）
  - 表格
  - 加粗/斜体/行内代码
  - LaTeX 数学公式（v2）
- 流式输出时，Markdown 实时渲染，不出现原始标记

#### UI4: 输入区域
- 多行文本输入框，支持 Shift+Enter 换行
- Enter 发送（可配置为 Ctrl+Enter）
- 发送按钮
- 流式输出中显示"停止"按钮

#### UI4.1: 选项交互 (Options/Chips)
- AI 返回结构化 JSON，前端直接渲染 `options` 数组为可点击按钮
- 按钮显示在消息气泡下方，与气泡有视觉关联
- 用户点击按钮 → 将 `value` 作为用户消息发送
- `type: "custom"` 的按钮点击后聚焦到输入框，让用户自由输入
- 用户发送消息后（点击或手动输入），当前消息的选项按钮消失
- 知识点学习阶段，输入框上方常驻快捷操作栏：
  - [理解了，继续] [举个例子] [深入原理]
  - 点击后发送预设文本
- 选项按钮样式：圆角胶囊型，主题色边框，hover 时加深

#### UI5: 设置面板
- 模态框形式
- AI 供应商选择（下拉框）
- 对应供应商的 API Key 输入
- 默认模型选择
- 主题切换（深色/浅色）— v2

---

## 5. 非功能需求

### 5.1 性能
- AI 流式输出首字延迟 < 2 秒
- 前端切换知识点（导航）响应时间 < 100ms
- 会话列表加载（含 100 个会话）< 500ms

### 5.2 可靠性
- 会话数据自动持久化，异常退出不丢失
- AI API 调用失败时显示错误提示，支持重试
- 网络断开时可查看已加载的内容和大纲

### 5.3 安全性
- API Key 仅存储在本地 `.env` 文件
- API Key 在设置面板中显示为 `sk-****...xxxx` 脱敏形式
- 不收集任何用户数据

### 5.4 可扩展性
- AI 供应商可扩展（LiteLLM 支持 100+ 模型）
- 记忆系统可从文件系统升级为向量数据库（v2）
- 大纲可从只读升级为可编辑（v2）

---

## 6. 技术架构

### 6.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 桌面壳 | Tauri v2 | 轻量、原生、~10MB 打包体积 |
| 前端 | React + TypeScript + Vite | 现代前端工具链 |
| UI 框架 | Tailwind CSS + Lucide Icons | 原子化 CSS + 图标库 |
| 状态管理 | Zustand | 轻量、无 boilerplate |
| Markdown | react-markdown + remark-gfm + rehype-highlight | 流式 MD 渲染 |
| 后端 | Python FastAPI | 异步、SSE 原生支持 |
| AI 集成 | LiteLLM | 统一多供应商接口 |
| 流式传输 | SSE (Server-Sent Events) | 单向流、简单可靠 |
| 持久化 | JSON + Markdown 文件 | 人类可读、可移植 |
| 包管理 | uv (Python) + npm (Node.js) | 快速、确定性安装 |

### 6.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Tauri 桌面窗口                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React 前端 (WebView)                     │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐             │   │
│  │  │ Sidebar │  │ ChatPanel│  │ Settings│             │   │
│  │  └────┬────┘  └────┬─────┘  └────┬────┘             │   │
│  │       │            │              │                   │   │
│  │  ┌────┴────────────┴──────────────┴────┐             │   │
│  │  │          Zustand Store              │             │   │
│  │  └────────────────┬────────────────────┘             │   │
│  └───────────────────┼──────────────────────────────────┘   │
│                      │ HTTP / SSE                            │
│  ┌───────────────────┼──────────────────────────────────┐   │
│  │         Python FastAPI 后端 (Sidecar)                 │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐         │   │
│  │  │ Routes  │  │ AI Engine│  │ Session Mgr │         │   │
│  │  └────┬────┘  └────┬─────┘  └──────┬──────┘         │   │
│  │       │            │               │                  │   │
│  │  ┌────┴────┐  ┌────┴─────┐  ┌─────┴──────┐          │   │
│  │  │  SSE    │  │ LiteLLM  │  │  Navigator │          │   │
│  │  └─────────┘  └────┬─────┘  └────────────┘          │   │
│  │                    │                                  │   │
│  │         ┌──────────┴──────────┐                      │   │
│  │         │  File System Memory │                      │   │
│  │         │  (MD + JSON files)  │                      │   │
│  │         └─────────────────────┘                      │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐     │   │
│  │  │  大纲 Agent Loop (审查 → 修改 → 重生成)      │     │   │
│  │  │  ┌──────────┐   ┌──────────┐   ┌────────┐  │     │   │
│  │  │  │ 生成Agent│──→│ 审查Agent│──→│ 通过？  │  │     │   │
│  │  │  └────┬─────┘   └──────────┘   └───┬────┘  │     │   │
│  │  │       │                        是  │  否   │     │   │
│  │  │       │                         ↓    ↓     │     │   │
│  │  │       │                      展示  注入建议│     │   │
│  │  │       │                            重试    │     │   │
│  │  │       └────────────────────────────┘      │     │   │
│  │  └─────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                        │
         ↓                        ↓
  ┌──────────────┐    ┌─────────────────────┐
  │ AI Providers │    │ learning-output/     │
  │ Anthropic    │    │ {session}/           │
  │ OpenAI       │    │   session.json       │
  │ Google       │    │   syllabus.md        │
  └──────────────┘    │   topic-1.md         │
                      │   summary.md         │
                      └─────────────────────┘
```

### 6.3 数据模型

```python
# 学习阶段枚举
LearningPhase = "questioning" | "syllabus" | "deep_dive" | "summarization"

# 节点状态枚举
NodeStatus = "pending" | "in_progress" | "completed"

# 大纲节点
SyllabusNode:
  id: str                    # UUID
  title: str                 # 节点标题
  description: str           # 节点描述（1-2句话）
  depth: int                 # 深度（0=顶层）
  order: int                 # 同级排序
  status: NodeStatus         # 状态
  children: list[SyllabusNode]  # 子节点
  file_path: str | None      # 对应的 MD 文件路径
  conversation_history: list[dict]  # 该节点的对话历史

# 学习会话
LearningSession:
  id: str                    # UUID
  name: str                  # 人类可读名称
  slug: str                  # 文件系统安全的名称
  original_question: str     # 用户最初的问题
  created_at: datetime
  updated_at: datetime
  phase: LearningPhase       # 当前阶段
  syllabus: SyllabusNode     # 大纲树（根节点）
  current_node_id: str       # 当前所在节点
  context_summary: str       # 跨知识点的上下文摘要

# 对话消息
ChatMessage:
  role: "user" | "assistant" | "system"
  content: str                # 文本内容（Markdown 格式）
  timestamp: datetime
  node_id: str | None         # 所属知识点节点
  options: list[ChatOption] | None  # AI 提供的可点击选项

# 选项（AI 结构化输出的一部分）
ChatOption:
  label: str                  # 按钮显示文本（简短）
  value: str                  # 点击后发送给 AI 的完整文本
  type: "default" | "custom"  # custom = 自定义输入引导

# 大纲审查结果
ReviewResult:
  verdict: "pass" | "fail"    # 是否通过
  score: int                  # 0-100 质量分
  issues: list[ReviewIssue]   # 问题列表
  summary: str                # 总体评价

ReviewIssue:
  type: "bloat" | "depth" | "coverage" | "order" | "granularity"
  severity: "critical" | "warning"
  location: str               # 问题节点路径
  description: str            # 问题描述
  suggestion: str             # 修改建议
```

**TypeScript 前端类型 (`src/lib/types.ts`)：**

```typescript
type LearningPhase = "questioning" | "syllabus" | "deep_dive" | "summarization";
type NodeStatus = "pending" | "in_progress" | "completed";

interface ChatOption {
  label: string;         // 按钮显示文本
  value: string;         // 点击后发送的文本
  type: "default" | "custom";
}

interface SyllabusNode {
  id: string;
  title: string;
  description: string;
  depth: number;
  order: number;
  status: NodeStatus;
  children: SyllabusNode[];
  filePath: string | null;
}

interface LearningSession {
  id: string;
  name: string;
  slug: string;
  originalQuestion: string;
  createdAt: string;
  updatedAt: string;
  phase: LearningPhase;
  syllabus: SyllabusNode | null;
  currentNodeId: string | null;
  contextSummary: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  nodeId: string | null;
  options: ChatOption[] | null;
}

// AI 返回的结构化响应
interface AIResponse {
  content: string;       // Markdown 文本
  options: ChatOption[] | null;
  action: {
    type: string;        // "generate_syllabus" | "topic_complete" | "save_summary" | null
    payload: Record<string, unknown>;
  } | null;
}

// SSE 流式事件
interface SSEChunk {
  type: "token" | "done" | "error" | "phase_change" | "syllabus_update";
  content: string;
  options?: ChatOption[];
  metadata?: Record<string, unknown>;
}

// 大纲审查结果
interface ReviewIssue {
  type: "bloat" | "depth" | "coverage" | "order" | "granularity";
  severity: "critical" | "warning";
  location: string;
  description: string;
  suggestion: string;
}

interface ReviewResult {
  verdict: "pass" | "fail";
  score: number;
  issues: ReviewIssue[];
  summary: string;
}
```

### 6.4 API 设计

```
REST Endpoints:
  POST   /api/sessions              — 创建会话
  GET    /api/sessions              — 列出会话
  GET    /api/sessions/{id}         — 获取会话详情
  DELETE /api/sessions/{id}         — 删除会话
  POST   /api/sessions/{id}/chat    — 发送消息（返回 SSE 流）
  POST   /api/sessions/{id}/navigate — 跳转到节点
  POST   /api/sessions/{id}/back    — 返回上级
  POST   /api/sessions/{id}/overview — 回到总览
  GET    /api/sessions/{id}/messages — 获取当前节点消息
  GET    /api/settings              — 获取设置
  POST   /api/settings              — 保存设置
  GET    /api/health                — 健康检查

SSE Events:
  token         — 流式文本片段
  done          — 完成（含完整响应 + 结构化选项）
  phase_change  — 阶段切换
  syllabus_update — 大纲更新
  error         — 错误

AI 响应结构（done 事件的 data）:
  {
    "type": "done",
    "content": "AI 的 Markdown 文本内容...",
    "options": [
      { "label": "完全没有", "value": "完全没有，从零开始", "type": "default" },
      { "label": "学过一些", "value": "学过一些基础", "type": "default" },
      { "label": "有经验", "value": "有较多经验，想深入", "type": "default" },
      { "label": "自定义", "value": "", "type": "custom" }
    ],
    "metadata": {
      "phase": "questioning",
      "action": null
    }
  }
```

---

## 7. 文件输出规范

### 7.1 大纲文件 (`syllabus.md`)

```markdown
# 学习计划：机器学习入门

> 为初学者定制的学习路径，从数学基础到实际应用。

## 1. 数学基础
线性代数、微积分和概率论——机器学习的数学地基。

### 1.1 线性代数
向量、矩阵运算、特征值与矩阵分解。

### 1.2 微积分
导数、梯度与优化基础。

### 1.3 概率与统计
分布、贝叶斯定理与统计推断。

## 2. 监督学习
从标注数据中学习预测。

### 2.1 线性回归
...
```

### 7.2 知识点文件 (`{topic-name}.md`)

```markdown
# 线性代数基础

> 学习日期：2026-05-03
> 学习计划：机器学习入门

## 核心概念

### 向量与矩阵
[AI 讲解内容...]

### 特征值与特征向量
[AI 讲解内容...]

## 探讨的问题

- 什么是特征值？为什么它在 PCA 中很重要？
- 矩阵乘法和线性变换的关系是什么？

## 要点总结

- 向量是机器学习中数据的基本表示形式
- 矩阵分解（如 SVD）是降维技术的数学基础
- 特征值反映了变换的主要方向和缩放比例
```

### 7.3 总结文件 (`summary.md`)

```markdown
# 学习总结：机器学习入门

> 学习日期：2026-05-03
> 已完成：5/8 个知识点

## 学习路径回顾

1. **数学基础** — 建立了线性代数、微积分和概率论的基础
2. **监督学习** — 学习了回归和分类的核心算法
3. ...

## 关键概念

| 概念 | 描述 | 相关知识点 |
|------|------|-----------|
| 梯度下降 | 通过迭代优化损失函数 | 微积分、线性回归 |
| 过拟合 | 模型在训练集表现好但泛化差 | 正则化 |
| ... | ... | ... |

## 待深入领域

- 深度学习（未覆盖）
- 强化学习（未覆盖）
- 特征工程实践

## 下一步建议

1. 动手实现一个简单的线性回归
2. 学习 scikit-learn 框架
3. 完成 Kaggle 入门竞赛
```

---

## 8. AI Prompt 设计

### 8.0 苏格拉底式教学原则

所有阶段的 Prompt 都遵循以下核心原则：

1. **引导而非灌输** — 不直接给出答案，而是通过问题引导用户自己思考和发现
2. **追问深入** — 在用户回答后，追问"为什么你这么认为？""还有其他可能吗？"来推动更深层的思考
3. **提供选项 + 开放回答** — 每次提问都给出 2-4 个预设选项供用户快速选择，同时支持用户自由输入，降低决策负担的同时不限制表达
4. **适时启发** — 当用户卡住时，给出提示或类比而非直接解答
5. **确认理解** — 用"你能用自己的话解释一下吗？"来验证真正理解而非表面记忆

### 8.0.1 模型参数设计

所有 AI 调用使用统一的参数配置，以确保教学的严谨性和一致性：

| 参数 | 值 | 说明 |
|------|---|------|
| temperature | 0 | 确保输出确定、一致、可复现，避免随机发挥和"幻觉" |
| top_p | 1.0 | 不额外限制采样（temperature=0 时已保证确定性） |
| max_tokens | 4096 | 单次响应上限，防止过长输出；总结阶段可适当提高 |
| frequency_penalty | 0 | 教学场景中重复关键词是可接受的 |
| presence_penalty | 0 | 保持聚焦，不鼓励偏离主题的发散 |

**设计理由：**
- **temperature=0** 是教学场景的核心要求：AI 应该给出准确、一致的知识讲解，而不是"创意写作"。同一个问题问两次，答案应该相同。
- **不使用 top_k 限制**：temperature=0 时模型已经选择概率最高的 token，额外的 top_k 限制没有意义。
- **max_tokens 控制输出长度**：避免 AI 一次性输出过多内容导致用户信息过载。流式输出场景下，前端可以随时中断。

**阶段差异化参数：**

| 阶段 | temperature | max_tokens | 说明 |
|------|------------|------------|------|
| 反向提问 | 0 | 512 | 问题简短、精准 |
| 大纲生成 | 0 | 8192 | 大纲 JSON 可能较长 |
| 大纲审查 | 0 | 4096 | 审查报告，输出结构化 JSON |
| 知识点讲解 | 0 | 4096 | 分段讲解，每次一个概念 |
| 学习总结 | 0 | 8192 | 总结需要覆盖所有内容 |

### 8.1 阶段 1：反向提问 Prompt

```
你是 Socrate，一位以苏格拉底式教学法为核心的引导式学习助手。

用户向你提出了学习需求。你的任务不是立刻开始教学，而是通过提问来真正理解用户。

你需要了解：
1. 用户当前的知识水平
2. 用户具体想学什么、想达到什么能力
3. 学习场景（学术、职业、个人兴趣）
4. 用户更关心哪些方面

输出格式要求：
你必须严格以 JSON 格式回复，不要输出任何 JSON 之外的文本。
JSON 结构如下：

{
  "content": "你的问题文本（Markdown 格式）",
  "options": [
    { "label": "选项简短标签", "value": "点击后发送给AI的完整文本", "type": "default" },
    { "label": "选项简短标签", "value": "点击后发送给AI的完整文本", "type": "default" },
    { "label": "自定义", "value": "", "type": "custom" }
  ],
  "action": null
}

提问规则：
- content 中每次最多提出 1 个问题
- options 中提供 2-4 个预设选项
- 最后一个选项的 type 必须是 "custom"，表示用户可以输入自定义内容
- label 要简短（2-6 个字），适合做按钮
- value 是用户选择后发送给你的完整回答文本
- 根据用户的选择或自定义回答，调整下一个问题
- 语气温暖、鼓励、好奇
- 经过 2-4 轮提问后，你将有足够的信息生成学习大纲

当你认为信息充分时，设置 action 为 "generate_syllabus"，并提供用户需求总结：
{
  "content": "我理解了你的需求：...",
  "options": [],
  "action": "generate_syllabus"
}
```

**前端交互要求：**
- AI 返回的 JSON 中，`content` 渲染为 Markdown 消息气泡
- `options` 渲染为消息气泡下方的可点击按钮
- `type: "custom"` 的按钮点击后聚焦到输入框，让用户自由输入
- 用户点击按钮或输入文本后，选项按钮消失
- 消息气泡和选项按钮需要有视觉关联（选项在气泡下方，有连接线或共享背景色）

**示例交互流程：**

```
[消息气泡] 你之前有编程经验吗？
[按钮组]  [完全没有] [学过一些] [有经验] [自定义...]

用户点击 → [学过一些]

[消息气泡] 好的，你有一些基础了。那你希望学到什么程度呢？
[按钮组]  [理解概念] [做项目] [深入原理] [自定义...]

用户点击 → [做项目]

[消息气泡] 明白了。你更偏好哪种学习方式？
[按钮组]  [理论优先] [实践优先] [穿插进行] [自定义...]

用户点击 → [实践优先]

[消息气泡] 我理解了你的需求：
- 有编程基础
- 希望能动手做项目
- 偏好实践驱动的学习方式

我来为你制定一个以项目为导向的学习计划...
(无选项按钮，action=generate_syllabus 触发大纲生成)
```

### 8.2 阶段 2：大纲生成 Prompt

```
你是 Socrate，引导式学习助手。

根据用户的学习背景，生成结构化学习大纲。

生成规则：
1. 一级主题数量根据实际内容决定，不人为凑数（通常 2-6 个，简单主题可能只有 1-2 个）
2. 子主题数量同理，有多少拆多少，不要为了"看起来完整"而强行填充
3. 层级深度按实际需要，最大 3 层但绝大多数主题 1-2 层就够了
   - 一个简单的概念不需要三层嵌套
   - 一个复杂的概念可以适当多拆几层
4. 每个节点有清晰标题和 1-2 句描述
5. 从基础到进阶排列
6. 根据用户水平和目标定制深度和广度
7. 如果用户偏好实践驱动，增加更多动手项目节点
8. 如果用户偏好理论优先，增加更多原理讲解节点

**核心约束：大纲结构必须忠于内容本身的复杂度，而非机械地满足数字指标。**
- 简单主题：1-2 个一级节点，少量子节点，1 层深度即可
- 中等主题：3-4 个一级节点，适度子节点，1-2 层深度
- 复杂主题：5-6 个一级节点，丰富子节点，最多 3 层深度
- 判断标准：如果一个子节点只有一句话就能讲清楚，它可能不需要单独成为一个节点

输出格式要求：
你必须严格以 JSON 格式回复。大纲数据放在 action 的 payload 中：

{
  "content": "用苏格拉底式的方式向用户介绍学习计划的 Markdown 文本。解释为什么这样安排，让用户理解学习路径的逻辑。",
  "options": [
    { "label": "从第一个开始", "value": "从第一个主题开始学习", "type": "default" },
    { "label": "调整顺序", "value": "我想调整一下学习顺序", "type": "default" },
    { "label": "自定义", "value": "", "type": "custom" }
  ],
  "action": {
    "type": "syllabus_generated",
    "payload": {
      "syllabus": [
        {
          "title": "主题标题",
          "description": "主题描述",
          "children": [
            { "title": "子主题标题", "description": "子主题描述", "children": [] }
          ]
        }
      ]
    }
  }
}

苏格拉底式介绍：
- 不要只是罗列大纲，而是解释为什么这样安排
- 问用户觉得顺序是否合理
- 给用户建议的起始点
```

### 8.2.1 大纲质量检验 — 对抗性审查 Agent

大纲生成后，不直接展示给用户，而是先经过一个独立的"审查 Agent"进行对抗性检验。审查不通过则返回修改建议，由生成 Agent 重新生成，形成 Agent Loop。

**流程图：**

```
生成 Agent ──大纲JSON──→ 审查 Agent
    ↑                        │
    │                   通过？├── 是 → 展示给用户
    │                        │
    │                        └── 否 → 返回修改建议
    │                                    │
    └──────────── 修改建议 ←──────────────┘
```

**审查 Agent Prompt：**

```
你是一位严格的学习大纲审查员。你的任务是对一份学习大纲进行对抗性质量检验。

你会收到：
1. 用户的学习需求和背景
2. AI 生成的学习大纲（JSON 格式）

你需要逐项检查以下问题，输出审查报告：

检查项：

1. **膨胀检测** — 是否存在为了凑数量而生成的低质量节点？
   - 节点描述是否只有一句话、缺乏实质内容？
   - 是否存在"了解XX""认识XX"这类同义重复的节点？
   - 子节点数量是否明显超过内容本身的需要？

2. **深度检测** — 层级嵌套是否合理？
   - 叶子节点（最底层）是否真的需要单独讲解？如果一句话就能说清楚，就不该独立成节点
   - 是否存在"假深度"——为了达到 3 层而强行嵌套？

3. **覆盖度检测** — 大纲是否覆盖了用户的核心需求？
   - 用户明确提到的学习目标是否有对应节点？
   - 用户的水平和偏好是否被反映在大纲中？
   - 是否遗漏了必要的前置知识？

4. **顺序检测** — 知识点的排列顺序是否合理？
   - 是否存在前置依赖被排在后面的情况？
   - 从基础到进阶的递进是否自然？

5. **粒度一致性** — 同一层级的节点粒度是否大致一致？
   - 是否存在有的节点很细（子节点很多）而有的节点很粗（没有子节点）的情况？
   - 粒度差异是否合理（因为内容复杂度不同）还是随意的？

输出格式要求：
你必须严格以 JSON 格式回复：

{
  "verdict": "pass" | "fail",
  "score": 0-100,
  "issues": [
    {
      "type": "bloat" | "depth" | "coverage" | "order" | "granularity",
      "severity": "critical" | "warning",
      "location": "具体的节点路径，如 '主题2 > 子主题3'",
      "description": "问题描述",
      "suggestion": "具体修改建议"
    }
  ],
  "summary": "总体评价（一句话）"
}

判定规则：
- 存在任何 critical 级别的 issue → verdict = "fail"
- 所有 issue 都是 warning → verdict = "pass"（附带改进建议）
- 无 issue → verdict = "pass"

注意：你的职责是挑毛病，不是表扬。宁可误判为 fail（让生成 Agent 重做）也不要放过低质量的大纲。
```

**Agent Loop 机制：**

```
function generateSyllabusWithReview(userContext, maxRetries=3):
    for attempt in range(maxRetries):
        # Step 1: 生成大纲
        syllabusJson = ai.complete(SYLLABUS_PROMPT, userContext)

        # Step 2: 审查大纲
        reviewResult = ai.complete(REVIEW_PROMPT, {
            user_context: userContext,
            syllabus: syllabusJson
        })

        # Step 3: 判断结果
        if reviewResult.verdict == "pass":
            return syllabusJson  # 通过，展示给用户

        # Step 4: 不通过，将修改建议注入下一轮生成
        userContext = userContext + "\n\n[审查反馈] 上一次生成的大纲有以下问题，请修正：\n"
        for issue in reviewResult.issues:
            userContext += f"- [{issue.severity}] {issue.location}: {issue.suggestion}\n"

    # 超过最大重试次数，使用最后一次生成的结果，附带审查报告
    return syllabusJson, reviewResult
```

**关键设计决策：**

1. **审查 Agent 独立于生成 Agent** — 用不同的 system prompt 甚至不同的模型，避免"自我审查"的盲区
2. **审查是对抗性的** — 审查 Agent 的默认立场是"挑毛病"，而非"找优点"
3. **修改建议注入重试** — 审查不通过时，修改建议作为额外上下文注入下一次生成，让生成 Agent 知道要修什么
4. **最大重试 3 次** — 避免无限循环。3 次都不通过则使用最后一次结果，附带审查报告让用户知晓
5. **用户无感** — 审查过程对用户透明，用户只看到最终的大纲。如果多次重试，可以在 UI 上显示"正在优化学习计划..."

**前端交互：**
- 审查过程中，消息气泡显示 "正在为你制定学习计划..." + 加载动画
- 如果审查需要多次重试，显示 "正在优化学习计划..."（不暴露审查细节）
- 审查通过后，展示大纲和苏格拉底式介绍

### 8.3 阶段 3：知识点讲解 Prompt

```
你是 Socrate，引导式学习助手。你正在教授用户一个具体的知识点。

当前主题：{topic_title}
主题描述：{topic_description}
父级上下文：{parent_context}
用户学习背景：{user_context}
已学内容摘要：{context_summary}

输出格式要求：
你必须严格以 JSON 格式回复，不要输出任何 JSON 之外的文本：
{
  "content": "你的教学内容（Markdown 格式）",
  "options": [
    { "label": "选项标签", "value": "点击后发送的文本", "type": "default" },
    { "label": "自定义", "value": "", "type": "custom" }
  ],
  "action": null
}

苏格拉底式教学指南：

1. **先问后讲** — 开始前先问用户对这个主题已有什么了解：
   content: "在我们开始之前，你对{topic}有什么了解吗？"
   options: [{label:"有一定了解"}, {label:"听说过"}, {label:"完全不了解"}, {label:"自定义"}]

2. **引导思考** — 用问题引导用户自己发现规律：
   - "你觉得为什么会这样？"
   - "如果换成X情况，结果会怎样？"
   - 给出 2-3 个可能的答案选项 + 自定义

3. **分层讲解** — 先给直觉，再给细节，最后给原理：
   - 第一层：用类比和例子建立直觉
   - 第二层：讲解具体机制和用法
   - 第三层：深入数学原理或底层实现（仅当用户选择深入时）

4. **具体化** — 用用户熟悉的事物做类比，而不是抽象解释

5. **定期检查** — 每讲完一个子概念，提供选项：
   options 常见值:
   - {label:"理解了，继续", value:"我理解了，请继续下一个部分"}
   - {label:"再举个例子", value:"能再举一个具体的例子吗？"}
   - {label:"深入原理", value:"我想深入了解一下背后的原理"}
   - {label:"和X的关系", value:"这个和之前学的{X}有什么关系？"}

6. **总结回顾** — 讲完主题后：
   - content 中先给出要点总结
   - options 中包含确认理解的选项
   - 当用户确认理解后，设置 action:

{
  "content": "要点总结...",
  "options": [{label:"开始下一个主题", value:"开始下一个主题"}, {label:"还有疑问", value:"我还有些疑问"}],
  "action": { "type": "topic_complete", "payload": { "node_id": "{current_node_id}" } }
}
```

**前端交互要求：**
- `options` 渲染为消息气泡下方的可点击按钮
- 知识点学习阶段，输入框上方常驻快捷按钮：[理解了，继续] [举个例子] [深入原理]
- 快捷按钮点击后发送对应的 value 文本
- `type: "custom"` 的按钮点击后聚焦输入框

### 8.4 阶段 4：总结 Prompt

```
你是 Socrate，引导式学习助手。

用户完成了学习，现在需要生成知识总结。

已学主题：{topics_covered}
对话历史摘要：{history_highlights}

输出格式要求：
你必须严格以 JSON 格式回复：
{
  "content": "总结内容（Markdown 格式）",
  "options": [...],
  "action": { "type": "save_summary", "payload": {} }
}

苏格拉底式总结方法：

1. **先让用户回顾** — 在生成总结前，先问用户：
   content: "在我们总结之前，你觉得这次学习最重要的收获是什么？"
   options: 给出 2-4 个从学习内容中提取的关键概念选项 + 自定义
   用用户的回答来校准总结的重点

2. **生成总结** — 基于用户的回顾和对话历史：
   - 将所学组织成连贯的叙述
   - 突出关键概念及其之间的关系（用表格）
   - 标注用户自己提出的好问题和深入思考
   - 标注可能需要进一步学习的领域
   - action: { type: "save_summary", payload: {} }

3. **反思引导** — 总结后提出思考问题：
   content: 总结内容 + 反思问题
   options: [
     {label: "概念A启发最大", value: "我觉得{概念A}对我启发最大"},
     {label: "需要巩固B", value: "{部分B}我还需要再巩固"},
     {label: "继续深入", value: "我想继续深入学习"},
     {label: "自定义", value: "", type: "custom"}
   ]

4. **核心要点** — content 中包含：
   - "核心要点"部分（5-8 条）
   - "概念关系"表格（关键概念间的联系）
   - "待深入领域"
   - "推荐下一步"（options 中给出具体可选的下一步行动）
```

---

## 9. 版本规划

### v0.1 — MVP (当前版本)
- [x] 基础项目结构
- [ ] Python 后端核心（AI 引擎、会话管理、文件记忆）
- [ ] FastAPI API 层 + SSE 流式
- [ ] React 前端（对话、大纲树、导航）
- [ ] Tauri 桌面集成
- [ ] 单一 AI 供应商支持（可配置）

### v0.2 — 增强
- [ ] 大纲可编辑（添加/删除/重排节点）
- [ ] 深色/浅色主题切换
- [ ] 会话导出（打包为 ZIP）
- [ ] 键盘快捷键
- [ ] 多语言支持（中/英）

### v1.0 — 完善
- [ ] 向量数据库记忆（语义搜索历史学习内容）
- [ ] LaTeX 数学公式渲染
- [ ] 语音输入
- [ ] 学习统计面板（学习时长、知识点覆盖率）
- [ ] 分享学习计划

---

## 10. 验收标准

### AC1: 完整学习流程
- [ ] 用户输入"我想学习 Python"
- [ ] AI 反向提问 2-4 轮（每轮提供可点击选项）
- [ ] 自动生成大纲，节点数量匹配主题复杂度（不强行凑数）
- [ ] 侧边栏显示大纲树
- [ ] 点击节点进入学习，AI 流式讲解（结构化 JSON 输出）
- [ ] 可以回到大纲，选择另一个节点
- [ ] 生成总结

### AC2: 导航与记忆
- [ ] 面包屑始终显示当前位置
- [ ] 点击面包屑可跳转
- [ ] 切换知识点后回来，对话历史完整保留
- [ ] 跨知识点学习时 AI 不重复已学内容

### AC3: 文件输出
- [ ] `learning-output/{session}/syllabus.md` 存在且内容可读
- [ ] `learning-output/{session}/{topic}.md` 存在且内容可读
- [ ] 文件可直接用 Obsidian/Typora 打开

### AC4: 流式交互
- [ ] AI 响应逐字流式显示
- [ ] Markdown 实时渲染，不出现原始标记
- [ ] 可中断正在输出的响应

### AC5: 多供应商
- [ ] 设置面板可配置 API Key
- [ ] 切换供应商后对话正常进行
- [ ] API Key 脱敏显示

### AC6: 大纲质量
- [ ] 简单主题（如"什么是变量"）生成的大纲不超过 2 层深度、3 个节点
- [ ] 复杂主题（如"机器学习"）生成的大纲有合理的层级和节点数
- [ ] 没有出现"为了凑数"的空洞节点（描述模糊、内容单薄的节点）
- [ ] 节点描述准确反映该节点实际会讲的内容
