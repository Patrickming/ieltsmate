# 词性&词根派生拆分 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 wordFamily 拆分为词性派生和词根派生两个区块，partsOfSpeech 改为必填，修正易混淆词的名称和内容。

**Architecture:** 后端 `WordFamily` 接口新增 `rootDerived` 字段；prompt 中 partsOfSpeech 改为必填、wordFamily 增加 rootDerived 模板、confusables 排除词根派生；前端 Tab 改名，WordFamilyPanel 拆为两个区块，ConfusablePanel 改名。

**Tech Stack:** NestJS (backend), React + Vite + Zustand (frontend), Vitest (testing), Jest (backend e2e)

---

### Task 1: 后端 WordFamily 接口与 normalize 扩展

**Files:**
- Modify: `backend/src/notes/types/word-family.ts`

- [ ] **Step 1: 在 WordFamily 接口新增 rootDerived 字段**

在 `backend/src/notes/types/word-family.ts` 的 `WordFamily` 接口中新增 `rootDerived`:

```typescript
export interface WordFamily {
  base: WordFamilyBase
  derivedByPos: Record<Pos4, WordFamilyItem[]>
  rootDerived: WordFamilyItem[]
}
```

- [ ] **Step 2: 新增 normalizeRootItem 辅助函数**

在 `normalizeWordFamily` 函数上方新增辅助函数，用于校验 rootDerived 的每一项（不按 bucket 过滤 pos）：

```typescript
function normalizeRootItem(
  raw: Record<string, unknown>,
  globalSeen: Set<string>,
): WordFamilyItem | null {
  const word = trimStr(raw.word)
  const meaning = trimStr(raw.meaning)
  if (!word || !meaning) return null
  const pos = mapToPos4(trimStr(raw.pos))
  if (!pos) return null
  const phoneticRaw = trimStr(raw.phonetic)
  const item: WordFamilyItem = { word, pos, meaning, phonetic: phoneticRaw }
  const k = wordFamilyItemDedupKey(item)
  if (globalSeen.has(k)) return null
  globalSeen.add(k)
  return item
}
```

- [ ] **Step 3: 修改 normalizeWordFamily 解析 rootDerived**

在 `normalizeWordFamily` 函数中，现有 `derivedByPos` 解析之后、`return` 之前，新增 rootDerived 解析逻辑：

```typescript
  const rootDerived: WordFamilyItem[] = []
  const rootArr = o.rootDerived
  if (Array.isArray(rootArr)) {
    for (const row of rootArr) {
      if (!row || typeof row !== 'object') continue
      const item = normalizeRootItem(row as Record<string, unknown>, globalSeen)
      if (item) {
        rootDerived.push(item)
      }
    }
  }

  return { base, derivedByPos, rootDerived }
```

同时修改原来的 `return { base, derivedByPos }` 为 `return { base, derivedByPos, rootDerived }`。

- [ ] **Step 4: 修改 mergeWordFamilyItems 支持 rootDerived**

将现有签名和实现扩展为：

```typescript
export function mergeWordFamilyItems(
  base: WordFamily,
  incomingItems: WordFamilyItem[],
  incomingRootItems?: WordFamilyItem[],
): WordFamily {
  const seen = new Set<string>()
  const derived = emptyDerivedByPos()
  for (const k of POS4_ORDER) {
    for (const it of base.derivedByPos[k]) {
      const key = wordFamilyItemDedupKey(it)
      if (seen.has(key)) continue
      seen.add(key)
      derived[k].push(it)
    }
  }
  for (const it of incomingItems) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    derived[it.pos].push(it)
  }
  const rootDerived: WordFamilyItem[] = []
  for (const it of base.rootDerived ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  for (const it of incomingRootItems ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  return { base: { ...base.base }, derivedByPos: derived, rootDerived }
}
```

- [ ] **Step 5: 修复所有 TypeScript 编译错误**

项目中其他构造 `WordFamily` 对象的地方需要添加 `rootDerived: []`。搜索整个 backend 代码库中构造 WordFamily 对象的位置，确保都包含新字段。

