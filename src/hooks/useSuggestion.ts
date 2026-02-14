import { useState, useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import { formatSuggestionForProvider } from '../models/suggestion'
import type { SuggestionParams, AcceptSuggestionParams } from '../models/suggestion'
import type { ProviderType } from '../services/providers/types'
import type { ApiError } from '../services/CodeReviewApiTypes'

// ---------------------------------------------------------------------------
// Providers that natively support suggestion blocks
// ---------------------------------------------------------------------------

const SUGGESTION_CAPABLE_PROVIDERS: ReadonlySet<ProviderType> = new Set([
  'github',
  'gitlab',
])

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

interface UseSuggestionOptions {
  readonly providerType: ProviderType
  readonly owner?: string
  readonly repo?: string
}

// ---------------------------------------------------------------------------
// Submit suggestion params (without formatting -- the hook handles that)
// ---------------------------------------------------------------------------

export interface SubmitSuggestionInput {
  readonly prNumber: number
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly suggestion: string
  readonly startLine?: number
  readonly commitId?: string
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseSuggestionReturn {
  readonly submitSuggestion: (params: SubmitSuggestionInput) => void
  readonly acceptSuggestion: (commentId: number, prNumber: number) => void
  readonly isSubmitting: boolean
  readonly error: string | null
  readonly canSuggest: boolean
  readonly providerType: ProviderType
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSuggestion({
  providerType,
  owner,
  repo,
}: UseSuggestionOptions): UseSuggestionReturn {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const canSuggest = useMemo(
    () => SUGGESTION_CAPABLE_PROVIDERS.has(providerType),
    [providerType],
  )

  const submitMutation = useMutation({
    mutationFn: (params: SubmitSuggestionInput) => {
      const formattedBody = formatSuggestionForProvider(
        providerType,
        params.body,
        params.suggestion,
      )

      return runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          // Use the provider-level submitSuggestion if available (native support)
          if (canSuggest && api.submitSuggestion && owner && repo) {
            return yield* api.submitSuggestion(owner, repo, {
              prNumber: params.prNumber,
              body: params.body,
              path: params.path,
              line: params.line,
              side: params.side,
              suggestion: params.suggestion,
              startLine: params.startLine,
              commitId: params.commitId,
            })
          }

          // Fallback: submit as a regular diff comment with formatted body
          if (owner && repo) {
            yield* api.addDiffComment(
              owner,
              repo,
              params.prNumber,
              formattedBody,
              params.commitId ?? '',
              params.path,
              params.line,
              params.side,
              params.startLine,
              params.side,
            )
          }

          return undefined
        }),
      )
    },
    onSuccess: (_data, params) => {
      setError(null)
      if (owner && repo) {
        queryClient.invalidateQueries({
          queryKey: ['pr-comments', owner, repo, params.prNumber],
        })
      }
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to submit suggestion')
    },
  })

  const acceptMutation = useMutation({
    mutationFn: ({ commentId, prNumber }: { readonly commentId: number; readonly prNumber: number }) =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          if (api.acceptSuggestion && owner && repo) {
            yield* api.acceptSuggestion(owner, repo, {
              prNumber,
              commentId,
            })
          }
        }),
      ),
    onSuccess: (_data, params) => {
      setError(null)
      if (owner && repo) {
        queryClient.invalidateQueries({
          queryKey: ['pr-comments', owner, repo, params.prNumber],
        })
      }
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to accept suggestion')
    },
  })

  const submitSuggestion = useCallback(
    (params: SubmitSuggestionInput) => {
      setError(null)
      submitMutation.mutate(params)
    },
    [submitMutation],
  )

  const acceptSuggestion = useCallback(
    (commentId: number, prNumber: number) => {
      setError(null)
      acceptMutation.mutate({ commentId, prNumber })
    },
    [acceptMutation],
  )

  return {
    submitSuggestion,
    acceptSuggestion,
    isSubmitting: submitMutation.isPending || acceptMutation.isPending,
    error,
    canSuggest,
    providerType,
  }
}
