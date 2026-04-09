import type { ConfusableGroup, PartOfSpeechItem } from '../types/noteExtensions'

/** 与后端 normalize 一致：pos + meaning（归一化） */
export function posDedupKey(item: PartOfSpeechItem): string {
  return `${item.pos.trim().toLowerCase()}|${item.meaning.trim().toLowerCase()}`
}

function normWordSurface(word: string): string {
  return word.trim().toLowerCase()
}

/** 与后端 normalizeConfusableGroups 的组键一致 */
export function confusableDedupKey(group: ConfusableGroup): string {
  const sorted = group.words.map((w) => normWordSurface(w.word)).sort().join('\u0001')
  if (group.kind === 'meaning') {
    return `meaning|${sorted}|${group.difference.trim().toLowerCase()}`
  }
  return `form|${sorted}`
}

const posKeySet = (items: PartOfSpeechItem[]) => new Set(items.map(posDedupKey))

/** 先保留 base 顺序，再追加 incoming 中未见过的项 */
export function mergeUniquePos(base: PartOfSpeechItem[], incoming: PartOfSpeechItem[]): PartOfSpeechItem[] {
  const seen = posKeySet(base)
  const out = [...base]
  for (const item of incoming) {
    const k = posDedupKey(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

const confKeySet = (groups: ConfusableGroup[]) => new Set(groups.map(confusableDedupKey))

export function mergeUniqueConfusables(base: ConfusableGroup[], incoming: ConfusableGroup[]): ConfusableGroup[] {
  const seen = confKeySet(base)
  const out = [...base]
  for (const g of incoming) {
    const k = confusableDedupKey(g)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(g)
  }
  return out
}
