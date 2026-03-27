# IELTSmate — 雅思学习助手项目规格文档

## 1. 项目概述

IELTSmate 是一款基于 AI 的雅思学习工具，核心功能是将用户的个人学习笔记（杂笔记 + 写作笔记）导入系统进行结构化管理，并通过 **AI 实时生成** 的闪卡复习系统进行间隔复习。

**设计参考文件：** `ieltsmate.pen`（Pencil 设计稿，包含 8 个画板：Dashboard、Knowledge-Base、Knowledge-Detail、Review-Selection、Review-Cards、Review-Summary、Settings、Modals-Overlays）

**笔记素材参考：** `笔记/` 目录下的 Markdown 文件

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | Next.js API Routes (Route Handlers) |
| 数据库 | SQLite（通过 Drizzle ORM） |
| AI 集成 | OpenAI-compatible API（硅基流动等第三方兼容接口） |
| 运行时 | Node.js，本地桌面端运行 |

**设计风格：** 暗色主题为主（`#09090b` 背景、`#18181b` 侧边栏），渐变紫蓝品牌色（`#818cf8` → `#60a5fa`），参照设计稿 `ieltsmate.pen` 中的配色方案。

---

## 3. 数据模型

### 3.1 笔记大分类

系统只有 **两种大分类**：

| 大分类 | 说明 |
|--------|------|
| **杂笔记** | 随手记录的学习内容，包含 6 个子分类 |
| **写作** | 完整的写作笔记 Markdown 文件，仅存储文件路径 |

### 3.2 杂笔记子分类

| 子分类 | 存储内容示例 | 说明 |
|--------|-------------|------|
| 口语 | `absolutely 绝对是的（置后）` | 口语常用表达 |
| 短语 | `get out of 避免` | 英语短语及中文释义 |
| 句子 | `To some extent... 在某种程度上` | 句式/句型模板 |
| 同义替换 | `convincing = persuasive 令人信服的` | 同义词/近义词替换对 |
| 拼写 | `January February theater` | 容易拼错的词（无中文释义=纯拼写） |
| 单词 | `elaborate 详细阐述；精心制作的` | 生词 + 释义 |

### 3.3 核心数据表设计

```
notes（笔记/知识条目）
├── id: UUID (PK)
├── type: ENUM('misc', 'writing')          -- 大分类：杂笔记 / 写作
├── category: ENUM('oral', 'phrase', 'sentence', 'synonym', 'spelling', 'word') | NULL
│                                           -- 子分类（仅杂笔记有值，写作为 NULL）
├── content: TEXT                           -- 原始内容（杂笔记的原词/句/替换等）
├── meaning: TEXT | NULL                    -- 中文释义（拼写类可能无）
├── file_path: TEXT | NULL                  -- 写作笔记的 Markdown 文件绝对路径
├── review_count: INTEGER DEFAULT 0         -- 总复习次数
├── correct_count: INTEGER DEFAULT 0        -- 记得次数
├── incorrect_count: INTEGER DEFAULT 0      -- 不记得次数
├── last_reviewed_at: DATETIME | NULL       -- 上次复习时间
├── created_at: DATETIME
├── updated_at: DATETIME

note_extensions（AI 延伸内容，从复习卡片手动存入）
├── id: UUID (PK)
├── note_id: UUID (FK → notes.id)           -- 关联的原始笔记
├── ext_type: ENUM('synonym', 'antonym', 'example', 'phonetic', 'structure', 'memory_tip', 'synonym_sentence', 'other')
│                                           -- 延伸内容类型
├── content: TEXT                           -- 延伸内容文本
├── created_at: DATETIME

note_memos（用户手动备注）
├── id: UUID (PK)
├── note_id: UUID (FK → notes.id)
├── content: TEXT                           -- 备注文字
├── created_at: DATETIME

ai_configs（AI 模型配置）
├── id: UUID (PK)
├── name: TEXT                              -- 显示名称（如 "硅基流动 GLM-Z1-Flash"）
├── provider: TEXT DEFAULT 'openai-compatible'
├── base_url: TEXT                          -- API Base URL
├── api_key: TEXT                           -- API Key（存储完整值，显示时脱敏）
├── model: TEXT                             -- 模型标识（如 "Pro/zai-org/GLM-5"）
├── created_at: DATETIME
├── updated_at: DATETIME

ai_default_assignments（默认模型分配）
├── id: UUID (PK)
├── purpose: ENUM('classification', 'review_association', 'assistant')
│                                           -- 分类识别 / 复习联想 / AI 助手
├── ai_config_id: UUID (FK → ai_configs.id)

chat_sessions（AI 对话会话）
├── id: UUID (PK)
├── title: TEXT                             -- 对话标题
├── model_config_id: UUID (FK → ai_configs.id)
├── created_at: DATETIME
├── updated_at: DATETIME

chat_messages（对话消息）
├── id: UUID (PK)
├── session_id: UUID (FK → chat_sessions.id)
├── role: ENUM('user', 'assistant')
├── content: TEXT
├── created_at: DATETIME

user_settings（用户偏好）
├── id: UUID (PK)
├── daily_new_limit: INTEGER DEFAULT 20     -- 每日新卡片上限
├── daily_review_limit: INTEGER DEFAULT 100 -- 每日复习上限
├── theme: ENUM('dark', 'light') DEFAULT 'dark'

review_sessions（复习会话记录）
├── id: UUID (PK)
├── total_cards: INTEGER
├── correct_count: INTEGER
├── incorrect_count: INTEGER
├── new_extensions_count: INTEGER           -- 本次新增延伸知识条数
├── created_at: DATETIME
```

