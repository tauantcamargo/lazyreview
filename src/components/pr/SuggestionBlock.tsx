import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { parseSuggestionBlock, type ParsedSuggestion } from '../../models/suggestion'

// ---------------------------------------------------------------------------
// Pure extraction helper (re-exported for testing)
// ---------------------------------------------------------------------------

/**
 * Extract a suggestion block from a comment body string.
 * Returns the parsed suggestion and comment text, or null if none found.
 */
export function extractSuggestionFromBody(body: string): ParsedSuggestion | null {
  return parseSuggestionBlock(body)
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface SuggestionBlockProps {
  /** The suggested replacement code */
  readonly suggestion: string
  /** The original code being replaced */
  readonly originalCode: string
  /** Whether this block is focused (for keyboard hints) */
  readonly isFocused: boolean
  /** Whether the current user can accept this suggestion */
  readonly canAccept?: boolean
  /** Callback when user presses 'a' to accept */
  readonly onAccept?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestionBlock({
  suggestion,
  originalCode,
  isFocused,
  canAccept = false,
  onAccept,
}: SuggestionBlockProps): React.ReactElement {
  const theme = useTheme()

  const originalLines = originalCode ? originalCode.split('\n') : []
  const suggestionLines = suggestion ? suggestion.split('\n') : []
  const isDeletion = suggestion === ''

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? theme.colors.accent : theme.colors.border}
      paddingX={1}
      paddingY={0}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.warning} bold>
          Suggestion
        </Text>
        {isDeletion && (
          <Text color={theme.colors.muted} dimColor>
            (delete line{originalLines.length > 1 ? 's' : ''})
          </Text>
        )}
      </Box>

      {/* Original code (deletions) */}
      {originalLines.map((line, i) => (
        <Box key={`del-${i}`} flexDirection="row">
          <Text color={theme.colors.diffDel}>- {line}</Text>
        </Box>
      ))}

      {/* Suggested code (additions) */}
      {suggestionLines.length > 0 &&
        suggestion !== '' &&
        suggestionLines.map((line, i) => (
          <Box key={`add-${i}`} flexDirection="row">
            <Text color={theme.colors.diffAdd}>+ {line}</Text>
          </Box>
        ))}

      {/* Keyboard hints */}
      {isFocused && canAccept && (
        <Text color={theme.colors.muted} dimColor>
          a: accept suggestion
        </Text>
      )}
    </Box>
  )
}
