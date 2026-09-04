import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { createBitbucketProvider } from '../services/providers/bitbucket'
import { getDefaultBaseUrl } from '../services/providers/types'
import { getTokenForProvider, getUserForProvider } from '../services/Auth'
import { useBookmarkedRepos } from './useBookmarkedRepos'
import { useConfig } from './useConfig'
import { useRefreshInterval } from './useRefreshInterval'
import type { PullRequest } from '../models/pull-request'
import type { PRStateFilter } from './useGitHub'

const FAN_OUT_CONCURRENCY = 4

export type BitbucketScope = 'my' | 'involved' | 'review-requested'

export interface BitbucketPRsResult {
  /** PRs matching `scope`, already filtered/tagged provider: 'bitbucket'. */
  readonly prs: readonly PullRequest[]
  /**
   * True when Bitbucket is enabled but no usable token was found (or it was
   * rejected). GitHub's results should still render -- this is surfaced so
   * the caller can show a small non-blocking notice instead of silently
   * dropping Bitbucket coverage.
   */
  readonly authError: boolean
}

const EMPTY_RESULT: BitbucketPRsResult = { prs: [], authError: false }

function fetchRepoPRs(
  owner: string,
  repo: string,
  token: string,
  stateFilter: PRStateFilter,
): Effect.Effect<readonly PullRequest[], never> {
  const provider = createBitbucketProvider({
    type: 'bitbucket',
    baseUrl: getDefaultBaseUrl('bitbucket'),
    token,
    owner,
    repo,
  })
  return provider.listPRs({ state: stateFilter }).pipe(
    Effect.map((result) => result.items),
    // A single bookmarked repo failing (renamed, deleted, no access, not
    // actually a Bitbucket repo) must not blank out the other repos' PRs.
    Effect.catchAll(() => Effect.succeed([] as readonly PullRequest[])),
  )
}

export function matchesScope(
  pr: PullRequest,
  scope: BitbucketScope,
  currentLogin: string,
): boolean {
  const isAuthor = pr.user.login === currentLogin
  const isReviewer = pr.requested_reviewers.some(
    (r) => r.login === currentLogin,
  )
  switch (scope) {
    case 'my':
      return isAuthor
    case 'review-requested':
      return isReviewer
    case 'involved':
      return isAuthor || isReviewer
  }
}

export function fetchBitbucketPRs(
  bitbucketRepos: readonly { readonly owner: string; readonly repo: string }[],
  scope: BitbucketScope,
  stateFilter: PRStateFilter,
): Effect.Effect<BitbucketPRsResult, never> {
  return Effect.gen(function* () {
    if (bitbucketRepos.length === 0) return EMPTY_RESULT

    const tokenResult = yield* Effect.either(getTokenForProvider('bitbucket'))
    if (tokenResult._tag === 'Left') {
      return { prs: [], authError: true }
    }
    const token = tokenResult.right

    const userResult = yield* Effect.either(
      getUserForProvider('bitbucket', token),
    )
    if (userResult._tag === 'Left') {
      return { prs: [], authError: true }
    }
    const currentLogin = userResult.right.login

    const perRepo = yield* Effect.forEach(
      bitbucketRepos,
      (r) => fetchRepoPRs(r.owner, r.repo, token, stateFilter),
      { concurrency: FAN_OUT_CONCURRENCY },
    )

    const prs = perRepo
      .flat()
      .filter((pr) => matchesScope(pr, scope, currentLogin))

    return { prs, authError: false }
  })
}

/**
 * Fetches Bitbucket PRs for the Involved/My PRs/For Review screens.
 *
 * Bitbucket Cloud has no cross-repo/workspace-wide PR search API (unlike
 * GitHub's Search API), so this fans out per-repo `listPRs` calls across the
 * user's *bookmarked* Bitbucket repos and filters client-side. Coverage is
 * therefore limited to bookmarked repos, not the user's full Bitbucket
 * account -- callers should surface this (e.g. in empty-state copy).
 *
 * Returns an empty, non-error result when Bitbucket isn't enabled or has no
 * bookmarked repos, so callers can unconditionally merge this in.
 */
export function useBitbucketPRs(
  scope: BitbucketScope,
  stateFilter: PRStateFilter,
): {
  readonly data: BitbucketPRsResult | undefined
  readonly isFetched: boolean
} {
  const { config } = useConfig()
  const { bookmarkedRepos } = useBookmarkedRepos()
  const refetchInterval = useRefreshInterval()

  const enabled = (config?.enabledProviders ?? ['github']).includes('bitbucket')
  const bitbucketRepos = bookmarkedRepos.filter(
    (r) => r.provider === 'bitbucket',
  )
  const repoKey = bitbucketRepos.map((r) => `${r.owner}/${r.repo}`).sort()

  const query = useQuery({
    queryKey: ['bitbucket-prs', scope, stateFilter, repoKey],
    queryFn: () =>
      Effect.runPromise(fetchBitbucketPRs(bitbucketRepos, scope, stateFilter)),
    enabled,
    refetchInterval,
  })

  return {
    data: enabled ? query.data : EMPTY_RESULT,
    isFetched: query.isFetched,
  }
}
