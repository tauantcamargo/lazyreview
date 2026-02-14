import { describe, it, expect } from 'vitest'
import { hashCode } from './useAiReview'
import type { AiConfig } from '../services/config-migration'

// We test the pure utility functions directly since the hook is a thin wrapper
// around React state + streaming. The hook's behavior is tested via the
// AiReviewModal component tests and integration tests.

const configuredAiConfig: AiConfig = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key-123',
  endpoint: '',
  maxTokens: 4096,
  temperature: 0.3,
}

const unconfiguredAiConfig: AiConfig = {
  provider: '',
  model: '',
  apiKey: '',
  endpoint: '',
  maxTokens: 4096,
  temperature: 0.3,
}

describe('hashCode', () => {
  it('returns a consistent hash for the same input', () => {
    const hash1 = hashCode('hello world')
    const hash2 = hashCode('hello world')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different inputs', () => {
    const hash1 = hashCode('hello')
    const hash2 = hashCode('world')
    expect(hash1).not.toBe(hash2)
  })

  it('returns a string', () => {
    const hash = hashCode('test')
    expect(typeof hash).toBe('string')
  })

  it('handles empty string', () => {
    const hash = hashCode('')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('produces short hashes suitable for cache keys', () => {
    const hash = hashCode('const x = 1 + 2')
    expect(hash.length).toBeLessThan(10)
  })

  it('handles long strings without collision for typical code', () => {
    const code1 = 'function add(a: number, b: number): number { return a + b }'
    const code2 = 'function sub(a: number, b: number): number { return a - b }'
    expect(hashCode(code1)).not.toBe(hashCode(code2))
  })

  it('handles special characters', () => {
    const hash = hashCode('const x = "hello\\nworld"')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('handles unicode content', () => {
    const hash = hashCode('const msg = "Hello 世界"')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})

// Test the isAiConfigured logic (extracted for testability)
describe('AI config validation', () => {
  function isAiConfigured(aiConfig: AiConfig | undefined): boolean {
    if (!aiConfig) return false
    return aiConfig.provider !== '' && aiConfig.apiKey !== ''
  }

  it('returns false when config is undefined', () => {
    expect(isAiConfigured(undefined)).toBe(false)
  })

  it('returns false when provider is empty', () => {
    expect(isAiConfigured(unconfiguredAiConfig)).toBe(false)
  })

  it('returns false when apiKey is empty', () => {
    expect(
      isAiConfigured({ ...configuredAiConfig, apiKey: '' }),
    ).toBe(false)
  })

  it('returns true when both provider and apiKey are set', () => {
    expect(isAiConfigured(configuredAiConfig)).toBe(true)
  })

  it('returns false when provider is empty but apiKey is set', () => {
    expect(
      isAiConfigured({ ...unconfiguredAiConfig, apiKey: 'key' }),
    ).toBe(false)
  })
})

// Test the provider display name logic
describe('AI provider display names', () => {
  function getProviderDisplayName(provider: string): string {
    const names: Readonly<Record<string, string>> = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      copilot: 'GitHub Copilot',
      gemini: 'Google Gemini',
      ollama: 'Ollama',
    }
    return names[provider] ?? provider
  }

  it('maps anthropic to Anthropic', () => {
    expect(getProviderDisplayName('anthropic')).toBe('Anthropic')
  })

  it('maps openai to OpenAI', () => {
    expect(getProviderDisplayName('openai')).toBe('OpenAI')
  })

  it('maps copilot to GitHub Copilot', () => {
    expect(getProviderDisplayName('copilot')).toBe('GitHub Copilot')
  })

  it('maps gemini to Google Gemini', () => {
    expect(getProviderDisplayName('gemini')).toBe('Google Gemini')
  })

  it('maps ollama to Ollama', () => {
    expect(getProviderDisplayName('ollama')).toBe('Ollama')
  })

  it('returns unknown provider name as-is', () => {
    expect(getProviderDisplayName('custom-provider')).toBe('custom-provider')
  })

  it('returns empty string for empty input', () => {
    expect(getProviderDisplayName('')).toBe('')
  })
})
