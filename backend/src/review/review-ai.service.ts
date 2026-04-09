import { Injectable, Logger } from '@nestjs/common'
import { AiService } from '../ai/ai.service'
import { PrismaService } from '../prisma/prisma.service'
import { parseReviewAiPayload } from './review-ai-content.util'
import {
  CardAIContent,
  CardType,
  FallbackResponse,
} from './types/card-ai-content'

@Injectable()
export class ReviewAiService {
  private readonly logger = new Logger(ReviewAiService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  private extractFencedJson(content: string): string | null {
    const fenceMatch = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/)
    if (!fenceMatch) {
      return null
    }
    const jsonText = fenceMatch[1].trim()
    return jsonText ? jsonText : null
  }

  /**
   * 扫描文本中首个“平衡”的 JSON 对象，能正确跳过字符串内花括号与转义字符。
   */
  private extractFirstBalancedJsonObject(content: string): string | null {
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
          inString = false
          escaped = false
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

      if (inString) {
        continue
      }

      if (ch === '{') {
        depth += 1
        continue
      }

      if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          return content.slice(start, i + 1)
        }
      }
    }

    return null
  }

  private extractJsonCandidate(content: string): string {
    const fenced = this.extractFencedJson(content)
    if (fenced) {
      return fenced
    }
    const balanced = this.extractFirstBalancedJsonObject(content)
    if (balanced) {
      return balanced
    }
    return content
  }

  async generate(noteId: string, cardType: CardType): Promise<CardAIContent> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } })
    if (!note) {
      return this.buildFallback(null, '笔记不存在')
    }

    const prompt = this.buildPrompt(note, cardType)

    try {
      const result = await Promise.race([
        this.aiService.chat({
          messages: [{ role: 'user', content: prompt }],
          slot: 'review',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), 15_000),
        ),
      ])

      return this.parseAIResponse(result.content, cardType, note)
    } catch (err) {
      this.logger.warn(`AI generation failed for note ${noteId}: ${String(err)}`)
      return this.buildFallback(note, 'AI generation failed or timed out')
    }
  }

  private buildPrompt(
    note: {
      content: string
      translation: string
      category: string
      phonetic?: string | null
      synonyms: string[]
      antonyms: string[]
      example?: string | null
      memoryTip?: string | null
    },
    cardType: CardType,
  ): string {
    const base = `单词/内容: "${note.content}"\n中文含义: "${note.translation}"`

    if (cardType === 'word-speech') {
      return `${base}\n\n你是一位专业的IELTS词汇教师。请为这个单词生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "音标（如已知请填写，如不知请查询）",
  "synonyms": ["同义词1", "同义词2", "同义词3"],
  "antonyms": ["反义词1", "反义词2"],
  "example": "一个地道的例句",
  "exampleTranslation": "例句的中文翻译",
  "memoryTip": "帮助记忆的技巧或联想",
  "partsOfSpeech": [
    { "pos": "词性缩写如 n./v.", "label": "词性中文如 名词", "meaning": "该词性下的义项（中文）" }
  ],
  "confusables": [
    {
      "kind": "form",
      "words": [
        { "word": "易混词A", "meaning": "义项（中文）" },
        { "word": "易混词B", "meaning": "义项（中文）" }
      ]
    },
    {
      "kind": "meaning",
      "difference": "易混点核心区别说明（中文，必填）",
      "words": [
        { "word": "词1", "meaning": "义项" },
        { "word": "词2", "meaning": "义项" }
      ]
    }
  ],
  "wordFamily": {
    "base": { "word": "目标词", "pos": "adjective", "meaning": "义项（中文）", "phonetic": "/音标/" },
    "derivedByPos": {
      "noun": [{ "word": "派生名词", "pos": "noun", "meaning": "义项", "phonetic": "/音标/" }],
      "verb": [],
      "adjective": [],
      "adverb": []
    }
  }
}
partsOfSpeech/confusables/wordFamily 可选；wordFamily.base 必填（若提供 wordFamily）；derivedByPos 四个数组均需存在；派生项 pos 必须为 noun|verb|adjective|adverb 且与所在分区一致；confusables 中 kind 为 form（形近/拼写易混）或 meaning（义近易混），kind 为 meaning 时必须提供非空 difference；每组至少两个 words。
只返回JSON，不要其他内容。`
    }

    if (cardType === 'phrase') {
      return `${base}\n\n你是一位专业的IELTS词汇教师。请为这个短语生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "整体发音提示或重读说明",
  "synonyms": ["同义短语1", "同义短语2"],
  "antonyms": ["反义短语1", "反义短语2"],
  "example": "一个地道的例句",
  "exampleTranslation": "例句的中文翻译",
  "memoryTip": "帮助记忆的技巧"
}
只返回JSON，不要其他内容。`
    }

    if (cardType === 'synonym') {
      const words = note.content
        .split(/[,，/、]/)
        .map((w) => w.trim())
        .filter(Boolean)
      const wordList = words.map((w) => `"${w}"`).join(', ')
      return `同义词组: [${wordList}]\n中文含义: "${note.translation}"\n\n你是一位专业的IELTS词汇教师。请为这个同义替换词组生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "wordMeanings": [
    { "word": "单词1", "phonetic": "音标", "meaning": "具体含义及与其他词的细微差别" },
    { "word": "单词2", "phonetic": "音标", "meaning": "具体含义及与其他词的细微差别" }
  ],
  "antonymGroup": ["反义同义替换词1", "反义同义替换词2", "反义同义替换词3"],
  "moreSynonyms": ["更多同义词1", "更多同义词2", "更多同义词3"]
}
只返回JSON，不要其他内容。`
    }

    if (cardType === 'sentence') {
      return `原句: "${note.content}"\n中文含义: "${note.translation}"\n\n你是一位专业的IELTS写作教师。请生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "analysis": "帮助理解句意的自然语言解析（重点说明句子逻辑结构、关键短语的作用，使学习者能读懂这句话）",
  "paraphrases": [
    { "sentence": "改写版本1（替换不同结构）", "dimension": "结构变化：如从句→分词" },
    { "sentence": "改写版本2（替换不同词汇）", "dimension": "词汇变化：如词性转换" },
    { "sentence": "改写版本3（整体重构）", "dimension": "整体重构：完全不同的表达方式" }
  ]
}
只返回JSON，不要其他内容。`
    }

    if (cardType === 'spelling') {
      return `单词: "${note.content}"\n中文含义: "${note.translation}"\n\n你是一位专业的IELTS词汇教师。请为拼写练习生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "音标",
  "synonyms": ["同义词1", "同义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "memoryTip": "拼写记忆技巧（如词根词缀分析）",
  "contextExample": {
    "sentence": "包含该单词的例句",
    "translation": "例句的中文翻译",
    "analysis": "例句结构分析和理解要点"
  },
  "partsOfSpeech": [
    { "pos": "词性缩写", "label": "词性中文", "meaning": "义项（中文）" }
  ],
  "confusables": [
    {
      "kind": "form",
      "words": [
        { "word": "易混词A", "meaning": "义项" },
        { "word": "易混词B", "meaning": "义项" }
      ]
    },
    {
      "kind": "meaning",
      "difference": "核心区别说明（必填）",
      "words": [
        { "word": "词1", "meaning": "义项" },
        { "word": "词2", "meaning": "义项" }
      ]
    }
  ],
  "wordFamily": {
    "base": { "word": "目标词", "pos": "verb", "meaning": "义项（中文）", "phonetic": "/音标/" },
    "derivedByPos": {
      "noun": [],
      "verb": [],
      "adjective": [{ "word": "derived", "pos": "adjective", "meaning": "义项", "phonetic": "" }],
      "adverb": []
    }
  }
}
partsOfSpeech/confusables/wordFamily 可选；wordFamily 规则同 word-speech 卡片说明；confusables 规则同 word-speech 卡片说明。
只返回JSON，不要其他内容。`
    }

    return `${base}\n请以JSON格式提供学习内容。`
  }

  private parseAIResponse(
    content: string,
    cardType: CardType,
    note: {
      content: string
      translation: string
      phonetic?: string | null
      synonyms: string[]
      antonyms: string[]
      example?: string | null
      memoryTip?: string | null
    },
  ): CardAIContent {
    try {
      const jsonStr = this.extractJsonCandidate(content)
      const parsed = JSON.parse(jsonStr.trim()) as unknown

      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as { fallback?: boolean }).fallback === false
      ) {
        const contentParsed = parseReviewAiPayload(parsed, cardType)
        if (contentParsed !== null) {
          return contentParsed
        }
      }

      return this.buildFallback(note, 'AI returned unexpected format')
    } catch {
      return this.buildFallback(note, 'Failed to parse AI response')
    }
  }

  private buildFallback(
    note: {
      translation: string
      phonetic?: string | null
      synonyms: string[]
      antonyms: string[]
      example?: string | null
      memoryTip?: string | null
    } | null,
    _reason: string,
  ): FallbackResponse {
    return {
      fallback: true,
      phonetic: note?.phonetic ?? null,
      translation: note?.translation ?? '',
      synonyms: note?.synonyms ?? [],
      antonyms: note?.antonyms ?? [],
      example: note?.example ?? null,
      memoryTip: note?.memoryTip ?? null,
    }
  }
}
