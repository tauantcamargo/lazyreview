/**
 * AI annotation gutter markers for diff views.
 *
 * Shows colored markers next to annotated lines in the diff gutter:
 * - info (blue): `*`
 * - warning (yellow): `!`
 * - error (red): `X`
 *
 * When the focused line has an annotation, shows an expanded preview below.
 */
import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { AiAnnotation, AiAnnotationSeverity } from '../../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiAnnotationGutterProps {
  readonly annotations: readonly AiAnnotation[]
  readonly currentLine: number
  readonly onSelect?: (annotation: AiAnnotation) => void
}

interface AiAnnotationMarkerProps {
  readonly annotation: AiAnnotation | undefined
}

// ---------------------------------------------------------------------------
// Pure helpers (tested in AiAnnotationGutter.test.tsx)
// ---------------------------------------------------------------------------

export function getMarkerChar(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return '*'
    case 'warning':
      return '!'
    case 'error':
      return 'X'
  }
}

export function getAnnotationForLine(
  annotations: readonly AiAnnotation[],
  lineNumber: number,
): AiAnnotation | undefined {
  return annotations.find((a) => a.line === lineNumber)
}

export function getAnnotationsByLine(
  annotations: readonly AiAnnotation[],
): ReadonlyMap<number, AiAnnotation> {
  const map = new Map<number, AiAnnotation>()
  for (const annotation of annotations) {
    if (!map.has(annotation.line)) {
      map.set(annotation.line, annotation)
    }
  }
  return map
}

export function formatAnnotationPreview(annotation: AiAnnotation): string {
  return `[${annotation.severity.toUpperCase()}] ${annotation.message}`
}

export function getAnnotatedLineNumbers(
  annotations: readonly AiAnnotation[],
): readonly number[] {
  return annotations.map((a) => a.line)
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AiAnnotationMarker({
  annotation,
}: AiAnnotationMarkerProps): React.ReactElement {
  const theme = useTheme()

  if (!annotation) {
    return (
      <Box width={2} flexShrink={0}>
        <Text> </Text>
      </Box>
    )
  }

  const colorMap: Readonly<Record<AiAnnotationSeverity, string>> = {
    info: theme.colors.info,
    warning: theme.colors.warning,
    error: theme.colors.error,
  }

  const marker = getMarkerChar(annotation.severity)
  const color = colorMap[annotation.severity]

  return (
    <Box width={2} flexShrink={0}>
      <Text color={color} bold>
        {marker}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiAnnotationGutter({
  annotations,
  currentLine,
  onSelect,
}: AiAnnotationGutterProps): React.ReactElement {
  const theme = useTheme()

  const annotationMap = useMemo(
    () => getAnnotationsByLine(annotations),
    [annotations],
  )

  const currentAnnotation = annotationMap.get(currentLine)

  return (
    <Box flexDirection="column">
      {/* Marker for the current line */}
      <AiAnnotationMarker annotation={currentAnnotation} />

      {/* Expanded preview for the focused annotation */}
      {currentAnnotation && (
        <Box paddingLeft={1} paddingTop={0}>
          <Text
            color={
              currentAnnotation.severity === 'error'
                ? theme.colors.error
                : currentAnnotation.severity === 'warning'
                  ? theme.colors.warning
                  : theme.colors.info
            }
            dimColor
            wrap="truncate-end"
          >
            {formatAnnotationPreview(currentAnnotation)}
          </Text>
          {onSelect && (
            <Text color={theme.colors.muted} dimColor>
              {' '}
              [Enter: details]
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}

/**
 * Inline gutter marker for a single diff line.
 * Renders a 2-character wide marker or empty space.
 */
export function AiGutterMark({
  annotation,
}: {
  readonly annotation: AiAnnotation | undefined
}): React.ReactElement {
  return <AiAnnotationMarker annotation={annotation} />
}
