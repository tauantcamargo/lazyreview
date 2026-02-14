import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createOpenAiService } from './openai'
import type { AiServiceConfig, AiMessage } from './types'

const mockConfig: AiServiceConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: 'sk-test-key',
  maxTokens: 1024,
  temperature: 0.7,
}

const testMessages: readonly AiMessage[] = [
  { role: 'user', content: 'Hello, how are you?' },
]

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Headers(headers),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      body: null,
    }),
  )
}

describe('OpenAI Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createOpenAiService', () => {
    it('should return a service with correct provider name', () => {
      const service = createOpenAiService(mockConfig)
      expect(service.getProviderName()).toBe('OpenAI')
    })

    it('should support custom provider label', () => {
      const service = createOpenAiService(mockConfig, 'MyProvider')
      expect(service.getProviderName()).toBe('MyProvider')
    })

    it('should report configured when apiKey and model are set', () => {
      const service = createOpenAiService(mockConfig)
      expect(service.isConfigured()).toBe(true)
    })

    it('should report not configured when apiKey is empty', () => {
      const service = createOpenAiService({ ...mockConfig, apiKey: '' })
      expect(service.isConfigured()).toBe(false)
    })

    it('should report not configured when model is empty', () => {
      const service = createOpenAiService({ ...mockConfig, model: '' })
      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('complete', () => {
    it('should make request with correct headers', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'Hello!' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })

      const service = createOpenAiService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/chat/completions')

      const options = fetchCall[1] as RequestInit
      const headers = options.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer sk-test-key')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should send correct request body', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'Response' } }],
        model: 'gpt-4o',
      })

      const service = createOpenAiService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.model).toBe('gpt-4o')
      expect(body.max_tokens).toBe(1024)
      expect(body.temperature).toBe(0.7)
      expect(body.messages).toEqual([
        { role: 'user', content: 'Hello, how are you?' },
      ])
    })

    it('should parse response with usage', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'Hello there!' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 15, completion_tokens: 8 },
      })

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('Hello there!')
      expect(result.model).toBe('gpt-4o')
      expect(result.usage).toEqual({
        inputTokens: 15,
        outputTokens: 8,
      })
    })

    it('should prepend system prompt from options', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'OK' } }],
        model: 'gpt-4o',
      })

      const service = createOpenAiService(mockConfig)
      await Effect.runPromise(
        service.complete(testMessages, {
          systemPrompt: 'You are a code reviewer.',
        }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'You are a code reviewer.',
      })
      expect(body.messages[1]).toEqual({
        role: 'user',
        content: 'Hello, how are you?',
      })
    })

    it('should keep system messages in messages array', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'OK' } }],
        model: 'gpt-4o',
      })

      const messages: readonly AiMessage[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ]

      const service = createOpenAiService(mockConfig)
      await Effect.runPromise(service.complete(messages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.messages).toEqual([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ])
    })

    it('should use custom endpoint', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'OK' } }],
        model: 'custom-model',
      })

      const service = createOpenAiService({
        ...mockConfig,
        endpoint: 'https://my-api.example.com',
      })
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe(
        'https://my-api.example.com/v1/chat/completions',
      )
    })

    it('should override maxTokens and temperature from options', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'OK' } }],
        model: 'gpt-4o',
      })

      const service = createOpenAiService(mockConfig)
      await Effect.runPromise(
        service.complete(testMessages, {
          maxTokens: 2048,
          temperature: 0.1,
        }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.max_tokens).toBe(2048)
      expect(body.temperature).toBe(0.1)
    })

    it('should handle empty choices', async () => {
      mockFetchResponse({
        choices: [],
        model: 'gpt-4o',
      })

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('')
    })

    it('should return AiRateLimitError on 429', async () => {
      mockFetchResponse(
        { error: 'rate limited' },
        429,
        { 'retry-after': '60' },
      )

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiResponseError on non-OK status', async () => {
      mockFetchResponse({ error: 'bad request' }, 400)

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiNetworkError on fetch failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      )

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should handle missing usage in response', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'Hello' } }],
        model: 'gpt-4o',
      })

      const service = createOpenAiService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.usage).toBeUndefined()
    })
  })

  describe('stream', () => {
    it('should return an AsyncIterable', () => {
      const service = createOpenAiService(mockConfig)
      const iterable = service.stream(testMessages)

      expect(iterable[Symbol.asyncIterator]).toBeDefined()
    })
  })
})
