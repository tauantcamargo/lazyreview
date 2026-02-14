import { describe, it, expect } from 'vitest'
import {
  buildSummaryCacheKey,
  isSummaryConfigured,
  getProviderDisplayName,
} from './useAiSummary'
import type { AiConfig } from '../services/config-migration'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const configuredAiConfig: AiConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
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

// ---------------------------------------------------------------------------
// buildSummaryCacheKey
// ---------------------------------------------------------------------------

describe('buildSummaryCacheKey', () => {
  it('builds cache key from owner/repo/number/sha', () => {
    const key = buildSummaryCacheKey('octocat', 'hello-world', 42, 'abc1234')
    expect(key).toBe('octocat/hello-world#42@abc1234')
  })

  it('produces different keys for different PRs', () => {
    const key1 = buildSummaryCacheKey('owner', 'repo', 1, 'sha1')
    const key2 = buildSummaryCacheKey('owner', 'repo', 2, 'sha1')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different head SHAs (new commits)', () => {
    const key1 = buildSummaryCacheKey('owner', 'repo', 1, 'sha1')
    const key2 = buildSummaryCacheKey('owner', 'repo', 1, 'sha2')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different owners', () => {
    const key1 = buildSummaryCacheKey('owner1', 'repo', 1, 'sha1')
    const key2 = buildSummaryCacheKey('owner2', 'repo', 1, 'sha1')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different repos', () => {
    const key1 = buildSummaryCacheKey('owner', 'repo1', 1, 'sha1')
    const key2 = buildSummaryCacheKey('owner', 'repo2', 1, 'sha1')
    expect(key1).not.toBe(key2)
  })

  it('handles empty strings gracefully', () => {
    const key = buildSummaryCacheKey('', '', 0, '')
    expect(key).toBe('/#0@')
  })
})

// ---------------------------------------------------------------------------
// isSummaryConfigured
// ---------------------------------------------------------------------------

describe('isSummaryConfigured', () => {
  it('returns false when config is undefined', () => {
    expect(isSummaryConfigured(undefined)).toBe(false)
  })

  it('returns false when provider is empty', () => {
    expect(isSummaryConfigured(unconfiguredAiConfig)).toBe(false)
  })

  it('returns false when apiKey is empty', () => {
    expect(
      isSummaryConfigured({ ...configuredAiConfig, apiKey: '' }),
    ).toBe(false)
  })

  it('returns true when both provider and apiKey are set', () => {
    expect(isSummaryConfigured(configuredAiConfig)).toBe(true)
  })

  it('returns false when provider is empty but apiKey is set', () => {
    expect(
      isSummaryConfigured({ ...unconfiguredAiConfig, apiKey: 'key' }),
    ).toBe(false)
  })

  it('returns true for ollama without apiKey (local model)', () => {
    expect(
      isSummaryConfigured({
        ...unconfiguredAiConfig,
        provider: 'ollama',
        apiKey: 'ollama',
      }),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getProviderDisplayName
// ---------------------------------------------------------------------------

describe('getProviderDisplayName (summary)', () => {
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
