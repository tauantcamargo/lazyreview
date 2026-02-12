import { describe, it, expect } from 'vitest'
import {
  addBookmarkToList,
  removeBookmarkFromList,
  validateBookmarkInput,
} from './useBookmarkedRepos'
import type { BookmarkedRepo } from '../services/Config'

describe('validateBookmarkInput', () => {
  it('accepts valid owner/repo format', () => {
    const result = validateBookmarkInput('facebook/react')
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('rejects input without slash', () => {
    const result = validateBookmarkInput('facebook')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Format: owner/repo')
  })

  it('rejects empty owner', () => {
    const result = validateBookmarkInput('/react')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Owner and repo cannot be empty')
  })

  it('rejects empty repo', () => {
    const result = validateBookmarkInput('facebook/')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Owner and repo cannot be empty')
  })

  it('rejects empty string', () => {
    const result = validateBookmarkInput('')
    expect(result.valid).toBe(false)
  })

  it('trims whitespace', () => {
    const result = validateBookmarkInput('  owner / repo  ')
    expect(result.valid).toBe(true)
  })
})

describe('addBookmarkToList', () => {
  it('adds a new bookmark to an empty list', () => {
    const result = addBookmarkToList([], 'facebook', 'react')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ owner: 'facebook', repo: 'react' })
  })

  it('appends to existing list', () => {
    const existing: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    const result = addBookmarkToList(existing, 'vercel', 'next.js')
    expect(result).toHaveLength(2)
    expect(result[0]?.owner).toBe('facebook')
    expect(result[1]?.owner).toBe('vercel')
  })

  it('rejects duplicate entries (returns same list)', () => {
    const existing: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    const result = addBookmarkToList(existing, 'facebook', 'react')
    expect(result).toBe(existing) // Same reference - no mutation
    expect(result).toHaveLength(1)
  })

  it('treats different repos from same owner as distinct', () => {
    const existing: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    const result = addBookmarkToList(existing, 'facebook', 'jest')
    expect(result).toHaveLength(2)
  })

  it('does not mutate the original array', () => {
    const existing: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    addBookmarkToList(existing, 'vercel', 'next.js')
    expect(existing).toHaveLength(1)
  })
})

describe('removeBookmarkFromList', () => {
  it('removes a bookmark from the list', () => {
    const repos: BookmarkedRepo[] = [
      { owner: 'facebook', repo: 'react' },
      { owner: 'vercel', repo: 'next.js' },
    ]
    const result = removeBookmarkFromList(repos, 'facebook', 'react')
    expect(result).toHaveLength(1)
    expect(result[0]?.owner).toBe('vercel')
  })

  it('returns same-length list when bookmark not found', () => {
    const repos: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    const result = removeBookmarkFromList(repos, 'unknown', 'repo')
    expect(result).toHaveLength(1)
  })

  it('returns empty array when removing last item', () => {
    const repos: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    const result = removeBookmarkFromList(repos, 'facebook', 'react')
    expect(result).toHaveLength(0)
  })

  it('does not mutate the original array', () => {
    const repos: BookmarkedRepo[] = [{ owner: 'facebook', repo: 'react' }]
    removeBookmarkFromList(repos, 'facebook', 'react')
    expect(repos).toHaveLength(1)
  })
})
