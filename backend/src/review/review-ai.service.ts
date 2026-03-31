import { Injectable, Logger } from '@nestjs/common'
import { AiService } from '../ai/ai.service'
import { PrismaService } from '../prisma/prisma.service'
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
  "memoryTip": "帮助记忆的技巧或联想"
}
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
  }
}
只返回JSON，不要其他内容。`
    }

    return `${base}\n请以JSON格式提供学习内容。`
  }

  private parseAIResponse(
    content: string,
    _cardType: CardType,
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
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) ??
        content.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content
      const parsed = JSON.parse(jsonStr.trim()) as { fallback?: boolean }

      if (parsed.fallback === false) {
        return parsed as CardAIContent
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
