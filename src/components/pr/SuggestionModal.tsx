import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MultiLineInput } from '../common/MultiLineInput'
import type { ProviderType } from '../../services/providers/types'

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Returns the modal title string. */
export function getSuggestionModalTitle(): string {
  return 'Suggest Change'
}

/** Badge metadata for the provider suggestion support indicator. */
export interface ProviderBadge {
  readonly label: string
  readonly isNative: boolean
  readonly display: string
}

/**
 * Compute the provider badge shown in the SuggestionModal title bar.
 * `canSuggest` indicates native suggestion block support (GitHub, GitLab).
 */
export function getSuggestionProviderBadge(
  canSuggest: boolean,
  providerType: string,
): ProviderBadge {
  const label = canSuggest ? 'native' : 'comment'
  return {
    label,
    isNative: canSuggest,
    display: `[${providerType}: ${label}]`,
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuggestionModalProps {
  /** The original code lines to be replaced */
  readonly originalCode: string
  /** File path being edited */
  readonly path: string
  /** Called with the suggestion text when submitted */
  readonly onSubmit: (body: string, suggestion: string) => void
  /** Called when the modal is cancelled */
  readonly onClose: () => void
  /** Whether a submission is in progress */
  readonly isSubmitting: boolean
  /** Error message from last submission attempt */
  readonly error: string | null
  /** Whether the provider supports native suggestion blocks */
  readonly canSuggest: boolean
  /** Which provider type is active */
  readonly providerType: ProviderType
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestionModal({
  originalCode,
  path,
  onSubmit,
  onClose,
  isSubmitting,
  error,
  canSuggest,
  providerType,
}: SuggestionModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [suggestion, setSuggestion] = useState(originalCode)

  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return
    onSubmit('', suggestion)
  }, [suggestion, isSubmitting, onSubmit])

  useInput(
    (_input, key) => {
      if (isSubmitting) return

      if (key.escape) {
        onClose()
      } else if (_input === 's' && key.ctrl) {
        handleSubmit()
      }
    },
  )

  const originalLines = originalCode.split('\n')
  const providerBadge = canSuggest ? 'native' : 'comment'
  const providerBadgeColor = canSuggest ? theme.colors.success : theme.colors.warning

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={70}
      >
        {/* Title bar */}
        <Box flexDirection="row" gap={1}>
          <Text color={theme.colors.accent} bold>
            Suggest Change
          </Text>
          <Text color={providerBadgeColor} dimColor>
            [{providerType}: {providerBadge}]
          </Text>
        </Box>

        {/* File path */}
        <Text color={theme.colors.muted}>{path}</Text>

        {/* Original code (read-only) */}
        <Box flexDirection="column">
          <Text color={theme.colors.muted} bold>
            Original:
          </Text>
          <Box
            borderStyle="single"
            borderColor={theme.colors.border}
            paddingX={1}
            paddingY={0}
            flexDirection="column"
          >
            {originalLines.map((line, i) => (
              <Text key={i} color={theme.colors.diffDel}>
                {line || ' '}
              </Text>
            ))}
          </Box>
        </Box>

        {/* Replacement code (editable) */}
        <Box flexDirection="column">
          <Text color={theme.colors.muted} bold>
            Replacement:
          </Text>
          <Box
            borderStyle="single"
            borderColor={theme.colors.accent}
            paddingX={1}
            paddingY={0}
            flexDirection="column"
          >
            <MultiLineInput
              placeholder="Edit replacement code..."
              defaultValue={originalCode}
              onChange={setSuggestion}
              isActive={!isSubmitting}
              minHeight={Math.max(3, originalLines.length)}
            />
          </Box>
        </Box>

        {/* Keyboard hints */}
        <Text color={theme.colors.muted} dimColor>
          Ctrl+S: submit | Esc: cancel
        </Text>

        {/* Status */}
        {isSubmitting && (
          <Text color={theme.colors.info}>Submitting suggestion...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}
      </Box>
    </Modal>
  )
}
