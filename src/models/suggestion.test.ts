import { describe, it, expect } from 'vitest'
import {
  SuggestionParamsSchema,
  AcceptSuggestionParamsSchema,
  formatSuggestionBody,
  formatGitLabSuggestionBody,
  formatFallbackSuggestionBody,
  formatSuggestionForProvider,
  parseSuggestionBlock,
  hasSuggestionBlock,
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

describe('formatGitLabSuggestionBody', () => {
  it('wraps suggestion in GitLab syntax with body', () => {
    const result = formatGitLabSuggestionBody('Please fix this', 'const x = 1')
    expect(result).toBe(
      'Please fix this\n\n```suggestion:-0+0\nconst x = 1\n```',
    )
  })

  it('returns only code block when body is empty', () => {
    const result = formatGitLabSuggestionBody('', 'const x = 1')
    expect(result).toBe('```suggestion:-0+0\nconst x = 1\n```')
  })

  it('handles multi-line suggestions', () => {
    const suggestion = 'const x = 1\nconst y = 2'
    const result = formatGitLabSuggestionBody('Fix', suggestion)
    expect(result).toContain('```suggestion:-0+0\n')
    expect(result).toContain(suggestion)
    expect(result).toContain('\n```')
  })
})

describe('formatFallbackSuggestionBody', () => {
  it('formats as plain text with Suggested change prefix', () => {
    const result = formatFallbackSuggestionBody('Please update', 'const x = 1')
    expect(result).toContain('Please update')
    expect(result).toContain('**Suggested change:**')
    expect(result).toContain('const x = 1')
  })

  it('formats without body prefix when body is empty', () => {
    const result = formatFallbackSuggestionBody('', 'const x = 1')
    expect(result).toContain('**Suggested change:**')
    expect(result).toContain('const x = 1')
    expect(result).not.toMatch(/^\n/)
  })

  it('wraps suggestion in a code block', () => {
    const result = formatFallbackSuggestionBody('', 'const x = 1')
    expect(result).toContain('```\nconst x = 1\n```')
  })
})

describe('formatSuggestionForProvider', () => {
  it('uses GitHub format for github provider', () => {
    const result = formatSuggestionForProvider('github', 'fix', 'code')
    expect(result).toContain('```suggestion')
    expect(result).not.toContain('suggestion:-0+0')
  })

  it('uses GitLab format for gitlab provider', () => {
    const result = formatSuggestionForProvider('gitlab', 'fix', 'code')
    expect(result).toContain('```suggestion:-0+0')
  })

  it('uses fallback format for bitbucket provider', () => {
    const result = formatSuggestionForProvider('bitbucket', 'fix', 'code')
    expect(result).toContain('**Suggested change:**')
  })

  it('uses fallback format for azure provider', () => {
    const result = formatSuggestionForProvider('azure', 'fix', 'code')
    expect(result).toContain('**Suggested change:**')
  })

  it('uses fallback format for gitea provider', () => {
    const result = formatSuggestionForProvider('gitea', 'fix', 'code')
    expect(result).toContain('**Suggested change:**')
  })
})

describe('parseSuggestionBlock', () => {
  it('extracts suggestion from GitHub-style block', () => {
    const body = 'Some comment\n\n```suggestion\nconst x = 1\n```'
    const result = parseSuggestionBlock(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('Some comment')
  })

  it('extracts suggestion from GitLab-style block', () => {
    const body = 'Fix this\n\n```suggestion:-0+0\nconst x = 1\n```'
    const result = parseSuggestionBlock(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('Fix this')
  })

  it('handles multi-line suggestions', () => {
    const body = '```suggestion\nconst x = 1\nconst y = 2\nconst z = 3\n```'
    const result = parseSuggestionBlock(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1\nconst y = 2\nconst z = 3')
  })

  it('handles empty suggestion (line deletion)', () => {
    const body = 'Remove this line\n\n```suggestion\n\n```'
    const result = parseSuggestionBlock(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('')
    expect(result!.commentText).toBe('Remove this line')
  })

  it('returns null when no suggestion block exists', () => {
    const body = 'Just a regular comment with ```code``` blocks'
    const result = parseSuggestionBlock(body)
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSuggestionBlock('')).toBeNull()
  })

  it('handles suggestion with no preceding comment text', () => {
    const body = '```suggestion\nconst x = 1\n```'
    const result = parseSuggestionBlock(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('')
  })
})

describe('hasSuggestionBlock', () => {
  it('returns true for GitHub suggestion block', () => {
    expect(hasSuggestionBlock('text\n```suggestion\ncode\n```')).toBe(true)
  })

  it('returns true for GitLab suggestion block', () => {
    expect(hasSuggestionBlock('text\n```suggestion:-0+0\ncode\n```')).toBe(true)
  })

  it('returns false for regular code blocks', () => {
    expect(hasSuggestionBlock('text\n```typescript\ncode\n```')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(hasSuggestionBlock('just plain text')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasSuggestionBlock('')).toBe(false)
  })
})
