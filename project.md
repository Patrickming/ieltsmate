# IELTSmate 后端实施任务总表（按大功能拆分）

> 目标：严格对齐 `frontend` 现有逻辑与 `FUNCTIONAL_SPEC.md`，采用“渐进替换 mock”策略。
> 栈：NestJS + Prisma + PostgreSQL（单用户，无登录）。
> 设计基线：`docs/superpowers/specs/2026-03-29-frontend-aligned-backend-design.md`

## 大功能 1：后端工程基础与规范
- [x] Task 1.1 初始化 NestJS 工程结构（模块目录、环境变量、配置加载）
- [x] Task 1.2 接入 Prisma + PostgreSQL：core schema（Note / Favorite / NoteUserNote / Review* / Todo / DailyActivity）、`init_core_models` 迁移、`PrismaModule`+`PrismaService`（`onModuleInit`/`onModuleDestroy`）、e2e `prisma-schema.e2e-spec.ts`（PrismaClient 与 Nest 生命周期）；本地需 PostgreSQL 后执行 `pnpm prisma migrate dev` 与 e2e
- [x] Task 1.3 搭建统一响应体、全局异常过滤器、参数校验管道
- [ ] Task 1.4 建立 OpenAPI/Swagger 与基础健康检查接口
- [x] Task 1.5【修复】WSL 跨域问题：Vite 加 `server.proxy`（/notes /favorites /review /health → 127.0.0.1:3000），`apiBase.ts` 改为相对路径，后端 `package.json` 加 `dev/start` 脚本并安装 `ts-node`，`start.sh` 改用 `pnpm dev` 启动后端

## 大功能 2：笔记系统（KnowledgeBase / Detail 核心）
- [x] Task 2.1 实现 notes 表与 CRUD（创建、列表、详情、更新、软删除）：`NotesModule` + `POST/GET/PATCH/DELETE /notes`、`GET /notes/:id`；删除为 `deletedAt` 软删；e2e 见 `backend/test/notes.e2e-spec.ts`（需本地 PostgreSQL）
- [x] Task 2.2 实现分类筛选 + 搜索（content/translation）：`GET /notes?category=&search=`，列表仅 `deletedAt IS NULL`，搜索为 content/translation 不区分大小写 `contains`
- [x] Task 2.3 实现 note_user_notes（备注新增、列表、删除）：`GET/POST /notes/:id/user-notes`、`DELETE /notes/:id/user-notes/:userNoteId`（`NoteUserNote.deletedAt` 软删）；列表仅未删；父笔记不存在或已软删返回 404；DTO 校验 content；e2e 见 `backend/test/notes.e2e-spec.ts`
- [x] Task 2.4 明确并实现详情页编辑/删除真实接口（对应前端占位按钮）：复用 `PATCH /notes/:id` 与 `DELETE /notes/:id`，并在 e2e 覆盖详情更新与软删后 404；前端 `KnowledgeDetail` 接入 `deleteNote`/`updateNote`，主卡片内联编辑（分类/内容/释义），操作区加删除二次确认
- [x] Task 2.5 前端联调（部分）：App 启动时调用 `loadNotes` 从 `GET /notes` 加载真实数据替换 mockNotes；新增 `BackendNote` 类型、`mapBackendNote`、`formatNoteDate` 工具函数；`notesLoaded` 标志位；写作列表与详情页仍用 mock

## 大功能 3：收藏系统（Favorites）
- [x] Task 3.1 实现 favorites toggle 接口（返回最新 isFavorite）：`POST /favorites/toggle` 入参 `{ noteId }`，未收藏则创建并返回 `isFavorite: true`，已收藏则删除并返回 `isFavorite: false`；笔记不存在或已软删 404；`deleteMany` + 捕获 `P2002` 保证幂等；e2e 见 `backend/test/favorites.e2e-spec.ts`
- [x] Task 3.2 实现收藏列表与收藏搜索接口：`GET /favorites` 可选 `search`，仅返回未软删笔记、在 content/translation 上不区分大小写 contains；响应 `{ items: Note[] }`；e2e 见 `backend/test/favorites.e2e-spec.ts`
- [x] Task 3.3 前端联调：知识库收藏夹、详情收藏按钮、复习收藏按钮（后端优先 + 本地兜底：`useAppStore` 中 `toggleFavorite` 先 `POST /favorites/toggle`，失败则沿用本地切换；`syncFavorites` 在 `App` 挂载时 `GET /favorites` 同步 id 列表，失败静默；待 Task 2.5 笔记 id 与后端一致后可切纯后端、弱化兜底）

