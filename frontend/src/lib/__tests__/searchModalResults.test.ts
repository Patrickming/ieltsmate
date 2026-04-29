import { describe, expect, it } from 'vitest'
import type { Note } from '@/data/mockData'
import {
  buildSearchModalResults,
  extractAssociationEnglishTokens,
  extractAssociationHanFragments,
  formatHanAssociationPrimaryTitle,
  noteMatchesPrimarySearch,
  normalizeSearchQuery,
} from '@/lib/searchModalResults'

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    content: 'hostel',
    translation: '旅舍',
    category: '单词',
    subcategory: '杂笔记',
    createdAt: '今天',
    reviewStatus: 'new',
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  }
}

describe('searchModalResults', () => {
  it('extractAssociationEnglishTokens 只拆英文词并过滤单字母', () => {
    expect(extractAssociationEnglishTokens('striped-stripe注意e')).toEqual(['striped', 'stripe'])
  })

  it('extractAssociationHanFragments 拆 Unicode 汉字连续片段（与英文同理为可检索片段）', () => {
    expect(extractAssociationHanFragments('striped stripe 条纹辨析')).toEqual(['条纹辨析'])
    expect(noteMatchesPrimarySearch(createNote({ content: 'omit', translation: '省略', userNotes: [] }), '省')).toBe(true)
    expect(noteMatchesPrimarySearch(createNote({ content: 'omit', translation: '', userNotes: ['考点：省略号'] }), '省略号')).toBe(
      false,
    )
  })

  it('汉字关联在主行展示紧邻左括号前的英文与当前汉字片段', () => {
    const line = 'much further (远超 (距离、程度) )'
    expect(formatHanAssociationPrimaryTitle(line, normalizeSearchQuery('远超'))).toBe('much further(远超')
    expect(formatHanAssociationPrimaryTitle('far beyond human perception. 远超人类感知', normalizeSearchQuery('远超'))).toBe(
      '远超人类感知',
    )
  })

  it('多来源含同一关键词时优先展示「英文(汉字」行且同标题去重', () => {
    const note = createNote({
      id: 'n-far',
      content: 'far beyond',
      translation: '远超',
      userNotes: ['far beyond human perception. 远超人类感知'],
      synonyms: ['much further (远超 (距离、程度))', 'well beyond (远远超出 (限制、能力))'],
    })
    const assoc = buildSearchModalResults([note], '远超').filter((x) => x.kind === 'association')
    const titles = assoc.map((x) => x.token)
    expect(titles).toContain('much further(远超')
    expect(titles).toContain('远超人类感知')
    expect(titles.filter((t) => t === '远超人类感知').length).toBe(1)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('buildSearchModalResults 先返回笔记结果，再返回命中的关联内容结果', () => {
    const note = createNote({
      id: 'note-strip',
      content: 'strip basics',
      translation: '剥离基础',
      userNotes: ['striped-stripe注意e', 'stripe 再记一次'],
      synonyms: ['stripe (条纹)'],
      memoryTip: 'remember stripe',
    })

    expect(buildSearchModalResults([note], 'strip')).toEqual([
      {
        kind: 'note',
        id: 'note-strip',
        note,
      },
      {
        kind: 'association',
        id: 'note-strip::stripe',
        token: 'stripe',
        note,
      },
      {
        kind: 'association',
        id: 'note-strip::striped',
        token: 'striped',
        note,
      },
    ])
  })

  it('汉字查询可命中译义与关联汉字片段结果', () => {
    const note = createNote({
      id: 'note-cn',
      content: 'example',
      translation: '例证',
      userNotes: ['注意：用词准确'],
      synonyms: ['instance (例证)'],
    })
    expect(buildSearchModalResults([note], '例证')).toEqual([
      { kind: 'note', id: 'note-cn', note },
      { kind: 'association', id: 'note-cn::instance(例证', token: 'instance(例证', note },
    ])
  })

  it('只在关联字段命中的笔记不作为本体结果出现', () => {
    const farBeyond = createNote({
      id: 'far-beyond',
      content: 'far beyond',
      translation: '远超',
      synonyms: ['well beyond (远远超出 (限制、能力))'],
    })
    const restricted = createNote({
      id: 'restricted',
      content: 'restricted',
      translation: '受限制的',
    })

    const results = buildSearchModalResults([farBeyond, restricted], '限制')

    expect(results).toEqual([
      { kind: 'note', id: 'restricted', note: restricted },
      { kind: 'association', id: 'far-beyond::限制', token: '限制', note: farBeyond },
    ])
  })
})
