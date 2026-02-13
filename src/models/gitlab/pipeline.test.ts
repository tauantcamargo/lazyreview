import { describe, it, expect } from 'vitest'
import { GitLabPipelineJobSchema } from './pipeline'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validJob = {
  id: 200,
  name: 'test',
  status: 'success' as const,
  stage: 'test',
  web_url: 'https://gitlab.com/project/-/jobs/200',
  started_at: '2026-01-15T10:00:00Z',
  finished_at: '2026-01-15T10:05:00Z',
}

// ---------------------------------------------------------------------------
// GitLabPipelineJobSchema
// ---------------------------------------------------------------------------

describe('GitLabPipelineJobSchema', () => {
  it('parses a valid completed job', () => {
    const result = GitLabPipelineJobSchema.parse(validJob)
    expect(result.id).toBe(200)
    expect(result.name).toBe('test')
    expect(result.status).toBe('success')
    expect(result.stage).toBe('test')
    expect(result.web_url).toBe('https://gitlab.com/project/-/jobs/200')
    expect(result.started_at).toBe('2026-01-15T10:00:00Z')
    expect(result.finished_at).toBe('2026-01-15T10:05:00Z')
  })

  it('defaults allow_failure to false', () => {
    const result = GitLabPipelineJobSchema.parse(validJob)
    expect(result.allow_failure).toBe(false)
  })

  it('parses allow_failure when set', () => {
    const result = GitLabPipelineJobSchema.parse({
      ...validJob,
      allow_failure: true,
    })
    expect(result.allow_failure).toBe(true)
  })

  it('accepts null timestamps for pending jobs', () => {
    const result = GitLabPipelineJobSchema.parse({
      ...validJob,
      status: 'pending',
      started_at: null,
      finished_at: null,
    })
    expect(result.status).toBe('pending')
    expect(result.started_at).toBeNull()
    expect(result.finished_at).toBeNull()
  })

  it('parses all valid status values', () => {
    const statuses = [
      'created',
      'pending',
      'running',
      'failed',
      'success',
      'canceled',
      'skipped',
      'manual',
    ] as const

    for (const status of statuses) {
      const result = GitLabPipelineJobSchema.parse({ ...validJob, status })
      expect(result.status).toBe(status)
    }
  })

  it('rejects invalid status', () => {
    expect(() =>
      GitLabPipelineJobSchema.parse({ ...validJob, status: 'unknown' }),
    ).toThrow()
  })

  it('rejects missing name', () => {
    const { name: _, ...noName } = validJob
    expect(() => GitLabPipelineJobSchema.parse(noName)).toThrow()
  })

  it('rejects missing stage', () => {
    const { stage: _, ...noStage } = validJob
    expect(() => GitLabPipelineJobSchema.parse(noStage)).toThrow()
  })
})
