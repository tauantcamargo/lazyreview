import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createOllamaService } from './ollama'
import type { AiServiceConfig, AiMessage } from './types'

const mockConfig: AiServiceConfig = {
  provider: 'ollama',
  model: 'llama3.1',
  apiKey: '',
  maxTokens: 1024,
  temperature: 0.7,
}

const testMessages: readonly AiMessage[] = [
  { role: 'user', content: 'Explain this code' },
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

describe('Ollama Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createOllamaService', () => {
    it('should return a service with correct provider name', () => {
      const service = createOllamaService(mockConfig)
      expect(service.getProviderName()).toBe('Ollama')
    })

    it('should report configured when model is set (no API key needed)', () => {
      const service = createOllamaService(mockConfig)
      expect(service.isConfigured()).toBe(true)
    })

    it('should report not configured when model is empty', () => {
      const service = createOllamaService({ ...mockConfig, model: '' })
      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('complete', () => {
    it('should make request to local endpoint', async () => {
      mockFetchResponse({
        message: { content: 'Here is the explanation...' },
        model: 'llama3.1',
        prompt_eval_count: 20,
        eval_count: 50,
      })

      const service = createOllamaService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('http://localhost:11434/api/chat')
    })

    it('should send correct request body', async () => {
      mockFetchResponse({
        message: { content: 'Response' },
        model: 'llama3.1',
      })

      const service = createOllamaService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.model).toBe('llama3.1')
      expect(body.stream).toBe(false)
      expect(body.messages).toEqual([
        { role: 'user', content: 'Explain this code' },
      ])
      expect(body.options.num_predict).toBe(1024)
      expect(body.options.temperature).toBe(0.7)
    })

    it('should parse response with usage', async () => {
      mockFetchResponse({
        message: { content: 'The code does X' },
        model: 'llama3.1',
        prompt_eval_count: 20,
        eval_count: 50,
      })

      const service = createOllamaService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('The code does X')
      expect(result.model).toBe('llama3.1')
      expect(result.usage).toEqual({
        inputTokens: 20,
        outputTokens: 50,
      })
    })

    it('should use custom endpoint', async () => {
      mockFetchResponse({
        message: { content: 'OK' },
        model: 'llama3.1',
      })

      const service = createOllamaService({
        ...mockConfig,
        endpoint: 'http://gpu-server:11434',
      })
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe('http://gpu-server:11434/api/chat')
    })

    it('should prepend system prompt from options', async () => {
      mockFetchResponse({
        message: { content: 'OK' },
        model: 'llama3.1',
      })

      const service = createOllamaService(mockConfig)
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
    })

    it('should override maxTokens and temperature from options', async () => {
      mockFetchResponse({
        message: { content: 'OK' },
        model: 'llama3.1',
      })

      const service = createOllamaService(mockConfig)
      await Effect.runPromise(
        service.complete(testMessages, {
          maxTokens: 4096,
          temperature: 0.0,
        }),
      )

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const body = JSON.parse(options.body as string)

      expect(body.options.num_predict).toBe(4096)
      expect(body.options.temperature).toBe(0.0)
    })

    it('should return AiResponseError on non-OK status', async () => {
      mockFetchResponse({ error: 'model not found' }, 404)

      const service = createOllamaService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should return AiNetworkError on fetch failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Connection refused')),
      )

      const service = createOllamaService(mockConfig)
      const result = await Effect.runPromiseExit(service.complete(testMessages))

      expect(result._tag).toBe('Failure')
    })

    it('should handle missing usage in response', async () => {
      mockFetchResponse({
        message: { content: 'Hello' },
        model: 'llama3.1',
      })

      const service = createOllamaService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.usage).toBeUndefined()
    })

    it('should not send auth headers', async () => {
      mockFetchResponse({
        message: { content: 'OK' },
        model: 'llama3.1',
      })

      const service = createOllamaService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const headers = options.headers as Record<string, string>

      expect(headers['Authorization']).toBeUndefined()
      expect(headers['x-api-key']).toBeUndefined()
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('stream', () => {
    it('should return an AsyncIterable', () => {
      const service = createOllamaService(mockConfig)
      const iterable = service.stream(testMessages)

      expect(iterable[Symbol.asyncIterator]).toBeDefined()
    })
  })
})
