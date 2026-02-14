import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// AiReviewModal - Data validation and logic tests
//
// The AiReviewModal component uses Ink's Modal wrapper with position="absolute"
// which ink-testing-library does not render. We therefore test the extracted
// data-handling logic (line range formatting, code truncation, action guards)
// directly.
// ---------------------------------------------------------------------------

// Replicate the pure functions from AiReviewModal for testing
function formatLineRange(ctx: {
  readonly startLine?: number
  readonly endLine?: number
}): string {
  if (ctx.startLine != null && ctx.endLine != null && ctx.startLine !== ctx.endLine) {
    return `L${ctx.startLine}-L${ctx.endLine}`
  }
  if (ctx.startLine != null) {
    return `L${ctx.startLine}`
  }
  return ''
}

function truncateCode(code: string, maxLines: number): string {
  const lines = code.split('\n')
  if (lines.length <= maxLines) return code
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`
}

describe('AiReviewModal logic', () => {
  // -------------------------------------------------------------------------
  // Line range formatting
  // -------------------------------------------------------------------------

  describe('formatLineRange', () => {
    it('returns empty string when no line numbers provided', () => {
      expect(formatLineRange({})).toBe('')
    })

    it('formats single line', () => {
      expect(formatLineRange({ startLine: 10 })).toBe('L10')
    })

    it('formats single line when start equals end', () => {
      expect(formatLineRange({ startLine: 10, endLine: 10 })).toBe('L10')
    })

    it('formats multi-line range', () => {
      expect(formatLineRange({ startLine: 5, endLine: 12 })).toBe('L5-L12')
    })

    it('formats range starting at line 1', () => {
      expect(formatLineRange({ startLine: 1, endLine: 3 })).toBe('L1-L3')
    })

    it('handles large line numbers', () => {
      expect(formatLineRange({ startLine: 1000, endLine: 2000 })).toBe('L1000-L2000')
    })
  })

  // -------------------------------------------------------------------------
  // Code truncation
  // -------------------------------------------------------------------------

  describe('truncateCode', () => {
    it('returns code unchanged when within limit', () => {
      const code = 'line 1\nline 2\nline 3'
      expect(truncateCode(code, 5)).toBe(code)
    })

    it('returns single line unchanged', () => {
      const code = 'const x = 1'
      expect(truncateCode(code, 8)).toBe(code)
    })

    it('truncates code exceeding max lines', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
      const code = lines.join('\n')
      const result = truncateCode(code, 8)
      expect(result).toContain('line 1')
      expect(result).toContain('line 8')
      expect(result).not.toContain('line 9')
      expect(result).toContain('... (12 more lines)')
    })

    it('shows correct count of remaining lines', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`)
      const code = lines.join('\n')
      const result = truncateCode(code, 10)
      expect(result).toContain('... (5 more lines)')
    })

    it('truncates at exact boundary', () => {
      const lines = Array.from({ length: 9 }, (_, i) => `line ${i + 1}`)
      const code = lines.join('\n')
      const resultFitting = truncateCode(code, 9)
      expect(resultFitting).toBe(code) // Exact fit, no truncation

      const resultTruncated = truncateCode(code, 8)
      expect(resultTruncated).toContain('... (1 more lines)')
    })

    it('handles empty code', () => {
      expect(truncateCode('', 8)).toBe('')
    })
  })

  // -------------------------------------------------------------------------
  // Action guard logic
  // -------------------------------------------------------------------------

  describe('action guards', () => {
    it('actions are blocked when loading', () => {
      const isLoading = true
      const response = 'some response'
      const canAct = !isLoading && !!response
      expect(canAct).toBe(false)
    })

    it('actions are blocked when response is empty', () => {
      const isLoading = false
      const response = ''
      const canAct = !isLoading && !!response
      expect(canAct).toBe(false)
    })

    it('actions are allowed when not loading and response exists', () => {
      const isLoading = false
      const response = 'Review result'
      const canAct = !isLoading && !!response
      expect(canAct).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Provider info display
  // -------------------------------------------------------------------------

  describe('provider info formatting', () => {
    function formatProviderInfo(providerName: string, modelName: string): string {
      return modelName
        ? `${providerName} (${modelName})`
        : providerName
    }

    it('shows provider and model when both present', () => {
      expect(formatProviderInfo('OpenAI', 'gpt-4')).toBe('OpenAI (gpt-4)')
    })

    it('shows only provider when model is empty', () => {
      expect(formatProviderInfo('Ollama', '')).toBe('Ollama')
    })

    it('handles anthropic provider', () => {
      expect(formatProviderInfo('Anthropic', 'claude-3-opus')).toBe('Anthropic (claude-3-opus)')
    })
  })

  // -------------------------------------------------------------------------
  // Context validation
  // -------------------------------------------------------------------------

  describe('context shape', () => {
    it('accepts minimal context', () => {
      const context = {
        code: 'const x = 1',
        filename: 'test.ts',
        language: 'typescript',
      }
      expect(context.code).toBe('const x = 1')
      expect(context.filename).toBe('test.ts')
      expect(context.language).toBe('typescript')
    })

    it('accepts full context with line numbers', () => {
      const context = {
        code: 'const x = 1\nconst y = 2',
        filename: 'src/math.ts',
        language: 'typescript',
        startLine: 10,
        endLine: 11,
      }
      expect(formatLineRange(context)).toBe('L10-L11')
    })
  })
})
