import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { createBitbucketApiAdapter } from './BitbucketApiAdapter'
import { BitbucketError } from '../models/errors'

const getTokenForProvider = vi.fn()
vi.mock('./Auth', () => ({
  getTokenForProvider: (...args: unknown[]) => getTokenForProvider(...args),
}))

const providerMethods: Record<string, ReturnType<typeof vi.fn>> = {}
const createBitbucketProvider = vi.fn()
vi.mock('./providers/bitbucket', () => ({
  createBitbucketProvider: (...args: unknown[]) =>
    createBitbucketProvider(...args),
}))

function run<A, E>(effect: Effect.Effect<A, E>): Promise<Exit.Exit<A, E>> {
  return Effect.runPromise(Effect.exit(effect))
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of Object.keys(providerMethods)) {
    delete providerMethods[key]
  }
  getTokenForProvider.mockReturnValue(Effect.succeed('user@example.com:tok'))
  {
    const provider: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const name of [
      'listPRs',
      'getPR',
      'getPRFiles',
      'getPRFilesPage',
      'getFileDiff',
      'getPRComments',
      'getIssueComments',
      'getPRReviews',
      'getPRCommits',
      'getPRChecks',
      'getReviewThreads',
      'getCommitDiff',
      'submitReview',
      'createPendingReview',
      'addPendingReviewComment',
      'submitPendingReview',
      'discardPendingReview',
      'addComment',
      'addDiffComment',
      'replyToComment',
      'editIssueComment',
      'editReviewComment',
      'deleteReviewComment',
      'mergePR',
      'closePR',
      'reopenPR',
      'updatePRTitle',
      'updatePRBody',
      'requestReReview',
      'getLabels',
      'setLabels',
      'createPR',
      'getCollaborators',
      'updateAssignees',
      'addReaction',
      'getCurrentUser',
    ]) {
      const fn = vi.fn().mockReturnValue(Effect.succeed(undefined))
      providerMethods[name] = fn
      provider[name] = fn
    }
    createBitbucketProvider.mockReturnValue(provider)
  }
})

describe('createBitbucketApiAdapter', () => {
  it('resolves a bitbucket token and constructs a provider scoped to owner/repo', async () => {
    const adapter = createBitbucketApiAdapter()
    providerMethods['getPR']!.mockReturnValue(Effect.succeed({ id: 1 }))

    await run(adapter.getPR('acme', 'web', 42))

    expect(getTokenForProvider).toHaveBeenCalledWith('bitbucket')
    expect(createBitbucketProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bitbucket',
        token: 'user@example.com:tok',
        owner: 'acme',
        repo: 'web',
      }),
    )
    expect(providerMethods['getPR']).toHaveBeenCalledWith(42)
  })

  it('unwraps listPRs items from the Provider PRListResult shape', async () => {
    const adapter = createBitbucketApiAdapter()
    providerMethods['listPRs']!.mockReturnValue(
      Effect.succeed({ items: [{ id: 1 }, { id: 2 }] }),
    )

    const exit = await run(adapter.listPRs('acme', 'web'))
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual([{ id: 1 }, { id: 2 }])
    }
  })

  it('reorders replyToComment args to Provider.replyToComment(prNumber, commentId, body)', async () => {
    const adapter = createBitbucketApiAdapter()
    await run(adapter.replyToComment('acme', 'web', 42, 'reply body', 99))
    expect(providerMethods['replyToComment']).toHaveBeenCalledWith(
      42,
      99,
      'reply body',
    )
  })

  it('packs addDiffComment positional args into a params object', async () => {
    const adapter = createBitbucketApiAdapter()
    await run(
      adapter.addDiffComment(
        'acme',
        'web',
        42,
        'body',
        'sha123',
        'src/a.ts',
        10,
        'RIGHT',
      ),
    )
    expect(providerMethods['addDiffComment']).toHaveBeenCalledWith({
      prNumber: 42,
      body: 'body',
      commitId: 'sha123',
      path: 'src/a.ts',
      line: 10,
      side: 'RIGHT',
      startLine: undefined,
      startSide: undefined,
    })
  })

  it('packs createPR positional args into a params object', async () => {
    const adapter = createBitbucketApiAdapter()
    await run(
      adapter.createPR('acme', 'web', 'Title', 'Body', 'main', 'feature'),
    )
    expect(providerMethods['createPR']).toHaveBeenCalledWith({
      title: 'Title',
      body: 'Body',
      baseBranch: 'main',
      headBranch: 'feature',
      draft: undefined,
    })
  })

  it('fails getMyPRs/getReviewRequests/getInvolvedPRs without touching auth or the provider', async () => {
    const adapter = createBitbucketApiAdapter()

    const myPRs = await run(adapter.getMyPRs())
    const reviewRequests = await run(adapter.getReviewRequests())
    const involved = await run(adapter.getInvolvedPRs())

    expect(Exit.isFailure(myPRs)).toBe(true)
    expect(Exit.isFailure(reviewRequests)).toBe(true)
    expect(Exit.isFailure(involved)).toBe(true)
    expect(getTokenForProvider).not.toHaveBeenCalled()
    expect(createBitbucketProvider).not.toHaveBeenCalled()
  })

  it('fails resolveThread/unresolveThread/convertToDraft/markReadyForReview without touching auth or the provider', async () => {
    const adapter = createBitbucketApiAdapter()

    const results = await Promise.all([
      run(adapter.resolveThread('t1')),
      run(adapter.unresolveThread('t1')),
      run(adapter.convertToDraft('node1')),
      run(adapter.markReadyForReview('node1')),
    ])

    for (const exit of results) {
      expect(Exit.isFailure(exit)).toBe(true)
    }
    expect(getTokenForProvider).not.toHaveBeenCalled()
    expect(createBitbucketProvider).not.toHaveBeenCalled()
  })

  it('calls getCurrentUser with an empty owner/repo context', async () => {
    const adapter = createBitbucketApiAdapter()
    providerMethods['getCurrentUser']!.mockReturnValue(
      Effect.succeed({ login: 'bbuser' }),
    )

    await run(adapter.getCurrentUser())

    expect(createBitbucketProvider).toHaveBeenCalledWith(
      expect.objectContaining({ owner: '', repo: '' }),
    )
  })

  it('propagates a BitbucketError from an underlying provider call', async () => {
    const adapter = createBitbucketApiAdapter()
    providerMethods['closePR']!.mockReturnValue(
      Effect.fail(new BitbucketError({ message: 'nope', status: 400 })),
    )

    const exit = await run(adapter.closePR('acme', 'web', 42))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('propagates an AuthError when no bitbucket token is available', async () => {
    getTokenForProvider.mockReturnValue(
      Effect.fail({
        _tag: 'AuthError',
        message: 'no token',
        reason: 'no_token',
      }),
    )
    const adapter = createBitbucketApiAdapter()

    const exit = await run(adapter.getPR('acme', 'web', 42))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(createBitbucketProvider).not.toHaveBeenCalled()
  })
})
