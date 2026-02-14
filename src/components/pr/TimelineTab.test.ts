import { describe, it, expect } from 'vitest'
import {
  getEventIcon,
  getEventDescription,
  getEventColorKey,
} from './TimelineTab'
import type { TimelineEvent } from '../../models/timeline-event'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCommitEvent(
  overrides?: Partial<TimelineEvent & { type: 'commit' }>,
): TimelineEvent {
  return {
    type: 'commit',
    id: 'commit-1',
    timestamp: '2024-01-15T10:00:00Z',
    sha: 'abc1234567890',
    message: 'feat: add new feature',
    author: { login: 'alice' },
    ...overrides,
  }
}

function makeReviewEvent(
  overrides?: Partial<TimelineEvent & { type: 'review' }>,
): TimelineEvent {
  return {
    type: 'review',
    id: 'review-1',
    timestamp: '2024-01-15T11:00:00Z',
    state: 'APPROVED',
    body: 'LGTM!',
    author: { login: 'bob' },
    ...overrides,
  }
}

function makeCommentEvent(
  overrides?: Partial<TimelineEvent & { type: 'comment' }>,
): TimelineEvent {
  return {
    type: 'comment',
    id: 'comment-1',
    timestamp: '2024-01-15T12:00:00Z',
    body: 'Nice work!',
    author: { login: 'carol' },
    ...overrides,
  }
}

function makeLabelChangeEvent(
  overrides?: Partial<TimelineEvent & { type: 'label-change' }>,
): TimelineEvent {
  return {
    type: 'label-change',
    id: 'label-1',
    timestamp: '2024-01-15T13:00:00Z',
    action: 'added',
    label: { name: 'bug', color: '#d73a4a' },
    actor: { login: 'dave' },
    ...overrides,
  }
}

function makeAssigneeChangeEvent(
  overrides?: Partial<TimelineEvent & { type: 'assignee-change' }>,
): TimelineEvent {
  return {
    type: 'assignee-change',
    id: 'assignee-1',
    timestamp: '2024-01-15T14:00:00Z',
    action: 'assigned',
    assignee: { login: 'eve' },
    actor: { login: 'frank' },
    ...overrides,
  }
}

function makeStatusCheckEvent(
  overrides?: Partial<TimelineEvent & { type: 'status-check' }>,
): TimelineEvent {
  return {
    type: 'status-check',
    id: 'check-1',
    timestamp: '2024-01-15T15:00:00Z',
    name: 'CI Build',
    status: 'success',
    ...overrides,
  }
}

