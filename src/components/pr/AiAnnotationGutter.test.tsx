import { describe, it, expect } from 'vitest'
import type { AiAnnotation, AiAnnotationSeverity } from '../../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// AiAnnotationGutter - Pure logic tests
//
// We test the pure helper functions that drive the gutter rendering.
// The component itself uses Ink Box/Text which is tested via layout tests.
// ---------------------------------------------------------------------------

// Replicate pure functions from AiAnnotationGutter for testing

function getMarkerChar(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return '*'
    case 'warning':
      return '!'
    case 'error':
      return 'X'
  }
}

function getAnnotationForLine(
  annotations: readonly AiAnnotation[],
  lineNumber: number,
): AiAnnotation | undefined {
  return annotations.find((a) => a.line === lineNumber)
}

function getAnnotationsByLine(
  annotations: readonly AiAnnotation[],
): ReadonlyMap<number, AiAnnotation> {
  const map = new Map<number, AiAnnotation>()
  for (const annotation of annotations) {
    // First annotation per line wins (highest priority is first in the array)
    if (!map.has(annotation.line)) {
      map.set(annotation.line, annotation)
    }
  }
  return map
}

function shouldShowExpanded(
  annotation: AiAnnotation | undefined,
  currentLine: number,
  annotationLine: number,
): boolean {
  if (!annotation) return false
  return currentLine === annotationLine
}

function formatAnnotationPreview(annotation: AiAnnotation): string {
  return `[${annotation.severity.toUpperCase()}] ${annotation.message}`
}

function getAnnotatedLineNumbers(
  annotations: readonly AiAnnotation[],
): readonly number[] {
  return annotations.map((a) => a.line)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiAnnotationGutter logic', () => {
  // -------------------------------------------------------------------------
  // Marker characters
  // -------------------------------------------------------------------------

  describe('getMarkerChar', () => {
    it('returns * for info severity', () => {
      expect(getMarkerChar('info')).toBe('*')
    })

    it('returns ! for warning severity', () => {
      expect(getMarkerChar('warning')).toBe('!')
    })

    it('returns X for error severity', () => {
      expect(getMarkerChar('error')).toBe('X')
    })
  })

  // -------------------------------------------------------------------------
  // Annotation lookup
  // -------------------------------------------------------------------------

  describe('getAnnotationForLine', () => {
    const annotations: AiAnnotation[] = [
      { line: 5, severity: 'info', message: 'Consider docs' },
      { line: 12, severity: 'warning', message: 'Missing error handling' },
      { line: 20, severity: 'error', message: 'Security issue' },
    ]

    it('returns the annotation for a matching line', () => {
      const result = getAnnotationForLine(annotations, 12)
      expect(result).toBeDefined()
      expect(result!.severity).toBe('warning')
      expect(result!.message).toBe('Missing error handling')
    })

    it('returns undefined for a non-annotated line', () => {
      const result = getAnnotationForLine(annotations, 7)
      expect(result).toBeUndefined()
    })

    it('returns undefined for empty annotations', () => {
      const result = getAnnotationForLine([], 5)
      expect(result).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Annotation map
  // -------------------------------------------------------------------------

  describe('getAnnotationsByLine', () => {
    it('builds a map from annotations', () => {
      const annotations: AiAnnotation[] = [
        { line: 1, severity: 'info', message: 'First' },
        { line: 5, severity: 'warning', message: 'Second' },
      ]
      const map = getAnnotationsByLine(annotations)
      expect(map.size).toBe(2)
      expect(map.get(1)!.message).toBe('First')
      expect(map.get(5)!.message).toBe('Second')
    })

    it('first annotation wins for duplicate lines', () => {
      const annotations: AiAnnotation[] = [
        { line: 5, severity: 'error', message: 'First (wins)' },
        { line: 5, severity: 'info', message: 'Second (ignored)' },
      ]
      const map = getAnnotationsByLine(annotations)
      expect(map.size).toBe(1)
      expect(map.get(5)!.message).toBe('First (wins)')
    })

    it('returns empty map for empty annotations', () => {
      const map = getAnnotationsByLine([])
      expect(map.size).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Expanded state
  // -------------------------------------------------------------------------

  describe('shouldShowExpanded', () => {
    const annotation: AiAnnotation = {
      line: 10,
      severity: 'warning',
      message: 'Test',
    }

    it('returns true when current line matches annotation line', () => {
      expect(shouldShowExpanded(annotation, 10, 10)).toBe(true)
    })

    it('returns false when current line does not match', () => {
      expect(shouldShowExpanded(annotation, 5, 10)).toBe(false)
    })

    it('returns false when annotation is undefined', () => {
      expect(shouldShowExpanded(undefined, 10, 10)).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Annotation preview formatting
  // -------------------------------------------------------------------------

  describe('formatAnnotationPreview', () => {
    it('formats info annotation', () => {
      const result = formatAnnotationPreview({
        line: 1,
        severity: 'info',
        message: 'Consider adding docs',
      })
      expect(result).toBe('[INFO] Consider adding docs')
    })

    it('formats warning annotation', () => {
      const result = formatAnnotationPreview({
        line: 5,
        severity: 'warning',
        message: 'Missing null check',
      })
      expect(result).toBe('[WARNING] Missing null check')
    })

    it('formats error annotation', () => {
      const result = formatAnnotationPreview({
        line: 10,
        severity: 'error',
        message: 'SQL injection risk',
      })
      expect(result).toBe('[ERROR] SQL injection risk')
    })
  })

  // -------------------------------------------------------------------------
  // Line number extraction
  // -------------------------------------------------------------------------

  describe('getAnnotatedLineNumbers', () => {
    it('returns line numbers from annotations', () => {
      const annotations: AiAnnotation[] = [
        { line: 3, severity: 'info', message: 'A' },
        { line: 10, severity: 'warning', message: 'B' },
        { line: 25, severity: 'error', message: 'C' },
      ]
      expect(getAnnotatedLineNumbers(annotations)).toEqual([3, 10, 25])
    })

    it('returns empty array for no annotations', () => {
      expect(getAnnotatedLineNumbers([])).toEqual([])
    })
  })
})
