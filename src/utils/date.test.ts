import { describe, it, expect } from 'vitest'
import { timeAgo, formatDate, formatDateTime } from './date'

describe('timeAgo', () => {
  it('returns a relative time string for a valid ISO date', () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString()
    const result = timeAgo(recent)
    expect(result).toContain('ago')
  })

  it('returns the original string for an invalid date', () => {
    expect(timeAgo('not-a-date')).toBe('not-a-date')
  })
})

describe('formatDate', () => {
  it('formats a valid ISO date as MMM d, yyyy', () => {
    expect(formatDate('2024-03-15T10:30:00Z')).toBe('Mar 15, 2024')
  })

  it('returns the original string for an invalid date', () => {
    expect(formatDate('invalid')).toBe('invalid')
  })
})

describe('formatDateTime', () => {
  it('formats a valid ISO date with time', () => {
    const result = formatDateTime('2024-03-15T10:30:00Z')
    expect(result).toContain('Mar 15, 2024')
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/)
  })

  it('returns the original string for an invalid date', () => {
    expect(formatDateTime('invalid')).toBe('invalid')
  })
})
