# Review Association Meanings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为复习卡同义词/反义词建立“生成即带释义、存入必带释义”的统一链路，并兼容现有 `String[]` 知识库存储。

**Architecture:** 后端将同反义 AI 协议统一为结构化 `AssociationItem`（`word + meaning`）并做严格解析；前端统一以结构化对象渲染与保存，在落库前收口序列化为 `word (meaning)`。数据库字段保持不变，历史字符串数据继续兼容显示与去重。

**Tech Stack:** NestJS, Prisma, TypeScript, React, Zustand, Vitest, Jest

---

## Scope Check

该 spec 属于单一子系统（“复习卡关联词释义链路”），可在一份计划内完成，不需要拆分多份 plan。

## File Structure

- Modify: `backend/src/review/types/card-ai-content.ts`
- Modify: `backend/src/review/review-ai-content.util.ts`
- Modify: `backend/src/review/review-ai.service.ts`
- Modify: `backend/test/review-ai-content.e2e-spec.ts`
- Modify: `backend/test/notes.e2e-spec.ts` (仅在需要时补充兼容断言)

- Modify: `frontend/src/pages/ReviewCards.tsx`
- Modify: `frontend/src/lib/associationDedup.ts`
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`
- Modify: `frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts` (仅在需要时补充保存载荷断言)

---

### Task 1: 后端定义统一 AssociationItem 类型

**Files:**
- Modify: `backend/src/review/types/card-ai-content.ts`
- Test: `backend/test/review-ai-content.e2e-spec.ts`

- [ ] **Step 1: 先写失败测试（新结构字段）**

```ts
// backend/test/review-ai-content.e2e-spec.ts
import { parseReviewAiPayload } from '../src/review/review-ai-content.util'

