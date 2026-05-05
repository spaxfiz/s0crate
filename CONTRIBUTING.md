# 贡献指南

感谢你关注 Socrate。项目仍处早期阶段，贡献时请优先保持改动小、边界清楚、容易验证。

## 开发环境

先安装依赖：

```bash
bash scripts/bootstrap.sh
```

启动桌面 Web 开发环境：

```bash
bash scripts/dev.sh
```

启动 Tauri 开发环境：

```bash
bash scripts/tauri-dev.sh
```

## 提交前检查

按改动范围运行对应检查：

```bash
uv run python -m compileall backend
cd src && npm run build
cd h5 && npm run build
```

改动 Tauri 时运行：

```bash
bash scripts/package-tauri.sh
```

## 约定

1. 后端、桌面端、H5 的 API 类型要保持同步。
2. 不提交 `backend/.env`、`learning-output/`、`logs/`、构建产物、真实 API Key。
3. 行为变化需要同步更新 `README.md` 或 `docs/`。
4. 大改动请拆成可 review 的小提交。
5. 私有 VPS 部署脚本保持本地使用，不加入 git。

## Issue 和 PR

提交 Issue 时请包含：

- 复现步骤
- 期望行为
- 实际行为
- 相关日志或截图

提交 PR 时请包含：

- 改动摘要
- 验证命令
- 风险或未覆盖项