## 大功能 4：复习系统（Selection / Cards / Summary）
- [x] Task 4.1 实现开始复习接口（按筛选生成会话与卡片快照）：新增 `POST /review/sessions/start`，支持 `source(notes/favorites)`、`categories[]`、`range(all/wrong)`、`mode(random/continue)`；创建 `review_sessions` 与 `review_session_cards` 快照（顺序与筛选结果一致），并在 e2e 覆盖 favorites 来源与软删过滤
- [ ] Task 4.2 实现评分接口（首期仅 again/easy，hard 仅保留扩展位）与事务更新统计
- [ ] Task 4.3 实现会话进度查询与结束接口
- [ ] Task 4.4 实现复习总结聚合接口（总数、正确率、分类统计）
- [ ] Task 4.5 前端联调：复习三页面全链路替换 store 临时逻辑
- [ ] Task 4.6 统一评分口径：首期只开放 easy/again；hard 仅保留扩展位
- [ ] Task 4.7 明确中途退出语义：aborted 会话保留已评分记录

## 大功能 5：Todo 与学习热力图
- [ ] Task 5.1 实现 todos 按日 CRUD（新增、勾选、删除、排序）
- [ ] Task 5.2 实现 all-done 状态与 daily_activity 聚合写入
- [ ] Task 5.3 实现热力图数据查询接口（日期范围）
- [ ] Task 5.4 前端联调：TodoList + ActivityHeatmap 数据替换
- [ ] Task 5.5 统一日期口径为 Asia/Shanghai 日历日，避免 UTC 跨日误差

## 大功能 6：仪表盘统计聚合
- [ ] Task 6.1 实现顶部统计接口（待复习、已掌握、连续学习、总笔记）
- [ ] Task 6.2 实现掌握度环形图统计接口（new/learning/mastered）
- [ ] Task 6.3 前端联调：Dashboard 统计卡与 MasteryRing
- [ ] Task 6.4 固化统计口径（总笔记仅 notes、热力图 studyCount=当日评分次数、颜色四档 0/1-3/4-7/8+）

## 大功能 7：写作文件模块
- [ ] Task 7.1 实现 writing_notes 列表、筛选（大作文/小作文）
- [ ] Task 7.2 实现写作详情接口（markdown 内容）
- [ ] Task 7.3 前端联调：写作列表与详情页数据替换

## 大功能 8：设置与模型配置
- [x] Task 8.0 Prisma Schema：`AiProvider` / `AiModel` / `AppSettings` 表与 `add_ai_settings` 迁移
- [x] Task 8.1 实现 settings 持久化：`SettingsModule`，`GET /settings`、`PATCH /settings`（`AppSettings` key-value upsert），响应经全局拦截器 `{ data, message }`
- [ ] Task 8.2 实现 ai_providers / ai_models CRUD 与验证状态字段
- [ ] Task 8.3 前端联调：Settings 与 AIModelConfigModal

## 大功能 9：导入/导出/清理数据
- [ ] Task 9.1 实现 JSON/CSV 导出接口（notes/writing/review/todos）
- [ ] Task 9.2 实现导入接口（杂笔记、写作）
- [ ] Task 9.3 实现清空数据接口（安全确认参数）
- [ ] Task 9.4 前端联调：ImportModal + Settings 数据管理按钮

## 大功能 10：质量保障与上线准备
- [ ] Task 10.1 为核心 service 编写单元测试（notes/review/todos）
- [ ] Task 10.2 为关键接口编写集成测试
- [ ] Task 10.3 构建联调回归清单并逐项通过
- [ ] Task 10.4 部署配置与环境变量文档整理

