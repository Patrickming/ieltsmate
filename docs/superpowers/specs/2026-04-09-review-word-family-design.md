# 复习卡片扩展：词性派生（Word Family）设计说明

**日期**: 2026-04-09  
**状态**: 已确认（用户授权跳过过目环节，直接进入下一阶段）

## 目标

在 `单词(word-speech)` 与 `拼写(spelling)` 卡片背面新增“词性派生”能力，满足以下学习体验：

1. 先展示当前词（当前词性 + 含义 + 音标）
2. 再展示该词在不同词性的派生形式（名词/动词/形容词/副词）
3. 每个派生项包含：**派生词 + 词性 + 中文义 + 音标**
4. 若某词性无派生项，明确显示“无”
5. 支持“单条存入”与“一键存入整组”
6. 一键存入时检查重复并合并，不破坏既有数据

## 范围

- **包含**：
  - `word-speech` 与 `spelling` 背面新增“词性派生”视图
  - 后端 `Note` 新增 `wordFamily` 字段（结构化）
  - AI 生成协议扩展（仅目标两类卡）
  - 单条/整组存入与去重
- **不包含**：
  - `phrase` / `synonym` / `sentence` 卡片扩展
  - 跨笔记全库词族推荐
  - 对旧 `partsOfSpeech/confusables` 语义做替换

## 数据模型设计

在 `Note` 上新增可选字段：

- `wordFamily Json?`

### 逻辑结构

```ts
type Pos4 = 'noun' | 'verb' | 'adjective' | 'adverb'

type WordFamilyItem = {
  word: string
  pos: Pos4
  meaning: string
  phonetic: string
}

type WordFamily = {
  base: {
    word: string
    pos: Pos4 | 'other'
    meaning: string
    phonetic?: string
  }
  derivedByPos: {
    noun: WordFamilyItem[]
    verb: WordFamilyItem[]
    adjective: WordFamilyItem[]
    adverb: WordFamilyItem[]
  }
}
```

### 数据约束

- `base.word` / `base.pos` / `base.meaning` 必填
- `derivedByPos` 的四个分区固定存在（允许空数组）
- 每个 `WordFamilyItem` 必须包含 `word`/`pos`/`meaning`/`phonetic`
- `WordFamilyItem.pos` 必须与所在分区一致

## 存入与去重规则

## 1) 单条存入

- 输入：一个 `WordFamilyItem`
- 处理：
  - 读取当前 note 的 `wordFamily`
  - 将该 item 放入对应 `derivedByPos[pos]`
  - 执行去重后写回

## 2) 一键存入整组

- 输入：当前卡片可见的全部派生项
- 处理：
  - 内部逐条按“单条存入逻辑”合并到内存结果
  - 最终一次 PATCH 提交

## 3) 去重键

- 去重键：`word + pos + meaning`（全部 `trim + lower` 归一化）
- 判重范围：
  - 知识库已有 `wordFamily` 数据
  - 本次批量待写入队列
- 行为：
  - 重复项跳过
  - 非重复项写入

## 4) 结果反馈

- 单条：`已存入` 或 `已存在`
- 一键：`新增 X 条，跳过重复 Y 条（失败 Z 条）`

## AI 协议扩展（仅目标两类）

在 `word-speech` 与 `spelling` 的 AI JSON 中新增可选字段：

```json
{
  "wordFamily": {
    "base": { "word": "popular", "pos": "adjective", "meaning": "受欢迎的", "phonetic": "/ˈpɒpjələ(r)/" },
    "derivedByPos": {
      "noun": [{ "word": "popularity", "pos": "noun", "meaning": "受欢迎；普及", "phonetic": "/ˌpɒpjuˈlærəti/" }],
      "verb": [{ "word": "popularize", "pos": "verb", "meaning": "使普及", "phonetic": "/ˈpɒpjələraɪz/" }],
      "adjective": [],
      "adverb": [{ "word": "popularly", "pos": "adverb", "meaning": "普遍地", "phonetic": "/ˈpɒpjələli/" }]
    }
  }
}
```

兼容策略：

- AI 不返回 `wordFamily`：前端显示“暂无词性派生数据”或继续显示旧视图
- AI 返回非法结构：忽略该字段，不影响整卡 fallback 逻辑

## 前端交互设计

在 `word-speech` 与 `spelling` 背面顶部增加三段切换：

1. `学习内容`（现有）
2. `词性派生`（新增）
3. `易混淆词`（现有）

交互约束：

- 默认落在 `学习内容`
- 换卡时重置回 `学习内容`
- 切换不影响翻卡、评分、进度

### 词性派生页布局

1. **当前词信息**
   - 当前词、当前词性、当前义、当前音标
2. **派生分区（四段固定）**
   - 名词 / 动词 / 形容词 / 副词
   - 有数据则逐条卡片展示
   - 无数据显示 `无`
3. **操作区**
   - 单条存入按钮（每条）
   - 一键存入整组按钮（全局）

## 兼容与回归护栏

1. 旧字段（`synonyms`/`antonyms`/`partsOfSpeech`/`confusables`）不删不改
2. 新字段 `wordFamily` 独立，不覆盖旧字段
3. `phrase/synonym/sentence` 不显示“词性派生”入口
4. 保存失败仅影响当前操作，给出局部提示，可重试

## 测试计划

### 后端

- `Note` create/update 支持 `wordFamily`
- 单条与整组去重正确
- 非法结构被拒绝或清洗
- AI 解析兼容：有/无 `wordFamily` 均不影响主结构

### 前端

- `word-speech`/`spelling` 显示“词性派生”页签
- 其他类型不显示该页签
- 某词性无数据显示 `无`
- 单条存入触发正确写入
- 一键存入统计新增/重复
- 存入失败提示 + 可重试
- 评分/翻卡/斩击流程不回归

## 风险与缓解

- **风险**：AI 词性标注不稳定  
  **缓解**：后端严格校验 `pos`，非法项丢弃
- **风险**：一键存入重复写入  
  **缓解**：统一去重键 + 一次性写入
- **风险**：背面信息拥挤  
  **缓解**：独立“词性派生”页，不与学习内容混排

## 验收标准

1. 目标两类卡能看到“当前词 + 四类派生词性”结构
2. 空分区明确显示 `无`
3. 支持单条存入与一键存入
4. 一键存入能正确去重并给出统计
5. 既有复习与存入功能无回归
