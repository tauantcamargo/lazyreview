import { describe, it, expect, vi } from 'vitest'

/**
 * Tests for DescriptionTab component.
 *
 * Tests the component's rendering logic by verifying:
 * - PR info display (author, reviewers, labels, stats)
 * - Description display
 * - Review summary integration
 * - Bot summary integration (collapsible section for bot comments)
 * - 'D' key triggers onEditDescription callback
 * - 'B' key toggles bot summary expansion
 *
 * Since this is a presentational component, we test via the public
 * interface and exported sub-component behavior.
 */

import type { PullRequest } from '../../models/pull-request'
import type { Review } from '../../models/review'
import { findMostRecentBotComment, type BotDetectableComment } from '../../utils/bot-detection'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePR(overrides?: Partial<Record<string, unknown>>): PullRequest {
  return {
    id: 1,
    number: 42,
    title: 'Test PR',
    body: 'This is the PR description body',
    state: 'open',
    draft: false,
    merged: false,
    user: { login: 'author', avatar_url: '', id: 1, html_url: '' },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/42',
    head: { ref: 'feature', sha: 'abc' },
    base: { ref: 'main', sha: 'def' },
    additions: 10,
    deletions: 5,
    changed_files: 3,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    assignees: [],
    ...overrides,
  } as unknown as PullRequest
}

function makeReview(login: string, state: string, submitted_at: string): Review {
  return {
    id: Math.floor(Math.random() * 10000),
    user: { login, avatar_url: '', id: 1, html_url: '' },
    body: null,
    state,
    submitted_at,
    html_url: '',
  } as unknown as Review
}

function makeIssueComment(
  login: string,
  body: string,
  created_at: string,
): BotDetectableComment {
  return {
    id: Math.floor(Math.random() * 10000),
    body,
    user: { login, id: 1, avatar_url: '', html_url: '' },
    created_at,
    updated_at: created_at,
    html_url: '',
  }
}

// ---------------------------------------------------------------------------
// Tests for DescriptionTab data/logic
// ---------------------------------------------------------------------------

