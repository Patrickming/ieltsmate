import 'reflect-metadata'
import type { FreeDictionaryApiService } from '../src/dictionary/free-dictionary-api.service'
import { enrichReviewCardWithDictionary } from '../src/review/review-dictionary-enrichment'
import type { WordSpeechAI } from '../src/review/types/card-ai-content'

describe('review-dictionary-enrichment', () => {
  const dictionary = {
    lookupBritishPronunciation: jest.fn(),
  } as unknown as FreeDictionaryApiService

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('用英式词典覆盖 AI 音标并附带音频', async () => {
    ;(dictionary.lookupBritishPronunciation as jest.Mock).mockResolvedValue({
      word: 'hello',
      phonetic: '/həˈləʊ/',
      audioUrl: 'https://example.com/hello-uk.mp3',
      accent: 'uk',
      source: 'dictionaryapi.dev',
    })

    const ai: WordSpeechAI = {
      fallback: false,
      phonetic: '/wrong/',
      synonyms: [{ word: 'hi', meaning: '嗨' }],
      antonyms: [{ word: 'bye', meaning: '再见' }],
      example: 'Hello.',
      memoryTip: 'tip',
    }

    const out = await enrichReviewCardWithDictionary(
      dictionary,
      ai,
      'word-speech',
      'hello',
    )

    expect(out.fallback).toBe(false)
    if (out && 'phonetic' in out && !out.fallback) {
      expect(out.phonetic).toBe('/həˈləʊ/')
      expect(out.pronunciationAudioUrl).toContain('hello-uk.mp3')
      expect(out.pronunciationAccent).toBe('uk')
    }
  })
})
