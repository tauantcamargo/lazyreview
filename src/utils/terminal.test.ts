import { describe, it, expect } from 'vitest'
import { truncate, padRight, pluralize, formatCount, openInBrowser, copyToClipboard } from './terminal'

describe('truncate', () => {
  it('returns text unchanged when shorter than maxWidth', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns text unchanged when exactly maxWidth', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates with ellipsis when longer than maxWidth', () => {
    expect(truncate('hello world', 8)).toBe('hello w\u2026')
  })

  it('handles maxWidth <= 3 without ellipsis', () => {
    expect(truncate('hello', 3)).toBe('hel')
    expect(truncate('hello', 1)).toBe('h')
  })

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('')
  })
})

describe('padRight', () => {
  it('pads text with spaces to target width', () => {
    expect(padRight('hi', 5)).toBe('hi   ')
  })

  it('returns text unchanged when already at target width', () => {
    expect(padRight('hello', 5)).toBe('hello')
  })

  it('returns text unchanged when longer than target width', () => {
    expect(padRight('hello world', 5)).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(padRight('', 3)).toBe('   ')
  })
})

describe('pluralize', () => {
  it('returns singular when count is 1', () => {
    expect(pluralize(1, 'file')).toBe('file')
  })

  it('returns default plural (adds s) when count is not 1', () => {
    expect(pluralize(0, 'file')).toBe('files')
    expect(pluralize(2, 'file')).toBe('files')
    expect(pluralize(100, 'file')).toBe('files')
  })

  it('uses custom plural form when provided', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children')
    expect(pluralize(1, 'child', 'children')).toBe('child')
  })
})

describe('formatCount', () => {
  it('returns string representation for counts under 1000', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(42)).toBe('42')
    expect(formatCount(999)).toBe('999')
  })

  it('formats counts >= 1000 with k suffix', () => {
    expect(formatCount(1000)).toBe('1.0k')
    expect(formatCount(1500)).toBe('1.5k')
    expect(formatCount(10000)).toBe('10.0k')
  })
})

describe('openInBrowser', () => {
  it('rejects invalid URLs', () => {
    expect(openInBrowser('not-a-url')).toBe(false)
  })

  it('rejects non-http(s) protocols', () => {
    expect(openInBrowser('ftp://example.com')).toBe(false)
    expect(openInBrowser('file:///etc/passwd')).toBe(false)
    expect(openInBrowser('javascript:alert(1)')).toBe(false)
  })

  it('accepts https URLs', () => {
    expect(openInBrowser('https://github.com/foo/bar')).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(openInBrowser('http://github.com/foo/bar')).toBe(true)
  })
})

describe('copyToClipboard', () => {
  it('returns false for empty string', () => {
    expect(copyToClipboard('')).toBe(false)
  })

  it('copies text to clipboard on macOS', () => {
    // This test actually invokes pbcopy on macOS CI/dev
    const result = copyToClipboard('test-copy-value')
    expect(result).toBe(true)
  })

  it('copies URL to clipboard', () => {
    const url = 'https://github.com/owner/repo/pull/42'
    const result = copyToClipboard(url)
    expect(result).toBe(true)
  })

  it('copies SHA to clipboard', () => {
    const sha = 'abc123def456789'
    const result = copyToClipboard(sha)
    expect(result).toBe(true)
  })
})
