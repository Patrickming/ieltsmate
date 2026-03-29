# IELTSmate 后端设计（基于现有前端逻辑）

日期：2026-03-29  
技术栈：NestJS + PostgreSQL + Prisma  
范围：单用户（不做登录），按前端现有功能渐进替换 mock 数据

## 1. 目标与边界

### 1.1 目标
- 以后端真实数据替换当前前端 mock/本地状态，保持现有 UI 与交互不改形态。
- 优先打通用户高频闭环：知识库 -> 详情 -> 收藏 -> 复习 -> 总结 -> 仪表盘统计。
- 每完成一个大功能即可单独联调上线，不依赖“全量完工”。

### 1.2 非目标（本阶段）
- 不做多用户、注册登录、权限体系。
- 不做真实 LLM 推理链路（先保留 AI 模块数据结构和接口壳）。
- 不做复杂异步任务编排（导入解析先做同步/轻异步版本）。

## 2. 总体架构

- `apps/api`（NestJS）
  - `notes`：杂笔记 CRUD、筛选、搜索、详情、备注
  - `writing`：写作文件列表/详情
  - `favorites`：收藏关系切换与列表
  - `review`：会话开始、评分提交、进度推进、总结聚合
  - `todos`：按日任务 CRUD 与完成态
  - `dashboard`：统计卡、热力图、掌握进度聚合
  - `settings`：主题/模型分配/导出导入入口
  - `providers`：AI 服务商与模型配置（先后端可写，前端渐进接入）
  - `common`：异常过滤、统一响应、日志、校验

分层约束：
- Controller 只处理协议和参数校验
- Service 承担业务规则和聚合
- Prisma 层只做数据读写，不放业务分支

## 3. 数据模型（核心）

- `notes`
  - 基础：`content`, `translation`, `category`, `phonetic`
  - 延伸：`synonyms[]`, `antonyms[]`, `example`, `memoryTip`
  - 复习：`reviewStatus`, `reviewCount`, `correctCount`, `wrongCount`, `lastReviewedAt`
  - 维护：`createdAt`, `updatedAt`, `deletedAt`
- `note_user_notes`：详情页“我的备注”
- `writing_notes`：写作文件元数据 + markdown 内容
- `favorites`：`noteId` 唯一（单用户）
- `review_sessions` + `review_session_cards` + `review_logs`
- `todos`：`taskDate`, `text`, `done`, `sortOrder`
- `daily_activity`：热力图日聚合
- `settings`：主题、默认模型分配
- `ai_providers` + `ai_models`：配置持久化

索引重点：
- notes 分类与时间索引
- notes 内容检索索引（content/translation）
- review logs 按时间和 note 维度索引
- todos 按 `taskDate` 索引

## 4. API 设计原则

- REST 为主，路径按资源命名，避免页面耦合命名。
- 统一返回：
  - 成功：`{ data, meta?, message? }`
  - 失败：`{ error: { code, message, details? } }`
- 列表接口统一支持：分页、排序、筛选、关键词检索。
- 所有“toggle”类接口返回最新状态，前端可直接落地 UI。

## 5. 与前端功能的映射策略

### 5.1 第一优先级（立即替换 mock）
1. 笔记列表/筛选/搜索
2. 笔记创建（QuickNoteModal）
3. 笔记更新与软删除（对齐详情页编辑/删除按钮）
4. 笔记详情与备注
5. 收藏切换 + 收藏夹列表
6. 复习会话（开始/评分/总结）
7. Todo 按日任务

### 5.2 第二优先级（提升真实性）
8. 仪表盘统计（热力图、掌握环）
9. 写作文件列表与详情

### 5.3 第三优先级（管理功能补齐）
10. 设置页模型分配持久化
11. AI 提供商与模型配置
12. 导入/导出/清空数据

## 6. 关键业务规则

- 收藏：`toggle` 幂等，返回 `isFavorite`。
- 复习会话：
  - 启动时冻结卡片集合和顺序（会话快照），保证一轮一致性。
  - 评分后同步更新 note 统计字段（count/status）并写 review log。
  - 中途退出（abort）不回滚已提交评分；会话标记 `aborted`，已评分记录保持有效。
  - 总结页统计来源于会话卡片与评分日志，而非前端临时状态。
- 评分档位：
  - 首期仅支持 `easy`、`again` 两档（与当前前端按钮一致）。
  - `hard` 预留枚举但不在首期接口暴露。
- Todo：
  - 天维度隔离，查询默认当天，可按日期范围扩展。
  - 日期口径统一采用 `Asia/Shanghai` 本地日历日（避免 UTC 跨日偏差）。
  - 全部完成时写入 `daily_activity.allTodosDone=true` 供热力图特殊态使用。
- 仪表盘统计口径：
  - 今日待复习：当日新增 + 当日需复习（由 review 策略计算）
  - 已掌握：`reviewStatus = mastered` 的 notes 数
  - 连续学习天：`daily_activity.studyCount > 0` 的连续天数
  - 总笔记：仅 `notes`（不含 writing）
- 热力图口径：
  - `studyCount` 由当日 review 评分次数累计。
  - 颜色分档固定四档（0 / 1-3 / 4-7 / 8+），与当前前端视觉一致。

## 7. 错误处理与数据一致性

- 输入校验：DTO + class-validator。
- 资源不存在：返回 404（例如 noteId 无效）。
- 状态冲突：返回 409（例如重复插入唯一收藏）。
- 事务边界：复习评分流程使用事务（写 session_card + review_log + note stats）。
- 软删除：笔记类默认软删，列表默认过滤 `deletedAt is null`。

## 8. 测试策略

- 单元测试：Service 层（筛选、评分、状态流转规则）。
- 集成测试：Controller + Prisma（关键 API）。
- 回归用例：
  - 收藏切换双击幂等
  - 复习最后一张评分后会话结束
  - Todo 全部完成触发热力图标记
  - 搜索与分类联合筛选一致性

## 9. 交付里程碑（按渐进替换）

M1：Notes + Favorites + NoteUserNotes  
M2：Review（session/cards/logs/summary）  
M3：Todos + Dashboard stats  
M4：Writing + Settings/provider  
M5：Import/Export/Clear Data

## 10. 联调准则

- 每个里程碑提供：
  - OpenAPI 文档片段
  - Postman/HTTP 示例
  - 前端替换点清单（store 或页面中 mock 替换位置）
- 不改前端视觉与交互，仅替换数据源与调用路径。
- 复习子分类后端按完整 `Category` 提供（包含“句子”）；若前端缺项，作为前端修复任务单独跟踪。

