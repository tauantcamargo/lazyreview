import { Effect } from 'effect'
import { GitHubError } from '../../models/errors'
import { formatSuggestionBody } from '../../models/suggestion'
import type { Comment } from '../../models/comment'
import type { PullRequest } from '../../models/pull-request'
import type { TimelineEvent } from '../../models/timeline-event'
import type { SuggestionParams, AcceptSuggestionParams } from '../../models/suggestion'
import type { ApiError } from '../CodeReviewApiTypes'
import type { Provider, ProviderCapabilities } from './types'

// ---------------------------------------------------------------------------
// Default capability flags for V2
// ---------------------------------------------------------------------------

/**
 * Fills in V2 capability flags with `false` defaults for any provider
 * that hasn't explicitly declared them.
 */
export function ensureV2Capabilities(
  caps: ProviderCapabilities,
): ProviderCapabilities {
  return {
    ...caps,
    supportsStreaming: caps.supportsStreaming ?? false,
    supportsBatchFetch: caps.supportsBatchFetch ?? false,
    supportsWebhooks: caps.supportsWebhooks ?? false,
    supportsSuggestions: caps.supportsSuggestions ?? false,
    supportsTimeline: caps.supportsTimeline ?? false,
  }
}

// ---------------------------------------------------------------------------
// ProviderV1Adapter
// ---------------------------------------------------------------------------

/**
 * Wraps a V1 Provider and supplies default implementations for all V2
 * optional methods.  Providers that natively implement a V2 method
 * (e.g. GitHub's `batchGetPRs`) will have their implementation
 * preserved; the adapter only fills in methods that are missing.
 *
 * This allows the rest of the codebase to treat every provider as if
 * it supports the full V2 interface without modifying any existing
 * provider code.
 */
export function adaptProvider(provider: Provider): Provider {
  return {
    // Spread all existing V1 properties and any V2 overrides
    ...provider,

    // Ensure capabilities include V2 flags
    capabilities: ensureV2Capabilities(provider.capabilities),

    // -- Default V2 implementations (only applied if not already present) --

    batchGetPRs:
      provider.batchGetPRs ??
      defaultBatchGetPRs(provider),

    streamFileDiff:
      provider.streamFileDiff ??
      defaultStreamFileDiff(provider),

    getTimeline:
      provider.getTimeline ??
      defaultGetTimeline(),

    submitSuggestion:
      provider.submitSuggestion ??
      defaultSubmitSuggestion(provider),

    acceptSuggestion:
      provider.acceptSuggestion ??
      defaultAcceptSuggestion(),
  }
}

// ---------------------------------------------------------------------------
// Default method implementations
// ---------------------------------------------------------------------------

/**
 * Falls back to sequential `getPR` calls for each PR number.
 */
function defaultBatchGetPRs(
  provider: Provider,
): (prNumbers: readonly number[]) => Effect.Effect<readonly PullRequest[], ApiError> {
  return (prNumbers) =>
    Effect.all(
      prNumbers.map((n) => provider.getPR(n)),
      { concurrency: 'unbounded' },
    )
}

/**
 * Falls back to fetching the full file diff and yielding it as a
 * single chunk via an async generator.
 */
function defaultStreamFileDiff(
  provider: Provider,
): (prNumber: number, filePath: string) => AsyncIterable<string> {
  return (prNumber, filePath) => ({
    async *[Symbol.asyncIterator]() {
      const file = await Effect.runPromise(
        provider.getFileDiff(prNumber, filePath),
      )
      if (file?.patch != null) {
        yield file.patch
      }
    },
  })
}

/**
 * Returns an empty timeline by default.
 */
function defaultGetTimeline(): (
  prNumber: number,
) => Effect.Effect<readonly TimelineEvent[], ApiError> {
  return (_prNumber) => Effect.succeed([])
}

/**
 * Falls back to `addDiffComment` with suggestion markdown formatting.
 */
function defaultSubmitSuggestion(
  provider: Provider,
): (params: SuggestionParams) => Effect.Effect<Comment, ApiError> {
  return (params) =>
    Effect.flatMap(
      provider.addDiffComment({
        prNumber: params.prNumber,
        body: formatSuggestionBody(params.body, params.suggestion),
        commitId: params.commitId ?? '',
        path: params.path,
        line: params.line,
        side: params.side,
        startLine: params.startLine,
        startSide: params.side,
      }),
      () =>
        // addDiffComment returns void; fetch the latest comments to
        // find the one we just created. Return a placeholder comment
        // since the exact comment ID isn't available from addDiffComment.
        Effect.map(
          provider.getPRComments(params.prNumber),
          (comments) => {
            // Return the most recent comment on this path as the "created" comment
            const matching = [...comments]
              .reverse()
              .find((c) => c.path === params.path)
            if (matching) return matching
            // Fallback: return the last comment
            return comments[comments.length - 1]!
          },
        ),
    )
}

/**
 * Accepting suggestions is not universally supported.
 * Default implementation fails with a descriptive error.
 */
function defaultAcceptSuggestion(): (
  params: AcceptSuggestionParams,
) => Effect.Effect<void, ApiError> {
  return (_params) =>
    Effect.fail(
      new GitHubError({
        message: 'Accepting suggestions is not supported by this provider',
        status: 501,
      }),
    )
}
