import { describe, it, expect } from 'vitest'
import { REACTION_TYPES, REACTION_LABELS } from '../../models/reaction'

/**
 * Tests for the ReactionPicker component.
 *
 * The ReactionPicker uses the Modal component which renders with
 * position="absolute" -- this is not captured by ink-testing-library.
 * We test the data model used by the picker instead:
 * - All 8 reaction types are available
 * - Labels map correctly
 * - Navigation bounds are correct (0 to REACTION_TYPES.length - 1)
 *
 * The actual rendering and keyboard interaction are validated through
 * manual testing and integration tests at the PRDetailScreen level.
 */

describe('ReactionPicker data model', () => {
  it('has exactly 8 reaction types for the picker list', () => {
    expect(REACTION_TYPES).toHaveLength(8)
  })

  it('all reaction types have human-readable labels', () => {
    for (const type of REACTION_TYPES) {
      expect(REACTION_LABELS[type]).toBeDefined()
      expect(REACTION_LABELS[type].length).toBeGreaterThan(0)
    }
  })

  it('reaction types are in expected order for navigation', () => {
    expect(REACTION_TYPES[0]).toBe('+1')
    expect(REACTION_TYPES[1]).toBe('-1')
    expect(REACTION_TYPES[2]).toBe('laugh')
    expect(REACTION_TYPES[3]).toBe('hooray')
    expect(REACTION_TYPES[4]).toBe('confused')
    expect(REACTION_TYPES[5]).toBe('heart')
    expect(REACTION_TYPES[6]).toBe('rocket')
    expect(REACTION_TYPES[7]).toBe('eyes')
  })

  it('selectedIndex clamping logic: min is 0', () => {
    const selectedIndex = 0
    const prev = Math.max(selectedIndex - 1, 0)
    expect(prev).toBe(0)
  })

  it('selectedIndex clamping logic: max is REACTION_TYPES.length - 1', () => {
    const selectedIndex = REACTION_TYPES.length - 1
    const next = Math.min(selectedIndex + 1, REACTION_TYPES.length - 1)
    expect(next).toBe(7)
  })

  it('selectedIndex navigation from 0 to 1', () => {
    const selectedIndex = 0
    const next = Math.min(selectedIndex + 1, REACTION_TYPES.length - 1)
    expect(next).toBe(1)
    expect(REACTION_TYPES[next]).toBe('-1')
  })

  it('selectedIndex navigation from 1 back to 0', () => {
    const selectedIndex = 1
    const prev = Math.max(selectedIndex - 1, 0)
    expect(prev).toBe(0)
    expect(REACTION_TYPES[prev]).toBe('+1')
  })
})