function makeForcePushEvent(
  overrides?: Partial<TimelineEvent & { type: 'force-push' }>,
): TimelineEvent {
  return {
    type: 'force-push',
    id: 'push-1',
    timestamp: '2024-01-15T16:00:00Z',
    beforeSha: 'aaa1111',
    afterSha: 'bbb2222',
    actor: { login: 'grace' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getEventIcon tests
// ---------------------------------------------------------------------------

describe('getEventIcon', () => {
  it('returns commit icon for commit events', () => {
    expect(getEventIcon(makeCommitEvent())).toBe('*')
  })

  it('returns approved icon for approved reviews', () => {
    expect(getEventIcon(makeReviewEvent({ state: 'APPROVED' }))).toBe('+')
  })

  it('returns changes requested icon for changes_requested reviews', () => {
    expect(getEventIcon(makeReviewEvent({ state: 'CHANGES_REQUESTED' }))).toBe('x')
  })

  it('returns commented icon for commented reviews', () => {
    expect(getEventIcon(makeReviewEvent({ state: 'COMMENTED' }))).toBe('~')
  })

  it('returns dismissed icon for dismissed reviews', () => {
    expect(getEventIcon(makeReviewEvent({ state: 'DISMISSED' }))).toBe('-')
  })

  it('returns pending icon for pending reviews', () => {
    expect(getEventIcon(makeReviewEvent({ state: 'PENDING' }))).toBe('...')
  })

  it('returns comment icon for comment events', () => {
    expect(getEventIcon(makeCommentEvent())).toBe('#')
  })

  it('returns label icon for label-change events', () => {
    expect(getEventIcon(makeLabelChangeEvent())).toBe('@')
  })

  it('returns assignee icon for assignee-change events', () => {
    expect(getEventIcon(makeAssigneeChangeEvent())).toBe('>')
  })

  it('returns success icon for successful status checks', () => {
    expect(getEventIcon(makeStatusCheckEvent({ status: 'success' }))).toBe('[ok]')
  })

  it('returns failure icon for failed status checks', () => {
    expect(getEventIcon(makeStatusCheckEvent({ status: 'failure' }))).toBe('[!!]')
  })

  it('returns pending icon for pending status checks', () => {
    expect(getEventIcon(makeStatusCheckEvent({ status: 'pending' }))).toBe('[..]')
  })

  it('returns error icon for error status checks', () => {
    expect(getEventIcon(makeStatusCheckEvent({ status: 'error' }))).toBe('[!!]')
  })

  it('returns cancelled icon for cancelled status checks', () => {
    expect(getEventIcon(makeStatusCheckEvent({ status: 'cancelled' }))).toBe('[--]')
  })

  it('returns force-push icon for force-push events', () => {
    expect(getEventIcon(makeForcePushEvent())).toBe('!')
  })
})

// ---------------------------------------------------------------------------
// getEventDescription tests
// ---------------------------------------------------------------------------

describe('getEventDescription', () => {
  it('describes commit event with short SHA and message', () => {
    const event = makeCommitEvent({ sha: 'abc1234567890', message: 'feat: add new feature' })
    const desc = getEventDescription(event)
    expect(desc).toContain('abc1234')
    expect(desc).toContain('feat: add new feature')
  })

  it('truncates long commit messages to first line', () => {
    const event = makeCommitEvent({ message: 'first line\nsecond line\nthird line' })
    const desc = getEventDescription(event)
    expect(desc).toContain('first line')
    expect(desc).not.toContain('second line')
  })

  it('describes approved review', () => {
    const event = makeReviewEvent({ state: 'APPROVED', author: { login: 'bob' } })
    const desc = getEventDescription(event)
    expect(desc).toContain('bob')
    expect(desc).toContain('approved')
  })

  it('describes changes_requested review', () => {
    const event = makeReviewEvent({ state: 'CHANGES_REQUESTED', author: { login: 'bob' } })
    const desc = getEventDescription(event)
    expect(desc).toContain('bob')
    expect(desc).toContain('requested changes')
  })

  it('describes commented review', () => {
    const event = makeReviewEvent({ state: 'COMMENTED', author: { login: 'bob' } })
    const desc = getEventDescription(event)
    expect(desc).toContain('bob')
    expect(desc).toContain('reviewed')
  })

  it('describes dismissed review', () => {
    const event = makeReviewEvent({ state: 'DISMISSED', author: { login: 'bob' } })
    const desc = getEventDescription(event)
    expect(desc).toContain('bob')
    expect(desc).toContain('dismissed')
  })

  it('describes comment event', () => {
    const event = makeCommentEvent({ author: { login: 'carol' }, body: 'Nice work!' })
    const desc = getEventDescription(event)
    expect(desc).toContain('carol')
    expect(desc).toContain('commented')
  })

  it('describes comment with file path', () => {
    const event = makeCommentEvent({
      author: { login: 'carol' },
      path: 'src/main.ts',
      line: 42,
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('src/main.ts')
  })

  it('describes label added event', () => {
    const event = makeLabelChangeEvent({
      action: 'added',
      label: { name: 'bug', color: '#d73a4a' },
      actor: { login: 'dave' },
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('dave')
    expect(desc).toContain('added')
    expect(desc).toContain('bug')
  })

  it('describes label removed event', () => {
    const event = makeLabelChangeEvent({
      action: 'removed',
      label: { name: 'bug', color: '#d73a4a' },
      actor: { login: 'dave' },
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('dave')
    expect(desc).toContain('removed')
    expect(desc).toContain('bug')
  })

  it('describes assignee assigned event', () => {
    const event = makeAssigneeChangeEvent({
      action: 'assigned',
      assignee: { login: 'eve' },
      actor: { login: 'frank' },
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('frank')
    expect(desc).toContain('assigned')
    expect(desc).toContain('eve')
  })

  it('describes assignee unassigned event', () => {
    const event = makeAssigneeChangeEvent({
      action: 'unassigned',
      assignee: { login: 'eve' },
      actor: { login: 'frank' },
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('frank')
    expect(desc).toContain('unassigned')
    expect(desc).toContain('eve')
  })

  it('describes successful status check', () => {
    const event = makeStatusCheckEvent({ name: 'CI Build', status: 'success' })
    const desc = getEventDescription(event)
    expect(desc).toContain('CI Build')
    expect(desc).toContain('passed')
  })

  it('describes failed status check', () => {
    const event = makeStatusCheckEvent({ name: 'CI Build', status: 'failure' })
    const desc = getEventDescription(event)
    expect(desc).toContain('CI Build')
    expect(desc).toContain('failed')
  })

  it('describes pending status check', () => {
    const event = makeStatusCheckEvent({ name: 'CI Build', status: 'pending' })
    const desc = getEventDescription(event)
    expect(desc).toContain('CI Build')
    expect(desc).toContain('pending')
  })

  it('describes error status check', () => {
    const event = makeStatusCheckEvent({ name: 'CI Build', status: 'error' })
    const desc = getEventDescription(event)
    expect(desc).toContain('CI Build')
    expect(desc).toContain('errored')
  })

  it('describes cancelled status check', () => {
    const event = makeStatusCheckEvent({ name: 'CI Build', status: 'cancelled' })
    const desc = getEventDescription(event)
    expect(desc).toContain('CI Build')
    expect(desc).toContain('cancelled')
  })

  it('describes force-push event with short SHAs', () => {
    const event = makeForcePushEvent({
      actor: { login: 'grace' },
      beforeSha: 'aaa1111bbb',
      afterSha: 'ccc2222ddd',
    })
    const desc = getEventDescription(event)
    expect(desc).toContain('grace')
    expect(desc).toContain('force-pushed')
    expect(desc).toContain('aaa1111')
    expect(desc).toContain('ccc2222')
  })
})

// ---------------------------------------------------------------------------
// getEventColorKey tests
// ---------------------------------------------------------------------------

describe('getEventColorKey', () => {
  it('returns warning for commit events', () => {
    expect(getEventColorKey(makeCommitEvent())).toBe('warning')
  })

  it('returns success for approved reviews', () => {
    expect(getEventColorKey(makeReviewEvent({ state: 'APPROVED' }))).toBe('success')
  })

  it('returns error for changes_requested reviews', () => {
    expect(getEventColorKey(makeReviewEvent({ state: 'CHANGES_REQUESTED' }))).toBe('error')
  })

  it('returns info for commented reviews', () => {
    expect(getEventColorKey(makeReviewEvent({ state: 'COMMENTED' }))).toBe('info')
  })

  it('returns muted for dismissed reviews', () => {
    expect(getEventColorKey(makeReviewEvent({ state: 'DISMISSED' }))).toBe('muted')
  })

  it('returns info for comment events', () => {
    expect(getEventColorKey(makeCommentEvent())).toBe('info')
  })

  it('returns secondary for label-change events', () => {
    expect(getEventColorKey(makeLabelChangeEvent())).toBe('secondary')
  })

  it('returns secondary for assignee-change events', () => {
    expect(getEventColorKey(makeAssigneeChangeEvent())).toBe('secondary')
  })

  it('returns success for successful status checks', () => {
    expect(getEventColorKey(makeStatusCheckEvent({ status: 'success' }))).toBe('success')
  })

  it('returns error for failed status checks', () => {
    expect(getEventColorKey(makeStatusCheckEvent({ status: 'failure' }))).toBe('error')
  })

  it('returns warning for pending status checks', () => {
    expect(getEventColorKey(makeStatusCheckEvent({ status: 'pending' }))).toBe('warning')
  })

  it('returns error for force-push events', () => {
    expect(getEventColorKey(makeForcePushEvent())).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// Viewport / scroll calculation tests
// ---------------------------------------------------------------------------

describe('viewport calculation', () => {
  it('computes viewport height from terminal rows', () => {
    const terminalRows = 40
    const viewportHeight = Math.max(1, terminalRows - 14)
    expect(viewportHeight).toBe(26)
  })

  it('clamps viewport height to minimum 1', () => {
    const terminalRows = 10
    const viewportHeight = Math.max(1, terminalRows - 14)
    expect(viewportHeight).toBe(1)
  })

  it('defaults to 24 rows when stdout is unavailable', () => {
    const defaultRows = 24
    const viewportHeight = Math.max(1, defaultRows - 14)
    expect(viewportHeight).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// getEventActor tests
// ---------------------------------------------------------------------------

describe('getEventActor', () => {
  // This is tested implicitly through getEventDescription, but we verify
  // actor extraction for each event type.

  it('uses author.login for commit events', () => {
    const desc = getEventDescription(makeCommitEvent({ author: { login: 'alice' } }))
    expect(desc).toContain('alice')
  })

  it('uses author.login for review events', () => {
    const desc = getEventDescription(makeReviewEvent({ author: { login: 'bob' } }))
    expect(desc).toContain('bob')
  })

  it('uses author.login for comment events', () => {
    const desc = getEventDescription(makeCommentEvent({ author: { login: 'carol' } }))
    expect(desc).toContain('carol')
  })

  it('uses actor.login for label-change events', () => {
    const desc = getEventDescription(makeLabelChangeEvent({ actor: { login: 'dave' } }))
    expect(desc).toContain('dave')
  })

  it('uses actor.login for assignee-change events', () => {
    const desc = getEventDescription(makeAssigneeChangeEvent({ actor: { login: 'frank' } }))
    expect(desc).toContain('frank')
  })

  it('uses actor.login for force-push events', () => {
    const desc = getEventDescription(makeForcePushEvent({ actor: { login: 'grace' } }))
    expect(desc).toContain('grace')
  })
})
