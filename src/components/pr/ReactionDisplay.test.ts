import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ReactionDisplay } from './ReactionDisplay'
import type { ReactionSummary } from '../../models/reaction'
import { emptyReactionSummary } from '../../models/reaction'
import { ThemeProvider } from '../../theme/index'

function renderWithTheme(element: React.ReactElement) {
  return render(React.createElement(ThemeProvider, null, element))
}

function makeSummary(overrides: Partial<ReactionSummary> = {}): ReactionSummary {
  return {
    ...emptyReactionSummary(),
    ...overrides,
  }
}

describe('ReactionDisplay', () => {
  it('returns null when no reactions have counts > 0', () => {
    const { lastFrame } = renderWithTheme(
      React.createElement(ReactionDisplay, { reactions: makeSummary() }),
    )
    // With all zero counts, the component returns null and renders nothing
    expect(lastFrame()).toBe('')
  })

  it('displays a single reaction with count', () => {
    const { lastFrame } = renderWithTheme(
      React.createElement(ReactionDisplay, {
        reactions: makeSummary({ '+1': 3, total_count: 3 }),
      }),
    )
    const frame = lastFrame()
    expect(frame).toContain('thumbsup')
    expect(frame).toContain('(3)')
  })

  it('displays multiple reactions', () => {
    const { lastFrame } = renderWithTheme(
      React.createElement(ReactionDisplay, {
        reactions: makeSummary({ '+1': 2, heart: 1, rocket: 5, total_count: 8 }),
      }),
    )
    const frame = lastFrame()
    expect(frame).toContain('thumbsup')
    expect(frame).toContain('(2)')
    expect(frame).toContain('heart')
    expect(frame).toContain('(1)')
    expect(frame).toContain('rocket')
    expect(frame).toContain('(5)')
  })

  it('does not display reactions with zero count', () => {
    const { lastFrame } = renderWithTheme(
      React.createElement(ReactionDisplay, {
        reactions: makeSummary({ '+1': 1, laugh: 0, total_count: 1 }),
      }),
    )
    const frame = lastFrame()
    expect(frame).toContain('thumbsup')
    expect(frame).not.toContain('laugh')
  })

  it('displays all 8 reaction types when all have counts', () => {
    const { lastFrame } = renderWithTheme(
      React.createElement(ReactionDisplay, {
        reactions: {
          '+1': 1,
          '-1': 1,
          laugh: 1,
          hooray: 1,
          confused: 1,
          heart: 1,
          rocket: 1,
          eyes: 1,
          total_count: 8,
        },
      }),
    )
    const frame = lastFrame()
    expect(frame).toContain('thumbsup')
    expect(frame).toContain('thumbsdown')
    expect(frame).toContain('laugh')
    expect(frame).toContain('hooray')
    expect(frame).toContain('confused')
    expect(frame).toContain('heart')
    expect(frame).toContain('rocket')
    expect(frame).toContain('eyes')
  })
})