Run: `cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无错误（或只有无关错误）

- [ ] **Step 6: 新增 rootDerived 相关后端单元测试**

在 `backend/test/word-family.e2e-spec.ts` 中新增测试：

```typescript
  it('normalizeWordFamily 解析 rootDerived', () => {
    const a = normalizeWordFamily({
      base: { word: 'continent', pos: 'noun', meaning: '大陆' },
      derivedByPos: {
        noun: [],
        verb: [],
        adjective: [{ word: 'continental', pos: 'adjective', meaning: '大陆的', phonetic: '' }],
        adverb: [],
      },
      rootDerived: [
        { word: 'continue', pos: 'verb', meaning: '继续', phonetic: '/kənˈtɪnjuː/' },
        { word: 'continence', pos: 'noun', meaning: '克制', phonetic: '' },
      ],
    })
    expect(a).not.toBeNull()
    expect(a!.rootDerived).toHaveLength(2)
    expect(a!.rootDerived[0].word).toBe('continue')
    expect(a!.rootDerived[1].word).toBe('continence')
  })

  it('normalizeWordFamily 无 rootDerived 时返回空数组（向后兼容）', () => {
    const a = normalizeWordFamily({
      base: { word: 'run', pos: 'verb', meaning: '跑' },
      derivedByPos: { noun: [], verb: [], adjective: [], adverb: [] },
    })
    expect(a).not.toBeNull()
    expect(a!.rootDerived).toEqual([])
  })

  it('normalizeWordFamily rootDerived 与 derivedByPos 跨区去重', () => {
    const a = normalizeWordFamily({
      base: { word: 'x', pos: 'noun', meaning: 'x' },
      derivedByPos: {
        noun: [{ word: 'a', pos: 'noun', meaning: 'm', phonetic: '' }],
        verb: [], adjective: [], adverb: [],
      },
      rootDerived: [
        { word: 'a', pos: 'noun', meaning: 'm', phonetic: '/p/' },
        { word: 'b', pos: 'verb', meaning: 'mv', phonetic: '' },
      ],
    })
    expect(a).not.toBeNull()
    expect(a!.derivedByPos.noun).toHaveLength(1)
    expect(a!.rootDerived).toHaveLength(1)
    expect(a!.rootDerived[0].word).toBe('b')
  })

  it('mergeWordFamilyItems 合并 rootDerived', () => {
    const base = normalizeWordFamily({
      base: { word: 'x', pos: 'noun', meaning: 'x' },
      derivedByPos: { noun: [], verb: [], adjective: [], adverb: [] },
      rootDerived: [{ word: 'a', pos: 'noun', meaning: 'm', phonetic: '' }],
    })!
    const merged = mergeWordFamilyItems(base, [], [
      { word: 'a', pos: 'noun', meaning: 'm', phonetic: '/p/' },
      { word: 'b', pos: 'verb', meaning: 'mv', phonetic: '' },
    ])
    expect(merged.rootDerived).toHaveLength(2)
    expect(merged.rootDerived[0].word).toBe('a')
    expect(merged.rootDerived[1].word).toBe('b')
  })
```

- [ ] **Step 7: 运行后端测试确认不破坏现有逻辑**

Run: `cd /home/pdm/DEV/ieltsmate/backend && pnpm test -- --testPathPattern=word-family 2>&1 | tail -20`
Expected: 所有测试 PASS（包括新增测试）

---

### Task 2: 后端 Prompt 改动

**Files:**
- Modify: `backend/src/review/review-ai.service.ts`

- [ ] **Step 1: 修改 word-speech prompt 的 wordFamily JSON 模板**

在 `buildPrompt` 方法的 `word-speech` 分支中，找到现有的 `wordFamily` JSON 模板（约第 177-185 行），替换为：

```json
  "wordFamily": {
    "base": { "word": "目标词", "pos": "adjective", "meaning": "义项（中文）", "phonetic": "/音标/" },
    "derivedByPos": {
      "noun": [{ "word": "派生名词", "pos": "noun", "meaning": "义项", "phonetic": "/音标/" }],
      "verb": [],
      "adjective": [],
      "adverb": []
    },
    "rootDerived": [
      { "word": "同词根关联词", "pos": "verb", "meaning": "义项", "phonetic": "/音标/" }
    ]
  }
