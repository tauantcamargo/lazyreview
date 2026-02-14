import { describe, it, expect, beforeEach } from 'vitest'
import { Effect } from 'effect'
import type { Provider } from '../types'

/**
 * Contract test suite for provider implementations.
 * Each provider must pass these tests to be considered valid.
 *
 * Usage:
 *   testProviderContract('github', () => createMockGitHubProvider())
 *   testProviderContract('gitlab', () => createMockGitLabProvider())
 */
export function testProviderContract(
  providerName: string,
  createProvider: () => Provider,
): void {
  describe(`${providerName} provider contract`, () => {
    let provider: Provider

    beforeEach(() => {
      provider = createProvider()
    })

    // -----------------------------------------------------------------------
    // Metadata
    // -----------------------------------------------------------------------

    describe('metadata', () => {
      it('should have a valid provider type', () => {
        expect(['github', 'gitlab', 'bitbucket', 'azure', 'gitea']).toContain(
          provider.type,
        )
      })

      it('should declare capabilities object', () => {
        expect(provider.capabilities).toBeDefined()
      })

      it('should declare supportsDraftPR as boolean', () => {
        expect(typeof provider.capabilities.supportsDraftPR).toBe('boolean')
      })

      it('should declare supportsReviewThreads as boolean', () => {
        expect(typeof provider.capabilities.supportsReviewThreads).toBe(
          'boolean',
        )
      })

      it('should declare supportsGraphQL as boolean', () => {
        expect(typeof provider.capabilities.supportsGraphQL).toBe('boolean')
      })

      it('should declare supportsReactions as boolean', () => {
        expect(typeof provider.capabilities.supportsReactions).toBe('boolean')
      })

      it('should declare supportsCheckRuns as boolean', () => {
        expect(typeof provider.capabilities.supportsCheckRuns).toBe('boolean')
      })

      it('should declare supportsLabels as boolean', () => {
        expect(typeof provider.capabilities.supportsLabels).toBe('boolean')
      })

      it('should declare supportsAssignees as boolean', () => {
        expect(typeof provider.capabilities.supportsAssignees).toBe('boolean')
      })

      it('should declare supportsMergeStrategies as array', () => {
        expect(Array.isArray(provider.capabilities.supportsMergeStrategies)).toBe(
          true,
        )
      })

      it('should have at least one merge strategy', () => {
        expect(provider.capabilities.supportsMergeStrategies.length).toBeGreaterThan(
          0,
        )
      })

      it('should only contain valid merge strategies', () => {
        const validStrategies = ['merge', 'squash', 'rebase']
        for (const strategy of provider.capabilities.supportsMergeStrategies) {
          expect(validStrategies).toContain(strategy)
        }
      })
    })

    // -----------------------------------------------------------------------
    // Read operations
    // -----------------------------------------------------------------------

    describe('read operations', () => {
      it('should implement listPRs', () => {
        expect(typeof provider.listPRs).toBe('function')
      })

      it('should implement getPR', () => {
        expect(typeof provider.getPR).toBe('function')
      })

      it('should implement getPRFiles', () => {
        expect(typeof provider.getPRFiles).toBe('function')
      })

      it('should implement getPRComments', () => {
        expect(typeof provider.getPRComments).toBe('function')
      })

      it('should implement getIssueComments', () => {
        expect(typeof provider.getIssueComments).toBe('function')
      })

      it('should implement getPRReviews', () => {
        expect(typeof provider.getPRReviews).toBe('function')
      })

      it('should implement getPRCommits', () => {
        expect(typeof provider.getPRCommits).toBe('function')
      })

      it('should implement getPRChecks', () => {
        expect(typeof provider.getPRChecks).toBe('function')
      })

      it('should implement getReviewThreads', () => {
        expect(typeof provider.getReviewThreads).toBe('function')
      })

      it('should implement getCommitDiff', () => {
        expect(typeof provider.getCommitDiff).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // User-scoped queries
    // -----------------------------------------------------------------------

    describe('user-scoped queries', () => {
      it('should implement getMyPRs', () => {
        expect(typeof provider.getMyPRs).toBe('function')
      })

      it('should implement getReviewRequests', () => {
        expect(typeof provider.getReviewRequests).toBe('function')
      })

      it('should implement getInvolvedPRs', () => {
        expect(typeof provider.getInvolvedPRs).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // Write operations
    // -----------------------------------------------------------------------

    describe('write operations', () => {
      it('should implement submitReview', () => {
        expect(typeof provider.submitReview).toBe('function')
      })

      it('should implement createPendingReview', () => {
        expect(typeof provider.createPendingReview).toBe('function')
      })

      it('should implement addPendingReviewComment', () => {
        expect(typeof provider.addPendingReviewComment).toBe('function')
      })

      it('should implement submitPendingReview', () => {
        expect(typeof provider.submitPendingReview).toBe('function')
      })

      it('should implement discardPendingReview', () => {
        expect(typeof provider.discardPendingReview).toBe('function')
      })

      it('should implement addComment', () => {
        expect(typeof provider.addComment).toBe('function')
      })

      it('should implement addDiffComment', () => {
        expect(typeof provider.addDiffComment).toBe('function')
      })

      it('should implement replyToComment', () => {
        expect(typeof provider.replyToComment).toBe('function')
      })

      it('should implement editIssueComment', () => {
        expect(typeof provider.editIssueComment).toBe('function')
      })

      it('should implement editReviewComment', () => {
        expect(typeof provider.editReviewComment).toBe('function')
      })

      it('should implement deleteReviewComment', () => {
        expect(typeof provider.deleteReviewComment).toBe('function')
      })

      it('should implement mergePR', () => {
        expect(typeof provider.mergePR).toBe('function')
      })

      it('should implement closePR', () => {
        expect(typeof provider.closePR).toBe('function')
      })

      it('should implement reopenPR', () => {
        expect(typeof provider.reopenPR).toBe('function')
      })

      it('should implement updatePRTitle', () => {
        expect(typeof provider.updatePRTitle).toBe('function')
      })

      it('should implement updatePRBody', () => {
        expect(typeof provider.updatePRBody).toBe('function')
      })

      it('should implement requestReReview', () => {
        expect(typeof provider.requestReReview).toBe('function')
      })

      it('should implement getLabels', () => {
        expect(typeof provider.getLabels).toBe('function')
      })

      it('should implement setLabels', () => {
        expect(typeof provider.setLabels).toBe('function')
      })

      it('should implement createPR', () => {
        expect(typeof provider.createPR).toBe('function')
      })

      it('should implement getCollaborators', () => {
        expect(typeof provider.getCollaborators).toBe('function')
      })

      it('should implement updateAssignees', () => {
        expect(typeof provider.updateAssignees).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // User info
    // -----------------------------------------------------------------------

    describe('user info', () => {
      it('should implement getCurrentUser', () => {
        expect(typeof provider.getCurrentUser).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // Optional capabilities - thread operations
    // -----------------------------------------------------------------------

    describe('optional capabilities - threads', () => {
      it('should implement resolveThread if supportsReviewThreads', () => {
        if (provider.capabilities.supportsReviewThreads) {
          expect(typeof provider.resolveThread).toBe('function')
          expect(typeof provider.unresolveThread).toBe('function')
        }
      })

      it('should always have resolveThread and unresolveThread on interface', () => {
        // These are required on the interface even if capability is false
        expect(typeof provider.resolveThread).toBe('function')
        expect(typeof provider.unresolveThread).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // Optional capabilities - draft PR
    // -----------------------------------------------------------------------

    describe('optional capabilities - draft PRs', () => {
      it('should implement draft methods if supportsDraftPR', () => {
        if (provider.capabilities.supportsDraftPR) {
          expect(typeof provider.convertToDraft).toBe('function')
          expect(typeof provider.markReadyForReview).toBe('function')
        }
      })

      it('should always have convertToDraft and markReadyForReview on interface', () => {
        // These are required on the interface even if capability is false
        expect(typeof provider.convertToDraft).toBe('function')
        expect(typeof provider.markReadyForReview).toBe('function')
      })
    })

    // -----------------------------------------------------------------------
    // Behavioral contract - read operations return data
    // -----------------------------------------------------------------------

    describe('behavioral contract - reads', () => {
      it('listPRs should return a PRListResult with items array', async () => {
        const result = await Effect.runPromise(provider.listPRs({}))
        expect(result).toHaveProperty('items')
        expect(Array.isArray(result.items)).toBe(true)
      })

      it('getPR should return a PullRequest', async () => {
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result).toHaveProperty('number')
        expect(result).toHaveProperty('title')
        expect(result).toHaveProperty('state')
      })

      it('getPRFiles should return an array of FileChange', async () => {
        const result = await Effect.runPromise(provider.getPRFiles(1))
        expect(Array.isArray(result)).toBe(true)
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('filename')
          expect(result[0]).toHaveProperty('status')
        }
      })

      it('getPRComments should return an array of Comment', async () => {
        const result = await Effect.runPromise(provider.getPRComments(1))
        expect(Array.isArray(result)).toBe(true)
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('body')
          expect(result[0]).toHaveProperty('user')
        }
      })

      it('getPRReviews should return an array of Review', async () => {
        const result = await Effect.runPromise(provider.getPRReviews(1))
        expect(Array.isArray(result)).toBe(true)
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('state')
          expect(result[0]).toHaveProperty('user')
        }
      })

      it('getPRCommits should return an array of Commit', async () => {
        const result = await Effect.runPromise(provider.getPRCommits(1))
        expect(Array.isArray(result)).toBe(true)
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('sha')
          expect(result[0]).toHaveProperty('commit')
        }
      })

      it('getPRChecks should return a CheckRunsResponse', async () => {
        const result = await Effect.runPromise(provider.getPRChecks('abc123'))
        expect(result).toHaveProperty('total_count')
        expect(result).toHaveProperty('check_runs')
        expect(Array.isArray(result.check_runs)).toBe(true)
      })

      it('getCurrentUser should return an object with login', async () => {
        const result = await Effect.runPromise(provider.getCurrentUser())
        expect(result).toHaveProperty('login')
        expect(typeof result.login).toBe('string')
      })
    })

    // -----------------------------------------------------------------------
    // Behavioral contract - write operations succeed
    // -----------------------------------------------------------------------

    describe('behavioral contract - writes', () => {
      it('submitReview should complete without error', async () => {
        await expect(
          Effect.runPromise(provider.submitReview(1, 'LGTM', 'APPROVE')),
        ).resolves.toBeUndefined()
      })

      it('addComment should complete without error', async () => {
        await expect(
          Effect.runPromise(provider.addComment(1, 'Nice!')),
        ).resolves.toBeUndefined()
      })

      it('mergePR should complete without error', async () => {
        await expect(
          Effect.runPromise(provider.mergePR(1, 'squash')),
        ).resolves.toBeUndefined()
      })

      it('closePR should complete without error', async () => {
        await expect(
          Effect.runPromise(provider.closePR(1)),
        ).resolves.toBeUndefined()
      })

      it('reopenPR should complete without error', async () => {
        await expect(
          Effect.runPromise(provider.reopenPR(1)),
        ).resolves.toBeUndefined()
      })

      it('createPR should return a result with number and html_url', async () => {
        const result = await Effect.runPromise(
          provider.createPR({
            title: 'Test PR',
            body: 'Test body',
            baseBranch: 'main',
            headBranch: 'feature/test',
            draft: false,
          }),
        )
        expect(result).toHaveProperty('number')
        expect(typeof result.number).toBe('number')
        expect(result).toHaveProperty('html_url')
        expect(typeof result.html_url).toBe('string')
      })
    })

    // -----------------------------------------------------------------------
    // Behavioral contract - user-scoped queries
    // -----------------------------------------------------------------------

    describe('behavioral contract - user-scoped queries', () => {
      it('getMyPRs should return an array', async () => {
        const result = await Effect.runPromise(provider.getMyPRs())
        expect(Array.isArray(result)).toBe(true)
      })

      it('getReviewRequests should return an array', async () => {
        const result = await Effect.runPromise(provider.getReviewRequests())
        expect(Array.isArray(result)).toBe(true)
      })

      it('getInvolvedPRs should return an array', async () => {
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(Array.isArray(result)).toBe(true)
      })
    })
  })
}
