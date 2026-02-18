import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'

// ---------------------------------------------------------------------------
// Provider-specific error hints
// ---------------------------------------------------------------------------

interface ErrorHint {
  readonly suggestion: string
  readonly detail?: string
}

/**
 * Detect provider and status from error message and return a helpful hint.
 * Error messages from the service layer typically contain the status code
 * and provider-specific identifiers (e.g. "GitHubError", "api.github.com").
 */
export function getProviderErrorHint(message: string): ErrorHint | null {
  const lower = message.toLowerCase()

  // GitHub errors
  if (lower.includes('github') || lower.includes('api.github.com')) {
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('bad credentials')) {
      return {
        suggestion: "Token expired or invalid. Press 'S' to open Settings and update your token.",
        detail: 'Create a new token at github.com/settings/tokens with repo scope.',
      }
    }
    if (lower.includes('403') || lower.includes('forbidden') || lower.includes('rate limit')) {
      return {
        suggestion: 'API rate limit exceeded or insufficient permissions.',
        detail: "Ensure your token has 'repo' scope. Rate limits reset hourly.",
      }
    }
    if (lower.includes('404') || lower.includes('not found')) {
      return {
        suggestion: 'Repository not found. Check the owner/repo name or token permissions.',
      }
    }
  }

  // GitLab errors
  if (lower.includes('gitlab')) {
    if (lower.includes('401') || lower.includes('unauthorized')) {
      return {
        suggestion: "GitLab token expired or invalid. Press 'S' to update your token.",
        detail: "Create a new token at gitlab.com/-/user_settings/personal_access_tokens with 'api' scope.",
      }
    }
    if (lower.includes('403') || lower.includes('forbidden')) {
      return {
        suggestion: "Permission denied. Ensure your token has 'api' scope.",
        detail: 'GitLab tokens need full API access to read merge requests.',
      }
    }
  }

  // Bitbucket errors
  if (lower.includes('bitbucket')) {
    if (lower.includes('401') || lower.includes('unauthorized')) {
      return {
        suggestion: "App password invalid. Press 'S' to update your credentials.",
        detail: 'Create a new app password at bitbucket.org/account/settings/app-passwords with Repository and Pull Request permissions.',
      }
    }
    if (lower.includes('403') || lower.includes('forbidden')) {
      return {
        suggestion: 'Permission denied. Ensure your app password has Repository and Pull Request read permissions.',
      }
    }
  }

  // Azure DevOps errors
  if (lower.includes('azure') || lower.includes('dev.azure.com')) {
    if (lower.includes('401') || lower.includes('unauthorized')) {
      return {
        suggestion: "PAT expired or invalid. Press 'S' to update your token.",
        detail: 'Create a new PAT at dev.azure.com with Code (Read) scope.',
      }
    }
    if (lower.includes('403') || lower.includes('forbidden')) {
      return {
        suggestion: "Insufficient permissions. Ensure your PAT has 'Code (Read)' scope.",
      }
    }
  }

  // Gitea / Forgejo errors
  if (lower.includes('gitea') || lower.includes('forgejo')) {
    if (lower.includes('401') || lower.includes('unauthorized')) {
      return {
        suggestion: "Token expired or invalid. Press 'S' to update your token.",
        detail: 'Create a new token in your Gitea instance under Settings > Applications.',
      }
    }
    if (lower.includes('403') || lower.includes('forbidden')) {
      return {
        suggestion: 'Permission denied. Ensure your token has repository read permissions.',
      }
    }
  }

  // Generic auth failures
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return {
      suggestion: "Authentication failed. Press 'S' to open Settings and update your token.",
    }
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return {
      suggestion: 'Permission denied. Check your token scopes and repository access.',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ErrorWithRetryProps {
  readonly message: string
  readonly onRetry: () => void
  readonly isActive?: boolean
}

export function ErrorWithRetry({
  message,
  onRetry,
  isActive = true,
}: ErrorWithRetryProps): React.ReactElement {
  const theme = useTheme()
  const hint = getProviderErrorHint(message)

  useInput(
    (input) => {
      if (input === 'r') {
        onRetry()
      }
    },
    { isActive },
  )

  return (
    <Box
      flexDirection="column"
      padding={1}
      gap={1}
      borderStyle="single"
      borderColor={theme.colors.error}
    >
      <Box gap={1}>
        <Text color={theme.colors.error} bold>✗</Text>
        <Text color={theme.colors.error}>{message}</Text>
      </Box>
      {hint && (
        <Box flexDirection="column" paddingLeft={2} gap={0}>
          <Text color={theme.colors.warning}>{hint.suggestion}</Text>
          {hint.detail && (
            <Text color={theme.colors.muted} dimColor>{hint.detail}</Text>
          )}
        </Box>
      )}
      <Box paddingLeft={2} gap={1}>
        <Text color={theme.colors.muted}>Press</Text>
        <Text color={theme.colors.accent} bold>r</Text>
        <Text color={theme.colors.muted}>to retry</Text>
        <Text color={theme.colors.muted}>·</Text>
        <Text color={theme.colors.accent} bold>?</Text>
        <Text color={theme.colors.muted}>for help</Text>
      </Box>
    </Box>
  )
}
