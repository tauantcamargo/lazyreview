import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { ConflictBanner } from './ConflictBanner'
import type { ConflictState } from '../../utils/conflict-detection'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

describe('ConflictBanner', () => {
  it('renders nothing when there are no conflicts and no message', () => {
    const state: ConflictState = {
      hasConflicts: false,
      mergeableState: 'clean',
      conflictMessage: '',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    expect(lastFrame()).toBe('')
  })

  it('renders a warning banner when there are conflicts', () => {
    const state: ConflictState = {
      hasConflicts: true,
      mergeableState: 'dirty',
      conflictMessage: 'This PR has merge conflicts that must be resolved locally',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('CONFLICTS')
    expect(frame).toContain('merge conflicts')
  })

  it('renders a muted message for unstable state', () => {
    const state: ConflictState = {
      hasConflicts: false,
      mergeableState: 'unstable',
      conflictMessage: 'CI checks are failing or pending',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('CI checks')
  })

  it('renders a muted message for blocked state', () => {
    const state: ConflictState = {
      hasConflicts: false,
      mergeableState: 'blocked',
      conflictMessage: 'Merging is blocked by branch protection rules or required reviews',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('blocked')
  })

  it('renders a message for behind state', () => {
    const state: ConflictState = {
      hasConflicts: false,
      mergeableState: 'behind',
      conflictMessage: 'Branch is behind the base branch and needs to be updated',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('behind')
  })

  it('renders computing message when mergeability is unknown', () => {
    const state: ConflictState = {
      hasConflicts: false,
      mergeableState: null,
      conflictMessage: 'Mergeability is still being computing by the server',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('computing')
  })

  it('shows a resolve hint when there are conflicts', () => {
    const state: ConflictState = {
      hasConflicts: true,
      mergeableState: 'dirty',
      conflictMessage: 'This PR has merge conflicts that must be resolved locally',
    }
    const { lastFrame } = render(themed(<ConflictBanner state={state} />))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('resolve')
  })
})
