/**
 * Modal displaying AI-powered code analysis for selected diff lines.
 *
 * Shows the selected code snippet, streaming AI response as markdown,
 * and action keys for converting suggestions to comments or copying.
 */
import React, { useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MarkdownText } from '../common/MarkdownText'
import { Spinner } from '../common/Spinner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiReviewContext {
  readonly code: string
  readonly filename: string
  readonly language: string
  readonly startLine?: number
  readonly endLine?: number
}

interface AiReviewModalProps {
  readonly context: AiReviewContext
  readonly response: string
  readonly isLoading: boolean
  readonly error: string | null
  readonly providerName: string
  readonly modelName: string
  readonly onClose: () => void
  readonly onConvertToComment?: (suggestion: string) => void
  readonly onCopy?: (text: string) => void
  readonly onRegenerate?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLineRange(ctx: AiReviewContext): string {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiReviewModal({
  context,
  response,
  isLoading,
  error,
  providerName,
  modelName,
  onClose,
  onConvertToComment,
  onCopy,
  onRegenerate,
}: AiReviewModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()

  useEffect(() => {
    setInputActive(true)
    return () => setInputActive(false)
  }, [setInputActive])

  const handleConvertToComment = useCallback(() => {
    if (response && onConvertToComment) {
      onConvertToComment(response)
    }
  }, [response, onConvertToComment])

  const handleCopy = useCallback(() => {
    if (response && onCopy) {
      onCopy(response)
    }
  }, [response, onCopy])

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate()
    }
  }, [onRegenerate])

  useInput(
    (input, key) => {
      if (key.escape) {
        onClose()
        return
      }

      // Action keys only available when response is ready
      if (!isLoading && response) {
        if (input === 'c' && onConvertToComment) {
          handleConvertToComment()
        } else if (input === 's' && onCopy) {
          handleCopy()
        } else if (input === 'r' && onRegenerate) {
          handleRegenerate()
        }
      }
    },
    { isActive: true },
  )

  const lineRange = formatLineRange(context)
  const codePreview = truncateCode(context.code, 8)
  const providerInfo = modelName
    ? `${providerName} (${modelName})`
    : providerName

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
        width={72}
        height={40}
      >
        {/* Header */}
        <Box justifyContent="space-between">
          <Box gap={1}>
            <Text color={theme.colors.accent} bold>
              AI Review
            </Text>
            {lineRange && (
              <Text color={theme.colors.muted}>{lineRange}</Text>
            )}
          </Box>
          {providerInfo && (
            <Text color={theme.colors.info} dimColor>
              {providerInfo}
            </Text>
          )}
        </Box>

        {/* Code context */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
        >
          <Text color={theme.colors.muted} dimColor>
            {context.filename}
          </Text>
          <Text color={theme.colors.text}>{codePreview}</Text>
        </Box>

        {/* Response area */}
        {isLoading && !response && (
          <Box gap={1} paddingY={1}>
            <Spinner label="Analyzing code..." />
          </Box>
        )}

        {response && (
          <Box flexDirection="column" overflow="hidden">
            <MarkdownText content={response} />
            {isLoading && (
              <Box paddingTop={1}>
                <Spinner label="Streaming..." />
              </Box>
            )}
          </Box>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        {/* Actions footer */}
        <Box flexDirection="column" gap={0}>
          {!isLoading && response && (
            <Box gap={2}>
              {onConvertToComment && (
                <Text color={theme.colors.muted}>
                  <Text color={theme.colors.accent}>c</Text> comment
                </Text>
              )}
              {onCopy && (
                <Text color={theme.colors.muted}>
                  <Text color={theme.colors.accent}>s</Text> copy
                </Text>
              )}
              {onRegenerate && (
                <Text color={theme.colors.muted}>
                  <Text color={theme.colors.accent}>r</Text> regenerate
                </Text>
              )}
              <Text color={theme.colors.muted}>
                <Text color={theme.colors.accent}>Esc</Text> close
              </Text>
            </Box>
          )}
          {(isLoading || !response) && (
            <Text color={theme.colors.muted} dimColor>
              Esc: close
            </Text>
          )}
        </Box>
      </Box>
    </Modal>
  )
}
