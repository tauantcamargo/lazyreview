import { Effect } from 'effect'
import { runEffect } from './effect'
import { CodeReviewApi } from '../services/GitHubApi'
import type { CodeReviewApiService } from '../services/CodeReviewApiTypes'
import { createBitbucketApiAdapter } from '../services/BitbucketApiAdapter'

/**
 * Runs `effect` against the `CodeReviewApiService` implementation for
 * `provider` -- the GitHub-backed `CodeReviewApi` Effect service (via the
 * existing `AppLayer`/`runEffect` path) for `'github'` or `undefined`
 * (matches `PullRequest.provider`'s default), or the standalone Bitbucket
 * adapter for `'bitbucket'`.
 *
 * This is the single dispatch point every PR-detail read/mutation hook
 * routes through, so adding a provider here doesn't require touching each
 * of the ~40 call sites individually again.
 */
export function runProviderEffect<A>(
  provider: string | undefined,
  effect: (api: CodeReviewApiService) => Effect.Effect<A, unknown>,
): Promise<A> {
  if (provider === 'bitbucket') {
    const provided = effect(createBitbucketApiAdapter()).pipe(
      Effect.catchAll((error) => Effect.die(error)),
    )
    return Effect.runPromise(provided as Effect.Effect<A, never, never>)
  }

  return runEffect(
    Effect.gen(function* () {
      const api = yield* CodeReviewApi
      return yield* effect(api)
    }),
  )
}