it('parses association items for word-speech', () => {
  const out = parseReviewAiPayload(
    {
      fallback: false,
      phonetic: '/pəˈpjuːlər/',
      synonyms: [{ word: 'common', meaning: '常见的；普遍的' }],
      antonyms: [{ word: 'rare', meaning: '稀少的；罕见的' }],
      example: 'This style is popular among teenagers.',
      memoryTip: 'pop+ular => people love it',
    },
    'word-speech',
  )
  expect(out && out.fallback === false).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: FAIL（当前 `synonyms/antonyms` 仍是 `string[]`）。

- [ ] **Step 3: 更新类型定义为结构化关联项**

```ts
// backend/src/review/types/card-ai-content.ts
export interface AssociationItem {
  word: string
  meaning: string
}

export interface WordSpeechAI {
  fallback: false
  phonetic: string
  synonyms: AssociationItem[]
  antonyms: AssociationItem[]
  // ...
}

export interface PhraseAI { /* synonyms/antonyms 同步改为 AssociationItem[] */ }
export interface SpellingAI { /* synonyms/antonyms 同步改为 AssociationItem[] */ }
export interface SynonymAI {
  fallback: false
  wordMeanings: Array<{ word: string; phonetic: string; meaning: string }>
  antonymGroup: AssociationItem[]
  moreSynonyms: AssociationItem[]
}
```

- [ ] **Step 4: 重跑测试确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: PASS。

- [ ] **Step 5: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 2: 后端解析器接入严格校验（meaning 必填）

**Files:**
- Modify: `backend/src/review/review-ai-content.util.ts`
- Modify: `backend/test/review-ai-content.e2e-spec.ts`

- [ ] **Step 1: 先写失败测试（缺释义应失败）**

```ts
// backend/test/review-ai-content.e2e-spec.ts
it('rejects association item when meaning is empty', () => {
  const out = parseReviewAiPayload(
    {
      fallback: false,
      phonetic: '/x/',
      synonyms: [{ word: 'fast', meaning: '   ' }],
      antonyms: [{ word: 'slow', meaning: '慢的' }],
      example: 'A fast runner.',
      memoryTip: 'f-a-s-t',
    },
    'word-speech',
  )
  expect(out).toBeNull()
})
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: FAIL（当前不会按 `meaning` 非空校验）。

- [ ] **Step 3: 实现统一 association 解析函数**

```ts
// backend/src/review/review-ai-content.util.ts
function parseAssociationItems(x: unknown): AssociationItem[] | null {
  if (!Array.isArray(x)) return null
  const out: AssociationItem[] = []
  for (const row of x) {
    if (!row || typeof row !== 'object') return null
    const o = row as Record<string, unknown>
    const word = typeof o.word === 'string' ? o.word.trim() : ''
    const meaning = typeof o.meaning === 'string' ? o.meaning.trim() : ''
    if (!word || !meaning) return null
    out.push({ word, meaning })
  }
  return out
}
```

- [ ] **Step 4: 接入 word-speech/phrase/spelling/synonym 解析分支**

```ts
// 例：word-speech 分支
const synonyms = parseAssociationItems(p.synonyms)
const antonyms = parseAssociationItems(p.antonyms)
if (!synonyms || !antonyms) return null
return { fallback: false, phonetic: p.phonetic, synonyms, antonyms, ... }
```

- [ ] **Step 5: 重跑测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: PASS。

- [ ] **Step 6: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 3: 后端 Prompt 改造为结构化释义输出

**Files:**
- Modify: `backend/src/review/review-ai.service.ts`
- Test: `backend/test/review-ai-content.e2e-spec.ts`

- [ ] **Step 1: 先写失败测试（提示词包含 word+meaning）**

```ts
// backend/test/review-ai-content.e2e-spec.ts
// 通过调用 buildPrompt 或等效可观测路径断言字段样例
expect(promptText).toContain('"synonyms": [{ "word":')
expect(promptText).toContain('"meaning":')
expect(promptText).toContain('meaning 必填')
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: FAIL（提示词仍为字符串数组样例）。

- [ ] **Step 3: 修改四类卡 prompt JSON 模板**

```ts
// backend/src/review/review-ai.service.ts (示例片段)
"synonyms": [
  { "word": "common", "meaning": "常见的；普遍的" },
  { "word": "well-liked", "meaning": "受欢迎的，强调被人喜爱" }
],
"antonyms": [
  { "word": "rare", "meaning": "罕见的；不常发生的" }
]
```

```ts
// synonym 卡片
"antonymGroup": [
  { "word": "delay", "meaning": "延迟；推后" }
],
"moreSynonyms": [
  { "word": "prompt", "meaning": "迅速的；及时的" }
]
```

- [ ] **Step 4: 明确约束文案**

```txt
word 与 meaning 均必须为非空字符串；
meaning 必须给出具体中文释义（可补充细微语义差别）；
只返回 JSON，不要额外文本。
```

- [ ] **Step 5: 重跑测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts -i`  
Expected: PASS。

- [ ] **Step 6: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 4: 前端展示与保存统一为“对象输入、字符串落库”

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Modify: `frontend/src/lib/associationDedup.ts`
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`
- Modify: `frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts`

- [ ] **Step 1: 先写失败测试（保存载荷含 `word (meaning)`）**

```ts
// frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx
it('saves synonym with meaning into note payload', async () => {
  // mock aiContent.synonyms = [{ word: 'common', meaning: '常见的' }]
  // click “存入”
  // expect updateNote called with { synonyms: expect.arrayContaining(['common (常见的)']) }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx`  
Expected: FAIL（当前保存参数为纯字符串词面）。

- [ ] **Step 3: 新增格式化/解析工具函数**

```ts
// frontend/src/lib/associationDedup.ts
export function formatAssociationItem(word: string, meaning: string): string {
  const w = word.trim()
  const m = meaning.trim()
  if (!w || !m) return ''
  return `${w} (${m})`
}

export function parseAssociationDisplay(input: string): { word: string; meaning: string } {
  const t = input.trim()
  const m = t.match(/^(.*?)\s*\((.*)\)$/)
  if (!m) return { word: t, meaning: '' }
  return { word: m[1].trim(), meaning: m[2].trim() }
}
```

- [ ] **Step 4: 改造 ReviewCards 的 SaveChip / handleSaveSyn / handleSaveAnt**

```tsx
// ReviewCards.tsx (示例)
type Assoc = { word: string; meaning: string }

function SaveChip({ item, saved, onSave }: { item: Assoc; saved: boolean; onSave: (i: Assoc) => void }) {
  return (
    <div>
      <span>{item.word}</span>
      <span>{item.meaning}</span>
      <button onClick={() => onSave(item)}>存入</button>
    </div>
  )
}

const payloadValue = formatAssociationItem(item.word, item.meaning)
if (!payloadValue) return
await updateNote(card.id, { synonyms: mergeAssociationListsUnique(base, [payloadValue]) })
```

- [ ] **Step 5: 兼容旧数据与冲突确认**

```ts
// 仍使用 extractAssociationKey 比较词头；对 "word" 与 "word (meaning)" 均能抽取同一 key
const conflicts = findConflictingAssociationEntries(candidateFormatted, existingList)
```

- [ ] **Step 6: 重跑前端测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: PASS。

- [ ] **Step 7: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 5: 全量回归与文档收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-04-09-review-association-meanings-design.md` (仅回写实施结果时)

- [ ] **Step 1: 后端回归测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts notes.e2e-spec.ts`  
Expected: PASS。

- [ ] **Step 2: 前端回归测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx src/pages/__tests__/ReviewCards.user-notes.test.tsx src/pages/__tests__/ReviewCards.slash.test.tsx src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: PASS。

- [ ] **Step 3: Lint 检查**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run lint`  
Expected: 无新增 lint 错误。

- [ ] **Step 4: 更新 spec 实施结果段**

```md
## 实施结果（YYYY-MM-DD）
- [x] 四类卡片同反义生成结构化并带释义
- [x] 复习页保存落库统一为 word (meaning)
- [x] 去重与冲突确认兼容新旧数据
- [x] 前后端回归测试通过
```

- [ ] **Step 5: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

## Self-Review

- Spec coverage: 已覆盖生成、解析、展示、存入、兼容、测试与回归。
- Placeholder scan: 无 `TODO/TBD/implement later` 等占位语。
- Type consistency: `AssociationItem`、`formatAssociationItem`、`word (meaning)` 在各任务中命名一致。

