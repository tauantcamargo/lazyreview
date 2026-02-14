/**
 * Floating panel for displaying a full AI annotation.
 *
 * Shown when the user presses Enter on an annotated line.
 * Displays severity badge, message, and optional suggestion.
 * Press `c` to convert the annotation to a review comment.
 * Press Escape to close.
 */
import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import type { AiAnnotation, AiAnnotationSeverity } from '../../services/ai/review-prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiAnnotationPanelProps {
  readonly annotation: AiAnnotation | undefined
  readonly isOpen: boolean
  readonly onConvert?: (annotation: AiAnnotation) => void
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// Pure helpers (tested in AiAnnotationPanel.test.tsx)
// ---------------------------------------------------------------------------

export function getSeverityBadge(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return 'INFO'
    case 'warning':
      return 'WARNING'
    case 'error':
      return 'ERROR'
  }
}

export function getSeverityEmoji(severity: AiAnnotationSeverity): string {
  switch (severity) {
    case 'info':
      return '*'
    case 'warning':
      return '!'
    case 'error':
      return 'X'
  }
}

export function hasSuggestion(annotation: AiAnnotation): boolean {
  return annotation.suggestion != null && annotation.suggestion.length > 0
}

export function formatConvertHint(hasSuggestionText: boolean): string {
  return hasSuggestionText
    ? 'c: convert to comment with suggestion | Esc: close'
    : 'c: convert to comment | Esc: close'
}

export function formatPanelTitle(annotation: AiAnnotation): string {
  return `${getSeverityEmoji(annotation.severity)} AI Annotation (line ${annotation.line})`
}

export function shouldRenderPanel(
  isOpen: boolean,
  annotation: AiAnnotation | undefined,
): boolean {
  return isOpen && annotation != null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiAnnotationPanel({
  annotation,
  isOpen,
  onConvert,
  onClose,
}: AiAnnotationPanelProps): React.ReactElement | null {
  const theme = useTheme()

  useInput(
    (input, key) => {
      if (key.escape) {
        onClose()
        return
      }
      if (input === 'c' && annotation && onConvert) {
        onConvert(annotation)
        return
      }
    },
    { isActive: isOpen && annotation != null },
  )

  if (!shouldRenderPanel(isOpen, annotation) || !annotation) {
    return null
  }

  const severityColor =
    annotation.severity === 'error'
      ? theme.colors.error
      : annotation.severity === 'warning'
        ? theme.colors.warning
        : theme.colors.info

  const title = formatPanelTitle(annotation)
  const badge = getSeverityBadge(annotation.severity)
  const showSuggestion = hasSuggestion(annotation)
  const hint = formatConvertHint(showSuggestion)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={severityColor}
      paddingX={1}
      paddingY={1}
      width="100%"
    >
      {/* Title */}
      <Text color={severityColor} bold>
        {title}
      </Text>

      {/* Severity badge */}
      <Box paddingTop={1}>
        <Box>
          <Text color={severityColor} bold inverse>
            {` ${badge} `}
          </Text>
        </Box>
      </Box>

      {/* Message */}
      <Box paddingTop={1}>
        <Text color={theme.colors.text} wrap="wrap">
          {annotation.message}
        </Text>
      </Box>

      {/* Suggestion (if available) */}
      {showSuggestion && (
        <Box paddingTop={1} flexDirection="column">
          <Text color={theme.colors.accent} bold>
            Suggestion:
          </Text>
          <Box paddingLeft={1}>
            <Text color={theme.colors.text} dimColor wrap="wrap">
              {annotation.suggestion}
            </Text>
          </Box>
        </Box>
      )}

      {/* Keybinding hints */}
      <Box paddingTop={1}>
        <Text color={theme.colors.muted} dimColor>
          {hint}
        </Text>
      </Box>
    </Box>
  )
}
