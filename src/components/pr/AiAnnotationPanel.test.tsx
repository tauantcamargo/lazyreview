import { describe, it, expect } from 'vitest'
import type { AiAnnotation, AiAnnotationSeverity } from '../../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// AiAnnotationPanel - Pure logic tests
//
// We test the pure helper functions used by the panel component.
// ---------------------------------------------------------------------------

// Replicate pure functions from AiAnnotationPanel for testing

function getSeverityBadge(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return 'INFO'
    case 'warning':
      return 'WARNING'
    case 'error':
      return 'ERROR'
  }
}

function getSeverityEmoji(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return '*'
    case 'warning':
      return '!'
    case 'error':
      return 'X'
  }
}

function hasSuggestion(annotation: AiAnnotation): boolean {
  return annotation.suggestion != null && annotation.suggestion.length > 0
}

function formatConvertHint(hasSuggestionText: boolean): string {
  return hasSuggestionText
    ? 'c: convert to comment with suggestion | Esc: close'
    : 'c: convert to comment | Esc: close'
}

function formatPanelTitle(annotation: AiAnnotation): string {
  return `${getSeverityEmoji(annotation.severity)} AI Annotation (line ${annotation.line})`
}

function shouldRenderPanel(isOpen: boolean, annotation: AiAnnotation | undefined): boolean {
  return isOpen && annotation != null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiAnnotationPanel logic', () => {
  // -------------------------------------------------------------------------
  // Severity badges
  // -------------------------------------------------------------------------

  describe('getSeverityBadge', () => {
    it('returns INFO for info severity', () => {
      expect(getSeverityBadge('info')).toBe('INFO')
    })

    it('returns WARNING for warning severity', () => {
      expect(getSeverityBadge('warning')).toBe('WARNING')
    })

    it('returns ERROR for error severity', () => {
      expect(getSeverityBadge('error')).toBe('ERROR')
    })
  })

  // -------------------------------------------------------------------------
  // Severity markers
  // -------------------------------------------------------------------------

  describe('getSeverityEmoji', () => {
    it('returns * for info', () => {
      expect(getSeverityEmoji('info')).toBe('*')
    })

    it('returns ! for warning', () => {
      expect(getSeverityEmoji('warning')).toBe('!')
    })

    it('returns X for error', () => {
      expect(getSeverityEmoji('error')).toBe('X')
    })
  })

  // -------------------------------------------------------------------------
  // Suggestion detection
  // -------------------------------------------------------------------------

  describe('hasSuggestion', () => {
    it('returns true when suggestion is present', () => {
      const annotation: AiAnnotation = {
        line: 5,
        severity: 'warning',
        message: 'Test',
        suggestion: 'Use try/catch',
      }
      expect(hasSuggestion(annotation)).toBe(true)
    })

    it('returns false when suggestion is undefined', () => {
      const annotation: AiAnnotation = {
        line: 5,
        severity: 'warning',
        message: 'Test',
      }
      expect(hasSuggestion(annotation)).toBe(false)
    })

    it('returns false when suggestion is empty string', () => {
      const annotation: AiAnnotation = {
        line: 5,
        severity: 'warning',
        message: 'Test',
        suggestion: '',
      }
      expect(hasSuggestion(annotation)).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Hints
  // -------------------------------------------------------------------------

  describe('formatConvertHint', () => {
    it('includes suggestion mention when has suggestion', () => {
      const hint = formatConvertHint(true)
      expect(hint).toContain('with suggestion')
      expect(hint).toContain('Esc: close')
    })

    it('omits suggestion mention when no suggestion', () => {
      const hint = formatConvertHint(false)
      expect(hint).toContain('convert to comment')
      expect(hint).not.toContain('with suggestion')
    })
  })

  // -------------------------------------------------------------------------
  // Panel title
  // -------------------------------------------------------------------------

  describe('formatPanelTitle', () => {
    it('includes severity marker and line number', () => {
      const title = formatPanelTitle({
        line: 42,
        severity: 'warning',
        message: 'Test',
      })
      expect(title).toContain('!')
      expect(title).toContain('42')
      expect(title).toContain('AI Annotation')
    })

    it('uses X for error severity', () => {
      const title = formatPanelTitle({
        line: 10,
        severity: 'error',
        message: 'Test',
      })
      expect(title).toContain('X')
    })

    it('uses * for info severity', () => {
      const title = formatPanelTitle({
        line: 1,
        severity: 'info',
        message: 'Test',
      })
      expect(title).toContain('*')
    })
  })

  // -------------------------------------------------------------------------
  // Render condition
  // -------------------------------------------------------------------------

  describe('shouldRenderPanel', () => {
    const annotation: AiAnnotation = {
      line: 5,
      severity: 'info',
      message: 'Test',
    }

    it('returns true when open and annotation is present', () => {
      expect(shouldRenderPanel(true, annotation)).toBe(true)
    })

    it('returns false when closed', () => {
      expect(shouldRenderPanel(false, annotation)).toBe(false)
    })

    it('returns false when annotation is undefined', () => {
      expect(shouldRenderPanel(true, undefined)).toBe(false)
    })

    it('returns false when both closed and no annotation', () => {
      expect(shouldRenderPanel(false, undefined)).toBe(false)
    })
  })
})
