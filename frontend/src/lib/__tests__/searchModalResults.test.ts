import { describe, expect, it } from 'vitest'
import type { Note } from '@/data/mockData'
import { buildSearchModalResults, extractAssociationEnglishTokens } from '@/lib/searchModalResults'

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
})
