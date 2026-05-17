import type { Note } from '../data/mockData'

/** 用于判断「英文词条是否相同」：忽略首尾空白、折叠空格、大小写 */
export function normalizeNoteEnglishKey(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 规范化英文 → 出现次数（跳过空词条） */
export function englishContentCounts(notes: Note[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const note of notes) {
    const key = normalizeNoteEnglishKey(note.content)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/** 至少有一条其它笔记与它英文相同的笔记数量（每条重复链里的每一条都算） */
export function countDuplicateParticipantNotes(notes: Note[]): number {
  const counts = englishContentCounts(notes)
  let n = 0
  for (const note of notes) {
    const key = normalizeNoteEnglishKey(note.content)
    if (!key) continue
    if ((counts.get(key) ?? 0) >= 2) n++
  }
  return n
}

export function isNoteEnglishDuplicate(note: Note, counts: Map<string, number>): boolean {
  const key = normalizeNoteEnglishKey(note.content)
  if (!key) return false
  return (counts.get(key) ?? 0) >= 2
}

/** 重复笔记视图：相同英文词条相邻（先按规范化英文排序，再按 id 稳定次序） */
export function sortDuplicateNotesByEnglishCluster(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const ka = normalizeNoteEnglishKey(a.content)
    const kb = normalizeNoteEnglishKey(b.content)
    const byKey = ka.localeCompare(kb)
    if (byKey !== 0) return byKey
    return a.id.localeCompare(b.id)
  })
}