---

## 4. 页面与路由结构

| 路由 | 对应设计稿画板 | 说明 |
|------|---------------|------|
| `/` | 01-Dashboard | 首页/仪表盘 |
| `/knowledge` | 02-Knowledge-Base | 知识库列表 |
| `/knowledge/[id]` | 03-Knowledge-Detail | 知识详情页（非编辑表单） |
| `/review` | 04-Review-Selection | 复习选择（大分类→子分类→范围→模式） |
| `/review/session` | 05-Review-Cards | 复习闪卡 |
| `/review/summary` | 06-Review-Summary | 复习小结 |
| `/settings` | 07-Settings | 设置 |

**全局浮层（08-Modals-Overlays）：**
- 快速记录 Modal（添加笔记）
- Cmd+K 全局搜索
- AI 助手面板（侧滑面板）

---

## 5. 侧边栏导航

```
IELTSmate（Logo，渐变紫蓝）

MAIN
├── 🏠 首页
├── 📚 知识库
└── 🔄 复习

CATEGORIES
├── 📝 杂笔记（展开/折叠）
│   ├── 🗣 口语
│   ├── 💬 短语
│   ├── 📖 句子
│   ├── 🔄 同义替换
│   ├── ✍️ 拼写
│   └── 📗 单词
└── ✏️ 写作

──────────
📥 导入数据
⚙️ 设置
```

**要求：**
- 所有分类项点击后必须有响应（跳转到对应分类筛选后的知识库页面）
- Emoji 图标必须正确渲染，使用 Unicode emoji 或 Lucide 图标库

---

## 6. 功能模块详细规格

### 6.1 首页 / 仪表盘

**统计卡片（4 张）：**
- 今日待复习（含到期+新卡数量）
- 已掌握（占全部百分比）
- 连续学习天数（按自然日累计）
- 总笔记（知识库条数）

**快捷操作：**
- 「开始今日复习」→ 跳转 `/review`
- 「添加新笔记」→ 打开快速记录 Modal

**最近添加：** 显示最近添加的笔记列表，支持按子分类筛选标签（全部/口语/短语/句子/同义替换/拼写/单词/写作）

### 6.2 添加笔记（快速记录 Modal）

**核心逻辑：简单的「随手记」输入，而非复杂表单。**

**UI 布局：**
1. 顶部标题：`📝 快速记录`
2. 主输入区域：一个大文本输入框，用户直接输入学习内容（如 `get out of — 避免`）
3. 右侧设置区：
   - **分类设置**：两个选项卡
     - `AI 自动识别`（默认）：AI 根据输入内容自动判断子分类
     - `手动选择`：手动下拉选择子分类
   - 选择了 AI 自动识别后显示 **AI 识别预览** 区域（如：`短语 | get out of → 避免`），带「确认」和「修改」按钮