```

- [ ] **Step 2: 修改 word-speech prompt 的约束文本**

在约束段落（约第 187 行）中：

将 `partsOfSpeech/confusables/wordFamily 可选` 替换为：
`partsOfSpeech 必填，穷举该词所有真实存在的词性及义项（依据词典判断，若确实只有一种词性则只返回该词性）；confusables/wordFamily 可选`

将原来关于 derivedByPos 的约束替换/扩展，确保包含以下内容：
`derivedByPos 只放词形变化派生（加前缀/后缀改变词性，意思与目标词紧密相关）；rootDerived 放同词根/词缀但意思已分化的关联词（平铺数组，不按词性分组）；两者不要重复。`

在 confusables 约束后追加：
`confusables 中 form 类只放拼写极相似、真正容易看错的词（如 strip vs stripe），不要放共享词根的派生词（那些属于 wordFamily.rootDerived）。`

- [ ] **Step 3: 修改 spelling prompt 的 wordFamily JSON 模板和约束**

在 `buildPrompt` 方法的 `spelling` 分支中（约第 291-302 行），做与 Step 1-2 相同的修改：
1. wordFamily JSON 模板新增 `rootDerived` 字段
2. 约束文本同步修改（partsOfSpeech 必填、derivedByPos/rootDerived 区分、confusables 排除）

注意 spelling 的约束文本是 `partsOfSpeech/confusables/wordFamily 可选；wordFamily 规则同 word-speech 卡片说明；confusables 规则同 word-speech 卡片说明。`，需要同步更新。

- [ ] **Step 4: 验证编译通过**

Run: `cd /home/pdm/DEV/ieltsmate/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无编译错误

---

### Task 3: 后端测试更新

**Files:**
- Modify: `backend/test/review-ai-content.e2e-spec.ts`

- [ ] **Step 1: 更新 word-speech prompt 断言**

在 `'buildPrompt word-speech 含关联词对象示例与 meaning 约束'` 测试（约第 274 行）中，新增断言：

```typescript
    expect(prompt).toContain('rootDerived')
    expect(prompt).toContain('partsOfSpeech 必填')
    expect(prompt).toContain('不要放共享词根的派生词')
    expect(prompt).toContain('derivedByPos 只放词形变化派生')
```

- [ ] **Step 2: 更新 spelling prompt 断言**

在 `'buildPrompt spelling 含关联词对象示例与 meaning 约束'` 测试（约第 315 行）中，新增断言：

```typescript
    expect(prompt).toContain('rootDerived')
    expect(prompt).toContain('不要放共享词根的派生词')
```

- [ ] **Step 3: 运行后端测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && pnpm test -- --testPathPattern=review-ai-content 2>&1 | tail -20`
Expected: 全部 PASS

---

### Task 4: 前端类型与工具函数扩展

**Files:**
- Modify: `frontend/src/types/wordFamily.ts`
- Modify: `frontend/src/lib/wordFamilyDedup.ts`

- [ ] **Step 1: 修改前端 WordFamily 接口**

在 `frontend/src/types/wordFamily.ts` 中，`WordFamily` 接口新增 `rootDerived`:

```typescript
export interface WordFamily {
  base: WordFamilyBase
  derivedByPos: Record<Pos4, WordFamilyItem[]>
  rootDerived: WordFamilyItem[]
}
```

- [ ] **Step 2: 修改 normalizeWordFamilyForUI 解析 rootDerived**

在 `frontend/src/lib/wordFamilyDedup.ts` 的 `normalizeWordFamilyForUI` 函数中，在现有 `derivedByPos` 解析之后（约第 74 行后），`return` 之前，新增：

```typescript
    const rootDerived: WordFamilyItem[] = []
    const rootArr = root.rootDerived
    if (Array.isArray(rootArr)) {
      for (const row of rootArr) {
        const r = asRecord(row)
        if (!r) continue
        const w = cleanString(r.word)
        const m = cleanString(r.meaning)
        if (!w || !m) continue
        const p = r.pos
        if (!isPos4(p)) continue
        const item: WordFamilyItem = { word: w, pos: p, meaning: m, phonetic: cleanString(r.phonetic) }
        const key = wordFamilyItemDedupKey(item)
        if (seen.has(key)) continue
        seen.add(key)
        rootDerived.push(item)
      }
    }
