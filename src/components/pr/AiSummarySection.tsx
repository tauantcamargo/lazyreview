/**
 * Collapsible AI summary section for the Description tab.
 *
 * Displays an AI-generated PR summary with streaming text,
 * caching by PR+headSha, and regeneration support.
 * Collapsed by default; toggle with Ctrl+A.
 */
import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { MarkdownText } from '../common/MarkdownText'
import { Spinner } from '../common/Spinner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiSummarySectionProps {
  readonly isExpanded: boolean
  readonly summary: string
  readonly isGenerating: boolean
  readonly error: string | null
  readonly isConfigured: boolean
  readonly providerName: string
}

// ---------------------------------------------------------------------------
// Pure helpers (tested in AiSummarySection.test.tsx)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiSummarySection({
  isExpanded,
  summary,
  isGenerating,
  error,
  isConfigured,
  providerName,
}: AiSummarySectionProps): React.ReactElement {
  const theme = useTheme()

  const headerText = formatProviderHeader(providerName)
  const toggleHint = getToggleHint(isExpanded)
  const statusText = getStatusText({
    isGenerating,
    error,
    summary,
    isConfigured,
  })

  const showContent =
    isExpanded && (summary.length > 0 || isGenerating)
  const showRegenerateHint =
    isExpanded && summary.length > 0 && !isGenerating

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.colors.border}
      overflow="hidden"
    >
      {/* Header row */}
      <Box flexDirection="row" gap={1}>
        <Text color={theme.colors.info} bold>
          {headerText}
        </Text>
        <Text color={theme.colors.muted} dimColor>
          {toggleHint}
        </Text>
      </Box>

      {/* Status text (not configured, error, prompt) */}
      {statusText.length > 0 && (
        <Box paddingTop={1}>
          <Text
            color={
              error
                ? theme.colors.error
                : !isConfigured
                  ? theme.colors.warning
                  : theme.colors.muted
            }
            dimColor={!error && isConfigured}
          >
            {statusText}
          </Text>
        </Box>
      )}

      {/* Generating spinner (no content yet) */}
      {isExpanded && isGenerating && !summary && (
        <Box paddingTop={1}>
          <Spinner label="Generating summary..." />
        </Box>
      )}

      {/* Streaming/completed summary content */}
      {showContent && summary.length > 0 && (
        <Box paddingLeft={1} paddingTop={1} width="85%">
          <MarkdownText content={summary} />
        </Box>
      )}

      {/* Streaming indicator */}
      {isExpanded && isGenerating && summary.length > 0 && (
        <Box paddingTop={1}>
          <Spinner label="Streaming..." />
        </Box>
      )}

      {/* Regenerate hint */}
      {showRegenerateHint && (
        <Box paddingTop={1}>
          <Text color={theme.colors.muted} dimColor>
            <Text color={theme.colors.accent}>Ctrl+R</Text> regenerate
          </Text>
        </Box>
      )}
    </Box>
  )
}
