import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createGeminiService } from './gemini'
import type { AiServiceConfig, AiMessage } from './types'

const mockConfig: AiServiceConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  apiKey: 'test-gemini-key',
  maxTokens: 1024,
  temperature: 0.7,
}

const testMessages: readonly AiMessage[] = [
  { role: 'user', content: 'Hello, how are you?' },
]

function mockFetchResponse(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Headers(),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      body: null,
    }),
  )
}

describe('Gemini Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createGeminiService', () => {
    it('should return a service with correct provider name', () => {
      const service = createGeminiService(mockConfig)
      expect(service.getProviderName()).toBe('Google Gemini')
    })

    it('should report configured when apiKey and model are set', () => {
      const service = createGeminiService(mockConfig)
      expect(service.isConfigured()).toBe(true)
    })

    it('should report not configured when apiKey is empty', () => {
      const service = createGeminiService({ ...mockConfig, apiKey: '' })
      expect(service.isConfigured()).toBe(false)
    })

    it('should report not configured when model is empty', () => {
      const service = createGeminiService({ ...mockConfig, model: '' })
      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('complete', () => {
    it('should make request with API key in query param', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'Hello!' }] } },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
        },
      })

      const service = createGeminiService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const url = fetchCall[0] as string
      expect(url).toContain(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      )
      expect(url).toContain('key=test-gemini-key')
    })

    it('should map roles to Gemini format (user/model)', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'OK' }] } },
        ],
      })

      const messages: readonly AiMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ]

      const service = createGeminiService(mockConfig)
      await Effect.runPromise(service.complete(messages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there' }] },
        { role: 'user', parts: [{ text: 'How are you?' }] },
      ])
    })

    it('should pass system messages via systemInstruction', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'OK' }] } },
        ],
      })

      const messages: readonly AiMessage[] = [
        { role: 'system', content: 'You are a code reviewer' },
        { role: 'user', content: 'Review this' },
      ]

      const service = createGeminiService(mockConfig)
      await Effect.runPromise(service.complete(messages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'You are a code reviewer' }],
      })
      // System messages should NOT be in contents
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Review this' }] },
      ])
    })

    it('should merge systemPrompt option with system messages', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'OK' }] } },
        ],
      })

      const messages: readonly AiMessage[] = [
        { role: 'system', content: 'Extra context' },
        { role: 'user', content: 'Hello' },
      ]

      const service = createGeminiService(mockConfig)
      await Effect.runPromise(
        service.complete(messages, { systemPrompt: 'Base prompt' }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'Base prompt\n\nExtra context' }],
      })
    })

    it('should parse response with usage', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'Hello there!' }] } },
        ],
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 8,
        },
      })

      const service = createGeminiService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('Hello there!')
      expect(result.model).toBe('gemini-2.0-flash')
      expect(result.usage).toEqual({
        inputTokens: 15,
        outputTokens: 8,
      })
    })

    it('should pass generationConfig with maxTokens and temperature', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'OK' }] } },
        ],
      })

      const service = createGeminiService(mockConfig)
      await Effect.runPromise(
        service.complete(testMessages, {
          maxTokens: 2048,
          temperature: 0.1,
        }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.generationConfig.maxOutputTokens).toBe(2048)
      expect(body.generationConfig.temperature).toBe(0.1)
    })

    it('should use custom endpoint', async () => {
      mockFetchResponse({
        candidates: [
          { content: { parts: [{ text: 'OK' }] } },
        ],
      })

      const service = createGeminiService({
        ...mockConfig,
        endpoint: 'https://custom.googleapis.com',
      })
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const url = fetchCall[0] as string
      expect(url).toContain('https://custom.googleapis.com/v1beta/models/')
    })

    it('should handle empty candidates', async () => {
      mockFetchResponse({
        candidates: [],
      })

      const service = createGeminiService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('')
    })

    it('should return AiRateLimitError on 429', async () => {
      mockFetchResponse({ error: 'quota exceeded' }, 429)

      const service = createGeminiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiResponseError on non-OK status', async () => {
      mockFetchResponse({ error: 'bad request' }, 400)

      const service = createGeminiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiNetworkError on fetch failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      )

      const service = createGeminiService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('stream', () => {
    it('should return an AsyncIterable', () => {
      const service = createGeminiService(mockConfig)
      const iterable = service.stream(testMessages)

      expect(iterable[Symbol.asyncIterator]).toBeDefined()
    })
  })
})
