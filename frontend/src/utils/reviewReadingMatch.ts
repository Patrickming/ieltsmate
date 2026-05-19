export function buildExpressionRegex(expression: string): RegExp {
  const trimmed = expression.trim()
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
  const prefix = /^[A-Za-z0-9]/.test(trimmed) ? '(?<![A-Za-z0-9])' : ''
  const suffix = /[A-Za-z0-9]$/.test(trimmed) ? '(?![A-Za-z0-9])' : ''
  return new RegExp(`${prefix}${escaped}${suffix}`, 'i')
}

export function findExpressionMatches(text: string, expression: string) {
  const regex = buildExpressionRegex(expression)
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  const globalRegex = new RegExp(regex.source, flags)
  const matches: Array<{ start: number; end: number; text: string }> = []
  for (const match of text.matchAll(globalRegex)) {
    const start = match.index ?? -1
    if (start < 0 || !match[0]) continue
    matches.push({ start, end: start + match[0].length, text: match[0] })
  }
  return matches
}
