import { describe, it, expect } from 'vitest'
import {
  BlameInfoSchema,
  BlameInfoArraySchema,
  abbreviateAuthor,
  formatBlameDate,
} from './blame'
import type { BlameInfo } from './blame'

describe('BlameInfoSchema', () => {
  const validBlame: BlameInfo = {
    line: 1,
    author: 'johndoe',
    date: '2025-01-15T10:30:00Z',
    commitSha: 'abc123def456',
    commitMessage: 'fix: resolve rendering issue',
  }

  it('validates a correct blame entry', () => {
    const result = BlameInfoSchema.safeParse(validBlame)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.line).toBe(1)
      expect(result.data.author).toBe('johndoe')
    }
  })

  it('rejects a blame entry with non-positive line number', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, line: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a blame entry with negative line number', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, line: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects a blame entry with non-integer line number', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, line: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects a blame entry with empty author', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, author: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a blame entry with empty date', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, date: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a blame entry with empty commitSha', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, commitSha: '' })
    expect(result.success).toBe(false)
  })

  it('allows empty commitMessage', () => {
    const result = BlameInfoSchema.safeParse({ ...validBlame, commitMessage: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a blame entry with missing fields', () => {
    const result = BlameInfoSchema.safeParse({ line: 1, author: 'test' })
    expect(result.success).toBe(false)
  })

  it('rejects non-object input', () => {
    const result = BlameInfoSchema.safeParse('not-an-object')
    expect(result.success).toBe(false)
  })

  it('rejects null input', () => {
    const result = BlameInfoSchema.safeParse(null)
    expect(result.success).toBe(false)
  })
})

describe('BlameInfoArraySchema', () => {
  it('validates an array of blame entries', () => {
    const entries: BlameInfo[] = [
      {
        line: 1,
        author: 'alice',
        date: '2025-01-15T10:30:00Z',
        commitSha: 'abc123',
        commitMessage: 'initial commit',
      },
      {
        line: 2,
        author: 'bob',
        date: '2025-02-20T14:00:00Z',
        commitSha: 'def456',
        commitMessage: 'add feature',
      },
    ]
    const result = BlameInfoArraySchema.safeParse(entries)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
    }
  })

  it('validates an empty array', () => {
    const result = BlameInfoArraySchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects array with invalid entries', () => {
    const result = BlameInfoArraySchema.safeParse([{ line: -1, author: '' }])
    expect(result.success).toBe(false)
  })
})

describe('abbreviateAuthor', () => {
  it('returns short names unchanged', () => {
    expect(abbreviateAuthor('alice')).toBe('alice')
  })

  it('returns names at max length unchanged', () => {
    expect(abbreviateAuthor('12345678')).toBe('12345678')
  })

  it('truncates long names to 8 characters by default', () => {
    expect(abbreviateAuthor('alexander')).toBe('alexande')
  })

  it('supports custom max length', () => {
    expect(abbreviateAuthor('johndoe', 4)).toBe('john')
  })

  it('handles single character names', () => {
    expect(abbreviateAuthor('a')).toBe('a')
  })

  it('handles empty string', () => {
    expect(abbreviateAuthor('')).toBe('')
  })
})

describe('formatBlameDate', () => {
  it('formats dates within the last hour as minutes', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatBlameDate(fiveMinutesAgo)).toBe('5m')
  })

  it('formats dates within the last day as hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatBlameDate(threeHoursAgo)).toBe('3h')
  })

  it('formats dates within the last month as days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatBlameDate(fiveDaysAgo)).toBe('5d')
  })

  it('formats dates within the last year as months', () => {
    const twoMonthsAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatBlameDate(twoMonthsAgo)).toBe('2mo')
  })

  it('formats dates older than a year as years', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatBlameDate(twoYearsAgo)).toBe('2y')
  })

  it('returns "now" for very recent dates', () => {
    const justNow = new Date().toISOString()
    expect(formatBlameDate(justNow)).toBe('now')
  })

  it('returns "now" for future dates', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(formatBlameDate(future)).toBe('now')
  })

  it('returns "?" for invalid date strings', () => {
    expect(formatBlameDate('not-a-date')).toBe('?')
  })

  it('returns "?" for empty string', () => {
    expect(formatBlameDate('')).toBe('?')
  })
})
