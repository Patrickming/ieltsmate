import { describe, expect, it } from 'vitest'
import {
  countDuplicateParticipantNotes,
  englishContentCounts,
  isNoteEnglishDuplicate,
  normalizeNoteEnglishKey,
  sortDuplicateNotesByEnglishCluster,
} from '@/lib/noteEnglishDedup'
import type { Note } from '@/data/mockData'

const base: Omit<Note, 'id' | 'content'> = {
  translation: '',
  category: '单词',
  subcategory: '杂笔记',
  createdAt: '',
  reviewStatus: 'new',
}

function n(id: string, content: string): Note {
  return { ...base, id, content }
}

describe('noteEnglishDedup', () => {
  it('normalizeNoteEnglishKey trims, folds spaces, lowercases', () => {
    expect(normalizeNoteEnglishKey('  Girl  ')).toBe('girl')
    expect(normalizeNoteEnglishKey('a   b')).toBe('a b')
  })

  it('englishContentCounts skips empty english', () => {
    const counts = englishContentCounts([n('1', ''), n('2', '   ')])
    expect(counts.size).toBe(0)
  })

  it('countDuplicateParticipantNotes counts each note in a duplicate chain', () => {
    const notes = [n('1', 'girl'), n('2', 'Girl'), n('3', 'boy')]
    expect(countDuplicateParticipantNotes(notes)).toBe(2)
  })

  it('isNoteEnglishDuplicate respects counts map', () => {
    const notes = [n('1', 'x'), n('2', 'x')]
    const counts = englishContentCounts(notes)
    expect(isNoteEnglishDuplicate(notes[0], counts)).toBe(true)
    expect(isNoteEnglishDuplicate(n('solo', 'only'), englishContentCounts([n('solo', 'only')]))).toBe(false)
  })

  it('sortDuplicateNotesByEnglishCluster groups same english adjacently', () => {
    const sorted = sortDuplicateNotesByEnglishCluster([
      n('c', 'zebra'),
      n('a', 'girl'),
      n('b', 'apple'),
      n('d', 'Girl'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a', 'd', 'c'])
  })
})