4. 底部：「取消」和「保存笔记」按钮

**AI 自动识别逻辑（使用「分类识别」默认模型）：**
- 没有中文意思的 → 拼写类
- 有等号连接的（如 `convincing = persuasive`）→ 同义替换
- 完整句子 → 句子类
- 短语词组 → 短语类
- 其他带释义的单词 → 单词类/口语类（根据上下文判断）

**关键：存入数据库的只有原始内容和中文释义。同义词、反义词、例句等延伸内容都不在此时生成/存储，而是在复习时由 AI 实时生成。**

### 6.3 知识库列表页

**筛选层级：**
1. 第一层：大分类标签（全部 / 杂笔记 / 写作）
2. 第二层（仅杂笔记时显示）：子分类标签（全部 / 口语 / 短语 / 句子 / 同义替换 / 拼写 / 单词）

**搜索：** 支持按内容和释义搜索笔记

**笔记卡片展示：**
- 分类标签（带颜色区分）
- 标题（原始内容）
- 释义
- 创建日期
- 复习状态标签（待复习 / 学习中 / 已掌握）

**写作类笔记卡片：** 显示文件名、文件路径、创建日期、标签为「文件」

**空状态提示：** 当筛选结果为空时显示引导文案

### 6.4 知识详情页（重要！非编辑表单）

点击知识库中任意一条知识后，跳转到**独立的详情展示页面**，而非弹出编辑表单。

**页面结构：**

1. **顶部导航**
   - 「← 返回知识库」按钮
   - 子分类标签 + 创建日期

2. **主内容区**
   - 标题（原始内容，大字展示）
   - 中文释义
   - 若为写作类：用 Markdown 解析器精美渲染 Markdown 文件内容（支持本地图片显示，解析绝对路径）

3. **AI 延伸内容**（标注「AI 生成」徽章）
   - 展示从复习卡片中手动存入的所有延伸内容
   - 按类型分组展示（同义短语/反义短语/音标/例句/记忆技巧等）
   - 每条延伸内容显示存入时间

4. **复习统计**
   - 复习次数
   - 正确次数 + 正确率
   - 错误次数 + 错误率
   - 上次复习时间

5. **我的备注**
   - 展示已有备注列表（内容 + 时间）
   - 「添加备注」按钮 → 弹出文本输入框，用户手动写文字备注关联到这个词

6. **操作按钮**
   - 编辑（修改原始内容/释义）
   - 删除

7. **底部导航**
   - 「上一个: {具体内容} {分类}」跳转按钮
   - 「下一个: {具体内容} {分类}」跳转按钮

### 6.5 复习系统

#### 6.5.1 复习选择页

**选择流程（四步）：**

1. **选择大分类**（二选一）
   - 杂笔记（显示待复习张数）
   - 写作（显示篇数）

2. **选择子分类**（仅杂笔记时显示，多选）
   - 全部 {N}
   - 口语 {N}
   - 短语 {N}
   - 句子 {N}（设计稿中侧栏未列出但需包含）
   - 同义替换 {N}
   - 拼写 {N}
   - 单词 {N}

3. **选择复习范围**
   - 全部复习（复习所有内容）
   - 仅复习错误的（展示上次标记错误的内容）

4. **选择复习模式**
   - 随机顺序复习
   - 继续上次复习（从上次的地方开始）

5. 底部显示：`当前筛选出 · 将复习 {N} 张`
6. 「开始复习」按钮

**注意：不需要任何记忆复习算法（无 FSRS、SM-2 等），直接按选择的范围和模式展示卡片。**

#### 6.5.2 复习闪卡

**进度条：** 顶部显示 `{当前} / {总数}` 和进度条

**卡片翻转逻辑：**
- 空格键翻转卡片
- 正面展示原始内容
- 背面展示 **AI 实时生成的延伸内容**（每次翻转都是实时请求 AI）
- 用户点击「不记得」或「记得」后，**无论选哪个都会自动翻转到背面**（如果还没翻转的话），然后自动跳到下一张

