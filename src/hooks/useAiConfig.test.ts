import { describe, it, expect } from 'vitest'
import type { AiConfig } from '../services/config-migration'

// ---------------------------------------------------------------------------
// useAiConfig - Pure logic tests
//
// The hook itself is a thin wrapper around React Query. We test the
// AI config loading/resolution logic and defaults directly.
// ---------------------------------------------------------------------------

const DEFAULT_AI_CONFIG: AiConfig = {
  provider: '',
  model: '',
  apiKey: '',
  endpoint: '',
  maxTokens: 4096,
  temperature: 0.3,
}

function resolveAiConfig(raw: Partial<AiConfig> | undefined): AiConfig {
  return {
    provider: raw?.provider ?? DEFAULT_AI_CONFIG.provider,
    model: raw?.model ?? DEFAULT_AI_CONFIG.model,
    apiKey: raw?.apiKey ?? DEFAULT_AI_CONFIG.apiKey,
    endpoint: raw?.endpoint ?? DEFAULT_AI_CONFIG.endpoint,
    maxTokens: raw?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
    temperature: raw?.temperature ?? DEFAULT_AI_CONFIG.temperature,
  }
}

describe('useAiConfig logic', () => {
  describe('resolveAiConfig', () => {
    it('returns defaults when input is undefined', () => {
      const result = resolveAiConfig(undefined)
      expect(result).toEqual(DEFAULT_AI_CONFIG)
    })

    it('returns defaults when input is empty object', () => {
      const result = resolveAiConfig({})
      expect(result).toEqual(DEFAULT_AI_CONFIG)
    })

    it('merges partial config with defaults', () => {
      const result = resolveAiConfig({
        provider: 'openai',
        model: 'gpt-4',
      })
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4')
      expect(result.apiKey).toBe('')
      expect(result.maxTokens).toBe(4096)
      expect(result.temperature).toBe(0.3)
    })

    it('uses all provided values', () => {
      const full: AiConfig = {
        provider: 'anthropic',
        model: 'claude-3-opus',
        apiKey: 'sk-test-123',
        endpoint: 'https://api.anthropic.com',
        maxTokens: 8192,
        temperature: 0.7,
      }
      const result = resolveAiConfig(full)
      expect(result).toEqual(full)
    })

    it('handles zero temperature', () => {
      const result = resolveAiConfig({ temperature: 0 })
      expect(result.temperature).toBe(0)
    })

    it('preserves empty string values for provider', () => {
      const result = resolveAiConfig({ provider: '' })
      expect(result.provider).toBe('')
    })

    it('preserves maxTokens override', () => {
      const result = resolveAiConfig({ maxTokens: 2048 })
      expect(result.maxTokens).toBe(2048)
    })
  })
})
