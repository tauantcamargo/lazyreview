import { describe, it, expect } from 'vitest'
import {
  sanitizeApiError,
  stripAnsi,
  validateOwner,
  validateRepo,
  validateNumber,
  validateRef,
  isValidGitHubToken,
} from './sanitize'

describe('sanitizeApiError', () => {
  it('returns mapped message for known status codes', () => {
    expect(sanitizeApiError(401, 'Unauthorized')).toBe('Authentication failed')
    expect(sanitizeApiError(403, 'Forbidden')).toBe('Permission denied')
    expect(sanitizeApiError(404, 'Not Found')).toBe('Resource not found')
    expect(sanitizeApiError(422, 'Unprocessable')).toBe('Validation failed')
    expect(sanitizeApiError(429, 'Too Many Requests')).toBe('Rate limit exceeded')
    expect(sanitizeApiError(500, 'Internal Server Error')).toBe('Internal server error')
  })

  it('returns generic message for unknown status codes', () => {
    expect(sanitizeApiError(418, "I'm a teapot")).toBe("HTTP 418 I'm a teapot")
    expect(sanitizeApiError(504, 'Gateway Timeout')).toBe('HTTP 504 Gateway Timeout')
  })
})

describe('stripAnsi', () => {
  it('removes ANSI escape sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red')
    expect(stripAnsi('\x1b[1mbold\x1b[22m')).toBe('bold')
  })

  it('handles multiple sequences', () => {
    expect(stripAnsi('\x1b[31m\x1b[1mred bold\x1b[0m')).toBe('red bold')
  })

  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('')
  })

  it('removes cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2Jhello')).toBe('hello')
    expect(stripAnsi('\x1b[Hhello')).toBe('hello')
  })
})

describe('validateOwner', () => {
  it('accepts valid owner names', () => {
    expect(validateOwner('facebook')).toBe('facebook')
    expect(validateOwner('my-org')).toBe('my-org')
    expect(validateOwner('user.name')).toBe('user.name')
    expect(validateOwner('user_name')).toBe('user_name')
    expect(validateOwner('123abc')).toBe('123abc')
  })

  it('rejects invalid owner names', () => {
    expect(() => validateOwner('')).toThrow('Invalid owner')
    expect(() => validateOwner('foo/bar')).toThrow('Invalid owner')
    expect(() => validateOwner('foo bar')).toThrow('Invalid owner')
    expect(() => validateOwner('foo@bar')).toThrow('Invalid owner')
    expect(() => validateOwner('../etc')).toThrow('Invalid owner')
  })
})

describe('validateRepo', () => {
  it('accepts valid repo names', () => {
    expect(validateRepo('react')).toBe('react')
    expect(validateRepo('my-repo')).toBe('my-repo')
    expect(validateRepo('repo.js')).toBe('repo.js')
  })

  it('rejects invalid repo names', () => {
    expect(() => validateRepo('')).toThrow('Invalid repo')
    expect(() => validateRepo('foo/bar')).toThrow('Invalid repo')
    expect(() => validateRepo('foo bar')).toThrow('Invalid repo')
  })
})

describe('validateNumber', () => {
  it('accepts valid numbers', () => {
    expect(validateNumber(0)).toBe(0)
    expect(validateNumber(1)).toBe(1)
    expect(validateNumber(12345)).toBe(12345)
  })

  it('rejects invalid numbers', () => {
    expect(() => validateNumber(-1)).toThrow('Invalid number')
    expect(() => validateNumber(1.5)).toThrow('Invalid number')
    expect(() => validateNumber(NaN)).toThrow('Invalid number')
    expect(() => validateNumber(Infinity)).toThrow('Invalid number')
  })
})

describe('validateRef', () => {
  it('accepts valid hex refs', () => {
    expect(validateRef('abc123')).toBe('abc123')
    expect(validateRef('ABCDEF')).toBe('ABCDEF')
    expect(validateRef('0123456789abcdef')).toBe('0123456789abcdef')
  })

  it('rejects invalid refs', () => {
    expect(() => validateRef('')).toThrow('Invalid ref')
    expect(() => validateRef('xyz')).toThrow('Invalid ref')
    expect(() => validateRef('abc 123')).toThrow('Invalid ref')
    expect(() => validateRef('abc/123')).toThrow('Invalid ref')
  })
})

describe('isValidGitHubToken', () => {
  it('accepts tokens with valid prefixes', () => {
    expect(isValidGitHubToken('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678')).toBe(true)
    expect(isValidGitHubToken('gho_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678')).toBe(true)
    expect(isValidGitHubToken('ghu_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678')).toBe(true)
    expect(isValidGitHubToken('ghs_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678')).toBe(true)
    expect(isValidGitHubToken('ghr_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345678')).toBe(true)
    expect(isValidGitHubToken('github_pat_1234567890abcdefghijklmnopqrstuvwxyz')).toBe(true)
  })

  it('rejects tokens with invalid prefixes', () => {
    expect(isValidGitHubToken('sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ12')).toBe(false)
    expect(isValidGitHubToken('random_token_value_here_1234567')).toBe(false)
  })

  it('rejects too-short tokens', () => {
    expect(isValidGitHubToken('ghp_abc')).toBe(false)
  })

  it('rejects too-long tokens', () => {
    expect(isValidGitHubToken('ghp_' + 'a'.repeat(252))).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidGitHubToken('')).toBe(false)
  })
})
