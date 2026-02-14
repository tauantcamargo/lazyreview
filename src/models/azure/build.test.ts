import { describe, it, expect } from 'vitest'
import { AzureBuildSchema } from './build'

// ---------------------------------------------------------------------------
// AzureBuildSchema
// ---------------------------------------------------------------------------

describe('AzureBuildSchema', () => {
  it('parses a minimal build', () => {
    const result = AzureBuildSchema.parse({
      id: 100,
      status: 'completed',
    })
    expect(result.id).toBe(100)
    expect(result.status).toBe('completed')
  })

  it('parses a fully-populated build', () => {
    const result = AzureBuildSchema.parse({
      id: 200,
      buildNumber: '20260115.1',
      status: 'completed',
      result: 'succeeded',
      definition: { id: 1, name: 'CI Build' },
      sourceBranch: 'refs/heads/main',
      sourceVersion: 'abc123',
      startTime: '2026-01-15T10:00:00Z',
      finishTime: '2026-01-15T10:05:00Z',
      url: 'https://dev.azure.com/org/proj/_apis/build/Builds/200',
      _links: {
        web: { href: 'https://dev.azure.com/org/proj/_build/results?buildId=200' },
      },
    })
    expect(result.buildNumber).toBe('20260115.1')
    expect(result.result).toBe('succeeded')
    expect(result.definition?.name).toBe('CI Build')
    expect(result._links?.web?.href).toContain('buildId=200')
  })

  it('parses all valid statuses', () => {
    const statuses = [
      'all',
      'cancelling',
      'completed',
      'inProgress',
      'none',
      'notStarted',
      'postponed',
    ] as const
    for (const status of statuses) {
      const result = AzureBuildSchema.parse({ id: 1, status })
      expect(result.status).toBe(status)
    }
  })

  it('parses all valid results', () => {
    const results = [
      'canceled',
      'failed',
      'none',
      'partiallySucceeded',
      'succeeded',
    ] as const
    for (const result of results) {
      const parsed = AzureBuildSchema.parse({
        id: 1,
        status: 'completed',
        result,
      })
      expect(parsed.result).toBe(result)
    }
  })

  it('accepts null result', () => {
    const result = AzureBuildSchema.parse({
      id: 1,
      status: 'inProgress',
      result: null,
    })
    expect(result.result).toBeNull()
  })

  it('accepts null startTime and finishTime', () => {
    const result = AzureBuildSchema.parse({
      id: 1,
      status: 'notStarted',
      startTime: null,
      finishTime: null,
    })
    expect(result.startTime).toBeNull()
    expect(result.finishTime).toBeNull()
  })

  it('rejects invalid status', () => {
    expect(() =>
      AzureBuildSchema.parse({ id: 1, status: 'running' }),
    ).toThrow()
  })

  it('rejects missing id', () => {
    expect(() =>
      AzureBuildSchema.parse({ status: 'completed' }),
    ).toThrow()
  })
})
