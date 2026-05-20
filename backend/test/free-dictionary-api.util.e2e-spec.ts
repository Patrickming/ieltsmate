import 'reflect-metadata'
import {
  mergePronunciation,
  normalizeLookupWord,
  parseDictionaryApiDev,
  parseFreeDictionaryCom,
} from '../src/dictionary/free-dictionary-api.util'

describe('free-dictionary-api util', () => {
  it('normalizeLookupWord 取首个英文词', () => {
    expect(normalizeLookupWord('  Take off  ')).toBe('take')
    expect(normalizeLookupWord('accommodation')).toBe('accommodation')
  })

  it('parseFreeDictionaryCom 优先英式 IPA', () => {
    const out = parseFreeDictionaryCom(
      {
        word: 'hello',
        entries: [
          {
            pronunciations: [
              { type: 'ipa', text: '/həˈloʊ/', tags: ['US'] },
              { type: 'ipa', text: '/həˈləʊ/', tags: ['UK', 'Received-Pronunciation'] },
            ],
          },
        ],
      },
      'hello',
    )
    expect(out?.phonetic).toBe('/həˈləʊ/')
    expect(out?.accent).toBe('uk')
    expect(out?.source).toBe('freedictionaryapi.com')
  })

  it('parseDictionaryApiDev 优先 -uk 音频', () => {
    const fixture = [
      {
        word: 'hello',
        phonetics: [
          {
            text: '/həˈloʊ/',
            audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3',
          },
          {
            text: '/həˈləʊ/',
            audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3',
          },
        ],
      },
    ]
    const out = parseDictionaryApiDev(fixture, 'hello')
    expect(out?.phonetic).toBe('/həˈləʊ/')
    expect(out?.audioUrl).toContain('hello-uk.mp3')
    expect(out?.accent).toBe('uk')
  })

  it('parseFreeDictionaryCom ukOnly 忽略美式', () => {
    const out = parseFreeDictionaryCom(
      {
        word: 'test',
        entries: [
          {
            pronunciations: [
              { type: 'ipa', text: '/tɛst/', tags: ['US'] },
              { type: 'ipa', text: '/test/', tags: ['UK'] },
            ],
          },
        ],
      },
      'test',
      true,
    )
    expect(out?.phonetic).toBe('/test/')
    expect(out?.accent).toBe('uk')
  })

  it('mergePronunciation 用 com 音标 + dev 音频', () => {
    const merged = mergePronunciation(
      {
        word: 'go',
        phonetic: '/ɡəʊ/',
        audioUrl: null,
        accent: 'uk',
        source: 'freedictionaryapi.com',
      },
      {
        word: 'go',
        phonetic: '/ɡoʊ/',
        audioUrl: 'https://example.com/go-uk.mp3',
        accent: 'uk',
        source: 'dictionaryapi.dev',
      },
    )
    expect(merged?.phonetic).toBe('/ɡəʊ/')
    expect(merged?.audioUrl).toBe('https://example.com/go-uk.mp3')
  })
})
