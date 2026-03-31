# IELTSmate 功能实施清单

> 栈：NestJS + Prisma + PostgreSQL（后端）/ React + Zustand + Vite（前端）  
> 策略：前端已完整实现 UI，逐步替换 mock 数据为真实后端接口

---

## 大功能 1：基础设施

- [x] NestJS 项目初始化（模块目录、环境变量、配置加载）
- [x] Prisma + PostgreSQL 接入：Note / Favorite / NoteUserNote / ReviewSession / ReviewSessionCard / ReviewLog / Todo / DailyActivity 表，迁移脚本，PrismaService 生命周期
- [x] 全局统一响应体 `{ data, message }` + 全局异常过滤器 + ValidationPipe
- [x] Vite proxy 解决 WSL 跨域：/notes /favorites /review /settings /ai /health 全部代理到后端，bypass HTML 请求
- [x] 后端 `package.json` 加 `dev/start` 脚本，安装 `ts-node`，`start.sh` 改用 `pnpm dev`
- [x] OpenAPI/Swagger 文档生成（`@nestjs/swagger@8` + `swagger-ui-express`，访问 `http://127.0.0.1:3000/api-docs`）

---

## 大功能 2：笔记系统（杂笔记）

- [x] `POST /notes` 创建笔记（content / translation / category + 可选 phonetic/synonyms/antonyms/example/memoryTip）
- [x] `GET /notes` 列表，支持按 `category` 过滤、按 `search` 关键词搜索（content + translation 不区分大小写）
- [x] `GET /notes/:id` 详情
- [x] `PATCH /notes/:id` 更新笔记（支持修改 content / translation / category 等字段）
- [x] `DELETE /notes/:id` 软删除（`deletedAt` 字段，列表自动过滤）
- [x] `GET/POST /notes/:id/user-notes` 用户个人备注的列表与新增
- [x] `DELETE /notes/:id/user-notes/:userNoteId` 删除个人备注（软删）
- [x] 前端 App 启动时从 `GET /notes` 加载真实数据，替换 mockNotes
- [x] 前端知识库详情页：内联编辑（分类/内容/释义）连接 PATCH 接口，删除按钮连接 DELETE 接口（含二次确认）
- [x] 前端详情页「我的备注」区域连接后端：进入详情页时加载 `GET /notes/:id/user-notes`，新增调 POST，删除（hover 出现 ✕ 按钮）调 DELETE，刷新不丢失
- [x] `POST /notes` 新增笔记时 AI 自动识别分类（QuickNoteModal 调 `/ai/chat` classify slot，800ms debounce，失败降级到关键词规则）

---

## 大功能 3：收藏系统

- [x] `POST /favorites/toggle` 切换收藏状态，返回最新 `isFavorite`；幂等保障
- [x] `GET /favorites` 收藏列表，支持 `search` 过滤，仅返回未软删笔记
- [x] 前端：知识库收藏夹 Tab、笔记详情收藏按钮、复习卡片收藏按钮全部连接后端；失败时本地兜底切换

---

## 大功能 4：复习系统

- [x] `POST /review/sessions/start` 开始复习：按 source（notes/favorites）、categories、range（all/wrong）、mode（random/continue）过滤笔记，创建会话快照（review_sessions + review_session_cards）
- [x] ReviewService.abort()：先 findUnique，不存在抛 NotFoundException（404）；已 endedAt 则直接返回 { ok: true }，避免重复调用刷新 endedAt（幂等）
- [x] Review DTO 与类型：`RateReviewDto`、`GenerateReviewDto`、`types/card-ai-content.ts`（CardType、各卡片 AI 结构、`categoryToCardType`）
- [x] `PATCH /review/sessions/:sessionId/rate` 评分接口：事务写入 ReviewSessionCard（isDone/rating/answeredAt）+ ReviewLog + Note 统计；幂等（已评分直接返回 ok）；easy 且 correctCount≥3 升为 mastered，again 降回 learning
- [x] `POST /review/sessions/:sessionId/end` 完成会话：返回 totalCards/results(easy,again)/savedExtensionCount；幂等；savedExtensionCount 统计会话期间被更新的笔记数
- [x] `POST /review/sessions/:sessionId/abort` 中止会话（幂等：已结束则直接返回 ok，未结束则写 endedAt）
- [x] `POST /review/ai/generate` AI 内容生成：按 cardType 构建 prompt，Promise.race 15s 超时，失败降级返回 DB 基础内容（fallback: true）
- [x] 后端 ReviewAiService：5 种 cardType 各有独立 prompt 模板；JSON 解析失败自动降级；AiModule 导出 AiService 供 ReviewModule 使用
- [x] 前端 store 联调：ReviewSession 类型加 sessionId/params/aiContent/aiLoading/savedExtensionCount；`startReviewSession(params)` 异步调后端；`rateCard` fire-and-forget；加 `endReviewSession`/`abortReviewSession`/`fetchAIContent`/`ensureAIWindow`/`incrementSavedExtensions`
- [x] 前端 ReviewSelection 页：handleStart 改为 async + loading 状态，startReviewSession 成功后 navigate
- [x] 前端 ReviewCards 页：CardBack 按 cardType 分支渲染（AI 加载动画/降级模式/5种卡型子组件）；存入同义词/反义词调 PATCH /notes/:id 并持久化；退出按钮调 abortReviewSession
- [x] 前端 ReviewSummary 页：mount 时调 endReviewSession() 获取真实统计；「再来一轮」复用 session.params 重新调 startReviewSession（有错题则 range=wrong）

