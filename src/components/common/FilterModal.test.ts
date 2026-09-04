import { describe, it, expect } from 'vitest'
import { computeFacetWindow, FACET_VIEWPORT } from './FilterModal'

describe('computeFacetWindow', () => {
  it('shows everything with no scroll hints when the list fits the viewport', () => {
    const w = computeFacetWindow(0, 5, true)
    expect(w).toEqual({ scrollOffset: 0, hiddenAbove: 0, hiddenBelow: 0 })
  })

  it('a list of exactly FACET_VIEWPORT items never scrolls', () => {
    const w = computeFacetWindow(FACET_VIEWPORT - 1, FACET_VIEWPORT, true)
    expect(w).toEqual({ scrollOffset: 0, hiddenAbove: 0, hiddenBelow: 0 })
  })

  it('previously-unreachable items beyond the viewport become visible', () => {
    // Regression test: FacetSection used to hard-cap at options.slice(0, 8),
    // and getMaxIndex capped navigation at index 7, making anything past
    // item 8 permanently unreachable ("+N more" with no way to get there).
    const highlightIndex = FACET_VIEWPORT + 3 // index 11, the 12th item
    const w = computeFacetWindow(highlightIndex, 12, true)
    expect(w.scrollOffset).toBeGreaterThan(0)
    expect(highlightIndex).toBeGreaterThanOrEqual(w.scrollOffset)
    expect(highlightIndex).toBeLessThan(w.scrollOffset + FACET_VIEWPORT)
  })

  it('scrolls down to keep the highlighted item within the viewport', () => {
    const w = computeFacetWindow(10, 20, true)
    expect(w.scrollOffset).toBe(10 - FACET_VIEWPORT + 1)
    expect(w.hiddenAbove).toBe(w.scrollOffset)
    expect(w.hiddenBelow).toBe(20 - w.scrollOffset - FACET_VIEWPORT)
  })

  it('does not scroll past the end of the list', () => {
    const w = computeFacetWindow(19, 20, true)
    expect(w.scrollOffset).toBe(20 - FACET_VIEWPORT)
    expect(w.hiddenBelow).toBe(0)
  })

  it('shows "hiddenAbove" once scrolled, and clears it when back at the top', () => {
    const scrolled = computeFacetWindow(15, 20, true)
    expect(scrolled.hiddenAbove).toBeGreaterThan(0)

    const top = computeFacetWindow(0, 20, true)
    expect(top.hiddenAbove).toBe(0)
    expect(top.hiddenBelow).toBe(20 - FACET_VIEWPORT)
  })

  it('does not scroll an unfocused section, regardless of highlightIndex', () => {
    const w = computeFacetWindow(15, 20, false)
    expect(w.scrollOffset).toBe(0)
    expect(w.hiddenAbove).toBe(0)
    expect(w.hiddenBelow).toBe(20 - FACET_VIEWPORT)
  })

  it('handles an empty list without going negative', () => {
    const w = computeFacetWindow(0, 0, true)
    expect(w.scrollOffset).toBe(0)
    expect(w.hiddenAbove).toBe(0)
    expect(w.hiddenBelow).toBe(0)
  })
})
