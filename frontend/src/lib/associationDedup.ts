/** Strip trailing ` (…)` produced by {@link formatAssociationItem}; legacy plain strings unchanged. */
function stripAssociationParenSuffix(s: string): string {
  const t = s.trim()
  const m = t.match(/^(.+)\s+\([^)]*\)\s*$/)
  return m ? m[1].trim() : t
}

/** Persisted form for synonym/antonym association lines: `word (meaning)` (both non-empty after trim). */
export function formatAssociationItem(word: string, meaning: string): string | null {
  const w = word.trim()
  const m = meaning.trim()
  if (!w || !m) return null
  return `${w} (${m})`
}

/** Leading Latin token (incl. hyphenated) for “same headword” detection. Works for `word (meaning)` and legacy plain strings. */
export function extractAssociationKey(s: string): string {
  const t = s.trim()
  if (!t) return ''
  const head = stripAssociationParenSuffix(t)
  const m = head.match(/^([a-zA-Z][a-zA-Z-]*)/)
  if (m) return m[1].toLowerCase()
  return head
}

/** True if this formatted line is already represented in `existing` (exact match, or legacy plain headword match). */
export function associationDisplaySaved(candidateFormatted: string, existing: string[]): boolean {
  const c = candidateFormatted.trim()
  if (!c) return false
  if (existing.some((e) => e.trim() === c)) return true
  const ck = extractAssociationKey(c)
  return existing.some((e) => {
    const et = e.trim()
    if (!et || et.includes('(')) return false
    return extractAssociationKey(et) === ck
  })
}

/** Existing entries that share the same association key as candidate but are not exactly equal (trim). */
export function findConflictingAssociationEntries(candidate: string, existing: string[]): string[] {
  const c = candidate.trim()
  if (!c) return []
  const ck = extractAssociationKey(candidate)
  return existing.filter((e) => {
    const et = e.trim()
    if (!et || et === c) return false
    return extractAssociationKey(e) === ck
  })
}

/** Append additions to base without duplicate trim; preserves base order then first-seen addition order. */
export function mergeAssociationListsUnique(base: string[], additions: string[]): string[] {
  const seen = new Set(base.map((s) => s.trim()))
  const out = [...base]
  for (const a of additions) {
    const t = a.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(a)
  }
  return out
}
