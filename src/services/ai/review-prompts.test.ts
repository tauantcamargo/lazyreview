import { describe, it, expect } from 'vitest'
import {
  buildDiffAnalysisPrompt,
  parseAiAnnotations,
  type AiAnnotation,
} from './review-prompts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const sampleDiff = `@@ -10,7 +10,8 @@
 import { useEffect } from 'react'

-export function fetchData(url) {
+export function fetchData(url: string) {
+  if (!url) throw new Error('URL required')
   const response = await fetch(url)
   return response.json()
 }`

const emptyDiff = ''

const sampleValidResponse = JSON.stringify([
  {
    line: 12,
    severity: 'warning',
    message: 'Missing error handling for fetch failure',
    suggestion: 'Wrap the fetch call in a try/catch block',
  },
  {
    line: 13,
    severity: 'info',
    message: 'Consider validating the response status code',
  },
])

const sampleErrorAnnotations = JSON.stringify([
  {
    line: 5,
    severity: 'error',
    message: 'SQL injection vulnerability detected',
    suggestion: 'Use parameterized queries instead of string concatenation',
  },
])

// ---------------------------------------------------------------------------
// buildDiffAnalysisPrompt
// ---------------------------------------------------------------------------

describe('buildDiffAnalysisPrompt', () => {
  it('returns a system message and a user message', () => {
    const messages = buildDiffAnalysisPrompt('src/utils/fetch.ts', sampleDiff)
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
  })

  it('system message instructs JSON array response format', () => {
    const messages = buildDiffAnalysisPrompt('src/utils/fetch.ts', sampleDiff)
    const system = messages[0]!.content
    expect(system).toContain('JSON')
    expect(system).toContain('line')
    expect(system).toContain('severity')
    expect(system).toContain('message')
  })

  it('system message mentions severity levels', () => {
    const messages = buildDiffAnalysisPrompt('src/utils/fetch.ts', sampleDiff)
    const system = messages[0]!.content
    expect(system).toContain('info')
    expect(system).toContain('warning')
    expect(system).toContain('error')
  })

  it('user message includes the filename', () => {
    const messages = buildDiffAnalysisPrompt('src/utils/fetch.ts', sampleDiff)
    const user = messages[1]!.content
    expect(user).toContain('src/utils/fetch.ts')
  })

  it('user message includes the diff content', () => {
    const messages = buildDiffAnalysisPrompt('src/utils/fetch.ts', sampleDiff)
    const user = messages[1]!.content
    expect(user).toContain('fetchData')
    expect(user).toContain('response.json()')
  })

  it('handles empty diff gracefully', () => {
    const messages = buildDiffAnalysisPrompt('empty.ts', emptyDiff)
    expect(messages).toHaveLength(2)
    const user = messages[1]!.content
    expect(user).toContain('empty.ts')
  })

  it('returns immutable message array', () => {
    const messages = buildDiffAnalysisPrompt('test.ts', sampleDiff)
    expect(Object.isFrozen(messages)).toBe(true)
  })

  it('truncates very large diffs', () => {
    const largeDiff = 'x'.repeat(50000)
    const messages = buildDiffAnalysisPrompt('large.ts', largeDiff)
    const user = messages[1]!.content
    expect(user.length).toBeLessThan(50000)
    expect(user).toContain('truncated')
  })
})

// ---------------------------------------------------------------------------
// parseAiAnnotations
// ---------------------------------------------------------------------------

describe('parseAiAnnotations', () => {
  it('parses valid JSON response into annotations', () => {
    const annotations = parseAiAnnotations(sampleValidResponse)
    expect(annotations).toHaveLength(2)
    expect(annotations[0]).toEqual({
      line: 12,
      severity: 'warning',
      message: 'Missing error handling for fetch failure',
      suggestion: 'Wrap the fetch call in a try/catch block',
    })
    expect(annotations[1]).toEqual({
      line: 13,
      severity: 'info',
      message: 'Consider validating the response status code',
      suggestion: undefined,
    })
  })

  it('parses error severity annotations', () => {
    const annotations = parseAiAnnotations(sampleErrorAnnotations)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.severity).toBe('error')
    expect(annotations[0]!.suggestion).toBe(
      'Use parameterized queries instead of string concatenation',
    )
  })

  it('returns empty array for malformed JSON', () => {
    const annotations = parseAiAnnotations('not valid json at all')
    expect(annotations).toEqual([])
  })

  it('returns empty array for empty string', () => {
    const annotations = parseAiAnnotations('')
    expect(annotations).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    const annotations = parseAiAnnotations('{"line": 1, "message": "test"}')
    expect(annotations).toEqual([])
  })

  it('filters out annotations with missing required fields', () => {
    const response = JSON.stringify([
      { line: 1, severity: 'info', message: 'Good annotation' },
      { severity: 'warning', message: 'Missing line number' },
      { line: 3, message: 'Missing severity' },
      { line: 4, severity: 'info' },
    ])
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.line).toBe(1)
  })

  it('filters out annotations with invalid severity', () => {
    const response = JSON.stringify([
      { line: 1, severity: 'critical', message: 'Bad severity' },
      { line: 2, severity: 'info', message: 'Valid' },
    ])
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.severity).toBe('info')
  })

  it('handles multiple valid annotations', () => {
    const response = JSON.stringify([
      { line: 1, severity: 'info', message: 'First' },
      { line: 5, severity: 'warning', message: 'Second', suggestion: 'Fix it' },
      { line: 10, severity: 'error', message: 'Third' },
    ])
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(3)
    expect(annotations.map((a) => a.severity)).toEqual(['info', 'warning', 'error'])
  })

  it('extracts JSON array from markdown code fences', () => {
    const response = `Here are the issues I found:

\`\`\`json
[
  {"line": 5, "severity": "warning", "message": "Missing null check"}
]
\`\`\`

These are the annotations.`
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.line).toBe(5)
    expect(annotations[0]!.message).toBe('Missing null check')
  })

  it('handles response with surrounding text and bare JSON', () => {
    const response = `I found these issues:
[{"line": 3, "severity": "info", "message": "Consider refactoring"}]
End of analysis.`
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.line).toBe(3)
  })

  it('coerces line numbers that are strings to numbers', () => {
    const response = JSON.stringify([
      { line: '7', severity: 'info', message: 'String line number' },
    ])
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.line).toBe(7)
  })

  it('filters out annotations with non-positive line numbers', () => {
    const response = JSON.stringify([
      { line: 0, severity: 'info', message: 'Zero line' },
      { line: -1, severity: 'info', message: 'Negative line' },
      { line: 5, severity: 'info', message: 'Valid line' },
    ])
    const annotations = parseAiAnnotations(response)
    expect(annotations).toHaveLength(1)
    expect(annotations[0]!.line).toBe(5)
  })
})
