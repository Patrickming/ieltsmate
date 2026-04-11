# 参与贡献

感谢你对 IELTSmate 的关注。欢迎通过 Issue 与 Pull Request 参与改进。

## 开发环境

请先阅读仓库根目录 [README.md](./README.md) 中的「快速开始」：需要 Node.js 20+、PostgreSQL 14+，推荐使用 **pnpm**。

```bash
# 后端
cd backend && pnpm install && cp .env.example .env
# 配置 DATABASE_URL 后
pnpm prisma:migrate && pnpm prisma:generate && pnpm dev

# 前端（新终端）
cd frontend && pnpm install && pnpm dev
```

## 提交代码前

- 在相关包目录执行 `pnpm lint`（前端）或保持与现有 Nest/TS 风格一致（后端）。
- 若修改了行为，尽量补充或更新测试（`frontend`: `pnpm test:run`，`backend`: `pnpm test:e2e`）。

## Pull Request

- 请说明改动动机与主要变更点；与 Issue 关联时可在描述中写上 `Fixes #编号`。
- 保持单次 PR 聚焦单一主题，避免无关大重构。
- 提交信息建议使用清晰的中文或英文短句。

## 行为准则

请保持友善、尊重与建设性沟通。人身攻击、骚扰与歧视性言论不被接受。

如有疑问，可先开 Issue 讨论再动手实现。
