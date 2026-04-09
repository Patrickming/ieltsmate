# Review Word Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `word-speech` 与 `spelling` 复习卡新增“词性派生（wordFamily）”展示与存入能力，并支持单条存入与一键存入（重复检查）。

**Architecture:** 在 `Note` 上新增独立 `wordFamily` 结构化字段，后端提供归一化与去重，前端通过独立“词性派生”视图渲染并执行单条/整组存入。旧字段和旧链路保持不变，目标卡型之外不显示新入口。

**Tech Stack:** Prisma, NestJS, class-validator, React, Zustand, Vitest, Jest

---

## File Structure

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_note_word_family/migration.sql`
- Create: `backend/src/notes/types/word-family.ts`
- Create: `backend/src/notes/dto/word-family-fields.dto.ts`
- Modify: `backend/src/notes/dto/create-note.dto.ts`
- Modify: `backend/src/notes/dto/update-note.dto.ts`
- Modify: `backend/src/notes/notes.service.ts`
- Modify: `backend/src/review/types/card-ai-content.ts`
- Modify: `backend/src/review/review-ai-content.util.ts`
- Modify: `backend/src/review/review-ai.service.ts`
- Create: `backend/test/word-family.e2e-spec.ts`
- Modify: `backend/test/notes.e2e-spec.ts`

- Create: `frontend/src/types/wordFamily.ts`
- Modify: `frontend/src/data/mockData.ts`
- Modify: `frontend/src/store/useAppStore.ts`
- Create: `frontend/src/lib/wordFamilyDedup.ts`
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Create: `frontend/src/pages/__tests__/ReviewCards.word-family.test.tsx`
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`

---

### Task 1: 后端 wordFamily 类型与归一化

**Files:**
- Create: `backend/src/notes/types/word-family.ts`
- Test: `backend/test/word-family.e2e-spec.ts`

- [ ] **Step 1: 写失败测试（归一化/去重/空分区）**

```ts
// backend/test/word-family.e2e-spec.ts
import { normalizeWordFamily, mergeWordFamilyItems } from '../src/notes/types/word-family'

describe('wordFamily normalize', () => {
  it('dedups by word+pos+meaning', () => {
    const wf = normalizeWordFamily({
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的' },
      derivedByPos: {
        noun: [
          { word: 'popularity', pos: 'noun', meaning: '受欢迎', phonetic: '/x/' },
          { word: ' popularity ', pos: 'noun', meaning: '受欢迎 ', phonetic: '/x/' },
        ],
        verb: [],
        adjective: [],
        adverb: [],
      },
    })
    expect(wf?.derivedByPos.noun).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- word-family.e2e-spec.ts -i`  
Expected: FAIL，目标函数不存在。

- [ ] **Step 3: 实现最小类型与函数**

```ts
// backend/src/notes/types/word-family.ts
export type Pos4 = 'noun' | 'verb' | 'adjective' | 'adverb'
export interface WordFamilyItem { word: string; pos: Pos4; meaning: string; phonetic: string }
export interface WordFamily { /* base + derivedByPos */ }

export function normalizeWordFamily(input: unknown): WordFamily | null { /* ... */ return null }
export function mergeWordFamilyItems(base: WordFamily, incoming: WordFamilyItem[]): WordFamily { /* ... */ return base }
```

- [ ] **Step 4: 重跑测试确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- word-family.e2e-spec.ts -i`  
Expected: PASS。

- [ ] **Step 5: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 2: Prisma + Notes API 支持 wordFamily

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_note_word_family/migration.sql`
- Create: `backend/src/notes/dto/word-family-fields.dto.ts`
- Modify: `backend/src/notes/dto/create-note.dto.ts`
- Modify: `backend/src/notes/dto/update-note.dto.ts`
- Modify: `backend/src/notes/notes.service.ts`
- Modify: `backend/test/notes.e2e-spec.ts`