```

并修改 return 语句为：

```typescript
    return {
      base: { ... },
      derivedByPos,
      rootDerived,
    }
```

- [ ] **Step 3: 修改前端 mergeWordFamilyItems 支持 rootDerived**

在 `frontend/src/lib/wordFamilyDedup.ts` 中，将 `mergeWordFamilyItems` 函数扩展为：

```typescript
export function mergeWordFamilyItems(
  base: WordFamily,
  incomingItems: WordFamilyItem[],
  incomingRootItems?: WordFamilyItem[],
): WordFamily {
  const seen = new Set<string>()
  const derived = emptyDerivedByPos()
  for (const k of POS4_ORDER) {
    for (const it of base.derivedByPos[k]) {
      const key = wordFamilyItemDedupKey(it)
      if (seen.has(key)) continue
      seen.add(key)
      derived[k].push(it)
    }
  }
  for (const it of incomingItems) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    derived[it.pos].push(it)
  }
  const rootDerived: WordFamilyItem[] = []
  for (const it of base.rootDerived ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  for (const it of incomingRootItems ?? []) {
    const key = wordFamilyItemDedupKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    rootDerived.push(it)
  }
  return { base: { ...base.base }, derivedByPos: derived, rootDerived }
}
```

- [ ] **Step 4: 修复所有前端 TypeScript 编译错误**

搜索前端代码库中所有构造 WordFamily 对象的地方（测试文件、mockData 等），确保添加 `rootDerived: []`。

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无编译错误

---

### Task 5: 前端 ReviewCards Tab 名称与 ConfusablePanel 修改

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`

- [ ] **Step 1: 修改 ReviewBackTabBar 的 Tab 名称**

在 `ReviewBackTabBar` 组件中（约第 341-343 行），将：
- `'词性派生'` → `'词性&词根派生'`
- `'易混小词'` → `'易混淆词'`

```typescript
      {showWordFamily ? btn('wordFamily', 'review-back-tab-word-family', '词性&词根派生') : null}
      {btn('posConfusable', 'review-back-tab-pos-confusable', '易混淆词')}
```

- [ ] **Step 2: 修改 ConfusablePanel 内文本**

在 `ConfusablePanel` 组件中（约第 407 行和第 464 行），将：
- `易混小词` → `易混淆词`
- `暂无易混小词内容` → `暂无易混淆词内容`

- [ ] **Step 3: 验证编译通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

---

### Task 6: 前端 WordFamilyPanel 新增词根派生区块

**Files:**
- Modify: `frontend/src/pages/ReviewCards.tsx`

- [ ] **Step 1: 修改 WordFamilyPanel 获取 rootDerived 数据**

在 `WordFamilyPanel` 组件中（约第 482 行），在现有数据准备逻辑之后，新增 rootDerived 合并逻辑：

```typescript
  const aiRootItems = aiWordFamily?.rootDerived ?? []
  const storedRootItems = storedWf?.rootDerived ?? []
  const rootSeen = new Set<string>()
  const mergedRoot: WordFamilyItem[] = []
  for (const it of storedRootItems) {
    const k = wordFamilyItemDedupKey(it)
    if (rootSeen.has(k)) continue
    rootSeen.add(k)
    mergedRoot.push(it)
  }
  for (const it of aiRootItems) {
    const k = wordFamilyItemDedupKey(it)
    if (rootSeen.has(k)) continue
    rootSeen.add(k)
    mergedRoot.push(it)
  }
```

- [ ] **Step 2: 扩展 WordFamilyPanel props 增加 onSaveRootItem 和 onSaveRootAll**

在 `WordFamilyPanel` 的 props 中新增：

```typescript
  onSaveRootItem: (item: WordFamilyItem) => void
  onSaveRootAll: () => void
```

