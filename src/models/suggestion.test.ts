import { describe, it, expect } from 'vitest'
import {
  SuggestionParamsSchema,
  AcceptSuggestionParamsSchema,
  formatSuggestionBody,
} from './suggestion'

describe('SuggestionParamsSchema', () => {
  it('parses valid suggestion params', () => {
    const input = {
      prNumber: 42,
      body: 'Consider this change',
      path: 'src/index.ts',
      line: 10,
      side: 'RIGHT',
      suggestion: 'const x = 1',
    }
    const result = SuggestionParamsSchema.parse(input)
    expect(result.prNumber).toBe(42)
    expect(result.body).toBe('Consider this change')
    expect(result.path).toBe('src/index.ts')
    expect(result.line).toBe(10)
    expect(result.side).toBe('RIGHT')
    expect(result.suggestion).toBe('const x = 1')
  })

  it('parses with optional startLine and commitId', () => {
    const input = {
      prNumber: 42,
      body: '',
      path: 'src/index.ts',
      line: 15,
      side: 'LEFT',
      suggestion: 'const y = 2',
      startLine: 10,
      commitId: 'abc123',
    }
    const result = SuggestionParamsSchema.parse(input)
    expect(result.startLine).toBe(10)
    expect(result.commitId).toBe('abc123')
  })

  it('rejects invalid side', () => {
    const input = {
      prNumber: 42,
      body: '',
      path: 'src/index.ts',
      line: 10,
      side: 'CENTER',
      suggestion: 'code',
    }
    expect(() => SuggestionParamsSchema.parse(input)).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => SuggestionParamsSchema.parse({})).toThrow()
    expect(() =>
      SuggestionParamsSchema.parse({ prNumber: 1, body: '', path: '' }),
    ).toThrow()
  })
})

describe('AcceptSuggestionParamsSchema', () => {
  it('parses valid accept params', () => {
    const input = {
      prNumber: 42,
      commentId: 123,
    }
    const result = AcceptSuggestionParamsSchema.parse(input)
    expect(result.prNumber).toBe(42)
    expect(result.commentId).toBe(123)
  })

  it('parses with optional commitMessage', () => {
    const input = {
      prNumber: 42,
      commentId: 123,
      commitMessage: 'Apply suggestion',
    }
    const result = AcceptSuggestionParamsSchema.parse(input)
    expect(result.commitMessage).toBe('Apply suggestion')
  })

  it('rejects missing required fields', () => {
    expect(() => AcceptSuggestionParamsSchema.parse({})).toThrow()
    expect(() =>
      AcceptSuggestionParamsSchema.parse({ prNumber: 1 }),
    ).toThrow()
  })
})

describe('formatSuggestionBody', () => {
  it('wraps suggestion in code block with body', () => {
    const result = formatSuggestionBody('Please fix this', 'const x = 1')
    expect(result).toBe(
      'Please fix this\n\n```suggestion\nconst x = 1\n```',
    )
  })

  it('returns only code block when body is empty', () => {
    const result = formatSuggestionBody('', 'const x = 1')
    expect(result).toBe('```suggestion\nconst x = 1\n```')
  })

  it('handles multi-line suggestions', () => {
    const suggestion = 'const x = 1\nconst y = 2\nconst z = 3'
    const result = formatSuggestionBody('Multi-line fix', suggestion)
    expect(result).toContain('```suggestion\n')
    expect(result).toContain('const x = 1\nconst y = 2\nconst z = 3')
    expect(result).toContain('\n```')
  })

  it('handles empty suggestion', () => {
    const result = formatSuggestionBody('Remove this line', '')
    expect(result).toBe('Remove this line\n\n```suggestion\n\n```')
  })
})
