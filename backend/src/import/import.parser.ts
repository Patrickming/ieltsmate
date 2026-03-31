export interface RawEntry {
  content: string
  translation: string
  category: string
  synonyms: string[]
  needsAI: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCategory(line: string): string | null {
  const m = line.match(/^###\s+(.+)/)
  return m ? m[1].trim() : null
}

/**
 * 真正的拼写列表行：多个独立英文单词，无中文，无等号，不以句末标点结尾
 * 例："January February theater Saturday"
 * 排除：句子 "So nothing really to do..."、同义链 "A = B"
 */
function isSpellingListLine(line: string): boolean {
  if (/[\u4e00-\u9fa5（）【】]/.test(line)) return false
  if (line.includes('=')) return false
  if (/[.!?,;]$/.test(line.trimEnd())) return false
  const words = line.trim().split(/\s+/).filter((w) => /^[a-zA-Z\-']+$/.test(w))
  return words.length >= 4
}

/**
 * 检测文本中是否有被英文词（≥2字母）分隔的多个中文词组
 * 例："显示表明 cooperation laundry洗衣店 nightmare噩梦" → true
 *     "与…… 有关"                                    → false（单个词组）
 *     "壮观的/令人惊叹的 = dramatic"                  → false（一个词条+英文同义词）
 */
function hasMultipleChineseGroups(text: string): boolean {
  // 按 2+ 连续英文字母拆分，统计含中文的段数
  const parts = text.split(/[a-zA-Z]{2,}/)
  const chineseParts = parts.filter((p) => /[\u4e00-\u9fa5]/.test(p))
  return chineseParts.length >= 2
}

/**
 * 检测多词条混排行：行内英文词被中文注释分隔（多个独立词条写在一行）
 * 例："meditation冥想沉思 dispense分发分配-- indispensable不可或缺的"
 */
function isComplexMultiEntryLine(line: string): boolean {
  return hasMultipleChineseGroups(line)
}

/**
 * 加粗词条：**词条** 中文释义 或 **词条**（中文）
 * content 至少 3 个字符，避免提取 "To" / "A" 等冠词介词
 */
function parseBoldEntry(line: string, category: string): RawEntry | null {
  const m = line.match(/^\*\*(.+?)\*\*/)
  if (!m) return null
  const content = m[1].trim()
  // 过滤太短的内容（通常是误匹配的冠词/介词）
  if (content.length < 3 || /^(a|an|to|the|of|in|on|at|by|do|be|I)$/i.test(content)) return null

  const rest = line.replace(/^\*\*(.+?)\*\*/, '').trim()
  if (!rest) return null

  // 优先提取括号内的中文注释：（中文）
  const parenMatch = rest.match(/^[（(]([^）)]+)[）)]/)
  if (parenMatch && /[\u4e00-\u9fa5]/.test(parenMatch[1])) {
    return { content, translation: parenMatch[1].trim(), category, synonyms: [], needsAI: false }
  }

  // 从第一个中文字符开始取释义
  const chineseIdx = rest.search(/[\u4e00-\u9fa5]/)
  if (chineseIdx >= 0) {
    return { content, translation: rest.slice(chineseIdx).trim(), category, synonyms: [], needsAI: false }
  }

  // 无中文的加粗（如 **词条** = other，可能是同义替换或需AI）
  const cleanRest = rest.replace(/\*\*/g, '').trim()
  if (cleanRest.length > 0) {
    return { content, translation: cleanRest, category, synonyms: [], needsAI: true }
  }
  return null
}

/**
 * 含中文的同义替换：A = B 中文  →  content=A, synonyms=[B], translation=中文
 */
function parseSynonymEntry(line: string, category: string): RawEntry | null {
  const m = line.match(/^([a-zA-Z][a-zA-Z\s\-']*?)\s*=\s*([a-zA-Z][a-zA-Z\s\-']*?)\s+([\u4e00-\u9fa5].+)$/)
  if (!m) return null
  return {
    content: m[1].trim(),
    translation: m[3].trim(),
    category,
    synonyms: [m[2].trim()],
    needsAI: false,
  }
}

/**
 * 无中文的同义替换：A = B  或  A = B = C
 * needsAI=true 让 AI 补充中文释义
 */
function parseSynonymNoTransEntry(line: string, category: string): RawEntry | null {
  if (/[\u4e00-\u9fa5]/.test(line)) return null
  if (!line.includes('=')) return null
  const clean = line.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim()
  const parts = clean
    .split('=')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[a-zA-Z]/.test(s))
  if (parts.length < 2) return null
  return {
    content: parts[0],
    translation: '',
    category,
    synonyms: parts.slice(1),
    needsAI: true,
  }
}

/**
 * 纯文本：以英文开头，包含中文
 */
function parsePlainEntry(line: string, category: string): RawEntry | null {
  if (!/[\u4e00-\u9fa5]/.test(line)) return null
  const clean = line.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim()
  const idx = clean.search(/[\u4e00-\u9fa5（）【】]/)
  if (idx <= 0) return null
  // 去掉 content 末尾的半角括号/标点（如 "in proportion(to)(" → "in proportion(to)"）
  const content = clean.slice(0, idx).trim().replace(/[([\s]+$/, '').trim()
  const translation = clean.slice(idx).trim()
  if (!content || !translation) return null
  if (!/[a-zA-Z]/.test(content)) return null
  return { content, translation, category, synonyms: [], needsAI: false }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseMarkdown(markdown: string): RawEntry[] {
  const lines = markdown.split('\n')
  const entries: RawEntry[] = []
  let currentCategory = '未分类'

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // 跳过空行、图片
    if (!line) continue
    if (line.startsWith('<img')) continue

    // h1 / h2 标题跳过
    if (/^#{1,2}\s/.test(line)) continue

    // ### 分类标题（在列表剥离前检测，避免误剥离）
    const cat = parseCategory(line)
    if (cat) {
      currentCategory = cat
      continue
    }

    let processedLine = line

    // 剥离引用块前缀 > （保留内容继续解析，不直接跳过）
    if (line.startsWith('> ')) {
      processedLine = line.slice(2).trim()
    } else if (line === '>') {
      continue
    }

    // 剥离有序列表前缀（1. 2. 等）
    const numberedMatch = processedLine.match(/^\d+\.\s+(.+)/)
    if (numberedMatch) {
      processedLine = numberedMatch[1].trim()
    } else if (/^\d+\.\s*$/.test(processedLine)) {
      continue // 空的有序列表项
    }

    // 剥离无序列表前缀（- / * / + 后接空格）
    const listMatch = processedLine.match(/^[-*+]\s+(.+)/)
    if (listMatch) {
      processedLine = listMatch[1]
    } else if (/^[|`]/.test(processedLine)) {
      continue // 跳过表格/代码块行
    }

    // 跳过以中文开头的行（通常是例句说明、注释）
    if (/^[\u4e00-\u9fa5（）【】]/.test(processedLine)) continue

    // ── 拼写列表 ────────────────────────────────────────────────────────────
    if (isSpellingListLine(processedLine)) {
      const words = processedLine.split(/\s+/).filter((w) => /^[a-zA-Z\-']+$/.test(w))
      for (const word of words) {
        entries.push({ content: word, translation: '', category: currentCategory, synonyms: [], needsAI: true })
      }
      continue
    }

    // ── 加粗词条（优先于复杂行检测，避免长短语被误判为混排）──────────────────
    const bold = parseBoldEntry(processedLine, currentCategory)
    if (bold) {
      // 判断是否多词条行（被 bold 拦截只取了第一词）：
      //   1. translation 本身有多组中文穿插英文，或
      //   2. content 很短（≤2个词）且整行有多组中文（说明行内有更多词条）
      const wordCount = bold.content.trim().split(/\s+/).length
      const isMultiEntry =
        hasMultipleChineseGroups(bold.translation) ||
        (wordCount <= 2 && hasMultipleChineseGroups(processedLine))

      if (isMultiEntry) {
        const cleaned = processedLine.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim()
        if (cleaned.length > 3) {
          entries.push({ content: cleaned, translation: '', category: currentCategory, synonyms: [], needsAI: true })
        }
        continue
      }
      entries.push(bold)
      continue
    }

    // ── 含中文的同义替换 A = B 中文 ──────────────────────────────────────────
    const syn = parseSynonymEntry(processedLine, currentCategory)
    if (syn) { entries.push(syn); continue }

    // ── 多词条混排行 → 整行送 AI ────────────────────────────────────────────
    if (isComplexMultiEntryLine(processedLine)) {
      const cleaned = processedLine.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim()
      if (cleaned.length > 3) {
        entries.push({ content: cleaned, translation: '', category: currentCategory, synonyms: [], needsAI: true })
      }
      continue
    }

    // ── 纯文本 英文 中文 ──────────────────────────────────────────────────────
    const plain = parsePlainEntry(processedLine, currentCategory)
    if (plain) { entries.push(plain); continue }

    // ── 无中文的同义替换 A = B ────────────────────────────────────────────────
    const synNoTrans = parseSynonymNoTransEntry(processedLine, currentCategory)
    if (synNoTrans) { entries.push(synNoTrans); continue }

    // ── 兜底：有实质英文内容 → 送 AI ────────────────────────────────────────
    const cleaned = processedLine.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').trim()
    if (cleaned.length > 3 && /[a-zA-Z]/.test(cleaned)) {
      entries.push({ content: cleaned, translation: '', category: currentCategory, synonyms: [], needsAI: true })
    }
  }

  return entries
}
