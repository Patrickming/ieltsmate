# Review POS & Confusables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `word-speech` 与 `spelling` 复习卡新增“词性 + 易混淆词”展示与“存入知识库”能力，同时保证既有复习/存入链路不回归。

**Architecture:** 采用“并行扩展”方案：后端 `Note` 新增 `partsOfSpeech` 与 `confusables` 两个可选 JSON 字段，前端在卡片背面通过“双视图切换”加载新内容。旧字段与旧视图全部保留，新存入动作只写新字段，不污染 `synonyms/antonyms`。AI 仅扩展 `word-speech` 与 `spelling` 的返回结构，并在解析层做字段级容错。

**Tech Stack:** Prisma + NestJS + class-validator + React + Zustand + Vitest + Jest(E2E)

---

## File Structure & Responsibilities

- Modify `backend/prisma/schema.prisma`
  - 为 `Note` 增加 JSON 可选字段：`partsOfSpeech`、`confusables`
- Modify `backend/src/notes/dto/create-note.dto.ts`
  - 新增可选 DTO 字段与验证约束
- Modify `backend/src/notes/dto/update-note.dto.ts`
  - 新增可选 DTO 字段与验证约束
- Modify `backend/src/notes/notes.service.ts`
  - 对新字段做归一化、去空与去重后写入
- Create `backend/src/notes/types/note-extensions.ts`
  - 后端词性/易混淆结构类型定义与归一化辅助函数
- Modify `backend/src/review/types/card-ai-content.ts`
  - 为 `WordSpeechAI`/`SpellingAI` 扩展新字段类型
- Create `backend/src/review/review-ai-content.util.ts`
  - AI JSON 解析 + 新字段容错归一化（可单测）
- Modify `backend/src/review/review-ai.service.ts`
  - 使用 util 解析，保持 fallback 行为一致
- Create `backend/test/review-ai-content.e2e-spec.ts`
  - 覆盖旧结构兼容与新结构解析
- Modify `backend/test/notes.e2e-spec.ts`
  - 覆盖新字段的创建/更新/去重

- Create `frontend/src/types/noteExtensions.ts`
  - 前端共享类型：`PartOfSpeechItem`、`ConfusableGroup`
- Modify `frontend/src/data/mockData.ts`
  - `Note` 接口新增 `partsOfSpeech`/`confusables`
- Modify `frontend/src/store/useAppStore.ts`
  - `updateNote` patch 类型与请求体支持新字段
- Modify `frontend/src/pages/ReviewCards.tsx`
  - `word-speech`/`spelling` 卡背新增双视图切换
  - 新增“词性/易混淆”渲染与存入动作
- Create `frontend/src/lib/noteExtensionsDedup.ts`
  - 前端新字段去重键生成与 merge 工具
- Create `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`
  - 视图切换、新模块展示、存入状态与回归断言

- Modify `docs/superpowers/specs/2026-04-09-review-pos-confusables-design.md`
  - 实施后补充“已实现差异（如有）”

---

### Task 1: 后端类型与归一化工具落位

**Files:**
- Create: `backend/src/notes/types/note-extensions.ts`
- Test: `backend/test/review-ai-content.e2e-spec.ts`（后续任务引用）

- [ ] **Step 1: 先写失败用例（归一化/去重行为）**

```ts
// backend/test/review-ai-content.e2e-spec.ts
import { normalizePartOfSpeechList, normalizeConfusableGroups } from '../src/notes/types/note-extensions'

describe('note extension normalizers', () => {
  it('dedup partsOfSpeech by pos+meaning', () => {
    const out = normalizePartOfSpeechList([
      { pos: 'noun', label: '名词', meaning: '条纹' },
      { pos: 'noun', label: '名词', meaning: ' 条纹 ' },
    ])
    expect(out).toHaveLength(1)
  })

  it('drops invalid confusable meaning group without difference', () => {
    const out = normalizeConfusableGroups([
      { kind: 'meaning', words: [{ word: 'affect', meaning: '影响' }, { word: 'effect', meaning: '效果' }] },
    ])
    expect(out).toEqual([])
  })
})
```

- [ ] **Step 2: 运行单测确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts`  
Expected: FAIL，提示 `normalizePartOfSpeechList`/`normalizeConfusableGroups` 未定义。

- [ ] **Step 3: 实现最小可用类型与归一化函数**

```ts
// backend/src/notes/types/note-extensions.ts
export type PosValue = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'phrase' | 'other'

export interface PartOfSpeechItem {
  pos: PosValue
  label: string
  phonetic?: string
  meaning: string
  example?: string
  exampleTranslation?: string
}

export interface ConfusableWord {
  word: string
  phonetic?: string
  meaning: string
}

