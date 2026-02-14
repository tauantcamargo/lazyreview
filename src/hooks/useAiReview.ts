/**
 * Hook for AI-powered code review of selected diff lines.
 *
 * Manages AI service lifecycle, streaming responses, and response caching.
 * Gracefully degrades when AI is not configured.
 */
import { useState, useCallback, useRef } from 'react'
import type { AiConfig } from '../services/config-migration'
import type { AiMessage, AiStreamChunk } from '../services/ai/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewCodeParams {
  readonly code: string
  readonly filename: string
  readonly language: string
  readonly messages: readonly AiMessage[]
}

export interface UseAiReviewReturn {
  readonly reviewCode: (params: ReviewCodeParams) => void
  readonly response: string
  readonly isLoading: boolean
  readonly error: string | null
  readonly isConfigured: boolean
  readonly providerName: string
  readonly modelName: string
  readonly reset: () => void
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Simple hash function for caching responses by code content.
 * Uses a FNV-1a-like approach for fast string hashing.
 */
export function hashCode(code: string): string {
  let hash = 2166136261
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const responseCache = new Map<string, string>()

const MAX_CACHE_SIZE = 50

function getCachedResponse(code: string): string | undefined {
  const key = hashCode(code)
  return responseCache.get(key)
}

function setCachedResponse(code: string, response: string): void {
  const key = hashCode(code)
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = responseCache.keys().next().value
    if (firstKey !== undefined) {
      responseCache.delete(firstKey)
    }
  }
  responseCache.set(key, response)
}

// ---------------------------------------------------------------------------
// AI config helpers
// ---------------------------------------------------------------------------

function isAiConfigured(aiConfig: AiConfig | undefined): boolean {
  if (!aiConfig) return false
  return aiConfig.provider !== '' && aiConfig.apiKey !== ''
}

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

// ---------------------------------------------------------------------------
// Mock streaming (used until real adapters are wired)
// ---------------------------------------------------------------------------

async function* mockStream(
  _messages: readonly AiMessage[],
): AsyncIterable<AiStreamChunk> {
  const response = [
    '## Summary\n',
    'The selected code appears to be well-structured.\n\n',
    '## Issues\n',
    'No critical issues found.\n\n',
    '## Suggestions\n',
    '- Consider adding error handling for edge cases.\n',
    '- Add type annotations where missing.\n',
  ]
  for (const chunk of response) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    yield { text: chunk, done: false }
  }
  yield { text: '', done: true }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAiReview(
  aiConfig?: AiConfig,
): UseAiReviewReturn {
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const configured = isAiConfigured(aiConfig)
  const providerName = configured
    ? getProviderDisplayName(aiConfig?.provider ?? '')
    : ''
  const modelName = aiConfig?.model ?? ''

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setResponse('')
    setIsLoading(false)
    setError(null)
  }, [])

  const reviewCode = useCallback(
    (params: ReviewCodeParams) => {
      if (!configured) {
        setError('AI is not configured. Add AI settings to your config.')
        return
      }

      // Check cache first
      const cached = getCachedResponse(params.code)
      if (cached) {
        setResponse(cached)
        setIsLoading(false)
        setError(null)
        return
      }

      // Abort any previous request
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      setResponse('')
      setIsLoading(true)
      setError(null)

      const processStream = async (): Promise<void> => {
        try {
          let accumulated = ''
          const stream = mockStream(params.messages)

          for await (const chunk of stream) {
            if (controller.signal.aborted) return

            if (chunk.done) {
              setCachedResponse(params.code, accumulated)
              setIsLoading(false)
              return
            }

            accumulated = accumulated + chunk.text
            setResponse(accumulated)
          }

          setCachedResponse(params.code, accumulated)
          setIsLoading(false)
        } catch (err) {
          if (controller.signal.aborted) return
          setError(err instanceof Error ? err.message : 'AI review failed')
          setIsLoading(false)
        }
      }

      void processStream()
    },
    [configured],
  )

  return {
    reviewCode,
    response,
    isLoading,
    error,
    isConfigured: configured,
    providerName,
    modelName,
    reset,
  }
}