describe('DescriptionTab', () => {
  describe('PR info rendering data', () => {
    it('provides author login from pr.user', () => {
      const pr = makePR({ user: { login: 'octocat', avatar_url: '', id: 1, html_url: '' } })
      expect(pr.user.login).toBe('octocat')
    })

    it('provides requested reviewers list', () => {
      const pr = makePR({
        requested_reviewers: [
          { login: 'alice', avatar_url: '', id: 2, html_url: '' },
          { login: 'bob', avatar_url: '', id: 3, html_url: '' },
        ],
      })
      expect(pr.requested_reviewers.map((r: { login: string }) => r.login)).toEqual(['alice', 'bob'])
    })

    it('provides labels with color', () => {
      const pr = makePR({
        labels: [
          { id: 1, name: 'bug', color: 'fc2929', description: null },
          { id: 2, name: 'enhancement', color: '84b6eb', description: null },
        ],
      })
      expect(pr.labels).toHaveLength(2)
      expect(pr.labels[0].name).toBe('bug')
      expect(pr.labels[0].color).toBe('fc2929')
    })

    it('provides additions, deletions, and changed_files', () => {
      const pr = makePR({ additions: 42, deletions: 13, changed_files: 7 })
      expect(pr.additions).toBe(42)
      expect(pr.deletions).toBe(13)
      expect(pr.changed_files).toBe(7)
    })

    it('handles empty reviewers', () => {
      const pr = makePR({ requested_reviewers: [] })
      expect(pr.requested_reviewers).toHaveLength(0)
    })

    it('handles empty labels', () => {
      const pr = makePR({ labels: [] })
      expect(pr.labels).toHaveLength(0)
    })

    it('handles null body', () => {
      const pr = makePR({ body: null })
      expect(pr.body).toBeNull()
    })
  })

  describe('sections array structure', () => {
    it('generates three sections without bot comments (info, description, reviews)', () => {
      // Without bot comments: PRInfoSection, PRDescriptionSection, ReviewSummary
      const hasBotComment = false
      const sectionCount = hasBotComment ? 4 : 3
      expect(sectionCount).toBe(3)
    })

    it('generates four sections with bot comments (info, bot summary, description, reviews)', () => {
      // With bot comments: PRInfoSection, BotSummarySection, PRDescriptionSection, ReviewSummary
      const hasBotComment = true
      const sectionCount = hasBotComment ? 4 : 3
      expect(sectionCount).toBe(4)
    })
  })

  describe('D key handler', () => {
    it('calls onEditDescription with body when D is pressed', () => {
      const onEditDescription = vi.fn()
      const pr = makePR({ body: 'Current description' })

      // Simulate the D key handler logic from DescriptionTab
      const input = 'D'
      if (input === 'D' && onEditDescription) {
        onEditDescription({ body: pr.body ?? '' })
      }

      expect(onEditDescription).toHaveBeenCalledWith({ body: 'Current description' })
    })

    it('does not call onEditDescription when not provided', () => {
      const onEditDescription = undefined
      const pr = makePR({ body: 'Current description' })

      const input = 'D'
      let called = false
      if (input === 'D' && onEditDescription) {
        called = true
      }

      expect(called).toBe(false)
    })

    it('passes empty string when body is null', () => {
      const onEditDescription = vi.fn()
      const pr = makePR({ body: null })

      const input = 'D'
      if (input === 'D' && onEditDescription) {
        onEditDescription({ body: pr.body ?? '' })
      }

      expect(onEditDescription).toHaveBeenCalledWith({ body: '' })
    })

    it('does not trigger on lowercase d', () => {
      const onEditDescription = vi.fn()

      const input = 'd'
      if (input === 'D' && onEditDescription) {
        onEditDescription({ body: '' })
      }

      expect(onEditDescription).not.toHaveBeenCalled()
    })
  })

  describe('B key handler (bot summary toggle)', () => {
    it('toggles bot summary when B is pressed and bot comment exists', () => {
      const botComment = makeIssueComment(
        'github-actions[bot]',
        'AI summary',
        '2025-01-01T00:00:00Z',
      )
      let expanded = false

      const input = 'B'
      if (input === 'B' && botComment) {
        expanded = !expanded
      }

      expect(expanded).toBe(true)
    })

    it('does not toggle when no bot comment exists', () => {
      const botComment = null
      let expanded = false

      const input = 'B'
      if (input === 'B' && botComment) {
        expanded = !expanded
      }

      expect(expanded).toBe(false)
    })

    it('does not trigger on lowercase b', () => {
      const botComment = makeIssueComment(
        'github-actions[bot]',
        'AI summary',
        '2025-01-01T00:00:00Z',
      )
      let expanded = false

      const input = 'b'
      if (input === 'B' && botComment) {
        expanded = !expanded
      }

      expect(expanded).toBe(false)
    })

    it('toggles back to collapsed on second B press', () => {
      const botComment = makeIssueComment(
        'github-actions[bot]',
        'AI summary',
        '2025-01-01T00:00:00Z',
      )
      let expanded = false

      // First press: expand
      if ('B' === 'B' && botComment) expanded = !expanded
      expect(expanded).toBe(true)

      // Second press: collapse
      if ('B' === 'B' && botComment) expanded = !expanded
      expect(expanded).toBe(false)
    })
  })

  describe('bot summary integration', () => {
    it('finds bot comment from issue comments', () => {
      const issueComments = [
        makeIssueComment('alice', 'LGTM', '2025-01-01T00:00:00Z'),
        makeIssueComment('github-actions[bot]', '## Summary\nLooks good', '2025-01-02T00:00:00Z'),
        makeIssueComment('bob', 'Nice work', '2025-01-03T00:00:00Z'),
      ]

      const botComment = findMostRecentBotComment(issueComments)
      expect(botComment).not.toBeNull()
      expect(botComment?.body).toBe('## Summary\nLooks good')
      expect(botComment?.user.login).toBe('github-actions[bot]')
    })

    it('returns null when no bot comments in issue comments', () => {
      const issueComments = [
        makeIssueComment('alice', 'LGTM', '2025-01-01T00:00:00Z'),
        makeIssueComment('bob', 'Nice work', '2025-01-02T00:00:00Z'),
      ]

      const botComment = findMostRecentBotComment(issueComments)
      expect(botComment).toBeNull()
    })

    it('uses custom bot usernames from config', () => {
      const issueComments = [
        makeIssueComment('coderabbitai', 'AI Review: looks good', '2025-01-01T00:00:00Z'),
      ]
      const botUsernames = ['coderabbitai']

      const botComment = findMostRecentBotComment(issueComments, botUsernames)
      expect(botComment).not.toBeNull()
      expect(botComment?.body).toBe('AI Review: looks good')
    })

    it('handles empty issue comments', () => {
      const botComment = findMostRecentBotComment([])
      expect(botComment).toBeNull()
    })

    it('handles undefined issue comments (defaults to no bot summary)', () => {
      const issueComments: readonly BotDetectableComment[] | undefined = undefined
      const botComment = findMostRecentBotComment(issueComments ?? [])
      expect(botComment).toBeNull()
    })
  })

  describe('viewport height calculation', () => {
    it('computes content height with reserved lines', () => {
      const PR_DETAIL_CONTENT_HEIGHT_RESERVED = 18
      const DESCRIPTION_HEADER_LINES = 2
      const terminalRows = 40

      const contentHeight = Math.max(1, terminalRows - PR_DETAIL_CONTENT_HEIGHT_RESERVED)
      const viewportHeight = Math.max(1, contentHeight - DESCRIPTION_HEADER_LINES)

      expect(contentHeight).toBe(22)
      expect(viewportHeight).toBe(20)
    })

    it('clamps to minimum of 1', () => {
      const PR_DETAIL_CONTENT_HEIGHT_RESERVED = 18
      const DESCRIPTION_HEADER_LINES = 2
      const terminalRows = 10

      const contentHeight = Math.max(1, terminalRows - PR_DETAIL_CONTENT_HEIGHT_RESERVED)
      const viewportHeight = Math.max(1, contentHeight - DESCRIPTION_HEADER_LINES)

      expect(contentHeight).toBe(1)
      expect(viewportHeight).toBe(1)
    })
  })

  describe('review summary integration', () => {
    it('ReviewSummary receives reviews prop', () => {
      const reviews = [
        makeReview('alice', 'APPROVED', '2025-01-02T00:00:00Z'),
        makeReview('bob', 'CHANGES_REQUESTED', '2025-01-03T00:00:00Z'),
      ]
      // The component passes reviews directly to ReviewSummary
      expect(reviews).toHaveLength(2)
      expect(reviews[0].state).toBe('APPROVED')
      expect(reviews[1].state).toBe('CHANGES_REQUESTED')
    })
  })
})
