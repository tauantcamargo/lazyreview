/**
 * Hook for AI-powered smart review annotations on diff lines.
 *
 * Provides on-demand AI analysis of a file's diff content, producing
 * line-level annotations with severity, message, and optional suggestions.
 *
 * Features:
 * - Manual trigger via analyze() (not automatic)
 * - Results cached per filename + commitSha key
 * - Rate limiting: configurable max analyses per session (default 10)
 * - Graceful degradation when AI is not configured
 */
import { useState, useCallback, useRef } from 'react'
import type { AiConfig } from '../services/config-migration'
import type { AiAnnotation } from '../services/ai/review-prompts'
import { buildDiffAnalysisPrompt, parseAiAnnotations } from '../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSmartReviewOptions {
  readonly enabled?: boolean
  readonly maxAnalyses?: number
  readonly commitSha?: string
}

export interface UseSmartReviewReturn {
  readonly annotations: readonly AiAnnotation[]
  readonly isAnalyzing: boolean
  readonly error: string | null
  readonly analyze: () => void
  readonly clear: () => void
  readonly analysisCount: number
  readonly isRateLimited: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_ANALYSES = 10

// ---------------------------------------------------------------------------
// Cache (module-level, persists across renders)
// ---------------------------------------------------------------------------

const annotationCache = new Map<string, readonly AiAnnotation[]>()
const MAX_CACHE_SIZE = 100

export function buildCacheKey(filename: string, commitSha: string): string {
  return `smart-review:${filename}:${commitSha}`
}

function getCachedAnnotations(key: string): readonly AiAnnotation[] | undefined {
  return annotationCache.get(key)
}

function setCachedAnnotations(key: string, annotations: readonly AiAnnotation[]): void {
  if (annotationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = annotationCache.keys().next().value
    if (firstKey !== undefined) {
      annotationCache.delete(firstKey)
    }
  }
  annotationCache.set(key, annotations)
}

// ---------------------------------------------------------------------------
// Rate limit tracking (module-level, per session)
// ---------------------------------------------------------------------------

let sessionAnalysisCount = 0

// ---------------------------------------------------------------------------
// AI config helpers
// ---------------------------------------------------------------------------

function isAiConfigured(aiConfig: AiConfig | undefined): boolean {
  if (!aiConfig) return false
  return aiConfig.provider !== '' && aiConfig.apiKey !== ''
}

// ---------------------------------------------------------------------------
// Mock AI completion (used until real adapters are wired)
// ---------------------------------------------------------------------------

async function mockComplete(
  filename: string,
  _diffContent: string,
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Return a plausible mock response
  const annotations = [
    {
      line: 1,
      severity: 'info',
      message: `Consider adding a file-level docstring for ${filename}`,
    },
  ]
  return JSON.stringify(annotations)
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmartReview(
  filename: string,
  diffContent: string,
  aiConfig?: AiConfig,
  options?: UseSmartReviewOptions,
): UseSmartReviewReturn {
  const {
    enabled = true,
    maxAnalyses = DEFAULT_MAX_ANALYSES,
    commitSha = '',
  } = options ?? {}

  const [annotations, setAnnotations] = useState<readonly AiAnnotation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisCount, setAnalysisCount] = useState(sessionAnalysisCount)
  const abortRef = useRef<AbortController | null>(null)

  const rateLimited = analysisCount >= maxAnalyses

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setAnnotations([])
    setIsAnalyzing(false)
    setError(null)
  }, [])

  const analyze = useCallback(() => {
    if (!enabled) return
    if (!isAiConfigured(aiConfig)) {
      setError('AI is not configured. Add AI settings to your config.')
      return
    }
    if (rateLimited) {
      setError(`Rate limit reached (${maxAnalyses} analyses per session)`)
      return
    }
    if (!diffContent || diffContent.trim().length === 0) {
      setAnnotations([])
      return
    }

    // Check cache
    const cacheKey = buildCacheKey(filename, commitSha)
    const cached = getCachedAnnotations(cacheKey)
    if (cached) {
      setAnnotations(cached)
      setIsAnalyzing(false)
      setError(null)
      return
    }

    // Abort any previous request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setIsAnalyzing(true)
    setError(null)

    // Increment rate limit counter
    sessionAnalysisCount += 1
    setAnalysisCount(sessionAnalysisCount)

    const performAnalysis = async (): Promise<void> => {
      try {
        // Build prompt (used when real AI service is wired)
        const _messages = buildDiffAnalysisPrompt(filename, diffContent)

        // Use mock completion for now
        const response = await mockComplete(filename, diffContent)

        if (controller.signal.aborted) return

        const parsed = parseAiAnnotations(response)
        setCachedAnnotations(cacheKey, parsed)
        setAnnotations(parsed)
        setIsAnalyzing(false)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'AI analysis failed')
        setIsAnalyzing(false)
      }
    }

    void performAnalysis()
  }, [enabled, aiConfig, rateLimited, maxAnalyses, diffContent, filename, commitSha])

  return {
    annotations,
    isAnalyzing,
    error,
    analyze,
    clear,
    analysisCount,
    isRateLimited: rateLimited,
  }
}
