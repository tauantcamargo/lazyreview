import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('masks a 1-character token', () => {
    expect(maskToken('x')).toBe('****')
  })

  it('masks an empty token', () => {
    expect(maskToken('')).toBe('****')
  })

  it('masks a typical GitHub PAT', () => {
    const pat = 'ghp_1234567890abcdefghijklmno'
    const result = maskToken(pat)
    expect(result).toBe('ghp_...lmno')
    // Must not contain the full token
    expect(result).not.toBe(pat)
  })

  it('masks a classic GitHub token', () => {
    const token = 'github_pat_01234567890abcdefghij'
    const result = maskToken(token)
    expect(result.startsWith('gith')).toBe(true)
    expect(result.endsWith('ghij')).toBe(true)
    expect(result).toContain('...')
  })

  it('handles exactly 7-char token (boundary below 8)', () => {
    expect(maskToken('1234567')).toBe('****')
  })

  it('handles exactly 9-char token (boundary above 8)', () => {
    const result = maskToken('abcdefghi')
    expect(result).toBe('abcd...fghi')
  })
})