---

## 大功能 5：Todo 与学习热力图

- [x] `GET/POST /todos` 按日期查询与新增 todo（text / taskDate / done / sortOrder）
- [x] `PATCH /todos/:id` 勾选/取消勾选 todo
- [x] `DELETE /todos/:id` 删除 todo
- [x] 当日所有 todo 全部完成时，更新 DailyActivity.allTodosDone = true（POST/PATCH/DELETE 均触发 syncAllTodosDoneForDate，事务内执行）
- [x] `GET /activity?start=&end=` 热力图数据查询：返回日期范围内每日的 studyCount（当日评分次数）
- [x] 每次评分时同步写入当日 DailyActivity.studyCount++（与评分接口同事务）
- [x] 前端 TodoList 组件：从后端加载当日 todos，增删勾选全部调接口；乐观更新 + 失败回滚
- [x] 前端 ActivityHeatmap 组件：从后端加载近一年数据，替换随机 mock；颜色四档（0 / 1-3 / 4-7 / 8+）
- [x] 日期口径统一为 Asia/Shanghai 日历日（`date.util.ts`），避免 UTC 跨日误差

---

## 大功能 6：仪表盘统计

- [x] `GET /dashboard/stats` 返回：总笔记数（total）、今日新增数（createdToday）、已掌握数（mastered）、连续学习天数（streak，今日无记录则从昨天起算）
- [x] 前端 Dashboard 页：4 个 StatCard 从接口读取，替换 mockStats；每个 StatCard 带 tooltip 说明计算口径
- [x] MasteryRing 保持现有逻辑（直接用 notes 数组计算），无需额外接口

---

## 大功能 7：写作文件模块

> 方案：纯磁盘实时读取（不引入 WritingNote DB 表），后端扫描 `笔记/写作笔记/` 目录，ServeStaticModule 提供图片静态服务。

- [x] 安装 `@nestjs/serve-static@4.x`，兼容 NestJS 10
- [x] `WritingService`：`getNotesRoot()` 统一根路径，`list()` 扫目录，`findOne(id)` 读文件替换图片路径；ALLOWED_IDS 白名单防路径穿越
- [x] `WritingController`：`GET /writing-notes` 列表、`GET /writing-notes/:id` 详情（含 content）
- [x] `app.module.ts`：注册 `ServeStaticModule`（`笔记/` → `/writing-assets`）与 `WritingModule`
- [x] Vite proxy 新增 `/writing-notes` 和 `/writing-assets` 代理规则
- [x] `useAppStore.ts`：新增 `writingNotes`、`writingNotesLoading`、`loadWritingNotes` action
- [x] `App.tsx`：启动时调用 `loadWritingNotes()`
- [x] 前端知识库写作 Tab：删除 `WRITING_NOTES` mock，改为读取 store 真实数据，含加载状态
- [x] 前端写作详情页：删除 `WRITING_NOTES_CONTENT` mock，fetch `/writing-notes/:id`，支持图片渲染、骨架屏、「重新加载」按钮

---

## 大功能 8：AI 模型配置与 AI 助手（已完成）

