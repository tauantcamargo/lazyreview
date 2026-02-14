import { describe, it, expect } from 'vitest'
import {
  REACTION_TYPES,
  REACTION_LABELS,
  REACTION_EMOJI,
  ReactionSummarySchema,
  emptyReactionSummary,
  activeReactions,
  formatReactionSummary,
  type ReactionType,
  type ReactionSummary,
} from './reaction'

describe('Reaction model', () => {
  describe('REACTION_TYPES', () => {
    it('contains all 8 standard reaction types', () => {
      expect(REACTION_TYPES).toHaveLength(8)
      expect(REACTION_TYPES).toContain('+1')
      expect(REACTION_TYPES).toContain('-1')
      expect(REACTION_TYPES).toContain('laugh')
      expect(REACTION_TYPES).toContain('hooray')
      expect(REACTION_TYPES).toContain('confused')
      expect(REACTION_TYPES).toContain('heart')
      expect(REACTION_TYPES).toContain('rocket')
      expect(REACTION_TYPES).toContain('eyes')
    })
  })

  describe('REACTION_LABELS', () => {
    it('has a label for every reaction type', () => {
      for (const type of REACTION_TYPES) {
        expect(REACTION_LABELS[type]).toBeDefined()
        expect(typeof REACTION_LABELS[type]).toBe('string')
        expect(REACTION_LABELS[type].length).toBeGreaterThan(0)
      }
    })

    it('maps +1 to thumbsup', () => {
      expect(REACTION_LABELS['+1']).toBe('thumbsup')
    })

    it('maps -1 to thumbsdown', () => {
      expect(REACTION_LABELS['-1']).toBe('thumbsdown')
    })
  })

  describe('REACTION_EMOJI', () => {
    it('has an emoji for every reaction type', () => {
      for (const type of REACTION_TYPES) {
        expect(REACTION_EMOJI[type]).toBeDefined()
        expect(typeof REACTION_EMOJI[type]).toBe('string')
      }
    })
  })

  describe('ReactionSummarySchema', () => {
    it('parses a full reaction summary', () => {
      const input = {
        '+1': 3,
        '-1': 0,
        laugh: 1,
        hooray: 0,
        confused: 0,
        heart: 2,
        rocket: 0,
        eyes: 1,
        total_count: 7,
      }
      const result = ReactionSummarySchema.parse(input)
      expect(result['+1']).toBe(3)
      expect(result.heart).toBe(2)
      expect(result.total_count).toBe(7)
    })

    it('applies defaults for missing fields', () => {
      const result = ReactionSummarySchema.parse({})
      expect(result['+1']).toBe(0)
      expect(result['-1']).toBe(0)
      expect(result.laugh).toBe(0)
      expect(result.hooray).toBe(0)
      expect(result.confused).toBe(0)
      expect(result.heart).toBe(0)
      expect(result.rocket).toBe(0)
      expect(result.eyes).toBe(0)
      expect(result.total_count).toBe(0)
    })

    it('rejects non-numeric values', () => {
      expect(() => ReactionSummarySchema.parse({ '+1': 'abc' })).toThrow()
    })
  })

  describe('emptyReactionSummary', () => {
    it('returns all counts at zero', () => {
      const summary = emptyReactionSummary()
      for (const type of REACTION_TYPES) {
        expect(summary[type]).toBe(0)
      }
      expect(summary.total_count).toBe(0)
    })

    it('returns a new object each call', () => {
      const a = emptyReactionSummary()
      const b = emptyReactionSummary()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })

  describe('activeReactions', () => {
    it('returns empty array for zero-count summary', () => {
      const summary = emptyReactionSummary()
      const result = activeReactions(summary)
      expect(result).toHaveLength(0)
    })

    it('returns only reactions with count > 0', () => {
      const summary: ReactionSummary = {
        ...emptyReactionSummary(),
        '+1': 3,
        heart: 1,
        rocket: 5,
      }
      const result = activeReactions(summary)
      expect(result).toHaveLength(3)
      expect(result.map((r) => r.type)).toEqual(['+1', 'heart', 'rocket'])
    })

    it('preserves counts', () => {
      const summary: ReactionSummary = {
        ...emptyReactionSummary(),
        eyes: 7,
      }
      const result = activeReactions(summary)
      expect(result).toHaveLength(1)
      expect(result[0]!.type).toBe('eyes')
      expect(result[0]!.count).toBe(7)
    })

    it('maintains order matching REACTION_TYPES', () => {
      const summary: ReactionSummary = {
        ...emptyReactionSummary(),
        eyes: 1,
        '+1': 2,
        laugh: 3,
      }
      const result = activeReactions(summary)
      const types = result.map((r) => r.type)
      // +1 comes before laugh which comes before eyes in REACTION_TYPES
      expect(types).toEqual(['+1', 'laugh', 'eyes'])
    })
  })

  describe('formatReactionSummary', () => {
    it('returns empty string for zero-count summary', () => {
      const summary = emptyReactionSummary()
      expect(formatReactionSummary(summary)).toBe('')
    })

    it('formats single reaction', () => {
      const summary: ReactionSummary = {
        ...emptyReactionSummary(),
        '+1': 3,
      }
      expect(formatReactionSummary(summary)).toBe('thumbsup (3)')
    })

    it('formats multiple reactions separated by double space', () => {
      const summary: ReactionSummary = {
        ...emptyReactionSummary(),
        '+1': 3,
        heart: 1,
      }
      expect(formatReactionSummary(summary)).toBe('thumbsup (3)  heart (1)')
    })

    it('formats all 8 reaction types', () => {
      const summary: ReactionSummary = {
        '+1': 1,
        '-1': 2,
        laugh: 3,
        hooray: 4,
        confused: 5,
        heart: 6,
        rocket: 7,
        eyes: 8,
        total_count: 36,
      }
      const result = formatReactionSummary(summary)
      expect(result).toContain('thumbsup (1)')
      expect(result).toContain('thumbsdown (2)')
      expect(result).toContain('laugh (3)')
      expect(result).toContain('hooray (4)')
      expect(result).toContain('confused (5)')
      expect(result).toContain('heart (6)')
      expect(result).toContain('rocket (7)')
      expect(result).toContain('eyes (8)')
    })
  })
})