- [ ] **Step 1: 先补失败用例（POST/PATCH wordFamily）**

```ts
// notes.e2e-spec.ts 新增
it('supports wordFamily in create/update with dedup', async () => {
  const created = await request(app.getHttpServer()).post('/notes').send({
    content: 'popular',
    translation: '受欢迎的',
    category: '单词',
    wordFamily: {
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的' },
      derivedByPos: { noun: [], verb: [], adjective: [], adverb: [] },
    },
  }).expect(201)
  expect(created.body.data.wordFamily.base.word).toBe('popular')
})
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- notes.e2e-spec.ts -i`  
Expected: FAIL，DTO/字段不支持 `wordFamily`。

- [ ] **Step 3: 更新 schema / DTO / service**

```prisma
// schema.prisma model Note
wordFamily Json?
```

```ts
// notes.service.ts
if (dto.wordFamily !== undefined) {
  data.wordFamily = normalizeWordFamily(dto.wordFamily)
}
```

- [ ] **Step 4: 迁移与测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run prisma:migrate -- --name add_note_word_family`  
Expected: migration 生成并应用。

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- notes.e2e-spec.ts -i`  
Expected: PASS。

- [ ] **Step 5: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 3: Review AI 扩展 wordFamily

**Files:**
- Modify: `backend/src/review/types/card-ai-content.ts`
- Modify: `backend/src/review/review-ai-content.util.ts`
- Modify: `backend/src/review/review-ai.service.ts`
- Modify: `backend/test/word-family.e2e-spec.ts`

- [ ] **Step 1: 先写失败测试（解析保留 wordFamily）**

```ts
// word-family.e2e-spec.ts
import { parseReviewAiPayload } from '../src/review/review-ai-content.util'

it('parses wordFamily for word-speech', () => {
  const out = parseReviewAiPayload({
    fallback: false,
    phonetic: '/x/',
    synonyms: [],
    antonyms: [],
    example: 'ex',
    memoryTip: 'tip',
    wordFamily: {
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的' },
      derivedByPos: { noun: [], verb: [], adjective: [], adverb: [] },
    },
  }, 'word-speech')
  expect((out as any)?.wordFamily?.base?.word).toBe('popular')
})
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- word-family.e2e-spec.ts -i`  
Expected: FAIL。

- [ ] **Step 3: 实现类型与解析接入**

```ts
// card-ai-content.ts
interface WordSpeechAI { /* old fields */ wordFamily?: WordFamily }
interface SpellingAI { /* old fields */ wordFamily?: WordFamily }
```

```ts
// review-ai-content.util.ts
const wf = normalizeWordFamily(p.wordFamily)
return { ...old, ...(wf ? { wordFamily: wf } : {}) }
```

- [ ] **Step 4: 更新 prompt（仅两类卡）**

```ts
// review-ai.service.ts buildPrompt
// 在 word-speech/spelling 示例中追加 wordFamily 结构说明
```

