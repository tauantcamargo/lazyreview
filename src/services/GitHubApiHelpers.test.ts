import { describe, it, expect } from 'vitest'
import { buildQueryString } from './GitHubApiHelpers'
import type { ListPRsOptions } from './GitHubApiTypes'

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
})