- [ ] **Step 3: 在 WordFamilyPanel 的 JSX 中，现有"一键存入本组派生"按钮之后，新增词根派生区块**

在现有的 `<div className="pt-1">` 一键存入按钮之后，添加分隔线和词根派生区块：

```tsx
      <div className="h-px bg-border my-4" />

      <div className="text-sm font-semibold text-text-muted mb-2">词根派生</div>
      {mergedRoot.filter((item) => item.word.trim().toLowerCase() !== currentWordSurface).length === 0 ? (
        <p className="text-sm text-text-dim" data-testid="review-root-derived-empty">无</p>
      ) : (
        <div className="flex flex-col gap-3">
          {mergedRoot
            .filter((item) => item.word.trim().toLowerCase() !== currentWordSurface)
            .map((item, idx) => {
              const saved = isWordFamilyItemSaved(item, storedNote, savedKeys)
              const ph = item.phonetic?.trim() ?? ''
              return (
                <div
                  key={`root-${wordFamilyItemDedupKey(item)}-${idx}`}
                  className="bg-[#141420] border border-[#27272a] rounded-xl px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[16px] font-semibold text-text-primary">{item.word}</span>
                      <span className="text-[11px] text-text-subtle font-mono">{item.pos}</span>
                    </div>
                    <button
                      type="button"
                      data-testid={`review-root-save-${idx}`}
                      onClick={() => onSaveRootItem(item)}
                      className="flex items-center gap-1 shrink-0"
                      style={{ color: saved ? '#34d399' : '#818cf8' }}
                    >
                      {saved ? <Check size={10} /> : <Plus size={10} />}
                      <span className="text-[11px]">{saved ? '✓ 已存入' : '存入'}</span>
                    </button>
                  </div>
                  <p className="text-[15px] text-text-primary leading-relaxed">{item.meaning}</p>
                  {ph ? <p className="text-[13px] text-[#a5b4fc] mt-2 font-mono">{ph}</p> : null}
                </div>
              )
            })}
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          data-testid="review-root-save-all"
          onClick={() => onSaveRootAll()}
          className="w-full py-2.5 rounded-lg text-[13px] font-semibold border border-primary/50 text-primary hover:bg-primary/10 transition-colors"
        >
          一键存入词根派生
        </button>
      </div>
```

- [ ] **Step 4: 将 onSaveRootItem 和 onSaveRootAll props 从调用方传入**

搜索所有调用 `<WordFamilyPanel ... />` 的地方（CardBackWordPhrase、CardBackSpelling 等），将新增的 `onSaveRootItem` 和 `onSaveRootAll` props 传入。这些 props 需要从 ReviewCardView 一路向下传递，和现有的 `onSaveWordFamilyItem`/`onSaveWordFamilyAll` 方式一致。

- [ ] **Step 5: 在 ReviewCardView 中实现 performSaveRootItem 和 performSaveRootAll**

在 ReviewCardView 组件中（约第 1798 行附近），仿照 `performSaveWordFamilyItem` 和 `performSaveWordFamilyAll`，实现两个新函数：

`performSaveRootItem`：
```typescript
  const performSaveRootItem = async (item: WordFamilyItem) => {
    const k = wordFamilyItemDedupKey(item)
    if (savedWordFamilyKeys.includes(k)) {
      setSaveNotice('已存在')
      return
    }
    const latest = useAppStore.getState().notes.find((n) => n.id === card.id)
    if (latest?.wordFamily?.rootDerived?.some((x) => wordFamilyItemDedupKey(x) === k)) {
      setSaveNotice('已存在')
      return
    }
    const ai = aiContent as WordSpeechAI | SpellingAI | undefined
    if (!aiContent || ('fallback' in aiContent && aiContent.fallback)) {
      setSaveNotice('暂无词根派生数据')
      return
    }
    const baseWf = ensureWordFamilyForSave(card, ai, latest)
    const norm: WordFamilyItem = { ...item, phonetic: item.phonetic?.trim() ?? '' }
    const merged = mergeWordFamilyItems(baseWf, [], [norm])
    setSavedWordFamilyKeys((p) => [...p, k])
    const ok = await updateNote(card.id, { wordFamily: merged })
    if (ok) {
      incrementSavedExtensions()
    } else {
      setSavedWordFamilyKeys((p) => p.filter((x) => x !== k))
      setSaveNotice('保存失败，可重试')
    }
  }
```

