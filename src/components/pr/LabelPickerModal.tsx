import React, { useState, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from '../common/Modal'
import type { RepoLabel } from '../../models/label'

interface LabelPickerModalProps {
  readonly repoLabels: readonly RepoLabel[]
  readonly currentLabels: readonly string[]
  readonly onSubmit: (labels: readonly string[]) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly isLoading: boolean
  readonly error: string | null
}

/**
 * Convert a hex color string (without #) to a human-readable color
 * for use in Ink's Text component.
 */
function hexToInkColor(hex: string): string {
  return `#${hex}`
}

/**
 * Determine if a label color is light enough to need dark text.
 * Returns true if the luminance suggests white/light background.
 */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return false
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

export function LabelPickerModal({
  repoLabels,
  currentLabels,
  onSubmit,
  onClose,
  isSubmitting,
  isLoading,
  error,
}: LabelPickerModalProps): React.ReactElement {
  const theme = useTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedLabels, setSelectedLabels] = useState<ReadonlySet<string>>(
    () => new Set(currentLabels),
  )

  const hasChanges = useMemo(() => {
    const currentSet = new Set(currentLabels)
    if (currentSet.size !== selectedLabels.size) return true
    for (const label of selectedLabels) {
      if (!currentSet.has(label)) return true
    }
    return false
  }, [currentLabels, selectedLabels])

  useInput(
    (_input, key) => {
      if (isSubmitting || isLoading) return

      if (key.escape) {
        onClose()
      } else if (_input === 'j' || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, repoLabels.length - 1))
      } else if (_input === 'k' || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (_input === ' ') {
        const label = repoLabels[selectedIndex]
        if (label) {
          setSelectedLabels((prev) => {
            if (prev.has(label.name)) {
              return new Set([...prev].filter((l) => l !== label.name))
            }
            return new Set([...prev, label.name])
          })
        }
      } else if (key.return && !key.ctrl && !key.meta) {
        const label = repoLabels[selectedIndex]
        if (label) {
          setSelectedLabels((prev) => {
            if (prev.has(label.name)) {
              return new Set([...prev].filter((l) => l !== label.name))
            }
            return new Set([...prev, label.name])
          })
        }
      } else if (_input === 's' && key.ctrl) {
        if (hasChanges) {
          onSubmit([...selectedLabels])
        }
      }
    },
    { isActive: true },
  )

  if (isLoading) {
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
          width={50}
        >
          <Text color={theme.colors.accent} bold>
            Labels
          </Text>
          <Text color={theme.colors.muted}>Loading labels...</Text>
          <Text color={theme.colors.muted} dimColor>
            Esc: cancel
          </Text>
        </Box>
      </Modal>
    )
  }

  if (repoLabels.length === 0) {
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
          width={50}
        >
          <Text color={theme.colors.accent} bold>
            Labels
          </Text>
          <Text color={theme.colors.muted}>No labels available for this repository.</Text>
          <Text color={theme.colors.muted} dimColor>
            Esc: close
          </Text>
        </Box>
      </Modal>
    )
  }

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
        width={55}
      >
        <Text color={theme.colors.accent} bold>
          Labels
        </Text>

        <Text color={theme.colors.muted}>
          Toggle labels for this PR:
        </Text>

        <Box flexDirection="column">
          {repoLabels.map((label, index) => {
            const isChecked = selectedLabels.has(label.name)
            const isFocused = index === selectedIndex
            const labelColor = hexToInkColor(label.color)
            const textOnLabel = isLightColor(label.color) ? '#000000' : '#ffffff'

            return (
              <Box key={label.name} gap={1}>
                <Text color={isFocused ? theme.colors.accent : theme.colors.muted}>
                  {isFocused ? '>' : ' '}
                </Text>
                <Text color={isChecked ? theme.colors.accent : theme.colors.muted}>
                  [{isChecked ? 'x' : ' '}]
                </Text>
                <Text
                  backgroundColor={labelColor}
                  color={textOnLabel}
                  bold={isFocused}
                >
                  {` ${label.name} `}
                </Text>
                {label.description && (
                  <Text color={theme.colors.muted} dimColor>
                    {label.description}
                  </Text>
                )}
              </Box>
            )
          })}
        </Box>

        {hasChanges && (
          <Text color={theme.colors.info}>
            {selectedLabels.size} label{selectedLabels.size !== 1 ? 's' : ''} selected
          </Text>
        )}

        {isSubmitting && (
          <Text color={theme.colors.info}>Applying labels...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          j/k: navigate | Space/Enter: toggle | Ctrl+S: apply | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}