- [x] Prisma：AiProvider / AiModel（含 isThinking / isVision 字段）/ AppSettings 表
- [x] `GET/POST/PATCH/DELETE /ai/providers` Provider CRUD
- [x] `POST/PATCH/DELETE /ai/providers/:id/models` 模型管理（含 `test` 接口真实调 API 验证连通性）
- [x] `POST /ai/chat` 代理端点：按 slot（classify/review/chat）路由到对应模型，支持 Function Calling（5 个工具：search_notes/get_stats/get_weak_notes/get_recent_notes/get_favorites），工具调用循环最多 6 次；enableThinking 时加 reasoning_effort=medium
- [x] `AiService.complete()`：无 Function Calling 的 `chat/completions` 调用（请求体不含 `tools`），`resolveProviderAndModel` + 默认 slot `classify`、`AbortSignal.timeout(30_000)`，返回首条 `choices[0].message.content` 字符串（供导入解析等使用）
- [x] `GET/PATCH /settings` 持久化应用设置（theme / classifyModel / reviewModel / chatModel）
- [x] 前端 AIModelConfigModal：每个模型行可手动标记 isVision（📷）和 isThinking（⚡），保存到后端；保存配置按钮替代 debounce；逐一测试调真实 API
- [x] 前端 AIPanel（AI 助手）：真实调 `/ai/chat`，支持 Markdown 渲染、图片和文本文件附件（图片 base64，文本注入上下文）、⚡深度思考开关（当前模型标记了 isThinking 时显示）、对话历史存 localStorage（关闭后保留）
- [x] 前端 QuickNoteModal：AI 自动识别分类调 classify slot，800ms debounce，失败降级关键词规则
- [x] 前端 Settings 页：主题切换 + 默认模型分配从后端读写

---

## 大功能 9：导入 / 导出 / 清理数据

> 前端现状：Settings 页导出 JSON/CSV 按钮、导入按钮均无 onClick；ImportModal 有完整 UI 但 handleImport 只模拟 1.8s 延迟，不真正解析文件；清空数据按钮无 onClick。

- [x] `GET /export/notes?format=json|csv` 导出杂笔记（ExportModule，`@Res()` 绕过全局 ResponseInterceptor，附件下载）
- [x] 导出杂笔记：`escapeCell` 对含 `\r` 的字段加引号转义；`format` 非 `json`/`csv` 时 `400 BadRequest`
- [ ] `GET /export/writing?format=json|csv` 导出写作笔记
- [x] 杂笔记导入：`backend/src/import/import.parser.ts` — Stage 1 规则解析（大幅优化：`isSpellingListLine` 过滤句末标点/等号/≥4词；`isComplexMultiEntryLine` 用中文词组数检测多词条行；`parseBoldEntry` 优先括号内注释提取，content≤2词+行复杂则整行送AI；有序列表前缀 `1.`/`2.` 剥离；引用块 `> ` 前缀剥离；纯中文开头行跳过；`parseSynonymNoTransEntry` 处理无中文同义词 `A=B`；Stage 2 AI prompt 支持多词条行拆分模式（`split:true`）及同义词/句子翻译规则）
- [x] 杂笔记导入：`ImportService`（`import.service.ts`）— `preview`：Stage 2 `AiService.complete` 补译（needsAI 或空 translation，支持 `split` 结果拼接/倒序插入）、Stage 3 条数 ≤60 时质量审查返回 `flagged`；`save` 逐条 `prisma.note.create` 汇总 created/failed/errors
- [x] 杂笔记导入：`ImportModule` + `ImportController`（`POST /import/notes/preview` multipart 5MB、`POST /import/notes/save` + `SaveNotesDto`）、`app.module` 注册 `ImportModule`
- [ ] `POST /import/notes` 导入杂笔记（解析 JSON 或 CSV，批量写库）
- [ ] `DELETE /data/all` 清空全部数据（需传安全确认参数 `confirm=true`）
- [x] Vite proxy 新增 `/export` 和 `/import` 代理规则（bypass HTML 请求）
- [x] 前端 Settings 页：导出 JSON/CSV 按钮调 `GET /export/notes?format=json|csv`，`URL.createObjectURL` 触发浏览器下载；导入按钮调 `openImport()` 打开 ImportModal
- [x] 前端 ImportModal：三步状态机（选择文件+模型 → 预览审核/flagged 建议 → 完成），真实调 `POST /import/notes/preview` 与 `POST /import/notes/save`，展示统计与成功/失败条数

---

