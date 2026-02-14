import { describe, it, expect } from 'vitest'
import {
  TimelineEventSchema,
  TimelineCommitEventSchema,
  TimelineReviewEventSchema,
  TimelineCommentEventSchema,
  TimelineLabelChangeEventSchema,
  TimelineAssigneeChangeEventSchema,
  TimelineStatusCheckEventSchema,
  TimelineForcePushEventSchema,
} from './timeline-event'

describe('TimelineEvent schemas', () => {
  describe('TimelineCommitEventSchema', () => {
    it('parses a valid commit event', () => {
      const input = {
        type: 'commit',
        id: 'commit-1',
        timestamp: '2026-01-01T00:00:00Z',
        sha: 'abc123',
        message: 'feat: add feature',
        author: { login: 'user1' },
      }
      const result = TimelineCommitEventSchema.parse(input)
      expect(result.type).toBe('commit')
      expect(result.sha).toBe('abc123')
      expect(result.message).toBe('feat: add feature')
      expect(result.author.login).toBe('user1')
    })

    it('parses with optional avatarUrl', () => {
      const input = {
        type: 'commit',
        id: 'commit-2',
        timestamp: '2026-01-01T00:00:00Z',
        sha: 'def456',
        message: 'fix: bug',
        author: { login: 'user1', avatarUrl: 'https://example.com/avatar.png' },
      }
      const result = TimelineCommitEventSchema.parse(input)
      expect(result.author.avatarUrl).toBe('https://example.com/avatar.png')
    })

    it('rejects missing required fields', () => {
      expect(() =>
        TimelineCommitEventSchema.parse({ type: 'commit', id: 'x' }),
      ).toThrow()
    })
  })

  describe('TimelineReviewEventSchema', () => {
    it('parses all valid review states', () => {
      const states = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'] as const
      for (const state of states) {
        const input = {
          type: 'review',
          id: `review-${state}`,
          timestamp: '2026-01-01T00:00:00Z',
          state,
          body: 'review body',
          author: { login: 'reviewer' },
        }
        const result = TimelineReviewEventSchema.parse(input)
        expect(result.state).toBe(state)
      }
    })

    it('rejects invalid review state', () => {
      const input = {
        type: 'review',
        id: 'review-1',
        timestamp: '2026-01-01T00:00:00Z',
        state: 'INVALID',
        body: '',
        author: { login: 'reviewer' },
      }
      expect(() => TimelineReviewEventSchema.parse(input)).toThrow()
    })
  })

  describe('TimelineCommentEventSchema', () => {
    it('parses a comment event with optional path and line', () => {
      const input = {
        type: 'comment',
        id: 'comment-1',
        timestamp: '2026-01-01T00:00:00Z',
        body: 'Nice change',
        author: { login: 'commenter' },
        path: 'src/index.ts',
        line: 42,
      }
      const result = TimelineCommentEventSchema.parse(input)
      expect(result.path).toBe('src/index.ts')
      expect(result.line).toBe(42)
    })

    it('parses without optional fields', () => {
      const input = {
        type: 'comment',
        id: 'comment-2',
        timestamp: '2026-01-01T00:00:00Z',
        body: 'General comment',
        author: { login: 'commenter' },
      }
      const result = TimelineCommentEventSchema.parse(input)
      expect(result.path).toBeUndefined()
      expect(result.line).toBeUndefined()
    })
  })

  describe('TimelineLabelChangeEventSchema', () => {
    it('parses added and removed actions', () => {
      for (const action of ['added', 'removed'] as const) {
        const input = {
          type: 'label-change',
          id: `label-${action}`,
          timestamp: '2026-01-01T00:00:00Z',
          action,
          label: { name: 'bug', color: 'fc2929' },
          actor: { login: 'labeler' },
        }
        const result = TimelineLabelChangeEventSchema.parse(input)
        expect(result.action).toBe(action)
        expect(result.label.name).toBe('bug')
      }
    })
  })

  describe('TimelineAssigneeChangeEventSchema', () => {
    it('parses assigned and unassigned actions', () => {
      for (const action of ['assigned', 'unassigned'] as const) {
        const input = {
          type: 'assignee-change',
          id: `assignee-${action}`,
          timestamp: '2026-01-01T00:00:00Z',
          action,
          assignee: { login: 'dev1' },
          actor: { login: 'manager' },
        }
        const result = TimelineAssigneeChangeEventSchema.parse(input)
        expect(result.action).toBe(action)
      }
    })
  })

  describe('TimelineStatusCheckEventSchema', () => {
    it('parses all valid statuses', () => {
      const statuses = ['pending', 'success', 'failure', 'error', 'cancelled'] as const
      for (const status of statuses) {
        const input = {
          type: 'status-check',
          id: `check-${status}`,
          timestamp: '2026-01-01T00:00:00Z',
          name: 'CI',
          status,
        }
        const result = TimelineStatusCheckEventSchema.parse(input)
        expect(result.status).toBe(status)
      }
    })

    it('includes optional detailsUrl', () => {
      const input = {
        type: 'status-check',
        id: 'check-1',
        timestamp: '2026-01-01T00:00:00Z',
        name: 'CI',
        status: 'success',
        detailsUrl: 'https://ci.example.com/run/1',
      }
      const result = TimelineStatusCheckEventSchema.parse(input)
      expect(result.detailsUrl).toBe('https://ci.example.com/run/1')
    })
  })

  describe('TimelineForcePushEventSchema', () => {
    it('parses a force push event', () => {
      const input = {
        type: 'force-push',
        id: 'fp-1',
        timestamp: '2026-01-01T00:00:00Z',
        beforeSha: 'aaa111',
        afterSha: 'bbb222',
        actor: { login: 'pusher' },
      }
      const result = TimelineForcePushEventSchema.parse(input)
      expect(result.beforeSha).toBe('aaa111')
      expect(result.afterSha).toBe('bbb222')
    })
  })

  describe('TimelineEventSchema (discriminated union)', () => {
    it('discriminates on type field', () => {
      const commit = TimelineEventSchema.parse({
        type: 'commit',
        id: 'c1',
        timestamp: '2026-01-01T00:00:00Z',
        sha: 'abc',
        message: 'msg',
        author: { login: 'a' },
      })
      expect(commit.type).toBe('commit')

      const review = TimelineEventSchema.parse({
        type: 'review',
        id: 'r1',
        timestamp: '2026-01-01T00:00:00Z',
        state: 'APPROVED',
        body: '',
        author: { login: 'b' },
      })
      expect(review.type).toBe('review')
    })

    it('rejects unknown event types', () => {
      expect(() =>
        TimelineEventSchema.parse({
          type: 'unknown',
          id: 'x',
          timestamp: '2026-01-01T00:00:00Z',
        }),
      ).toThrow()
    })

    it('parses all seven event types', () => {
      const events = [
        {
          type: 'commit',
          id: '1',
          timestamp: 't',
          sha: 's',
          message: 'm',
          author: { login: 'a' },
        },
        {
          type: 'review',
          id: '2',
          timestamp: 't',
          state: 'COMMENTED',
          body: 'b',
          author: { login: 'a' },
        },
        {
          type: 'comment',
          id: '3',
          timestamp: 't',
          body: 'b',
          author: { login: 'a' },
        },
        {
          type: 'label-change',
          id: '4',
          timestamp: 't',
          action: 'added',
          label: { name: 'n', color: 'c' },
          actor: { login: 'a' },
        },
        {
          type: 'assignee-change',
          id: '5',
          timestamp: 't',
          action: 'assigned',
          assignee: { login: 'a' },
          actor: { login: 'b' },
        },
        {
          type: 'status-check',
          id: '6',
          timestamp: 't',
          name: 'CI',
          status: 'success',
        },
        {
          type: 'force-push',
          id: '7',
          timestamp: 't',
          beforeSha: 'x',
          afterSha: 'y',
          actor: { login: 'a' },
        },
      ]

      for (const event of events) {
        const parsed = TimelineEventSchema.parse(event)
        expect(parsed.type).toBe(event.type)
      }
    })
  })
})
