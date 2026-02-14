/**
 * Hook for AI-powered PR summary generation.
 *
 * Manages streaming responses, in-memory caching by PR+headSha,
 * and graceful degradation when AI is not configured.
 */
import { useState, useCallback, useRef } from 'react'
import type { AiConfig } from '../services/config-migration'
import type { AiStreamChunk } from '../services/ai/types'
import { buildPRSummaryPrompt } from '../services/ai/pr-summary-prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRSummaryInput {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly headSha: string
  readonly title: string
  readonly description: string
  readonly commits: readonly { readonly message: string; readonly sha: string }[]
  readonly files: readonly {
    readonly filename: string
    readonly additions: number
    readonly deletions: number
  }[]
  readonly diffSample?: string
}

export interface UseAiSummaryReturn {
  readonly generateSummary: (prData: PRSummaryInput) => void
  readonly regenerateSummary: () => void
  readonly summary: string
  readonly isGenerating: boolean
  readonly error: string | null
  readonly cachedSummary: string | null
  readonly isConfigured: boolean
  readonly providerName: string
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const summaryCache = new Map<string, string>()
const MAX_CACHE_SIZE = 30

/**
 * Build a cache key from PR identity + head SHA.
 * Invalidates when new commits are pushed (SHA changes).
 */
export function buildSummaryCacheKey(
  owner: string,
  repo: string,
  prNumber: number,
  headSha: string,
): string {
  return `${owner}/${repo}#${prNumber}@${headSha}`
}

function getCachedSummary(key: string): string | undefined {
  return summaryCache.get(key)
}

function setCachedSummary(key: string, summary: string): void {
  if (summaryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = summaryCache.keys().next().value
    if (firstKey !== undefined) {
      summaryCache.delete(firstKey)
    }
  }
  summaryCache.set(key, summary)
}

// ---------------------------------------------------------------------------
// AI config helpers
// ---------------------------------------------------------------------------

export function isSummaryConfigured(aiConfig: AiConfig | undefined): boolean {
  if (!aiConfig) return false
  return aiConfig.provider !== '' && aiConfig.apiKey !== ''
}

export function getProviderDisplayName(provider: string): string {
  const names: Readonly<Record<string, string>> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    copilot: 'GitHub Copilot',
    gemini: 'Google Gemini',
    ollama: 'Ollama',
  }
  return names[provider] ?? provider
}

// ---------------------------------------------------------------------------
// Mock streaming (used until real adapters are wired)
// ---------------------------------------------------------------------------

async function* mockSummaryStream(): AsyncIterable<AiStreamChunk> {
  const response = [
    '## What changed\n',
    'This PR modifies the authentication flow to fix a race condition. ',
    'The OAuth callback handler now properly awaits token validation.\n\n',
    '## Why\n',
    'Users were intermittently failing to authenticate due to a timing issue ',
    'in the token exchange process.\n\n',
    '## Risk areas\n',
    '- `src/auth/oauth.ts` - Core auth logic changes\n',
    '- Error handling paths need verification\n\n',
    '## Complexity\n',
    '**Medium** - Focused change but touches security-sensitive code.\n',
  ]
  for (const chunk of response) {
    await new Promise((resolve) => setTimeout(resolve, 30))
    yield { text: chunk, done: false }
  }
  yield { text: '', done: true }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAiSummary(
  aiConfig?: AiConfig,
): UseAiSummaryReturn {
  const [summary, setSummary] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedSummary, setCachedSummaryState] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastInputRef = useRef<PRSummaryInput | null>(null)

  const configured = isSummaryConfigured(aiConfig)
  const providerName = configured
    ? getProviderDisplayName(aiConfig?.provider ?? '')
    : ''

  const generateSummary = useCallback(
    (prData: PRSummaryInput) => {
      if (!configured) {
        setError('AI is not configured. Add AI settings to your config.')
        return
      }

      lastInputRef.current = prData

      const cacheKey = buildSummaryCacheKey(
        prData.owner,
        prData.repo,
        prData.prNumber,
        prData.headSha,
      )

      // Check cache first
      const cached = getCachedSummary(cacheKey)
      if (cached) {
        setSummary(cached)
        setCachedSummaryState(cached)
        setIsGenerating(false)
        setError(null)
        return
      }

      // Abort any previous request
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      setSummary('')
      setCachedSummaryState(null)
      setIsGenerating(true)
      setError(null)

      // Build prompt messages (used when real adapters are wired)
      const _messages = buildPRSummaryPrompt({
        title: prData.title,
        description: prData.description,
        commits: prData.commits,
        files: prData.files,
        diffSample: prData.diffSample,
      })

      const processStream = async (): Promise<void> => {
        try {
          let accumulated = ''
          const stream = mockSummaryStream()

          for await (const chunk of stream) {
            if (controller.signal.aborted) return

            if (chunk.done) {
              setCachedSummary(cacheKey, accumulated)
              setCachedSummaryState(accumulated)
              setIsGenerating(false)
              return
            }

            accumulated = accumulated + chunk.text
            setSummary(accumulated)
          }

          setCachedSummary(cacheKey, accumulated)
          setCachedSummaryState(accumulated)
          setIsGenerating(false)
        } catch (err) {
          if (controller.signal.aborted) return
          setError(
            err instanceof Error ? err.message : 'AI summary generation failed',
          )
          setIsGenerating(false)
        }
      }

      void processStream()
    },
    [configured],
  )

  const regenerateSummary = useCallback(() => {
    if (!lastInputRef.current) return

    const prData = lastInputRef.current
    const cacheKey = buildSummaryCacheKey(
      prData.owner,
      prData.repo,
      prData.prNumber,
      prData.headSha,
    )

    // Remove from cache so it regenerates
    summaryCache.delete(cacheKey)
    generateSummary(prData)
  }, [generateSummary])

  return {
    generateSummary,
    regenerateSummary,
    summary,
    isGenerating,
    error,
    cachedSummary,
    isConfigured: configured,
    providerName,
  }
}
