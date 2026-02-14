import { describe, it, expect } from 'vitest'
import { extractSuggestionFromBody } from './SuggestionBlock'
import {
  getSuggestionProviderBadge,
  getSuggestionModalTitle,
} from './SuggestionModal'

// ---------------------------------------------------------------------------
// Tests for SuggestionModal pure helpers
// ---------------------------------------------------------------------------

describe('getSuggestionModalTitle', () => {
  it('returns the correct title', () => {
    expect(getSuggestionModalTitle()).toBe('Suggest Change')
  })
})

describe('getSuggestionProviderBadge', () => {
  it('returns native for github', () => {
    const badge = getSuggestionProviderBadge(true, 'github')
    expect(badge.label).toBe('native')
    expect(badge.isNative).toBe(true)
  })

  it('returns native for gitlab', () => {
    const badge = getSuggestionProviderBadge(true, 'gitlab')
    expect(badge.label).toBe('native')
    expect(badge.isNative).toBe(true)
  })

  it('returns comment for bitbucket', () => {
    const badge = getSuggestionProviderBadge(false, 'bitbucket')
    expect(badge.label).toBe('comment')
    expect(badge.isNative).toBe(false)
  })

  it('returns comment for azure', () => {
    const badge = getSuggestionProviderBadge(false, 'azure')
    expect(badge.label).toBe('comment')
    expect(badge.isNative).toBe(false)
  })

  it('returns comment for gitea', () => {
    const badge = getSuggestionProviderBadge(false, 'gitea')
    expect(badge.label).toBe('comment')
    expect(badge.isNative).toBe(false)
  })

  it('includes provider type in display', () => {
    const badge = getSuggestionProviderBadge(true, 'github')
    expect(badge.display).toContain('github')
    expect(badge.display).toContain('native')
  })

  it('includes provider type for non-native', () => {
    const badge = getSuggestionProviderBadge(false, 'bitbucket')
    expect(badge.display).toContain('bitbucket')
    expect(badge.display).toContain('comment')
  })
})

// ---------------------------------------------------------------------------
// Integration with suggestion block extraction
// ---------------------------------------------------------------------------

describe('SuggestionModal integration with extractSuggestionFromBody', () => {
  it('extracts GitHub suggestion block', () => {
    const body = 'Fix this issue\n\n```suggestion\nconst x = 1\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('Fix this issue')
  })

  it('extracts GitLab suggestion block', () => {
    const body = 'Update code\n\n```suggestion:-0+0\nconst x = 1\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
  })

  it('handles multi-line suggestions', () => {
    const body = '```suggestion\nconst x = 1\nconst y = 2\nconst z = 3\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1\nconst y = 2\nconst z = 3')
  })

  it('handles empty suggestion (line deletion)', () => {
    const body = 'Remove this\n\n```suggestion\n\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('')
  })

  it('returns null for regular comment', () => {
    const body = 'Just a regular comment with ```code``` blocks'
    expect(extractSuggestionFromBody(body)).toBeNull()
  })

  it('returns null for empty body', () => {
    expect(extractSuggestionFromBody('')).toBeNull()
  })
})