`performSaveRootAll`：

```typescript
  const performSaveRootAll = async () => {
    if (!aiContent || ('fallback' in aiContent && aiContent.fallback)) {
      setSaveNotice('暂无词根派生数据')
      return
    }
    const ai = aiContent as WordSpeechAI | SpellingAI
    if (!ai.wordFamily?.rootDerived?.length) {
      setSaveNotice('暂无词根派生数据')
      return
    }
    const currentWordSurface = card.content.trim().toLowerCase()
    const rootItems = ai.wordFamily.rootDerived
      .map((it) => ({ ...it, phonetic: it.phonetic?.trim() ?? '' }))
      .filter((it) => it.word.trim().toLowerCase() !== currentWordSurface)
    const latest = useAppStore.getState().notes.find((n) => n.id === card.id)
    const existing = latest?.wordFamily
    const existingKeys = new Set(
      existing?.rootDerived ? existing.rootDerived.map(wordFamilyItemDedupKey) : [],
    )
    let dup = 0
    const pending: WordFamilyItem[] = []
    for (const it of rootItems) {
      const key = wordFamilyItemDedupKey(it)
      if (existingKeys.has(key)) {
        dup++
      } else {
        pending.push(it)
      }
    }
    if (pending.length === 0) {
      setSaveNotice(dup > 0 ? `全部已存在，跳过重复 ${dup} 条` : '暂无可存入的词根派生')
      return
    }
    const baseWf = ensureWordFamilyForSave(card, ai, latest)
    const merged = mergeWordFamilyItems(baseWf, [], pending)
    const newKeys = pending.map(wordFamilyItemDedupKey)
    setSavedWordFamilyKeys((p) => [...p, ...newKeys])
    const ok = await updateNote(card.id, { wordFamily: merged })
    if (ok) {
      for (let i = 0; i < pending.length; i++) incrementSavedExtensions()
      setSaveNotice(
        dup > 0
          ? `存入 ${pending.length} 条，跳过重复 ${dup} 条`
          : `已存入 ${pending.length} 条词根派生`,
      )
    } else {
      setSavedWordFamilyKeys((p) => p.filter((x) => !newKeys.includes(x)))
      setSaveNotice(`失败 ${pending.length} 条，可重试`)
    }
  }
```

- [ ] **Step 6: 验证编译通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无错误

---

### Task 7: 前端 KnowledgeDetail 页面同步

**Files:**
- Modify: `frontend/src/pages/KnowledgeDetail.tsx`

- [ ] **Step 1: 修改词性派生标题**

在 `KnowledgeDetail.tsx` 约第 542 行，将：
```
🧩 词性派生
```
改为：
```
🧩 词性&词根派生
```

- [ ] **Step 2: 在 derivedByPos 展示之后新增 rootDerived 区块**

在 `KnowledgeDetail.tsx` 约第 575 行（derivedByPos 的四个分区渲染结束后），在 `</div>` 闭合标签之前，新增 rootDerived 展示：

```tsx
                      {(note.wordFamily?.rootDerived?.length ?? 0) > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-text-subtle mb-1">词根派生</div>
                          <div className="flex flex-col gap-2">
                            {note.wordFamily!.rootDerived.map((item, idx) => (
                              <div key={`root-${item.word}-${idx}`} className="pl-3 border-l-2 border-primary/35">
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-[14px] font-semibold text-text-primary">{item.word}</span>
                                  <span className="text-[11px] text-text-subtle font-mono">{item.pos}</span>
                                  {item.phonetic && <span className="text-[12px] text-[#a5b4fc] font-mono">{item.phonetic}</span>}
                                </div>
                                <p className="text-[13px] text-text-secondary mt-0.5">{item.meaning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
```

- [ ] **Step 3: 验证编译通过**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

---

### Task 8: 前端测试更新