export interface ConfusableGroup {
  kind: 'form' | 'meaning'
  words: ConfusableWord[]
  difference?: string
}

export function normalizePartOfSpeechList(input: unknown): PartOfSpeechItem[] { /* 归一化 + 去重实现 */ return [] }
export function normalizeConfusableGroups(input: unknown): ConfusableGroup[] { /* 归一化 + 去重实现 */ return [] }
```

- [ ] **Step 4: 重新运行用例确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts`  
Expected: PASS（2 tests passed）。

- [ ] **Step 5: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add backend/src/notes/types/note-extensions.ts backend/test/review-ai-content.e2e-spec.ts
git commit -m "test: add note extension normalizers for pos/confusables"
```

---

### Task 2: Prisma + Notes API 支持新字段

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/notes/dto/create-note.dto.ts`
- Modify: `backend/src/notes/dto/update-note.dto.ts`
- Modify: `backend/src/notes/notes.service.ts`
- Modify: `backend/test/notes.e2e-spec.ts`

- [ ] **Step 1: 写失败用例（创建/更新含新字段）**

```ts
// backend/test/notes.e2e-spec.ts (新增一个 it)
it('POST/PATCH /notes supports partsOfSpeech and confusables', async () => {
  const created = await request(app.getHttpServer())
    .post('/notes')
    .send({
      content: 'strip',
      translation: '剥去；条状物',
      category: '单词',
      partsOfSpeech: [{ pos: 'noun', label: '名词', meaning: '条状物' }],
      confusables: [{
        kind: 'form',
        words: [{ word: 'strip', meaning: '剥去' }, { word: 'stripe', meaning: '条纹' }],
      }],
    })
    .expect(201)

  const id = created.body.data.id as string
  expect(created.body.data.partsOfSpeech).toHaveLength(1)

  const patched = await request(app.getHttpServer())
    .patch(`/notes/${id}`)
    .send({
      partsOfSpeech: [
        { pos: 'noun', label: '名词', meaning: '条状物' },
        { pos: 'noun', label: '名词', meaning: ' 条状物 ' },
      ],
    })
    .expect(200)
  expect(patched.body.data.partsOfSpeech).toHaveLength(1)
})
```

- [ ] **Step 2: 运行该用例确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- notes.e2e-spec.ts`  
Expected: FAIL，提示 DTO 不识别新字段或返回体不含新字段。

- [ ] **Step 3: 更新 Prisma schema 与迁移**

```prisma
// backend/prisma/schema.prisma (model Note)
partsOfSpeech Json?
confusables   Json?
```

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run prisma:migrate -- --name note_pos_confusables`  
Expected: migration created + applied, Prisma Client regenerated.

- [ ] **Step 4: 更新 DTO 与 service 写入逻辑**

```ts
// create-note.dto.ts / update-note.dto.ts
@IsOptional()
@IsArray()
partsOfSpeech?: PartOfSpeechItem[]

@IsOptional()
@IsArray()
confusables?: ConfusableGroup[]
```

```ts
// notes.service.ts (update)
if (dto.partsOfSpeech !== undefined) {
  data.partsOfSpeech = normalizePartOfSpeechList(dto.partsOfSpeech)
}
if (dto.confusables !== undefined) {
  data.confusables = normalizeConfusableGroups(dto.confusables)
}
```

- [ ] **Step 5: 重新跑 notes e2e 确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- notes.e2e-spec.ts`  
Expected: PASS（原有 notes 用例 + 新增用例全部通过）。

- [ ] **Step 6: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/notes backend/test/notes.e2e-spec.ts
git commit -m "feat: add note-level pos and confusables fields"
```

---

### Task 3: Review AI 内容协议扩展与容错解析

**Files:**
- Modify: `backend/src/review/types/card-ai-content.ts`
- Create: `backend/src/review/review-ai-content.util.ts`
- Modify: `backend/src/review/review-ai.service.ts`
- Modify: `backend/test/review-ai-content.e2e-spec.ts`

- [ ] **Step 1: 先补失败用例（旧结构兼容 + 新结构提取）**

```ts
// backend/test/review-ai-content.e2e-spec.ts
import { parseReviewAiPayload } from '../src/review/review-ai-content.util'

it('accepts legacy payload without partsOfSpeech/confusables', () => {
  const out = parseReviewAiPayload({ fallback: false, phonetic: '/həʊˈtel/', synonyms: [], antonyms: [], example: 'x', memoryTip: 'x' }, 'word-speech')
  expect(out.fallback).toBe(false)
})

it('normalizes new payload fields for word-speech', () => {
  const out = parseReviewAiPayload({
    fallback: false,
    phonetic: '/strɪp/',
    synonyms: [],
    antonyms: [],
    example: 'x',
    memoryTip: 'x',
    partsOfSpeech: [{ pos: 'noun', label: '名词', meaning: '条状物' }],
    confusables: [{ kind: 'form', words: [{ word: 'strip', meaning: '剥去' }, { word: 'stripe', meaning: '条纹' }] }],
  }, 'word-speech')
  expect((out as any).partsOfSpeech).toHaveLength(1)
  expect((out as any).confusables).toHaveLength(1)
})
```

