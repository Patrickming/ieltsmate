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
    const lexicalTruthGuard = '重要：上面的“中文含义”来自用户笔记，可能不准确或词性有误。你必须优先依据英语词典/真实语料判断该英文词（或短语）的词性与义项；若与给定中文冲突，以词典判断为准并自动纠正，不要被“...地”等字面误导。'

    if (cardType === 'word-speech') {
      return `${base}\n\n${lexicalTruthGuard}\n你是一位专业的IELTS词汇教师。请为这个单词生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "音标（如已知请填写，如不知请查询）",
  "synonyms": [
    { "word": "同义词1", "meaning": "该同义词相对目标词的具体中文释义" },
    { "word": "同义词2", "meaning": "具体中文释义" },
    { "word": "同义词3", "meaning": "具体中文释义" }
  ],
  "antonyms": [
    { "word": "反义词1", "meaning": "具体中文释义" },
    { "word": "反义词2", "meaning": "具体中文释义" }
  ],
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
    },
    "rootDerived": [
      { "word": "同词根关联词", "pos": "verb", "meaning": "义项", "phonetic": "/音标/" }
    ]
  }
}
partsOfSpeech 必填，穷举该词所有真实存在的词性及义项（依据词典判断，若确实只有一种词性则只返回该词性）；confusables/wordFamily 可选；wordFamily.base 必填（若提供 wordFamily）；derivedByPos 四个数组均需存在；derivedByPos 只放词形变化派生（加前缀/后缀改变词性，意思与目标词紧密相关）；rootDerived 放同词根/词缀但意思已分化的关联词（平铺数组，不按词性分组）；两者不要重复。wordFamily.base.pos 必须是“目标词本身”的主词性（不要把派生词词性当作 base）；派生项 pos 必须为 noun|verb|adjective|adverb 且与所在分区一致；confusables 中 kind 为 form（形近/拼写易混）或 meaning（义近易混），kind 为 meaning 时必须提供非空 difference；每组至少两个 words。confusables 中 form 类只放拼写极相似、真正容易看错的词（如 strip vs stripe），不要放共享词根的派生词（那些属于 wordFamily.rootDerived）。
synonyms 与 antonyms 须为对象数组 [{ "word": "…", "meaning": "…" }]：word 与 meaning 必须非空；meaning 必须给出具体中文释义。只返回 JSON，不要其他内容。`
    }

    if (cardType === 'phrase') {
      return `${base}\n\n${lexicalTruthGuard}\n你是一位专业的IELTS词汇教师。请为这个短语生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "整体发音提示或重读说明",
  "synonyms": [
    { "word": "同义短语1", "meaning": "该短语相对目标短语的具体中文释义" },
    { "word": "同义短语2", "meaning": "具体中文释义" }
  ],
  "antonyms": [
    { "word": "反义短语1", "meaning": "具体中文释义" },
    { "word": "反义短语2", "meaning": "具体中文释义" }
  ],
  "example": "一个地道的例句",
  "exampleTranslation": "例句的中文翻译",
  "memoryTip": "帮助记忆的技巧"
}
synonyms 与 antonyms 须为对象数组 [{ "word": "…", "meaning": "…" }]：word 与 meaning 必须非空；meaning 必须给出具体中文释义。只返回 JSON，不要其他内容。`
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
  "antonymGroup": [
    { "word": "反义替换词1", "meaning": "具体中文释义" },
    { "word": "反义替换词2", "meaning": "具体中文释义" },
    { "word": "反义替换词3", "meaning": "具体中文释义" }
  ],
  "moreSynonyms": [
    { "word": "更多同义词1", "meaning": "具体中文释义" },
    { "word": "更多同义词2", "meaning": "具体中文释义" },
    { "word": "更多同义词3", "meaning": "具体中文释义" }
  ]
}
antonymGroup 与 moreSynonyms 须为对象数组 [{ "word": "…", "meaning": "…" }]：word 与 meaning 必须非空；meaning 必须给出具体中文释义。只返回 JSON，不要其他内容。`
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
只返回 JSON，不要其他内容。`
    }

    if (cardType === 'spelling') {
      return `单词: "${note.content}"\n中文含义: "${note.translation}"\n\n${lexicalTruthGuard}\n你是一位专业的IELTS词汇教师。请为拼写练习生成复习卡片背面内容，以JSON格式返回：
{
  "fallback": false,
  "phonetic": "音标",
  "synonyms": [
    { "word": "同义词1", "meaning": "具体中文释义" },
    { "word": "同义词2", "meaning": "具体中文释义" }
  ],
  "antonyms": [
    { "word": "反义词1", "meaning": "具体中文释义" },
    { "word": "反义词2", "meaning": "具体中文释义" }
  ],
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
    },
    "rootDerived": [
      { "word": "同词根关联词", "pos": "verb", "meaning": "义项", "phonetic": "/音标/" }
    ]
  }
}
partsOfSpeech 必填，穷举该词所有真实存在的词性及义项（依据词典判断，若确实只有一种词性则只返回该词性）；confusables/wordFamily 可选；wordFamily 规则同 word-speech 卡片说明；confusables 规则同 word-speech 卡片说明。confusables 中 form 类只放拼写极相似、真正容易看错的词（如 strip vs stripe），不要放共享词根的派生词（那些属于 wordFamily.rootDerived）。
synonyms 与 antonyms 须为对象数组 [{ "word": "…", "meaning": "…" }]：word 与 meaning 必须非空；meaning 必须给出具体中文释义。只返回 JSON，不要其他内容。`
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
