/** Leading Latin token (incl. hyphenated) for “same headword” detection. */
export function extractAssociationKey(s: string): string {
  const t = s.trim()
  if (!t) return ''
  const m = t.match(/^([a-zA-Z][a-zA-Z-]*)/)
  if (m) return m[1].toLowerCase()
  return t
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
