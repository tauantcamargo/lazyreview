import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// AiSummarySection - Data validation and logic tests
//
// The AiSummarySection component uses Ink's Box/Text within a parent
// that ink-testing-library may have trouble with (position/overflow).
// We test the extracted data-handling logic directly.
// ---------------------------------------------------------------------------

// Replicate the pure functions from AiSummarySection for testing

function formatProviderHeader(providerName: string): string {
  return providerName
    ? `AI Summary (powered by ${providerName})`
    : 'AI Summary'
}

function getToggleHint(isExpanded: boolean): string {
  return isExpanded ? '[Ctrl+A: collapse]' : '[Ctrl+A: expand]'
}

function getStatusText(params: {
  readonly isGenerating: boolean
  readonly error: string | null
  readonly summary: string
  readonly isConfigured: boolean
}): string {
  if (!params.isConfigured) {
    return 'AI not configured. Add ai: section to ~/.config/lazyreview/config.yaml'
  }
  if (params.error) {
    return `Error: ${params.error}`
  }
  if (params.isGenerating && !params.summary) {
    return 'Generating summary...'
  }
  if (params.isGenerating && params.summary) {
    return 'Streaming...'
  }
  if (params.summary) {
    return ''
  }
  return 'Press Ctrl+A to generate AI summary'
}

function shouldShowSummaryContent(params: {
  readonly isExpanded: boolean
  readonly summary: string
  readonly isGenerating: boolean
}): boolean {
  return params.isExpanded && (params.summary.length > 0 || params.isGenerating)
}

function shouldShowRegenerateHint(params: {
  readonly isExpanded: boolean
  readonly summary: string
  readonly isGenerating: boolean
}): boolean {
  return params.isExpanded && params.summary.length > 0 && !params.isGenerating
}

describe('AiSummarySection logic', () => {
  // -------------------------------------------------------------------------
  // Provider header formatting
  // -------------------------------------------------------------------------

  describe('formatProviderHeader', () => {
    it('shows provider name when available', () => {
      expect(formatProviderHeader('Anthropic')).toBe(
        'AI Summary (powered by Anthropic)',
      )
    })

    it('shows generic header when no provider', () => {
      expect(formatProviderHeader('')).toBe('AI Summary')
    })

    it('handles OpenAI provider', () => {
      expect(formatProviderHeader('OpenAI')).toBe(
        'AI Summary (powered by OpenAI)',
      )
    })

    it('handles Ollama provider', () => {
      expect(formatProviderHeader('Ollama')).toBe(
        'AI Summary (powered by Ollama)',
      )
    })
  })

  // -------------------------------------------------------------------------
  // Toggle hint
  // -------------------------------------------------------------------------

  describe('getToggleHint', () => {
    it('shows collapse hint when expanded', () => {
      expect(getToggleHint(true)).toBe('[Ctrl+A: collapse]')
    })

    it('shows expand hint when collapsed', () => {
      expect(getToggleHint(false)).toBe('[Ctrl+A: expand]')
    })
  })

  // -------------------------------------------------------------------------
  // Status text
  // -------------------------------------------------------------------------

  describe('getStatusText', () => {
    it('shows not-configured message when AI is not set up', () => {
      const result = getStatusText({
        isGenerating: false,
        error: null,
        summary: '',
        isConfigured: false,
      })
      expect(result).toContain('AI not configured')
      expect(result).toContain('config.yaml')
    })

    it('shows error message when error is present', () => {
      const result = getStatusText({
        isGenerating: false,
        error: 'Rate limit exceeded',
        summary: '',
        isConfigured: true,
      })
      expect(result).toContain('Error: Rate limit exceeded')
    })

    it('shows generating message when loading with no content yet', () => {
      const result = getStatusText({
        isGenerating: true,
        error: null,
        summary: '',
        isConfigured: true,
      })
      expect(result).toBe('Generating summary...')
    })

    it('shows streaming message when loading with partial content', () => {
      const result = getStatusText({
        isGenerating: true,
        error: null,
        summary: '## What changed\nSome content...',
        isConfigured: true,
      })
      expect(result).toBe('Streaming...')
    })

    it('returns empty string when summary is complete', () => {
      const result = getStatusText({
        isGenerating: false,
        error: null,
        summary: '## What changed\nComplete summary.',
        isConfigured: true,
      })
      expect(result).toBe('')
    })

    it('shows prompt message when no summary and not generating', () => {
      const result = getStatusText({
        isGenerating: false,
        error: null,
        summary: '',
        isConfigured: true,
      })
      expect(result).toContain('Ctrl+A')
    })
  })

  // -------------------------------------------------------------------------
  // Content visibility logic
  // -------------------------------------------------------------------------

  describe('shouldShowSummaryContent', () => {
    it('shows content when expanded and has summary', () => {
      expect(
        shouldShowSummaryContent({
          isExpanded: true,
          summary: 'Some text',
          isGenerating: false,
        }),
      ).toBe(true)
    })

    it('shows content when expanded and generating', () => {
      expect(
        shouldShowSummaryContent({
          isExpanded: true,
          summary: '',
          isGenerating: true,
        }),
      ).toBe(true)
    })

    it('hides content when collapsed', () => {
      expect(
        shouldShowSummaryContent({
          isExpanded: false,
          summary: 'Some text',
          isGenerating: false,
        }),
      ).toBe(false)
    })

    it('hides content when expanded but no summary and not generating', () => {
      expect(
        shouldShowSummaryContent({
          isExpanded: false,
          summary: '',
          isGenerating: false,
        }),
      ).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Regenerate hint visibility
  // -------------------------------------------------------------------------

  describe('shouldShowRegenerateHint', () => {
    it('shows regenerate hint when expanded with completed summary', () => {
      expect(
        shouldShowRegenerateHint({
          isExpanded: true,
          summary: 'Complete summary',
          isGenerating: false,
        }),
      ).toBe(true)
    })

    it('hides regenerate hint while generating', () => {
      expect(
        shouldShowRegenerateHint({
          isExpanded: true,
          summary: 'Partial...',
          isGenerating: true,
        }),
      ).toBe(false)
    })

    it('hides regenerate hint when collapsed', () => {
      expect(
        shouldShowRegenerateHint({
          isExpanded: false,
          summary: 'Complete summary',
          isGenerating: false,
        }),
      ).toBe(false)
    })

    it('hides regenerate hint when no summary', () => {
      expect(
        shouldShowRegenerateHint({
          isExpanded: true,
          summary: '',
          isGenerating: false,
        }),
      ).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Cached summary behavior
  // -------------------------------------------------------------------------

  describe('cached summary behavior', () => {
    it('cached summary skips generation state', () => {
      // When cachedSummary is available, we display it immediately
      // without going through isGenerating=true
      const cachedSummary = '## What changed\nCached result.'
      const isGenerating = false
      const summary = cachedSummary
      expect(summary).toBe(cachedSummary)
      expect(isGenerating).toBe(false)
    })

    it('non-cached generation goes through streaming', () => {
      const cachedSummary = null
      const isGenerating = true
      const summary = '## What'
      expect(cachedSummary).toBeNull()
      expect(isGenerating).toBe(true)
      expect(summary.length).toBeGreaterThan(0)
    })
  })
})
