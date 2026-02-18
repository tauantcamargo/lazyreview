import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ErrorWithRetry, getProviderErrorHint } from './ErrorWithRetry'
import { ThemeProvider } from '../../theme/index'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('ErrorWithRetry', () => {
  it('renders error message', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry message="Something went wrong" onRetry={() => {}} />,
    )
    expect(lastFrame()).toContain('Something went wrong')
  })

  it('renders retry hint', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry message="Network error" onRetry={() => {}} />,
    )
    expect(lastFrame()).toContain('r')
    expect(lastFrame()).toContain('retry')
  })

  it('calls onRetry when r is pressed', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} />,
    )
    stdin.write('r')
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not call onRetry when isActive is false', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} isActive={false} />,
    )
    stdin.write('r')
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('does not call onRetry for other keys', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} />,
    )
    stdin.write('x')
    stdin.write('q')
    stdin.write('R')
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('renders provider-specific hint for GitHub 401', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry
        message="GitHubError: 401 Unauthorized"
        onRetry={() => {}}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Token expired or invalid')
    expect(frame).toContain('Settings')
  })

  it('renders provider-specific hint for GitLab 403', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry
        message="GitLabError: 403 Forbidden"
        onRetry={() => {}}
      />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain("'api' scope")
  })

  it('does not render hint for generic errors', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry message="Network timeout" onRetry={() => {}} />,
    )
    const frame = lastFrame() ?? ''
    expect(frame).not.toContain('Token')
    expect(frame).not.toContain('Settings')
  })
})

describe('getProviderErrorHint', () => {
  // GitHub
  it('detects GitHub 401', () => {
    const hint = getProviderErrorHint('GitHubError: 401 Unauthorized from api.github.com')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Token expired or invalid')
    expect(hint?.detail).toContain('github.com/settings/tokens')
  })

  it('detects GitHub bad credentials', () => {
    const hint = getProviderErrorHint('GitHub: Bad credentials')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Token expired or invalid')
  })

  it('detects GitHub 403 rate limit', () => {
    const hint = getProviderErrorHint('GitHubError: 403 rate limit exceeded')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('rate limit')
  })

  it('detects GitHub 404', () => {
    const hint = getProviderErrorHint('GitHubError: 404 Not Found')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Repository not found')
  })

  // GitLab
  it('detects GitLab 401', () => {
    const hint = getProviderErrorHint('GitLabError: 401 Unauthorized')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('GitLab token expired')
    expect(hint?.detail).toContain('gitlab.com')
  })

  it('detects GitLab 403', () => {
    const hint = getProviderErrorHint('GitLabError: 403 Forbidden')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain("'api' scope")
  })

  // Bitbucket
  it('detects Bitbucket 401', () => {
    const hint = getProviderErrorHint('BitbucketError: 401 Unauthorized')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('App password invalid')
    expect(hint?.detail).toContain('bitbucket.org')
  })

  it('detects Bitbucket 403', () => {
    const hint = getProviderErrorHint('BitbucketError: 403 Forbidden')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Pull Request read permissions')
  })

  // Azure DevOps
  it('detects Azure 401', () => {
    const hint = getProviderErrorHint('AzureError: 401 Unauthorized from dev.azure.com')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('PAT expired')
    expect(hint?.detail).toContain('dev.azure.com')
  })

  it('detects Azure 403', () => {
    const hint = getProviderErrorHint('AzureError: 403 Forbidden')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain("'Code (Read)' scope")
  })

  // Gitea
  it('detects Gitea 401', () => {
    const hint = getProviderErrorHint('GiteaError: 401 Unauthorized')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Token expired or invalid')
    expect(hint?.detail).toContain('Gitea')
  })

  it('detects Gitea 403', () => {
    const hint = getProviderErrorHint('GiteaError: 403 Forbidden')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('repository read permissions')
  })

  // Forgejo (same as Gitea)
  it('detects Forgejo 401', () => {
    const hint = getProviderErrorHint('Forgejo: 401 Unauthorized')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Token expired or invalid')
  })

  // Generic
  it('detects generic 401 without provider', () => {
    const hint = getProviderErrorHint('HTTP 401 Unauthorized')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Authentication failed')
  })

  it('detects generic 403 without provider', () => {
    const hint = getProviderErrorHint('HTTP 403 Forbidden')
    expect(hint).not.toBeNull()
    expect(hint?.suggestion).toContain('Permission denied')
  })

  it('returns null for non-auth errors', () => {
    expect(getProviderErrorHint('Network timeout')).toBeNull()
    expect(getProviderErrorHint('Connection refused')).toBeNull()
    expect(getProviderErrorHint('500 Internal Server Error')).toBeNull()
  })
})
