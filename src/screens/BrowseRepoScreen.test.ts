import { describe, it, expect } from 'vitest'
import { validateRepoInput } from './BrowseRepoScreen'

describe('validateRepoInput', () => {
  it('accepts valid owner/repo format', () => {
    const result = validateRepoInput('facebook/react')
    expect(result.valid).toBe(true)
    expect(result.owner).toBe('facebook')
    expect(result.repo).toBe('react')
    expect(result.error).toBeNull()
  })

  it('trims whitespace', () => {
    const result = validateRepoInput('  facebook / react  ')
    expect(result.valid).toBe(true)
    expect(result.owner).toBe('facebook')
    expect(result.repo).toBe('react')
  })

  it('rejects input without slash', () => {
    const result = validateRepoInput('facebook-react')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Format: owner/repo')
  })

  it('rejects empty owner', () => {
    const result = validateRepoInput('/react')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Owner cannot be empty')
  })

  it('rejects empty repo', () => {
    const result = validateRepoInput('facebook/')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Repo cannot be empty')
  })

  it('rejects empty string', () => {
    const result = validateRepoInput('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Format: owner/repo')
  })

  it('rejects whitespace-only string', () => {
    const result = validateRepoInput('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Format: owner/repo')
  })

  it('handles multiple slashes (takes first as owner)', () => {
    const result = validateRepoInput('org/repo/path')
    expect(result.valid).toBe(true)
    expect(result.owner).toBe('org')
    expect(result.repo).toBe('repo/path')
  })
})
