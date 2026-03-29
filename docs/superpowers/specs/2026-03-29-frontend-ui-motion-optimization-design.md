# IELTSmate 前端 UI 与动效优化设计

## 1. 背景与目标

### 1.1 项目背景
- 当前项目处于前端持续优化阶段，后端尚未接入。
- 现有功能范围已基本满足预期，当前重点是视觉质量、交互质感与动效一致性升级。
- 技术栈为 React + TypeScript + Tailwind + Framer Motion，已具备动效能力基础。

### 1.2 设计目标
- 在不改变核心业务功能与路由结构前提下，系统化提升 UI 观感与交互体验。
- 采用“70% 极简 + 30% 科技感”的视觉主线，强化专业度与现代感平衡。
- 动效强度采用“中动效”策略：克制、有反馈、不干扰学习主流程。
- 引入 Uiverse（https://uiverse.io/elements）优质组件思路，执行混合策略：
  - 可复用小组件直接改造复用（如按钮、加载、开关、提示）。
  - 业务核心结构组件仅借鉴思路并重写（如导航、卡片、表单布局、弹窗框架）。

### 1.3 非目标
- 本阶段不变更业务数据结构与后端接口契约。
- 不做与本次 UI/动效目标无关的大规模重构。
- 不引入高密度持续动画或炫技动画。

## 2. 范围与分期策略

### 2.1 范围
- 全量覆盖前端主要界面：
  - `Sidebar + Topbar`
  - `Dashboard`
  - `KnowledgeBase / KnowledgeDetail / WritingNoteDetail`
  - `Review` 系列页面
  - `Settings` 页面
  - 全局弹窗与交互层（QuickNote/Search/AI/Import 等）

### 2.2 路线选择
- 主路线：**系统先行 + 页面落地（推荐路线）**
  1. 建立 Design Tokens（视觉基础变量）
  2. 建立组件基础层与动效规范
  3. 按页面批次落地与验收

### 2.3 页面落地批次
1. 批次 1：`Sidebar + Topbar`（导航辨识度、全局操作反馈）
2. 批次 2：`Dashboard`（统计卡、筛选、卡片列表节奏）
3. 批次 3：`KnowledgeBase / Detail`（信息密度与阅读体验）
4. 批次 4：`Review + Settings + Modal`（收口一致性）

## 3. 架构设计

### 3.1 分层结构
- `Design Tokens` 层
  - 颜色、字体、间距、圆角、阴影、边框、层级、动效时长、缓动曲线。
- `Primitives` 层
  - 基础 UI 原子组件：`Button`、`Input`、`Textarea`、`Select`、`Badge`、`Spinner`、`Skeleton`、`Tooltip`。
- `Composites` 层
  - 由原子组件组合的业务中立组件：`SearchBar`、`StatCard`、`NoteCard`、`FilterChipGroup`、`ModalShell`。
- `Layouts` 层
  - 页面结构组件：`Sidebar`、`Topbar`、`PageSection`、`EmptyState`、`LoadingState`。
- `Pages` 层
  - 现有页面在不改路由语义的前提下，切换为新组件体系。

### 3.2 组件接口原则
- 所有组件统一暴露：
  - `variant`（视觉风格）
  - `size`（尺寸）
  - `state`（normal/hover/focus/active/disabled/loading/error）
- 页面中避免重复硬编码色值、阴影、圆角、时长。

## 4. 视觉系统设计

### 4.1 视觉主线
- 核心风格：深色极简为主，科技感作为强调层。
- 科技感使用边界：
  - 用于重点 CTA、焦点态、关键分割线和少量高价值反馈。
  - 避免全页面霓虹化与高饱和冲突。

### 4.2 Design Tokens 规范（建议）
- 色彩：
  - `bg / sidebar / card / border / text-* / primary / accent-*`
- 圆角：
  - `sm / md / lg / pill`
- 阴影：
  - `elevation-1 / 2 / 3`（弱到强）
- 间距：
  - 8px 基线（4、8、12、16、24、32...）
- 层级：
  - `base / dropdown / popover / modal / toast`

### 4.3 主题一致性
- 深色主题作为默认主题精修目标。
- 保留浅色主题变量能力，但不阻塞本轮深色优化。

## 5. 动效系统设计

