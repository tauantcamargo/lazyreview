import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { maskToken, getEnvVarName, setAuthProvider, getAuthProvider } from './Auth'

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

describe('getEnvVarName', () => {
  it('returns LAZYREVIEW_GITHUB_TOKEN for github provider', () => {
    expect(getEnvVarName('github')).toBe('LAZYREVIEW_GITHUB_TOKEN')
  })

  it('returns LAZYREVIEW_GITLAB_TOKEN for gitlab provider', () => {
    expect(getEnvVarName('gitlab')).toBe('LAZYREVIEW_GITLAB_TOKEN')
  })
})

describe('setAuthProvider / getAuthProvider', () => {
  afterEach(() => {
    // Reset to default
    setAuthProvider('github')
  })

  it('defaults to github', () => {
    expect(getAuthProvider()).toBe('github')
  })

  it('can be set to gitlab', () => {
    setAuthProvider('gitlab')
    expect(getAuthProvider()).toBe('gitlab')
  })

  it('can be switched back to github', () => {
    setAuthProvider('gitlab')
    setAuthProvider('github')
    expect(getAuthProvider()).toBe('github')
  })
})
