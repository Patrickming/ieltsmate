<div align="center">

# IELTSmate

**面向雅思备考的本地优先学习助手：知识库 · 间隔复习 · AI 词汇拓展 · 写作笔记**

[![Security Check](https://img.shields.io/badge/Security%20Check-passing-brightgreen?style=flat&logo=github&logoColor=white&labelColor=555555)](SECURITY.md)
[![release](https://img.shields.io/github/v/release/Patrickming/ieltsmate?style=flat&sort=semver&label=release&labelColor=555555&color=orange)](https://github.com/Patrickming/ieltsmate/releases)
[![License](https://img.shields.io/static/v1?style=flat&label=License&message=MIT&color=yellow&labelColor=555555)](LICENSE)
[![pnpm](https://img.shields.io/badge/package%20manager-pnpm-f69220?style=flat&logo=pnpm&logoColor=white&labelColor=555555)](https://pnpm.io/)

</div>

<br />

<div align="center">
  <img src="docs/screenshots/dashboard-overview.png" alt="IELTSmate 首页仪表盘" width="900" />
  <p><em>首页仪表盘：AI 学习建议、学习统计、活动热力图、每日任务与掌握进度</em></p>
</div>

---

## 项目简介

IELTSmate 是一个为雅思备考设计的全栈学习工具。项目把英语笔记、复习卡片、写作 Markdown 笔记、每日 Todo、学习统计和 AI 辅助学习集中在一个本地运行的 Web 应用中。

它适合用来长期沉淀口语、短语、句子、同义替换、拼写、单词和写作素材，并通过复习记录、收藏、错题过滤、续接复习和 AI 生成内容减少重复整理成本。

## 核心功能

- **知识库管理**：按「杂笔记 / 写作」分组，支持口语、短语、句子、同义替换、拼写、单词、写作等分类；可搜索、筛选、收藏、编辑、软删除和批量导入。
- **复习系统**：支持从全部笔记或收藏启动复习，可按分类、错题、排除已掌握等范围筛选，支持随机复习和续接上次进度。
- **复习卡片记录**：记录每张卡片的复习次数、正确次数、错误次数、拼写答案、掌握状态和复习日志。
- **AI 词汇拓展**：为复习卡片生成音标、例句、记忆技巧、同义词、反义词、词性义项、易混淆词、词性派生和词根相关词。
- **AI 学习助手**：通过 `Ctrl+/` 唤起 AI 面板，可调用工具搜索笔记、查看统计、找薄弱项、读取最近笔记和收藏内容。
- **多模型配置**：支持 OpenAI 兼容接口，可配置 SiliconFlow、OpenRouter、Anthropic、Google Gemini、DeepSeek、BigModel、Ollama 或自定义供应商，并按「分类 / 复习生成 / 聊天」分配模型。
- **写作笔记**：读取本地 Markdown 写作笔记，区分大作文 / 小作文，支持文章详情页和侧边目录。
- **学习仪表盘**：展示总笔记数、今日新增、已掌握数量、连续学习天数、活动热力图、每日 Todo 和 AI 学习洞察。
- **数据导入导出**：支持 Markdown 批量导入预览、AI 辅助补全与质量检查，并可导出 JSON / CSV。
- **快捷交互**：`Cmd/Ctrl+K` 打开搜索，`Ctrl+/` 打开 AI 面板，`Esc` 关闭弹窗；页面和弹窗均采用懒加载。

<div align="center">
  <img src="docs/screenshots/review-card.png" alt="IELTSmate 复习卡片界面" width="900" />
  <p><em>复习卡片：拼写校验、音标、同义词、记忆技巧、AI 拓展与右侧复习队列</em></p>
</div>

## 技术栈

```text
┌────────────────────────────────────────────────────────────┐
│ Frontend                                                   │
│ React 19 · TypeScript · Vite 8 · React Router 7            │
│ Zustand · Tailwind CSS · Framer Motion · Vitest            │
└───────────────────────────┬────────────────────────────────┘
                            │ REST / Vite Dev Proxy
┌───────────────────────────▼────────────────────────────────┐
│ Backend                                                    │
│ NestJS 10 · Prisma 6 · PostgreSQL · Swagger                │
│ class-validator · OpenAI-compatible AI provider layer       │
└───────────────────────────┬────────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────▼────────────────────────────────┐
│ Database                                                   │
│ PostgreSQL 14+                                             │
└────────────────────────────────────────────────────────────┘
```

## 快速开始

### 前置条件

| 依赖 | 建议版本 | 用途 |
| --- | --- | --- |
| Node.js | 20+ | 运行前后端 TypeScript 项目 |
| pnpm | 9+ | 安装依赖和执行脚本 |
| PostgreSQL | 14+ | 存储笔记、复习、设置和 AI 配置 |

### 1. 克隆项目

```bash
git clone https://github.com/Patrickming/ieltsmate.git
cd ieltsmate
```

### 2. 配置后端

```bash
cd backend
pnpm install
cp .env.example .env
```

编辑 `backend/.env`，确认数据库连接：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ieltsmate?schema=public"
```

然后初始化 Prisma 并启动后端：

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

后端默认运行在 `http://localhost:3000`，健康检查为 `http://localhost:3000/health`，Swagger 文档为 `http://localhost:3000/api-docs`。

### 3. 启动前端

打开新的终端：

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认运行在 `http://localhost:5173`。开发环境下 Vite 已配置代理，`/notes`、`/review`、`/ai`、`/dashboard`、`/import`、`/export` 等请求会转发到后端。

### 4. 一键启动脚本

项目提供 `start.sh`，会尝试启动 PostgreSQL、后端和前端，并进入实时监控面板：

```bash
chmod +x start.sh
./start.sh
```

脚本会检查端口占用，必要时自动切换后端 / 前端端口，并将日志写入 `/tmp/ieltsmate-backend.log` 和 `/tmp/ieltsmate-frontend.log`。如果你把项目放在不同路径，请先检查 `start.sh` 顶部的 `PROJECT_DIR` 是否需要调整。

## 环境变量

### 后端：`backend/.env`

| 变量 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串，Prisma 会读取它连接数据库 | `postgresql://postgres:postgres@127.0.0.1:5432/ieltsmate?schema=public` |
| `PORT` | 否 | 后端监听端口，默认 `3000` | `3000` |
| `NOTES_ROOT` | 否 | 写作 Markdown 笔记根目录，不配置时使用后端默认目录逻辑 | `/home/user/ielts-writing-notes` |

AI 供应商、模型、API Key 和模型用途分配主要通过应用内「设置」页面保存到数据库，不需要手动写入 `.env`。

### 前端：可选

| 变量 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | 否 | 覆盖后端地址；开发模式通常留空走 Vite 代理 | `http://127.0.0.1:3000` |

## 常用命令

### 前端命令

在 `frontend/` 目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | TypeScript 编译并构建生产包 |
| `pnpm preview` | 预览生产构建 |
| `pnpm lint` | 运行 ESLint |
| `pnpm test` | 以监听模式运行 Vitest |
| `pnpm test:run` | 单次运行全部前端测试 |
| `pnpm test:coverage` | 生成测试覆盖率报告 |

### 后端命令

在 `backend/` 目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 使用 `ts-node` 启动 NestJS 后端 |
| `pnpm start` | 同 `pnpm dev` |
| `pnpm test:e2e` | 运行 Jest E2E 测试 |
| `pnpm prisma:generate` | 生成 Prisma Client |
| `pnpm prisma:migrate` | 执行开发环境数据库迁移 |
| `pnpm prisma` | 直接调用 Prisma CLI |

## 项目结构

```text
ieltsmate/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Note、ReviewSession、Todo、AI Provider 等数据模型
│   │   └── migrations/            # PostgreSQL 迁移记录
│   ├── src/
│   │   ├── ai/                    # AI 供应商、模型管理、聊天和工具调用
│   │   ├── common/                # 响应封装和异常过滤
│   │   ├── dashboard/             # 统计、活动热力图、AI 洞察
│   │   ├── export/                # JSON / CSV 导出
│   │   ├── favorites/             # 收藏列表和切换
│   │   ├── import/                # Markdown 导入解析、AI 补全、预览保存
│   │   ├── notes/                 # 笔记 CRUD、详情、用户补充笔记
│   │   ├── review/                # 复习会话、评分、AI 卡片生成
│   │   ├── settings/              # 应用设置持久化
│   │   ├── todos/                 # 每日 Todo
│   │   └── writing/               # 本地 Markdown 写作笔记读取
│   └── test/                      # 后端 E2E 测试
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar 等布局组件
│   │   │   ├── modals/            # 搜索、AI 面板、导入、模型配置等弹窗
│   │   │   ├── review/            # 复习流程组件
│   │   │   └── ui/                # Badge、热力图、加载态等 UI 组件
│   │   ├── data/                  # 分类、颜色和类型基础数据
│   │   ├── lib/                   # API 地址、搜索结果、词汇扩展归一化等逻辑
│   │   ├── pages/                 # Dashboard、KnowledgeBase、ReviewCards、Settings 等页面
│   │   ├── store/                 # Zustand 全局状态
│   │   ├── styles/                # 全局样式
│   │   ├── test/                  # Vitest / Testing Library 测试设置
│   │   └── types/                 # 前端业务类型
│   └── vite.config.ts             # 构建拆包、别名、代理和测试配置
├── start.sh                       # 本地一键启动与监控脚本
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

## 数据模型概览

核心数据由 Prisma 管理，主要模型包括：

- `Note`：学习笔记主体，包含内容、翻译、分类、音标、同反义词、例句、记忆技巧、词性、易混词、词族、复习状态和统计。
- `ReviewSession` / `ReviewSessionCard` / `ReviewLog`：复习会话、卡片顺序、评分、拼写答案和复习历史。
- `Favorite`：收藏笔记。
- `NoteUserNote`：用户给某条笔记追加的个人补充说明。
- `Todo` / `DailyActivity`：每日任务和学习活跃记录。
- `AiProvider` / `AiModel` / `AppSettings`：AI 供应商、模型能力标记和应用设置。

## API 概览

后端所有成功响应会被统一包装为：

```json
{
  "data": {},
  "message": "ok"
}
```

主要接口分组如下：

| 路径前缀 | 说明 |
| --- | --- |
| `/notes` | 笔记创建、列表、搜索、详情、编辑、软删除、用户补充笔记 |
| `/favorites` | 收藏列表和收藏切换 |
| `/review` | 开始复习、评分、结束 / 放弃会话、AI 生成复习内容 |
| `/ai` | AI 供应商、模型管理、模型测试和聊天 |
| `/settings` | 应用设置读取和更新 |
| `/todos` | 每日 Todo 增删改查 |
| `/dashboard` | 首页统计和 AI 洞察 |
| `/activity` | 学习活动热力图数据 |
| `/writing-notes` | 写作 Markdown 笔记列表和详情 |
| `/writing-assets` | 写作笔记静态资源访问 |
| `/import` | Markdown 笔记导入预览和保存 |
| `/export` | 笔记 JSON / CSV 导出 |
| `/health` | 服务健康检查 |

完整接口参数可以在本地启动后访问 `http://localhost:3000/api-docs` 查看。

## AI 工作流

IELTSmate 的 AI 能力分为三类用途，可以在设置页分别指定模型：

- **分类 / 导入补全**：导入 Markdown 时补全缺失翻译、拆分混排行、检查明显数据问题。
- **复习内容生成**：为单词或短语生成结构化卡片内容，包括词性义项、同反义词、易混词和词族。
- **学习助手聊天**：基于工具调用读取用户笔记库，回答复习建议、薄弱项、最近新增和收藏相关问题。

AI 服务层兼容 OpenAI Chat Completions 风格接口，因此本地 Ollama、OpenRouter、SiliconFlow、DeepSeek、Gemini OpenAI-compatible endpoint 等都可以接入。

## 开发说明

- 根目录不是 pnpm workspace，前端和后端各自维护 `package.json` 与 `pnpm-lock.yaml`。
- 前端请求默认使用相对路径；开发时依赖 `frontend/vite.config.ts` 的代理转发，生产部署时可设置 `VITE_API_BASE_URL`。
- 后端开启 CORS，仅默认允许 `http://localhost:5173` 和 `http://127.0.0.1:5173`。
- 后端请求体限制为 `10mb`，导入 Markdown 单文件限制为 `5mb`。
- 写作笔记通过后端静态资源模块暴露 `/writing-assets`，实际根目录由 `NOTES_ROOT` 或后端默认逻辑决定。

## 测试

前端使用 Vitest、Testing Library 和 jsdom，测试集中在页面行为、搜索结果、复习流程、词汇扩展归一化等模块。

```bash
cd frontend
pnpm test:run
```

后端使用 Jest 和 Supertest，覆盖笔记、复习启动、AI 内容生成等 E2E 场景。

```bash
cd backend
pnpm test:e2e
```

## 许可与贡献

本项目基于 [MIT License](LICENSE) 开源。

贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。如果发现安全问题，请按 [SECURITY.md](SECURITY.md) 中的方式私下报告，不要在公开 Issue 中披露漏洞细节。
