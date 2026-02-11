import { describe, it, expect } from 'vitest'
import { maskToken } from './Auth'

describe('maskToken', () => {
  it('masks short tokens with ****', () => {
    expect(maskToken('short')).toBe('****')
  })

  it('masks tokens of exactly 8 characters', () => {
    expect(maskToken('12345678')).toBe('****')
  })

  it('shows first 4 and last 4 chars for longer tokens', () => {
    expect(maskToken('ghp_abcdef123456')).toBe('ghp_...3456')
  })

  it('handles a 9-character token', () => {
    const result = maskToken('123456789')
    expect(result).toBe('1234...6789')
  })
})