**背面 AI 生成内容 — 按子分类不同生成不同内容：**

| 子分类 | 卡片正面 | 卡片背面（AI 实时生成） |
|--------|---------|----------------------|
| 口语 / 单词 | 原英语单词 | 中文意思、反义词、同义词/短语、音标 |
| 短语 | 原英语短语 | 中文意思、反义短语、同义词/短语、音标 |
| 同义替换 | 原同义替换对 | 各自中文详意（不同语义）、反义同义替换、更多同义替换、音标 |
| 句子 | 原英语句子 | 中文意思、句子结构解析、同义替换后的句子（不同结构/单词/短语） |
| 拼写 | 中文意思 + 开头字母 | 完整拼写、中文意思、句子结构解析、同义替换后的句子 |

**拼写子分类特殊逻辑：** 正面给出中文意思和开头字母，用户在脑中拼写。「记得」= 拼对了，「不记得」= 拼错了。翻转后显示正确拼写和其他延伸内容。

**背面「存入」操作：**
- AI 生成的每条延伸内容（同义词、反义词、例句等）旁边都有「存入」按钮
- 点击「存入」→ 将该条延伸内容保存到 `note_extensions` 表，关联原始笔记
- 已存入的显示「已存入」灰色状态
- 存入前做查重（相同 note_id + 相同 ext_type + 相似 content），可结合 AI 做语义级查重

**复习数据记录：**
- 每次点击「记得/不记得」更新对应笔记的 `review_count`、`correct_count`、`incorrect_count`、`last_reviewed_at`

#### 6.5.3 复习小结页

- 本轮复习完成标题 + 庆祝 emoji
- 复习张数
- 正确率
- 分类统计（每个子分类的正确/总数）
- 本次新增延伸知识数
- 「返回首页」和「再来一轮」按钮

### 6.6 导入数据

**交互流程：**
1. 点击侧边栏「导入数据」
2. 弹出导入 Modal
3. 用户通过文件选择器**从电脑自由选择文件**（支持 `.md`、`.txt` 等）
4. 选择导入类型：
   - **杂笔记/随手记**：AI 解析文件内容，自动拆分为独立的笔记条目并识别子分类
   - **写作**：仅记录文件的**绝对路径**到数据库

**杂笔记导入的 AI 辅助（使用「分类识别」默认模型）：**
- 必须用 AI 配合导入过程，因为笔记格式可能是杂乱的
- AI 负责：
  1. 解析 Markdown 结构（标题、列表、段落等）
  2. 拆分为独立的知识条目
  3. 识别每条的子分类
  4. 分离原始内容和中文释义
- 导入后展示预览列表，用户可修改分类后确认导入

**杂笔记格式参考（`笔记/杂笔记/杂笔记.md`）：**
```markdown
### 口语
**I think 'sth' is what l tend to go with.  sth是我常说/用(喜欢...)的**
absolutely 绝对是的（置后）

### 短语
get out of 避免
**end up** 结果 最终成为

### 同义替换
convincing = persuasive 令人信服的
identify = detect

### 拼写/生词
January  February theater Saturday
inhabitant = habitant居民  linguistic语言
```

### 6.7 AI 助手面板

**入口：** 顶部导航栏 `AI 助手 Ctrl+/` 或快捷键

**功能：**
- 侧滑面板形式
- 顶部：标题「AI 助手」+ 模型选择下拉
- **新建对话按钮**（`+` 图标）
- **对话历史列表**（点击可切换历史会话）
- 对话区域：消息气泡（用户/AI）
- 底部输入框 + 发送按钮

**AI 上下文：** AI 助手可关联知识库中的笔记作为上下文（如：消息中显示「相关笔记: get out of」标签）

### 6.8 全局搜索（Cmd+K）

- 快捷键 `Cmd+K` 或 `Ctrl+K` 触发
- 搜索输入框
- 实时搜索结果列表，显示：分类标签、标题、释义
- 键盘导航（↑↓ 导航、⏎ 打开、esc 关闭）
- 点击搜索结果跳转到对应知识详情页