### 5.1 总体策略
- 目标：中动效、低打扰、高反馈。
- 主时长区间：`160ms ~ 260ms`。
- 动效优先使用 `transform + opacity`，避免触发布局抖动。

### 5.2 动效映射规范
- Hover：`120~180ms`，轻微亮度/边框/位移反馈。
- Press：`80~120ms`，缩放 `0.97~0.99`。
- Focus：`160ms`，可见 ring + 弱 glow。
- Expand/Collapse：`180~240ms`，`height + opacity`。
- Modal Enter/Exit：`200~260ms`，`scale(0.96->1) + fade`。
- Route Transition：`180~220ms`，轻淡入，不做大位移。
- Skeleton：低对比 shimmer，不高频闪烁。

### 5.3 可访问性与动效降级
- 支持 `prefers-reduced-motion`：
  - 关闭位移动画，保留最小淡入反馈。
- 所有关键操作支持键盘焦点可见性。

## 6. Uiverse 融合方案

### 6.1 直接改造复用（高性价比）
- `Buttons`
- `Loaders`
- `Toggle switches`
- `Tooltips`

### 6.2 仅借鉴并重写（核心一致性）
- `Cards`
- `Forms`
- `Inputs`
- 导航类组件（`Sidebar`、`Topbar` 交互）

### 6.3 评估准入标准
- 是否符合产品调性（非花哨优先，信息效率优先）
- 是否可稳定适配深色主题与现有 token
- 是否满足中动效规范与性能约束
- 是否便于维护与主题扩展

## 7. 状态与反馈设计

### 7.1 Loading
- 页面级：结构骨架屏（Skeleton）。
- 组件级：按钮内或局部 Spinner。

### 7.2 Empty
- 每个空状态必须带可执行下一步动作（新增、导入、刷新等）。

### 7.3 Error
- 区分可重试错误与配置错误，文案明确并附带动作。

### 7.4 Success
- 轻量成功反馈（toast 或 inline），避免重弹窗打断。

## 8. 数据流与边界

### 8.1 数据流约束
- `zustand` 现有状态组织保持不变。
- UI 改造限于展示层、交互层、组件层，不侵入业务数据结构。

### 8.2 与后端接入关系
- 后续接后端时，仅替换数据来源与请求状态，不需二次推翻 UI 结构。
- 所有新 UI 组件需天然支持 `loading/error/empty` 状态。

## 9. 错误处理与风险控制

### 9.1 主要风险
- 全量改造导致视觉不一致。
- 动效过多影响性能与学习专注。
- 直接搬运第三方样式导致维护困难。

### 9.2 控制措施
- 先 token 后组件，再页面，确保统一口径。
- 动效全部进入统一时长与触发规范。
- 第三方组件先做准入评估再落地。

## 10. 验收标准

### 10.1 一致性验收
- 同类组件在不同页面样式、状态、动效一致。
- 焦点态可见、对比度达标、层级关系清晰。

### 10.2 体验验收
- 导航、搜索、新增、复习等关键路径反馈明确。
- 页面切换与弹窗开合平滑，无明显突兀与卡顿。

### 10.3 质量验收
- 无新增严重可访问性问题。
- 在常见设备下交互响应与动画体感稳定。

## 11. 测试策略

### 11.1 视觉回归
- 对关键页面进行截图比对：
  - Sidebar/Topbar
  - Dashboard
  - KnowledgeBase/Detail
  - 关键 Modal

### 11.2 交互状态检查
- 每个核心组件验证：
  - hover
  - focus
  - press
  - disabled
  - loading
  - error（适用时）

### 11.3 动效检查
- 时长是否在规范区间内。
- 是否满足 `prefers-reduced-motion` 降级。

## 12. 实施输出物

- 一套可复用 UI 设计系统（tokens + primitives + composites）。
- 页面级一致化升级（全核心页面覆盖）。
- Uiverse 组件“产品化吸收”清单与替换记录。
- 后端接入前可持续演进的前端视觉与动效基线。

## 13. 里程碑建议

- M1：Design Tokens + 动效基线完成
- M2：Primitives/Composites 完成并可在页面替换
- M3：核心页面批次 1-2 完成验收
- M4：批次 3-4 与全局收口完成
- M5：视觉回归与动效/可访问性回归完成
