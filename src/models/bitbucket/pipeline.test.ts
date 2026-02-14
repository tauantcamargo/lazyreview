import { describe, it, expect } from 'vitest'
import {
  BitbucketPipelineStepResultSchema,
  BitbucketPipelineStepStateSchema,
  BitbucketPipelineStepSchema,
} from './pipeline'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validResult = { name: 'SUCCESSFUL' as const }

const validState = {
  name: 'COMPLETED' as const,
  result: validResult,
}

const validStep = {
  uuid: '{step-uuid-1}',
  name: 'Build & Test',
  state: validState,
  started_on: '2026-01-15T10:00:00Z',
  completed_on: '2026-01-15T10:05:00Z',
}

// ---------------------------------------------------------------------------
// BitbucketPipelineStepResultSchema
// ---------------------------------------------------------------------------

describe('BitbucketPipelineStepResultSchema', () => {
  it('parses all valid result names', () => {
    const names = [
      'SUCCESSFUL',
      'FAILED',
      'ERROR',
      'STOPPED',
      'EXPIRED',
      'NOT_RUN',
    ] as const
    for (const name of names) {
      const result = BitbucketPipelineStepResultSchema.parse({ name })
      expect(result.name).toBe(name)
    }
  })

  it('rejects invalid result name', () => {
    expect(() =>
      BitbucketPipelineStepResultSchema.parse({ name: 'UNKNOWN' }),
    ).toThrow()
  })

  it('rejects missing name', () => {
    expect(() =>
      BitbucketPipelineStepResultSchema.parse({}),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketPipelineStepStateSchema
// ---------------------------------------------------------------------------

describe('BitbucketPipelineStepStateSchema', () => {
  it('parses completed state with result', () => {
    const result = BitbucketPipelineStepStateSchema.parse(validState)
    expect(result.name).toBe('COMPLETED')
    expect(result.result?.name).toBe('SUCCESSFUL')
  })

  it('parses pending state without result', () => {
    const result = BitbucketPipelineStepStateSchema.parse({
      name: 'PENDING',
    })
    expect(result.name).toBe('PENDING')
    expect(result.result).toBeUndefined()
  })

  it('parses all valid state names', () => {
    const names = [
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'PAUSED',
      'HALTED',
    ] as const
    for (const name of names) {
      const result = BitbucketPipelineStepStateSchema.parse({ name })
      expect(result.name).toBe(name)
    }
  })

  it('rejects invalid state name', () => {
    expect(() =>
      BitbucketPipelineStepStateSchema.parse({ name: 'RUNNING' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketPipelineStepSchema
// ---------------------------------------------------------------------------

describe('BitbucketPipelineStepSchema', () => {
  it('parses a completed step', () => {
    const result = BitbucketPipelineStepSchema.parse(validStep)
    expect(result.uuid).toBe('{step-uuid-1}')
    expect(result.name).toBe('Build & Test')
    expect(result.state.name).toBe('COMPLETED')
    expect(result.state.result?.name).toBe('SUCCESSFUL')
    expect(result.started_on).toBe('2026-01-15T10:00:00Z')
    expect(result.completed_on).toBe('2026-01-15T10:05:00Z')
  })

  it('parses a step without name', () => {
    const { name: _, ...noName } = validStep
    const result = BitbucketPipelineStepSchema.parse(noName)
    expect(result.name).toBeUndefined()
  })

  it('accepts null timestamps for pending steps', () => {
    const result = BitbucketPipelineStepSchema.parse({
      uuid: '{step-2}',
      state: { name: 'PENDING' },
      started_on: null,
      completed_on: null,
    })
    expect(result.started_on).toBeNull()
    expect(result.completed_on).toBeNull()
  })

  it('accepts missing timestamps', () => {
    const result = BitbucketPipelineStepSchema.parse({
      uuid: '{step-3}',
      state: { name: 'IN_PROGRESS' },
    })
    expect(result.started_on).toBeUndefined()
    expect(result.completed_on).toBeUndefined()
  })

  it('rejects missing uuid', () => {
    const { uuid: _, ...noUuid } = validStep
    expect(() => BitbucketPipelineStepSchema.parse(noUuid)).toThrow()
  })

  it('rejects missing state', () => {
    expect(() =>
      BitbucketPipelineStepSchema.parse({
        uuid: '{step-4}',
        name: 'test',
      }),
    ).toThrow()
  })
})
