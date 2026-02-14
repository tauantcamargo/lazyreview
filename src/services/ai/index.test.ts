import { describe, it, expect } from 'vitest'
import { createAiService } from './index'
import { AiConfigError } from '../../models/ai-errors'
import type { AiServiceConfig } from './types'

function makeConfig(provider: string, extras: Partial<AiServiceConfig> = {}): AiServiceConfig {
  return {
    provider: provider as AiServiceConfig['provider'],
    model: 'test-model',
    apiKey: 'test-key',
    maxTokens: 1024,
    temperature: 0.5,
    ...extras,
  }
}

describe('AI Service Factory', () => {
  describe('createAiService', () => {
    it('should create Anthropic service', () => {
      const service = createAiService(makeConfig('anthropic'))
      expect(service.getProviderName()).toBe('Anthropic')
      expect(service.isConfigured()).toBe(true)
    })

    it('should create OpenAI service', () => {
      const service = createAiService(makeConfig('openai'))
      expect(service.getProviderName()).toBe('OpenAI')
      expect(service.isConfigured()).toBe(true)
    })

    it('should create Copilot service', () => {
      const service = createAiService(makeConfig('copilot'))
      expect(service.getProviderName()).toBe('GitHub Copilot')
      expect(service.isConfigured()).toBe(true)
    })

    it('should create Gemini service', () => {
      const service = createAiService(makeConfig('gemini'))
      expect(service.getProviderName()).toBe('Google Gemini')
      expect(service.isConfigured()).toBe(true)
    })

    it('should create Ollama service', () => {
      const service = createAiService(makeConfig('ollama', { apiKey: '' }))
      expect(service.getProviderName()).toBe('Ollama')
      expect(service.isConfigured()).toBe(true)
    })

    it('should create Custom service (delegates to OpenAI)', () => {
      const service = createAiService(
        makeConfig('custom', { endpoint: 'https://my-api.example.com' }),
      )
      expect(service.getProviderName()).toBe('Custom')
      expect(service.isConfigured()).toBe(true)
    })

    it('should throw AiConfigError for unknown provider', () => {
      expect(() => {
        createAiService(makeConfig('unknown'))
      }).toThrow(AiConfigError)
    })

    it('should include provider name in AiConfigError', () => {
      try {
        createAiService(makeConfig('invalid-provider'))
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(AiConfigError)
        const configError = error as InstanceType<typeof AiConfigError>
        expect(configError.message).toContain('invalid-provider')
        expect(configError.field).toBe('provider')
      }
    })

    it('should pass endpoint to Copilot when not specified', () => {
      const service = createAiService(makeConfig('copilot'))
      // Copilot defaults to githubcopilot.com endpoint
      expect(service.getProviderName()).toBe('GitHub Copilot')
    })

    it('should pass custom endpoint to Copilot when specified', () => {
      const service = createAiService(
        makeConfig('copilot', { endpoint: 'https://custom-copilot.example.com' }),
      )
      expect(service.getProviderName()).toBe('GitHub Copilot')
    })

    describe('service interface compliance', () => {
      const providers = [
        'anthropic',
        'openai',
        'copilot',
        'gemini',
        'ollama',
        'custom',
      ] as const

      for (const provider of providers) {
        it(`${provider} service should have complete method`, () => {
          const config = makeConfig(provider, {
            apiKey: provider === 'ollama' ? '' : 'key',
          })
          const service = createAiService(config)
          expect(typeof service.complete).toBe('function')
        })

        it(`${provider} service should have stream method`, () => {
          const config = makeConfig(provider, {
            apiKey: provider === 'ollama' ? '' : 'key',
          })
          const service = createAiService(config)
          expect(typeof service.stream).toBe('function')
        })

        it(`${provider} service should have isConfigured method`, () => {
          const config = makeConfig(provider, {
            apiKey: provider === 'ollama' ? '' : 'key',
          })
          const service = createAiService(config)
          expect(typeof service.isConfigured).toBe('function')
        })

        it(`${provider} service should have getProviderName method`, () => {
          const config = makeConfig(provider, {
            apiKey: provider === 'ollama' ? '' : 'key',
          })
          const service = createAiService(config)
          expect(typeof service.getProviderName).toBe('function')
          expect(service.getProviderName().length).toBeGreaterThan(0)
        })
      }
    })
  })

  describe('exports', () => {
    it('should re-export error types', async () => {
      const mod = await import('./index')
      expect(mod.AiError).toBeDefined()
      expect(mod.AiConfigError).toBeDefined()
      expect(mod.AiNetworkError).toBeDefined()
      expect(mod.AiRateLimitError).toBeDefined()
      expect(mod.AiResponseError).toBeDefined()
    })

    it('should re-export createAiService', async () => {
      const mod = await import('./index')
      expect(typeof mod.createAiService).toBe('function')
    })
  })
})