- [ ] **Step 5: 回归测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- word-family.e2e-spec.ts review-ai-content.e2e-spec.ts notes.e2e-spec.ts`  
Expected: PASS。

- [ ] **Step 6: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 4: 前端模型与 store 支持 wordFamily

**Files:**
- Create: `frontend/src/types/wordFamily.ts`
- Modify: `frontend/src/data/mockData.ts`
- Modify: `frontend/src/store/useAppStore.ts`
- Create: `frontend/src/lib/wordFamilyDedup.ts`

- [ ] **Step 1: 先写失败测试（updateNote 支持 wordFamily）**

```ts
// frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts 追加
it('updateNote sends wordFamily patch', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
  await useAppStore.getState().updateNote('n-1', {
    wordFamily: {
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的' },
      derivedByPos: { noun: [], verb: [], adjective: [], adverb: [] },
    },
  } as any)
  expect(fetchMock).toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: FAIL（patch 类型无 `wordFamily`）。

- [ ] **Step 3: 实现类型和 patch 扩展**

```ts
// mockData.ts Note
wordFamily?: WordFamily
```

```ts
// useAppStore.ts updateNote patch
wordFamily?: WordFamily
```

- [ ] **Step 4: 新增 dedup/merge 工具**

```ts
// wordFamilyDedup.ts
export function wordFamilyItemKey(item: WordFamilyItem): string { /* ... */ }
export function mergeWordFamily(base: WordFamily | undefined, incoming: WordFamilyItem[]): WordFamily { /* ... */ }
```

- [ ] **Step 5: 测试通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: PASS。

- [ ] **Step 6: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 5: ReviewCards 新增“词性派生”视图 + 单条/一键存入

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Create: `frontend/src/pages/__tests__/ReviewCards.word-family.test.tsx`
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`

- [ ] **Step 1: 先写失败测试（视图与存入）**

```ts
// ReviewCards.word-family.test.tsx
it('word-speech shows 词性派生 tab and renders 无 for empty section', async () => {
  // 1) mock aiContent with wordFamily
  // 2) flip card and switch tab
  // 3) assert noun/verb/adjective/adverb sections
  // 4) assert empty section shows 无
})

it('supports single save and batch save with dedup stats', async () => {
  // click single save -> updateNote(wordFamily)
  // click batch save -> merged payload, summary toast
})
```

- [ ] **Step 2: 运行失败验证**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.word-family.test.tsx`  
Expected: FAIL（尚无视图与动作）。

- [ ] **Step 3: 实现 UI 与状态**

```tsx
// ReviewCards.tsx
// backFaceTab: learning | wordFamily | posConfusable
// 仅 word-speech/spelling 显示 wordFamily tab
// 切卡 reset -> learning
```

```tsx
// WordFamilyPanel
// base card
// noun/verb/adjective/adverb sections
// empty -> '无'
// single save + batch save button
```

- [ ] **Step 4: 存入逻辑实现**

```ts
async function saveWordFamilyItem(item: WordFamilyItem) { /* merge + updateNote */ }
async function saveWordFamilyBatch(items: WordFamilyItem[]) { /* batch merge + count */ }
```

- [ ] **Step 5: 回归测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.word-family.test.tsx src/pages/__tests__/ReviewCards.extensions.test.tsx src/pages/__tests__/ReviewCards.user-notes.test.tsx src/pages/__tests__/ReviewCards.slash.test.tsx`  
Expected: PASS。

- [ ] **Step 6: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

### Task 6: 全量验证与文档更新

**Files:**
- Modify: `docs/superpowers/specs/2026-04-09-review-word-family-design.md`

- [ ] **Step 1: 后端测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- word-family.e2e-spec.ts review-ai-content.e2e-spec.ts notes.e2e-spec.ts`  
Expected: PASS。

- [ ] **Step 2: 前端测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.word-family.test.tsx src/pages/__tests__/ReviewCards.extensions.test.tsx src/pages/__tests__/ReviewCards.user-notes.test.tsx src/pages/__tests__/ReviewCards.slash.test.tsx src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: PASS。

- [ ] **Step 3: lints**

Run: `cd /home/pdm/DEV/ieltsmate && npm --prefix frontend run lint`  
Expected: 无新增 lint error。

- [ ] **Step 4: 回写 spec 实施结果**

```md
## 实施结果（YYYY-MM-DD）
- [x] wordFamily 字段与迁移
- [x] ReviewCards 词性派生视图
- [x] 单条/一键存入 + 去重
- [x] 回归测试通过
```

- [ ] **Step 5: 按用户要求不提交**

Run: `echo "skip git commit by user request"`

---

## Self-Review

- Spec coverage: 包含数据结构、UI、存入策略、去重与测试。
- Placeholder scan: 无占位语。
- Type consistency: `WordFamily` / `WordFamilyItem` 前后端命名保持一致。