**Files:**
- Modify: `frontend/src/pages/__tests__/ReviewCards.extensions.test.tsx`
- Modify: `frontend/src/pages/__tests__/ReviewCards.word-family.test.tsx`

- [ ] **Step 1: 更新 extensions 测试中的"易混小词"断言**

在 `ReviewCards.extensions.test.tsx` 约第 161 行，将：
```typescript
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toHaveTextContent('易混小词')
```
改为：
```typescript
    expect(screen.getByTestId('review-back-tab-pos-confusable')).toHaveTextContent('易混淆词')
```

- [ ] **Step 2: 更新 word-family 测试数据新增 rootDerived**

在 `ReviewCards.word-family.test.tsx` 的 `seedWordFamilyReview` 函数中（约第 33 行），`wf` 对象新增 `rootDerived`:

```typescript
    const wf: WordFamily = {
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的', phonetic: '/ˈpɒpjələ(r)/' },
      derivedByPos: {
        ...emptyDerivedByPos(),
        noun: [{ word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/ˌpɒpjuˈlærəti/' }],
        verb: [{ word: 'popularize', pos: 'verb', meaning: '使普及', phonetic: '' }],
      },
      rootDerived: [
        { word: 'populace', pos: 'noun', meaning: '民众，平民', phonetic: '/ˈpɒpjələs/' },
      ],
    }
```

- [ ] **Step 3: 更新所有测试文件中构造 WordFamily 时缺少 rootDerived 的地方**

搜索测试文件中所有手动构造 WordFamily 对象的位置（如 `wfWithSameSurface`、保存相关的测试等），补充 `rootDerived: []`。

- [ ] **Step 4: 新增 rootDerived 渲染测试**

在 `ReviewCards.word-family.test.tsx` 的 `describe('ReviewCards 词性派生', ...)` 中新增测试：

```typescript
  it('词根派生区块渲染 rootDerived 项', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.getByText('词根派生')).toBeInTheDocument()
    expect(screen.getByText('populace')).toBeInTheDocument()
    expect(screen.getByText('民众，平民')).toBeInTheDocument()
  })

  it('rootDerived 为空时显示「无」', async () => {
    seedWordFamilyReview(updateNoteMock)
    useAppStore.setState((s) => {
      const ai = s.reviewSession?.aiContent?.['n-wf'] as Record<string, unknown> | undefined
      if (ai?.wordFamily) {
        (ai.wordFamily as WordFamily).rootDerived = []
      }
      return s
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createFetchResponse({ data: { items: [] } }))
    const user = userEvent.setup()
    renderWithRouter(<ReviewCards />)

    await user.click(screen.getByText('popular'))
    await user.click(screen.getByTestId('review-back-tab-word-family'))

    expect(screen.getByTestId('review-root-derived-empty')).toHaveTextContent('无')
  })
```

- [ ] **Step 5: 新增 Tab 名称断言测试**

在 `ReviewCards.word-family.test.tsx` 中，找到 `'word-speech 可见「词性派生」tab'` 测试，修改或新增断言：

```typescript
    expect(screen.getByTestId('review-back-tab-word-family')).toHaveTextContent('词性&词根派生')
```

- [ ] **Step 6: 运行所有前端测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && pnpm test:run -- src/pages/__tests__/ReviewCards.extensions.test.tsx src/pages/__tests__/ReviewCards.word-family.test.tsx 2>&1 | tail -30`
Expected: 全部 PASS

---

### Task 9: 全量测试验证与清理

- [ ] **Step 1: 运行后端全量测试**

Run: `cd /home/pdm/DEV/ieltsmate/backend && pnpm test 2>&1 | tail -20`
Expected: 全部 PASS

- [ ] **Step 2: 运行前端全量测试**

Run: `cd /home/pdm/DEV/ieltsmate/frontend && pnpm test:run 2>&1 | tail -30`
Expected: 全部 PASS（可忽略已知的 writing-route 失败）

- [ ] **Step 3: 检查 lint 错误**

Run: `cd /home/pdm/DEV/ieltsmate && npx tsc --noEmit -p backend/tsconfig.json && npx tsc --noEmit -p frontend/tsconfig.json`
Expected: 无错误
