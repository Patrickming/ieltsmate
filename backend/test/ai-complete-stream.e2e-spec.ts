import { AiService } from '../src/ai/ai.service'

describe('AiService complete streaming', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('accumulates streamed chat completion delta content', async () => {
    const prisma = {
      aiModel: {
        findFirst: jest.fn().mockResolvedValue({
          modelId: 'deepseek/deepseek-v4-pro',
          provider: {
            name: 'ZenMux',
            displayName: 'ZenMux',
            baseUrl: 'https://zenmux.ai/api/v1',
            apiKey: 'sk-test',
          },
        }),
      },
    }
    const settings = { getAll: jest.fn().mockResolvedValue({ readingReviewModel: 'deepseek/deepseek-v4-pro' }) }
    const chunks = [
      'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"A"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"rticle\\",\\"article\\":\\"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world\\"}"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body))
      expect(body.stream).toBe(true)
      return new Response(new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
          controller.close()
        },
      }), { status: 200 })
    }) as unknown as typeof fetch

    const service = new AiService(
      prisma as unknown as ConstructorParameters<typeof AiService>[0],
      settings as unknown as ConstructorParameters<typeof AiService>[1],
    )

    await expect(service.complete({
      messages: [{ role: 'user', content: 'write' }],
      slot: 'readingReview',
      stream: true,
    })).resolves.toBe('{"title":"Article","article":"Hello world"}')
  })
})
