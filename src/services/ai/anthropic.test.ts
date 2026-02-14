import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createAnthropicService } from './anthropic'
import type { AiServiceConfig, AiMessage } from './types'

const mockConfig: AiServiceConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'test-api-key',
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

describe('Anthropic Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createAnthropicService', () => {
    it('should return a service with correct provider name', () => {
      const service = createAnthropicService(mockConfig)
      expect(service.getProviderName()).toBe('Anthropic')
    })

    it('should report configured when apiKey and model are set', () => {
      const service = createAnthropicService(mockConfig)
      expect(service.isConfigured()).toBe(true)
    })

    it('should report not configured when apiKey is empty', () => {
      const service = createAnthropicService({ ...mockConfig, apiKey: '' })
      expect(service.isConfigured()).toBe(false)
    })

    it('should report not configured when model is empty', () => {
      const service = createAnthropicService({ ...mockConfig, model: '' })
      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('complete', () => {
    it('should make request with correct headers', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 5 },
      })

      const service = createAnthropicService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('https://api.anthropic.com/v1/messages')

      const options = fetchCall[1] as RequestInit
      const headers = options.headers as Record<string, string>
      expect(headers['x-api-key']).toBe('test-api-key')
      expect(headers['anthropic-version']).toBe('2023-06-01')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should send correct request body', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-20250514',
      })

      const service = createAnthropicService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.model).toBe('claude-sonnet-4-20250514')
      expect(body.max_tokens).toBe(1024)
      expect(body.temperature).toBe(0.7)
      expect(body.messages).toEqual([
        { role: 'user', content: 'Hello, how are you?' },
      ])
    })

    it('should parse response with usage', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'Hello there!' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 15, output_tokens: 8 },
      })

      const service = createAnthropicService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('Hello there!')
      expect(result.model).toBe('claude-sonnet-4-20250514')
      expect(result.usage).toEqual({
        inputTokens: 15,
        outputTokens: 8,
      })
    })

    it('should concatenate multiple text blocks', async () => {
      mockFetchResponse({
        content: [
          { type: 'text', text: 'Part 1 ' },
          { type: 'text', text: 'Part 2' },
        ],
        model: 'claude-sonnet-4-20250514',
      })

      const service = createAnthropicService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('Part 1 Part 2')
    })

    it('should separate system messages into system field', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
      })

      const messages: readonly AiMessage[] = [
        { role: 'system', content: 'You are a code reviewer.' },
        { role: 'user', content: 'Review this code' },
      ]

      const service = createAnthropicService(mockConfig)
      await Effect.runPromise(service.complete(messages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.system).toBe('You are a code reviewer.')
      expect(body.messages).toEqual([
        { role: 'user', content: 'Review this code' },
      ])
    })

    it('should merge systemPrompt option with system messages', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
      })

      const messages: readonly AiMessage[] = [
        { role: 'system', content: 'Extra instruction' },
        { role: 'user', content: 'Hello' },
      ]

      const service = createAnthropicService(mockConfig)
      await Effect.runPromise(
        service.complete(messages, { systemPrompt: 'Base prompt' }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.system).toBe('Base prompt\n\nExtra instruction')
    })

    it('should use custom endpoint', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
      })

      const service = createAnthropicService({
        ...mockConfig,
        endpoint: 'https://custom.anthropic.example.com',
      })
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe(
        'https://custom.anthropic.example.com/v1/messages',
      )
    })

    it('should override maxTokens and temperature from options', async () => {
      mockFetchResponse({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-sonnet-4-20250514',
      })

      const service = createAnthropicService(mockConfig)
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

    it('should return AiRateLimitError on 429', async () => {
      mockFetchResponse(
        { error: 'rate limited' },
        429,
        { 'retry-after': '30' },
      )

      const service = createAnthropicService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        const error = result.cause
        // Effect wraps the error in a Cause
        expect(JSON.stringify(error)).toContain('AiRateLimitError')
      }
    })

    it('should return AiResponseError on non-OK status', async () => {
      mockFetchResponse({ error: 'bad request' }, 400)

      const service = createAnthropicService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiNetworkError on fetch failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      )

      const service = createAnthropicService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })
  })

  describe('stream', () => {
    it('should return an AsyncIterable', () => {
      const service = createAnthropicService(mockConfig)
      const iterable = service.stream(testMessages)

      expect(iterable[Symbol.asyncIterator]).toBeDefined()
    })
  })
})