### 6.9 设置页

#### AI 模型配置

**模型列表：**
- 显示已配置的模型卡片（名称、provider 类型、API Key 脱敏显示）
- 每个模型有「编辑」和「删除」按钮
- 「添加模型」按钮

**添加/编辑模型表单：**
- 名称（显示名称）
- Provider 类型（默认 `openai-compatible`）
- Base URL
- API Key
- 模型标识（Model ID）
- **测试连接按钮**（调用 AI 的简单请求验证配置是否可用）

**关键 Bug 修复要求：**
- 编辑已保存的模型时，API Key 字段**必须正确回显完整值**（编辑态显示完整 key，非编辑态脱敏显示）
- 测试连接必须使用正确的 API 格式。以硅基流动为例：
  - Base URL: `https://api.siliconflow.cn/v1`
  - 请求方式：标准 OpenAI Chat Completions 兼容格式（`POST /chat/completions`）
  - 头部：`Authorization: Bearer {api_key}`
- 所有 OpenAI 兼容的 provider 都使用 `/v1/chat/completions` 端点
- 测试时发送一条简单消息（如 `"Hello"`），验证能收到正常响应

**预设支持的 Provider 参考：**

| Provider | Base URL | 备注 |
|----------|----------|------|
| 硅基流动 (SiliconFlow) | `https://api.siliconflow.cn/v1` | OpenAI 兼容 |
| OpenAI | `https://api.openai.com/v1` | 原生 |
| Anthropic (Claude) | `https://api.anthropic.com` | 需要适配 header |
| DeepSeek | `https://api.deepseek.com/v1` | OpenAI 兼容 |

**默认模型分配：**
- 分类识别 → 用于快速记录时的 AI 自动分类、导入数据时的 AI 解析
- 复习联想 → 用于复习卡片翻转时的 AI 实时内容生成
- AI 助手 → 用于 AI 助手对话

#### 学习偏好

- 每日新卡片上限（数字输入，默认 20）
- 每日复习上限（数字输入，默认 100）
- 界面主题（暗色 / 亮色切换）

---

## 7. AI 集成规格

### 7.1 统一调用接口

所有 AI 调用通过统一的服务层，根据用途自动选择对应的默认模型配置。

```typescript
interface AIRequest {
  purpose: 'classification' | 'review_association' | 'assistant'
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  stream?: boolean
}
```

### 7.2 各场景 Prompt 设计

#### 分类识别 Prompt

```
你是一个雅思学习笔记分类助手。根据用户输入的内容，判断它属于以下哪个分类：
- oral（口语）：口语常用表达、日常会话短句
- phrase（短语）：英语短语/词组及释义
- sentence（句子）：完整的句式/句型模板
- synonym（同义替换）：用等号或"="连接的同义词/近义词替换对
- spelling（拼写）：没有中文释义的英语单词（纯拼写练习）
- word（单词）：带有中文释义的单个英语单词

请只返回分类标识和提取的原始内容、中文释义（如有），JSON 格式：
{"category": "phrase", "content": "get out of", "meaning": "避免"}
```

#### 复习联想 Prompt（按子分类动态构建）

**口语/单词类：**
```
你是雅思学习的 AI 助手。为以下英语单词生成延伸学习内容：
单词：{content}
已知释义：{meaning}

请生成以下内容，JSON 格式返回：
{
  "phonetic": "音标",
  "meaning": "中文释义（如果更完整的话补充）",
  "synonyms": ["同义词/短语1", "同义词/短语2", ...],
  "antonyms": ["反义词1", "反义词2", ...],
  "example": {"en": "英语例句", "zh": "中文翻译"},
  "memory_tip": "记忆技巧"
}
```

**短语类：**
```
你是雅思学习的 AI 助手。为以下英语短语生成延伸学习内容：
短语：{content}
已知释义：{meaning}

请生成以下内容，JSON 格式返回：
{
  "phonetic": "音标",
  "meaning": "中文释义",
  "synonym_phrases": ["同义短语1", "同义短语2", ...],
  "antonym_phrases": ["反义短语1", "反义短语2", ...],
  "example": {"en": "英语例句", "zh": "中文翻译"},
  "memory_tip": "记忆技巧"
}
```

