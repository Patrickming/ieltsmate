import 'reflect-metadata'
import { mergeWordFamilyItems, normalizeWordFamily, wordFamilyItemDedupKey } from '../src/notes/types/word-family'

describe('word family', () => {
  it('normalizeWordFamily 按 word+pos+meaning 全局去重', () => {
    const a = normalizeWordFamily({
      base: { word: 'popular', pos: 'adjective', meaning: '受欢迎的', phonetic: '/p/' },
      derivedByPos: {
        noun: [
          { word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/n1/' },
          { word: 'popularity', pos: 'noun', meaning: '普及', phonetic: '/n2/' },
        ],
        verb: [],
        adjective: [],
        adverb: [],
      },
    })
    expect(a).not.toBeNull()
    expect(a!.derivedByPos.noun).toHaveLength(1)
    expect(a!.derivedByPos.noun[0].phonetic).toBe('/n1/')
  })

  it('normalizeWordFamily 空分区保留为空数组', () => {
    const a = normalizeWordFamily({
      base: { word: 'run', pos: 'verb', meaning: '跑' },
      derivedByPos: {
        noun: [],
        verb: [],
        adjective: [],
        adverb: [],
      },
    })
    expect(a).not.toBeNull()
    expect(a!.derivedByPos.noun).toEqual([])
    expect(a!.derivedByPos.adverb).toEqual([])
  })

  it('mergeWordFamilyItems 追加并去重', () => {
    const base = normalizeWordFamily({
      base: { word: 'x', pos: 'noun', meaning: 'x' },
      derivedByPos: {
        noun: [{ word: 'a', pos: 'noun', meaning: 'm', phonetic: '' }],
        verb: [],
        adjective: [],
        adverb: [],
      },
    })!
    const merged = mergeWordFamilyItems(base, [
      { word: 'a', pos: 'noun', meaning: 'm', phonetic: '/p/' },
      { word: 'b', pos: 'verb', meaning: 'mv', phonetic: '' },
    ])
    expect(merged.derivedByPos.noun).toHaveLength(1)
    expect(merged.derivedByPos.verb).toHaveLength(1)
  })

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
        verb: [],
        adjective: [],
        adverb: [],
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

  it('wordFamilyItemDedupKey 使用 trim+lower', () => {
    const k1 = wordFamilyItemDedupKey({
      word: ' Hello ',
      pos: 'noun',
      meaning: ' 世界 ',
      phonetic: '',
    })
    const k2 = wordFamilyItemDedupKey({
      word: 'hello',
      pos: 'noun',
      meaning: '世界',
      phonetic: '/x/',
    })
    expect(k1).toBe(k2)
  })
})
