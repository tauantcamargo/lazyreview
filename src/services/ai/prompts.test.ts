import { describe, it, expect } from 'vitest'
import {
  buildLineReviewPrompt,
  determineLineContext,
  type LineReviewPromptParams,
} from './prompts'

describe('buildLineReviewPrompt', () => {
  const baseParams: LineReviewPromptParams = {
    code: 'const x = 1',
    filename: 'src/utils/math.ts',
    language: 'typescript',
    context: 'added',
  }

  it('returns a system message and a user message', () => {
    const messages = buildLineReviewPrompt(baseParams)
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
  })

  it('system message instructs structured review with sections', () => {
    const messages = buildLineReviewPrompt(baseParams)
    const system = messages[0]!.content
    expect(system).toContain('## Summary')
    expect(system).toContain('## Issues')
    expect(system).toContain('## Suggestions')
  })

  it('user message contains the code in a fenced block', () => {
    const messages = buildLineReviewPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('```typescript')
    expect(user).toContain('const x = 1')
    expect(user).toContain('```')
  })

  it('user message contains filename and language', () => {
    const messages = buildLineReviewPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('File: src/utils/math.ts')
    expect(user).toContain('Language: typescript')
  })

  it('user message describes context for added lines', () => {
    const messages = buildLineReviewPrompt({ ...baseParams, context: 'added' })
    const user = messages[1]!.content
    expect(user).toContain('added in the pull request')
  })

  it('user message describes context for removed lines', () => {
    const messages = buildLineReviewPrompt({ ...baseParams, context: 'removed' })
    const user = messages[1]!.content
    expect(user).toContain('removed in the pull request')
  })

  it('user message describes context for unchanged lines', () => {
    const messages = buildLineReviewPrompt({ ...baseParams, context: 'unchanged' })
    const user = messages[1]!.content
    expect(user).toContain('unchanged context')
  })

  it('user message describes context for mixed lines', () => {
    const messages = buildLineReviewPrompt({ ...baseParams, context: 'mixed' })
    const user = messages[1]!.content
    expect(user).toContain('both added and removed')
  })

  it('includes PR title when provided', () => {
    const messages = buildLineReviewPrompt({
      ...baseParams,
      prTitle: 'Fix authentication bug',
    })
    const user = messages[1]!.content
    expect(user).toContain('PR Title: Fix authentication bug')
  })

  it('includes PR description when provided', () => {
    const messages = buildLineReviewPrompt({
      ...baseParams,
      prDescription: 'This fixes the login flow',
    })
    const user = messages[1]!.content
    expect(user).toContain('PR Description: This fixes the login flow')
  })

  it('truncates long PR descriptions to 500 chars', () => {
    const longDesc = 'a'.repeat(600)
    const messages = buildLineReviewPrompt({
      ...baseParams,
      prDescription: longDesc,
    })
    const user = messages[1]!.content
    expect(user).toContain('a'.repeat(500) + '...')
    expect(user).not.toContain('a'.repeat(501))
  })

  it('omits PR title and description when not provided', () => {
    const messages = buildLineReviewPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).not.toContain('PR Title:')
    expect(user).not.toContain('PR Description:')
  })

  it('handles multi-line code snippets', () => {
    const multiLineCode = 'function add(a: number, b: number): number {\n  return a + b\n}'
    const messages = buildLineReviewPrompt({
      ...baseParams,
      code: multiLineCode,
    })
    const user = messages[1]!.content
    expect(user).toContain('function add(a: number, b: number): number {')
    expect(user).toContain('return a + b')
  })

  it('returns immutable message array', () => {
    const messages = buildLineReviewPrompt(baseParams)
    expect(Object.isFrozen(messages)).toBe(true)
  })
})

describe('determineLineContext', () => {
  it('returns added when only add lines', () => {
    expect(determineLineContext(new Set(['add']))).toBe('added')
  })

  it('returns removed when only del lines', () => {
    expect(determineLineContext(new Set(['del']))).toBe('removed')
  })

  it('returns unchanged when only context lines', () => {
    expect(determineLineContext(new Set(['context']))).toBe('unchanged')
  })

  it('returns mixed when both add and del lines', () => {
    expect(determineLineContext(new Set(['add', 'del']))).toBe('mixed')
  })

  it('returns mixed when add, del, and context lines', () => {
    expect(determineLineContext(new Set(['add', 'del', 'context']))).toBe('mixed')
  })

  it('returns added when add and context lines', () => {
    expect(determineLineContext(new Set(['add', 'context']))).toBe('added')
  })

  it('returns removed when del and context lines', () => {
    expect(determineLineContext(new Set(['del', 'context']))).toBe('removed')
  })

  it('returns mixed for empty set', () => {
    expect(determineLineContext(new Set())).toBe('mixed')
  })

  it('ignores header lines', () => {
    expect(determineLineContext(new Set(['header', 'add']))).toBe('added')
  })
})