**同义替换类：**
```
你是雅思学习的 AI 助手。为以下同义替换对生成延伸学习内容：
同义替换：{content}
已知释义：{meaning}

请生成以下内容，JSON 格式返回：
{
  "phonetics": {"word1": "音标1", "word2": "音标2"},
  "detailed_meanings": {"word1": "详细释义（不同语义）", "word2": "详细释义"},
  "antonym_replacements": ["反义同义替换1", ...],
  "more_synonyms": ["更多同义替换1", ...],
  "example": {"en": "例句", "zh": "翻译"}
}
```

**句子类：**
```
你是雅思学习的 AI 助手。为以下英语句子/句式生成延伸学习内容：
句子：{content}
已知释义：{meaning}

请生成以下内容，JSON 格式返回：
{
  "meaning": "中文翻译",
  "structure_analysis": "句子结构解析",
  "synonym_sentences": [
    {"sentence": "同义替换后的句子1（不同结构/单词/短语）", "explanation": "替换说明"},
    ...
  ]
}
```

**拼写类：**
```
你是雅思学习的 AI 助手。为以下拼写练习单词生成延伸学习内容：
单词：{content}
已知释义：{meaning}（可能为空）

请生成以下内容，JSON 格式返回：
{
  "correct_spelling": "正确拼写",
  "meaning": "中文释义",
  "phonetic": "音标",
  "example": {"en": "例句", "zh": "翻译"},
  "common_misspellings": ["常见错误拼写1", ...],
  "memory_tip": "拼写记忆技巧"
}
```

### 7.3 AI Prompt 透明度（? 小标）

**所有涉及 AI 的功能旁边都有一个 `?` 小图标**（Tooltip），鼠标悬停时显示对应操作的白话版 Prompt 描述，让用户理解 AI 在做什么。

示例：
- 快速记录的 AI 识别 `?` → "AI 会根据你输入的内容判断它是口语、短语、句子、同义替换、拼写还是单词，没写中文的算拼写，有等号的算同义替换"
- 复习卡片的 AI 生成 `?` → "AI 会为这个{类型}实时生成中文意思、同义词、反义词、音标等延伸内容，每次可能不同"
- 导入数据的 AI 识别 `?` → "AI 会解析你的笔记文件，自动拆分为一条条知识，并判断每条的分类"

---

## 8. 写作笔记的特殊处理

写作笔记**不做复杂操作**，核心逻辑：

1. **导入：** 用户选择 Markdown 文件后选择「写作」类型，系统仅存储该文件的**绝对路径**
2. **知识库展示：** 写作笔记在知识库中显示文件名、路径、标签为「文件」
3. **详情页展示：** 点击后读取绝对路径对应的 Markdown 文件，用 Markdown 解析器精美渲染：
   - 支持标题、列表、表格、代码块、引用等标准 Markdown 语法
   - **支持本地图片**：解析 Markdown 中的相对路径图片引用（如 `./assets/image.png`），基于文件所在目录解析为绝对路径，通过 API 端点提供图片服务
   - 支持语法高亮
4. **复习：** 写作笔记在复习选择中作为独立大分类出现（显示篇数），复习时以 Markdown 渲染全文阅读模式展示

---

## 9. 全局交互规范

### 9.1 顶部导航栏

```
[当前页面标题]                    [⌘K 搜索笔记...]  [AI 助手 Ctrl+/]  [+ 添加笔记]
```

- 搜索框：点击或 Cmd+K 打开全局搜索 Modal
- AI 助手：点击或 Ctrl+/ 打开 AI 助手侧滑面板
- 添加笔记：点击打开快速记录 Modal（**不是**跳转到知识库添加页面）

### 9.2 响应式设计

- 主要适配 1440×960 桌面分辨率（参照设计稿尺寸）
- 侧边栏宽度 240px，可折叠
- 内容区自适应剩余宽度

### 9.3 主题

