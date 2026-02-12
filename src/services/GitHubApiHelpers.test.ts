import { describe, it, expect } from 'vitest'
import { buildQueryString, parseLinkHeader } from './GitHubApiHelpers'
import type { ListPRsOptions } from './GitHubApiTypes'

describe('parseLinkHeader', () => {
  it('returns null when header is null', () => {
    expect(parseLinkHeader(null)).toBeNull()
  })

  it('returns null when header is empty string', () => {
    expect(parseLinkHeader('')).toBeNull()
  })

  it('extracts next URL from Link header', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=2',
    )
  })

  it('returns null when no next link exists', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBeNull()
  })

  it('handles header with only next link', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=3>; rel="next"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=3',
    )
  })

  it('handles header with multiple parameters in URL', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=2>; rel="next"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=2',
    )
  })

  it('handles header with extra whitespace', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=2>;  rel="next" , <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=2',
    )
  })

  it('handles header with prev, next, first, and last links', () => {
    const header = [
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev"',
      '<https://api.github.com/repos/owner/repo/pulls?page=3>; rel="next"',
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="first"',
      '<https://api.github.com/repos/owner/repo/pulls?page=10>; rel="last"',
    ].join(', ')
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=3',
    )
  })

  it('returns null for malformed link header', () => {
    expect(parseLinkHeader('not a valid link header')).toBeNull()
  })

  it('returns null when only rel="prev" present', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev"'
    expect(parseLinkHeader(header)).toBeNull()
  })
})

describe('buildQueryString', () => {
  it('returns empty string when no options are set', () => {
    const result = buildQueryString({})
    expect(result).toBe('')
  })

  it('includes state parameter', () => {
    const result = buildQueryString({ state: 'open' })
    expect(result).toBe('?state=open')
  })

  it('includes sort parameter', () => {
    const result = buildQueryString({ sort: 'created' })
    expect(result).toBe('?sort=created')
  })

  it('includes direction parameter', () => {
    const result = buildQueryString({ direction: 'asc' })
    expect(result).toBe('?direction=asc')
  })

  it('includes perPage parameter', () => {
    const result = buildQueryString({ perPage: 50 })
    expect(result).toBe('?per_page=50')
  })

  it('includes page parameter', () => {
    const result = buildQueryString({ page: 3 })
    expect(result).toBe('?page=3')
  })

  it('combines multiple parameters', () => {
    const options: ListPRsOptions = {
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      perPage: 25,
      page: 2,
    }
    const result = buildQueryString(options)
    expect(result).toContain('state=closed')
    expect(result).toContain('sort=updated')
    expect(result).toContain('direction=desc')
    expect(result).toContain('per_page=25')
    expect(result).toContain('page=2')
    expect(result[0]).toBe('?')
  })

  it('omits undefined optional fields', () => {
    const result = buildQueryString({ state: 'all' })
    expect(result).not.toContain('sort=')
    expect(result).not.toContain('direction=')
    expect(result).not.toContain('per_page=')
    expect(result).not.toContain('page=')
  })

  it('handles state=all', () => {
    const result = buildQueryString({ state: 'all' })
    expect(result).toBe('?state=all')
  })

  it('handles state=closed', () => {
    const result = buildQueryString({ state: 'closed' })
    expect(result).toBe('?state=closed')
  })

  it('handles sort=updated', () => {
    const result = buildQueryString({ sort: 'updated' })
    expect(result).toBe('?sort=updated')
  })

  it('handles direction=desc', () => {
    const result = buildQueryString({ direction: 'desc' })
    expect(result).toBe('?direction=desc')
  })

  it('handles page=1', () => {
    const result = buildQueryString({ page: 1 })
    expect(result).toBe('?page=1')
  })

  it('handles perPage=100', () => {
    const result = buildQueryString({ perPage: 100 })
    expect(result).toBe('?per_page=100')
  })
})
