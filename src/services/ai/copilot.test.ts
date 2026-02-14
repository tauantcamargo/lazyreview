import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createCopilotService } from './copilot'
import type { AiServiceConfig, AiMessage } from './types'

const mockConfig: AiServiceConfig = {
  provider: 'copilot',
  model: 'gpt-4o',
  apiKey: 'gho_test-github-token',
  maxTokens: 1024,
  temperature: 0.7,
}

const testMessages: readonly AiMessage[] = [
  { role: 'user', content: 'Review this code' },
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

describe('Copilot Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createCopilotService', () => {
    it('should return a service with GitHub Copilot provider name', () => {
      const service = createCopilotService(mockConfig)
      expect(service.getProviderName()).toBe('GitHub Copilot')
    })

    it('should report configured when apiKey and model are set', () => {
      const service = createCopilotService(mockConfig)
      expect(service.isConfigured()).toBe(true)
    })
  })

  describe('complete', () => {
    it('should use Copilot endpoint by default', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'LGTM' } }],
        model: 'gpt-4o',
      })

      const service = createCopilotService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe(
        'https://api.githubcopilot.com/v1/chat/completions',
      )
    })

    it('should use custom endpoint when provided', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'LGTM' } }],
        model: 'gpt-4o',
      })

      const service = createCopilotService({
        ...mockConfig,
        endpoint: 'https://custom-copilot.example.com',
      })
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[0]).toBe(
        'https://custom-copilot.example.com/v1/chat/completions',
      )
    })

    it('should use Bearer token auth', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'LGTM' } }],
        model: 'gpt-4o',
      })

      const service = createCopilotService(mockConfig)
      await Effect.runPromise(service.complete(testMessages))

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      const options = fetchCall[1] as RequestInit
      const headers = options.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer gho_test-github-token')
    })

    it('should parse OpenAI-compatible response', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'Code looks good!' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      })

      const service = createCopilotService(mockConfig)
      const result = await Effect.runPromise(service.complete(testMessages))

      expect(result.content).toBe('Code looks good!')
      expect(result.model).toBe('gpt-4o')
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 20,
      })
    })
  })

  describe('stream', () => {
    it('should return an AsyncIterable', () => {
      const service = createCopilotService(mockConfig)
      const iterable = service.stream(testMessages)

      expect(iterable[Symbol.asyncIterator]).toBeDefined()
    })
  })
})