- 默认暗色主题
- 支持亮色主题切换（在设置中配置）
- 使用 CSS 变量管理主题色

---

## 10. 开发注意事项

### 10.1 必须修复的核心问题

1. **AI 配置可用性**：API Key 编辑回显、测试连接使用正确的 URL 和格式
2. **侧边栏导航响应**：所有分类点击都必须有路由响应
3. **搜索功能可用**：Cmd+K 搜索必须能搜索到知识库内容
4. **添加笔记入口统一**：所有「添加笔记」按钮都打开同一个快速记录 Modal，不做页面跳转
5. **笔记数据模型正确**：杂笔记只存原始内容+释义+分类，延伸内容在复习时 AI 实时生成

### 10.2 数据流要点

```
导入/手动添加 → notes 表（原始内容）
                ↓
复习翻卡 → AI 实时生成延伸内容（不进 DB）
                ↓
用户点击「存入」→ note_extensions 表（关联原始笔记）
                ↓
知识详情页 ← 聚合 notes + note_extensions + note_memos
```

### 10.3 AI 调用的查重逻辑

当用户在复习卡片中点击「存入」时：
1. 检查 `note_extensions` 表中是否已存在相同 `note_id` + `ext_type` 的记录
2. 对 `content` 做文本相似度比较（可用简单的字符串相似度或调用 AI 做语义级判重）
3. 如果发现重复，提示用户「该内容已存在，是否仍要保存？」

### 10.4 文件结构建议

```
ieltsmate/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页/仪表盘
│   │   ├── knowledge/
│   │   │   ├── page.tsx        # 知识库列表
│   │   │   └── [id]/
│   │   │       └── page.tsx    # 知识详情
│   │   ├── review/
│   │   │   ├── page.tsx        # 复习选择
│   │   │   ├── session/
│   │   │   │   └── page.tsx    # 复习闪卡
│   │   │   └── summary/
│   │   │       └── page.tsx    # 复习小结
│   │   ├── settings/
│   │   │   └── page.tsx        # 设置
│   │   ├── api/                # API 路由
│   │   │   ├── notes/
│   │   │   ├── ai/
│   │   │   ├── review/
│   │   │   ├── settings/
│   │   │   ├── import/
│   │   │   ├── chat/
│   │   │   └── files/          # 本地文件服务（图片等）
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/             # 侧边栏、顶部导航栏
│   │   ├── notes/              # 笔记相关组件
│   │   ├── review/             # 复习相关组件（闪卡等）
│   │   ├── ai/                 # AI 助手面板
│   │   ├── modals/             # 快速记录、搜索等 Modal
│   │   └── ui/                 # shadcn/ui 基础组件
│   ├── lib/
│   │   ├── db/                 # Drizzle ORM schema + 迁移
│   │   ├── ai/                 # AI 服务层（统一调用接口）
│   │   └── utils/              # 工具函数
│   └── hooks/                  # 自定义 React Hooks
├── drizzle/                    # 数据库迁移文件
├── 笔记/                       # 用户笔记素材（不纳入应用代码）
├── ieltsmate.pen               # UI 设计稿
├── prompt.md                   # 本文档
├── package.json
├── tailwind.config.ts
├── drizzle.config.ts
└── tsconfig.json
```

---

## 11. 硅基流动 API 配置参考

用于开发和测试时验证 AI 功能的参考配置：

| 字段 | 值 |
|------|-----|
| 名称 | 硅基流动 |
| Provider | openai-compatible |
| Base URL | `https://api.siliconflow.cn/v1` |
| API Key | `sk-jhyeofdhmibwjesijkipkwihboldvghwcmnjlzjuuemivmdm` |
| 模型 1 | `Pro/zai-org/GLM-5` |
| 模型 2 | `Pro/MiniMaxAI/MiniMax-M2.5` |

**调用示例（标准 OpenAI 兼容格式）：**
```bash
curl -X POST https://api.siliconflow.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-jhyeofdhmibwjesijkipkwihboldvghwcmnjlzjuuemivmdm" \
  -d '{
    "model": "Pro/zai-org/GLM-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```
