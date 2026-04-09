<div align="center">

# IELTSmate

**智能雅思备考助手 — 笔记管理 · AI 复习**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

</div>

<br/>

<div align="center">
  <img src="docs/screenshots/review-card.png" alt="IELTSmate Review Interface" width="800" />
  <p><em>复习界面 — 拼写检测、音标、同/反义词、AI 生成记忆技巧</em></p>
</div>

---

## 特性

- **知识库管理** — 按分类（单词 / 短语 / 句子 / 同义替换 / 口语 / 拼写）组织笔记，支持批量操作、收藏与搜索
- **间隔复习** — 可按范围（全部 / 错题 / 排除已掌握）和模式（随机 / 续接上次）启动复习，自动记录正确率与进度
- **AI 扩展** — 为每张复习卡片生成词性派生、易混淆词、词族等扩展内容；支持自定义 AI 供应商与模型
- **写作笔记** — Markdown 写作笔记管理，支持大/小作文分类
- **学习追踪** — 每日 Todo、活动热力图、学习统计仪表盘
- **数据导入/导出** — 批量导入笔记预览 & 确认，一键导出全量数据

## 技术架构

```
┌──────────────────────────────────────────────┐
│                  Frontend                     │
│  React 19 · Vite 8 · Zustand · Tailwind CSS  │
│  Framer Motion · React Router · Vitest        │
└────────────────────┬─────────────────────────┘
                     │  Vite Dev Proxy / REST
┌────────────────────▼─────────────────────────┐
│                  Backend                      │
│  NestJS 10 · Prisma 6 · Swagger · class-validator │
└────────────────────┬─────────────────────────┘
                     │
┌────────────────────▼─────────────────────────┐
│              PostgreSQL 14+                   │
└──────────────────────────────────────────────┘
```

## 快速开始

### 前置条件

| 依赖 | 版本 |
|------|------|
| Node.js | 20+ |
| PostgreSQL | 14+ |
| pnpm | 9+ (推荐) |

### 1. 克隆仓库

```bash
git clone https://github.com/<your-username>/ieltsmate.git
cd ieltsmate
```

### 2. 启动后端

```bash
cd backend
pnpm install

# 配置数据库连接
cp .env.example .env
# 编辑 .env，设置你的 DATABASE_URL
```

`.env` 示例：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ieltsmate?schema=public"
```

```bash
# 初始化数据库 & 启动
pnpm prisma:migrate
pnpm prisma:generate
pnpm dev
```

后端默认运行在 `http://127.0.0.1:3000`，API 文档可访问 `http://127.0.0.1:3000/api-docs`。

### 3. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认运行在 `http://127.0.0.1:5173`。开发模式下 Vite 已配置代理，会自动将 API 请求转发到后端，无需额外配置。

## 项目结构

```
ieltsmate/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/      # 通用组件 & 弹窗
│   │   ├── pages/           # 页面组件
│   │   ├── store/           # Zustand 状态管理
│   │   ├── lib/             # 工具函数
│   │   └── types/           # TypeScript 类型定义
│   └── vite.config.ts
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── notes/           # 笔记 CRUD
│   │   ├── review/          # 复习系统 & AI 生成
│   │   ├── ai/              # AI 供应商管理
│   │   ├── favorites/       # 收藏
│   │   ├── todos/           # 待办事项
│   │   ├── dashboard/       # 仪表盘统计
│   │   ├── writing/         # 写作笔记
│   │   ├── import/          # 数据导入
│   │   ├── export/          # 数据导出
│   │   └── settings/        # 应用设置
│   └── prisma/
│       ├── schema.prisma    # 数据模型
│       └── migrations/      # 迁移文件
└── docs/                    # 设计文档
```

## 常用命令

### 前端

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm test` | 监听模式运行测试 |
| `pnpm test:run` | 单次运行全部测试 |
| `pnpm test:coverage` | 生成测试覆盖率报告 |

### 后端

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm test:e2e` | 运行端到端测试 |
| `pnpm prisma:migrate` | 执行数据库迁移 |
| `pnpm prisma:generate` | 生成 Prisma Client |

## 环境变量

### 后端 (`backend/.env`)

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@127.0.0.1:5432/ieltsmate?schema=public` |
| `PORT` | 服务端口（可选，默认 3000） | `3000` |

### 前端（可选）

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_BASE_URL` | 后端地址覆盖（开发模式一般不需要） | `http://127.0.0.1:3000` |

## License

MIT
