export interface ReadingQuestion {
  id: string
  type: string
  prompt: string
  options?: string[]
}

export interface ReadingAnswer {
  id: string
  answer: string
}

export interface ReadingExplanation {
  id: string
  explanation: string
}

export interface ReadingUsedNote {
  noteId: string
  original: string
  expression: string
  isVariant: boolean
  explanation?: string
}

export interface ParsedReadingArticle {
  title: string
  article: string
  paragraphTranslations: string[]
  wordCount: number
  questions: ReadingQuestion[]
  answers: ReadingAnswer[]
  explanations: ReadingExplanation[]
  usedNotes: ReadingUsedNote[]
}

function trimString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function extractFencedJson(content: string): string | null {
  const fenceMatch = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/)
  return fenceMatch?.[1]?.trim() || null
}

function extractBalancedJson(content: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]
    if (start === -1) {
      if (ch === '{') {
        start = i
        depth = 1
      }
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return content.slice(start, i + 1)
    }
  }
  return null
}

export function extractReadingJsonCandidate(content: string): string {
  return extractFencedJson(content) ?? extractBalancedJson(content) ?? content
}

export function countEnglishWords(text: string): number {
  return (text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) ?? []).length
}

export function hasChineseText(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text)
}

function normalizeQuestions(raw: unknown): ReadingQuestion[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = trimString(record.id)
      const type = trimString(record.type) || 'question'
      const prompt = trimString(record.prompt)
      const options = Array.isArray(record.options)
        ? record.options.map(trimString).filter(Boolean)
        : undefined
      if (!id || !prompt) return null
      return { id, type, prompt, ...(options?.length ? { options } : {}) }
    })
    .filter((item): item is ReadingQuestion => item !== null)
}

function normalizeAnswers(raw: unknown): ReadingAnswer[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = trimString(record.id)
      const answer = trimString(record.answer)
      if (!id || !answer) return null
      return { id, answer }
    })
    .filter((item): item is ReadingAnswer => item !== null)
}

function normalizeExplanations(raw: unknown): ReadingExplanation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = trimString(record.id)
      const explanation = trimString(record.explanation)
      if (!id || !explanation) return null
      return { id, explanation }
    })
    .filter((item): item is ReadingExplanation => item !== null)
}

function normalizeUsedNotes(raw: unknown): ReadingUsedNote[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const notes: ReadingUsedNote[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const noteId = trimString(record.noteId)
    const original = trimString(record.original)
    const expression = trimString(record.expression)
    if (!noteId || !expression || seen.has(noteId)) continue
    seen.add(noteId)
    notes.push({
      noteId,
      original,
      expression,
      isVariant: record.isVariant === true,
      explanation: trimString(record.explanation) || undefined,
    })
  }
  return notes
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(trimString).filter(Boolean)
}

export function parseReadingArticlePayload(raw: string): ParsedReadingArticle | null {
  let payload: unknown
  try {
    payload = JSON.parse(extractReadingJsonCandidate(raw))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const title = trimString(record.title)
  const article = trimString(record.article)
  const paragraphTranslations = normalizeStringArray(record.paragraphTranslations)
  const questions = normalizeQuestions(record.questions)
  const answers = normalizeAnswers(record.answers)
  const explanations = normalizeExplanations(record.explanations)
  const usedNotes = normalizeUsedNotes(record.usedNotes)
  const wordCount = Number.isFinite(Number(record.wordCount))
    ? Number(record.wordCount)
    : countEnglishWords(article)

  if (!title || !article) {
    return null
  }

  return { title, article, paragraphTranslations, wordCount, questions, answers, explanations, usedNotes }
}

export function parseParagraphTranslationsPayload(raw: string): string[] {
  let payload: unknown
  try {
    payload = JSON.parse(extractReadingJsonCandidate(raw))
  } catch {
    return []
  }
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  return normalizeStringArray(record.paragraphTranslations)
}

export interface NoteMatchCandidate {
  id: string
  content: string
}

export function parseSynonymPair(content: string): { left: string; right: string } | null {
  const match = content.trim().match(/^(.+?)\s*[=→]\s*(.+)$/u)
  if (!match) return null
  const left = match[1].trim()
  const right = match[2].trim()
  if (!left || !right) return null
  return { left, right }
}

export function containsSynonymMarker(content: string) {
  return /[=→]/.test(content)
}

export function buildExpressionRegex(expression: string): RegExp {
  const trimmed = expression.trim()
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
  const prefix = /^[A-Za-z0-9]/.test(trimmed) ? '(?<![A-Za-z0-9])' : ''
  const suffix = /[A-Za-z0-9]$/.test(trimmed) ? '(?![A-Za-z0-9])' : ''
  return new RegExp(`${prefix}${escaped}${suffix}`, 'i')
}

function overlapsRange(
  start: number,
  end: number,
  occupied: Array<{ start: number; end: number }>,
) {
  return occupied.some((item) => start < item.end && end > item.start)
}

function toGlobalRegex(regex: RegExp) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  return new RegExp(regex.source, flags)
}

function findFirstAvailableMatch(article: string, expression: string) {
  const regex = toGlobalRegex(buildExpressionRegex(expression))
  for (const match of article.matchAll(regex)) {
    const start = match.index ?? -1
    if (start < 0 || !match[0]) continue
    return { start, end: start + match[0].length, text: match[0] }
  }
  return null
}

export function inferUsedNotesFromArticle(
  notes: NoteMatchCandidate[],
  article: string,
): ReadingUsedNote[] {
  const used: ReadingUsedNote[] = []
  const seen = new Set<string>()
  const occupied: Array<{ start: number; end: number }> = []

  const candidates: Array<{
    noteId: string
    original: string
    expression: string
    isVariant: boolean
    length: number
    variantPriority: number
  }> = []

  for (const note of notes) {
    const content = note.content.trim()
    if (!content) continue

    const synonym = parseSynonymPair(content)
    if (synonym) {
      candidates.push({
        noteId: note.id,
        original: content,
        expression: synonym.right,
        isVariant: true,
        length: synonym.right.length,
        variantPriority: 2,
      })
      candidates.push({
        noteId: note.id,
        original: content,
        expression: synonym.left,
        isVariant: false,
        length: synonym.left.length,
        variantPriority: 1,
      })
      continue
    }

    if (containsSynonymMarker(content)) continue

    candidates.push({
      noteId: note.id,
      original: content,
      expression: content,
      isVariant: false,
      length: content.length,
      variantPriority: 0,
    })
  }

  candidates.sort((a, b) => b.length - a.length || b.variantPriority - a.variantPriority)

  for (const candidate of candidates) {
    if (seen.has(candidate.noteId)) continue
    const match = findFirstAvailableMatch(article, candidate.expression)
    if (!match) continue
    if (overlapsRange(match.start, match.end, occupied)) continue

    occupied.push({ start: match.start, end: match.end })
    seen.add(candidate.noteId)
    used.push({
      noteId: candidate.noteId,
      original: candidate.original,
      expression: match.text,
      isVariant: candidate.isVariant,
    })
  }

  return used
}