- [ ] **Step 2: 运行用例确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts`  
Expected: FAIL，提示 `parseReviewAiPayload` 未实现。

- [ ] **Step 3: 实现 util 并接入 ReviewAiService**

```ts
// review-ai-content.util.ts
export function parseReviewAiPayload(payload: unknown, cardType: CardType): CardAIContent | null {
  // 1) 校验 fallback:false
  // 2) 对 word-speech/spelling 注入 normalizePartOfSpeechList + normalizeConfusableGroups
  // 3) 其他 cardType 按旧结构透传
  return null
}
```

```ts
// review-ai.service.ts parseAIResponse 中
const parsed = JSON.parse(jsonStr.trim())
const normalized = parseReviewAiPayload(parsed, _cardType)
if (normalized) return normalized
return this.buildFallback(note, 'AI returned unexpected format')
```

- [ ] **Step 4: 更新 prompt（仅两类卡）**

```ts
// review-ai.service.ts buildPrompt
// word-speech / spelling JSON 结构中新增：
// "partsOfSpeech": [...],
// "confusables": [...]
```

- [ ] **Step 5: 回归与新增用例一起跑**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- review-ai-content.e2e-spec.ts notes.e2e-spec.ts`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add backend/src/review backend/test/review-ai-content.e2e-spec.ts
git commit -m "feat: extend review ai payload with pos and confusables"
```

---

### Task 4: 前端类型与 store 更新新字段写入

**Files:**
- Create: `frontend/src/types/noteExtensions.ts`
- Modify: `frontend/src/data/mockData.ts`
- Modify: `frontend/src/store/useAppStore.ts`
- Create: `frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts`

- [ ] **Step 1: 写失败测试（updateNote 请求体应带新字段）**

```ts
// frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts
it('updateNote sends partsOfSpeech/confusables', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
  await useAppStore.getState().updateNote('n-1', {
    partsOfSpeech: [{ pos: 'noun', label: '名词', meaning: '条状物' }],
    confusables: [{ kind: 'form', words: [{ word: 'strip', meaning: '剥去' }, { word: 'stripe', meaning: '条纹' }] }],
  } as any)
  expect(fetchMock).toHaveBeenCalled()
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
    method: 'PATCH',
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: FAIL，`updateNote` patch 类型不接受新字段或请求体缺失字段。

- [ ] **Step 3: 更新类型与 store patch 定义**

```ts
// frontend/src/types/noteExtensions.ts
export type PosValue = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'phrase' | 'other'
export interface PartOfSpeechItem { /* 与后端对齐 */ }
export interface ConfusableGroup { /* 与后端对齐 */ }
```

```ts
// mockData.ts Note interface
partsOfSpeech?: PartOfSpeechItem[]
confusables?: ConfusableGroup[]
```

```ts
// useAppStore.ts updateNote patch
updateNote: (
  id: string,
  patch: {
    content?: string
    translation?: string
    category?: Category
    synonyms?: string[]
    antonyms?: string[]
    partsOfSpeech?: PartOfSpeechItem[]
    confusables?: ConfusableGroup[]
  }
) => Promise<boolean>
```

- [ ] **Step 4: 重跑测试确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/store/__tests__/useAppStore.updateNote.extensions.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add frontend/src/types/noteExtensions.ts frontend/src/data/mockData.ts frontend/src/store/useAppStore.ts frontend/src/store/__tests__/useAppStore.updateNote.extensions.test.ts
git commit -m "feat: add frontend note extension types and store patch support"
```

---

### Task 5: ReviewCards 双视图与新模块渲染

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Create: `frontend/src/lib/noteExtensionsDedup.ts`
- Create: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`

- [ ] **Step 1: 先写失败测试（切换与展示）**

```ts
// frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx
it('word card can switch to 词性&易混淆 view and render all confusables', async () => {
  // 1) 构造 reviewSession.aiContent 含 partsOfSpeech/confusables
  // 2) 点击翻卡
  // 3) 点击“词性&易混淆”
  // 4) 断言 strip / stripe / affect / effect 均出现
})

it('switching views does not hide rating buttons', async () => {
  // 断言 “😊 记得” 按钮仍可见
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx`  
Expected: FAIL，当前无视图切换控件。

- [ ] **Step 3: 实现去重工具与新 UI 状态**

```ts
// noteExtensionsDedup.ts
export function posDedupKey(item: PartOfSpeechItem): string { /* pos+meaning */ return '' }
export function confusableDedupKey(group: ConfusableGroup): string { /* kind + sorted words */ return '' }
export function mergeUniquePos(base: PartOfSpeechItem[], incoming: PartOfSpeechItem[]): PartOfSpeechItem[] { return [] }
export function mergeUniqueConfusables(base: ConfusableGroup[], incoming: ConfusableGroup[]): ConfusableGroup[] { return [] }
```

```tsx
// ReviewCards.tsx 关键状态
const [backView, setBackView] = useState<'core' | 'extensions'>('core')
// 切卡时 reset:
setBackView('core')
```

- [ ] **Step 4: 在 word-speech/spelling 背面接入新视图**

```tsx
// 背面顶部切换控件（仅两类）
<button onClick={() => setBackView('core')}>学习内容</button>
<button onClick={() => setBackView('extensions')}>词性&易混淆</button>
```

```tsx
// extensions 视图渲染
{partsOfSpeech.map(...)}
{confusables.map(group => group.kind === 'meaning' ? <DifferenceBlock /> : <WordPairBlock />)}
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx src/pages/__tests__/ReviewCards.user-notes.test.tsx src/pages/__tests__/ReviewCards.slash.test.tsx`  
Expected: PASS，且旧测试不回归。

- [ ] **Step 6: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add frontend/src/lib/noteExtensionsDedup.ts frontend/src/pages/ReviewCards.tsx frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx
git commit -m "feat: add review back-side extensions view for pos/confusables"
```

---

### Task 6: 新“存入知识库”动作（仅写新字段）

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`

- [ ] **Step 1: 写失败测试（点击存入后调用 updateNote 新字段）**

```ts
it('save pos/confusable writes only extension fields', async () => {
  const updateNote = vi.fn().mockResolvedValue(true)
  useAppStore.setState({ updateNote } as any)
  // 翻卡 -> 切换新视图 -> 点击“存入”
  expect(updateNote).toHaveBeenCalledWith(
    'n-1',
    expect.objectContaining({
      partsOfSpeech: expect.any(Array),
    }),
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx`  
Expected: FAIL，尚无新存入动作。

- [ ] **Step 3: 实现存入逻辑与局部状态**

```tsx
const [savedPosKeys, setSavedPosKeys] = useState<string[]>([])
const [savedConfusableKeys, setSavedConfusableKeys] = useState<string[]>([])

async function handleSavePos(item: PartOfSpeechItem) {
  const next = mergeUniquePos(basePartsOfSpeech, [item])
  await updateNote(card.id, { partsOfSpeech: next })
}

async function handleSaveConfusable(group: ConfusableGroup) {
  const next = mergeUniqueConfusables(baseConfusables, [group])
  await updateNote(card.id, { confusables: next })
}
```

- [ ] **Step 4: 重新运行测试确认通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add frontend/src/pages/ReviewCards.tsx frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx
git commit -m "feat: support saving pos and confusables from review cards"
```

---

### Task 7: 全量回归与文档收口

**Files:**
- Modify: `docs/superpowers/specs/2026-04-09-review-pos-confusables-design.md`

- [ ] **Step 1: 跑后端回归**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npm run test:e2e -- notes.e2e-spec.ts review-ai-content.e2e-spec.ts review-start.e2e-spec.ts`  
Expected: PASS。

- [ ] **Step 2: 跑前端回归**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run test:run -- src/pages/__tests__/ReviewCards.user-notes.test.tsx src/pages/__tests__/ReviewCards.slash.test.tsx src/pages/__tests__/ReviewCards.extensions.test.tsx`  
Expected: PASS。

- [ ] **Step 3: 跑前端 lint（受改动文件）**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npm run lint`  
Expected: 0 error（如有历史 warning，仅记录新增问题为 0）。

- [ ] **Step 4: 同步 spec 实施状态**

```md
## 实施结果
- [x] Note 新增 partsOfSpeech/confusables
- [x] ReviewCards 新增“词性&易混淆”视图
- [x] 新字段存入动作
- [x] 关键回归用例通过
```

- [ ] **Step 5: 最终提交**

```bash
cd /home/pdm/DEV/ieltsmate
git add docs/superpowers/specs/2026-04-09-review-pos-confusables-design.md
git commit -m "docs: record implementation results for review pos/confusables"
```

---

## Self-Review Checklist (Plan Author)

- Spec coverage: 已覆盖数据模型、AI 协议、前端视图切换、存入动作、兼容护栏、测试回归。
- Placeholder scan: 无占位语（如“待补充”“稍后实现”）。
- Type consistency: `PartOfSpeechItem` / `ConfusableGroup` 在前后端命名一致；`word-speech`/`spelling` 作用域一致。

