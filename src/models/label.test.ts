import { describe, it, expect } from 'vitest'
import { RepoLabelSchema, RepoLabelsSchema } from './label'
import type { RepoLabel } from './label'

describe('RepoLabelSchema', () => {
  it('parses a valid label', () => {
    const input = {
      id: 1,
      name: 'bug',
      color: 'fc2929',
      description: 'Something is broken',
      default: false,
    }
    const result = RepoLabelSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('uses default null for missing description', () => {
    const input = {
      id: 2,
      name: 'feature',
      color: '0075ca',
    }
    const result = RepoLabelSchema.parse(input)
    expect(result.description).toBeNull()
    expect(result.default).toBe(false)
  })

  it('accepts null description', () => {
    const input = {
      id: 3,
      name: 'docs',
      color: 'e4e669',
      description: null,
      default: true,
    }
    const result = RepoLabelSchema.parse(input)
    expect(result.description).toBeNull()
    expect(result.default).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(() => RepoLabelSchema.parse({ name: 'bug' })).toThrow()
    expect(() => RepoLabelSchema.parse({ id: 1, color: 'fff' })).toThrow()
    expect(() => RepoLabelSchema.parse({ id: 1, name: 'bug' })).toThrow()
  })

  it('rejects non-number id', () => {
    expect(() =>
      RepoLabelSchema.parse({
        id: 'abc',
        name: 'bug',
        color: 'fc2929',
      }),
    ).toThrow()
  })

  it('rejects non-string name', () => {
    expect(() =>
      RepoLabelSchema.parse({
        id: 1,
        name: 123,
        color: 'fc2929',
      }),
    ).toThrow()
  })
})

describe('RepoLabelsSchema', () => {
  it('parses an array of labels', () => {
    const input = [
      { id: 1, name: 'bug', color: 'fc2929', description: 'Broken', default: false },
      { id: 2, name: 'feature', color: '0075ca', description: null, default: false },
    ]
    const result = RepoLabelsSchema.parse(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('bug')
    expect(result[1]!.name).toBe('feature')
  })

  it('parses empty array', () => {
    const result = RepoLabelsSchema.parse([])
    expect(result).toHaveLength(0)
  })

  it('rejects non-array', () => {
    expect(() => RepoLabelsSchema.parse('not an array')).toThrow()
  })

  it('rejects array with invalid items', () => {
    expect(() =>
      RepoLabelsSchema.parse([{ invalid: true }]),
    ).toThrow()
  })
})

describe('RepoLabel type', () => {
  it('allows typed access to all fields', () => {
    const label: RepoLabel = {
      id: 1,
      name: 'bug',
      color: 'fc2929',
      description: 'Something is broken',
      default: false,
    }
    expect(label.id).toBe(1)
    expect(label.name).toBe('bug')
    expect(label.color).toBe('fc2929')
    expect(label.description).toBe('Something is broken')
    expect(label.default).toBe(false)
  })
})
