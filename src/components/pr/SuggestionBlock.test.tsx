import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { SuggestionBlock, extractSuggestionFromBody } from './SuggestionBlock'

describe('extractSuggestionFromBody', () => {
  it('extracts GitHub suggestion block', () => {
    const body = 'Fix this issue\n\n```suggestion\nconst x = 1\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('Fix this issue')
  })

  it('extracts GitLab suggestion block', () => {
    const body = 'Update code\n\n```suggestion:-0+0\nconst x = 1\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1')
    expect(result!.commentText).toBe('Update code')
  })

  it('handles multi-line suggestions', () => {
    const body = '```suggestion\nconst x = 1\nconst y = 2\nconst z = 3\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('const x = 1\nconst y = 2\nconst z = 3')
  })

  it('handles empty suggestion (line deletion)', () => {
    const body = 'Remove this\n\n```suggestion\n\n```'
    const result = extractSuggestionFromBody(body)
    expect(result).not.toBeNull()
    expect(result!.suggestion).toBe('')
  })

  it('returns null for regular comment', () => {
    const body = 'Just a regular comment with ```code``` blocks'
    expect(extractSuggestionFromBody(body)).toBeNull()
  })

  it('returns null for empty body', () => {
    expect(extractSuggestionFromBody('')).toBeNull()
  })
})

describe('SuggestionBlock', () => {
  it('renders suggestion header', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={false}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('Suggestion')
  })

  it('renders suggested code', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={false}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('const x = 1')
  })

  it('renders original code with deletion marker', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={false}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('const x = 0')
  })

  it('renders accept hint when focused and canAccept is true', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={true}
        canAccept={true}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('a: accept')
  })

  it('does not render accept hint when canAccept is false', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={true}
        canAccept={false}
      />,
    )
    const output = lastFrame()
    expect(output).not.toContain('a: accept')
  })

  it('does not render accept hint when not focused', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion="const x = 1"
        originalCode="const x = 0"
        isFocused={false}
        canAccept={true}
      />,
    )
    const output = lastFrame()
    expect(output).not.toContain('a: accept')
  })

  it('renders deletion suggestion (empty replacement)', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion=""
        originalCode="const x = 0"
        isFocused={false}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('const x = 0')
    expect(output).toContain('(delete')
  })

  it('renders multi-line suggestion with all lines', () => {
    const { lastFrame } = render(
      <SuggestionBlock
        suggestion={'const x = 1\nconst y = 2'}
        originalCode={'const x = 0\nconst y = 0'}
        isFocused={false}
      />,
    )
    const output = lastFrame()
    expect(output).toContain('const x = 1')
    expect(output).toContain('const y = 2')
  })
})
