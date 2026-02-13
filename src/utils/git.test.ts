import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseGitHubUrl,
  parseGitHubPRUrl,
  extractRepoFromPRUrl,
  checkoutPR,
  hasUncommittedChanges,
  parseGitRemote,
  parsePRUrl,
  detectProvider,
  getApiBaseUrl,
} from './git'
import type { CheckoutResult, ParsedRemote, ParsedPRUrl, ProviderType } from './git'

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

// Mock node:util to provide promisify that wraps our mocked execFile
import { execFile } from 'node:child_process'

// Get reference to the mocked execFile
const mockExecFile = vi.mocked(execFile)

/**
 * Helper to make execFile resolve with given stdout
 */
function mockExecSuccess(stdout: string): void {
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      if (typeof callback === 'function') {
        callback(null, { stdout, stderr: '' })
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

/**
 * Helper to make execFile reject with given error
 */
function mockExecError(message: string): void {
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      if (typeof callback === 'function') {
        callback(new Error(message), { stdout: '', stderr: '' })
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

/**
 * Helper to make execFile behave differently per call
 */
function mockExecSequence(
  behaviors: ReadonlyArray<{ stdout?: string; error?: string }>,
): void {
  let callIndex = 0
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      const behavior = behaviors[callIndex] ?? behaviors[behaviors.length - 1]
      callIndex++
      if (typeof callback === 'function') {
        if (behavior?.error) {
          callback(new Error(behavior.error), { stdout: '', stderr: '' })
        } else {
          callback(null, { stdout: behavior?.stdout ?? '', stderr: '' })
        }
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

// ===========================================================================
// detectProvider
// ===========================================================================

describe('detectProvider', () => {
  it('detects github.com', () => {
    expect(detectProvider('github.com')).toBe('github')
  })

  it('detects GitHub.com case-insensitively', () => {
    expect(detectProvider('GitHub.com')).toBe('github')
  })

  it('detects gitlab.com', () => {
    expect(detectProvider('gitlab.com')).toBe('gitlab')
  })

  it('detects bitbucket.org', () => {
    expect(detectProvider('bitbucket.org')).toBe('bitbucket')
  })

  it('detects dev.azure.com', () => {
    expect(detectProvider('dev.azure.com')).toBe('azure')
  })

  it('detects ssh.dev.azure.com', () => {
    expect(detectProvider('ssh.dev.azure.com')).toBe('azure')
  })

  it('detects visualstudio.com legacy Azure', () => {
    expect(detectProvider('myorg.visualstudio.com')).toBe('azure')
  })

  it('returns unknown for self-hosted domains', () => {
    expect(detectProvider('git.example.com')).toBe('unknown')
  })

  it('returns unknown for empty string', () => {
    expect(detectProvider('')).toBe('unknown')
  })
})

// ===========================================================================
// getApiBaseUrl
// ===========================================================================

describe('getApiBaseUrl', () => {
  it('returns api.github.com for github.com', () => {
    expect(getApiBaseUrl('github', 'github.com')).toBe('https://api.github.com')
  })

  it('returns GHE API URL for self-hosted GitHub', () => {
    expect(getApiBaseUrl('github', 'github.acme.com')).toBe('https://github.acme.com/api/v3')
  })

  it('returns GitLab.com API URL', () => {
    expect(getApiBaseUrl('gitlab', 'gitlab.com')).toBe('https://gitlab.com/api/v4')
  })

  it('returns self-hosted GitLab API URL', () => {
    expect(getApiBaseUrl('gitlab', 'gitlab.internal.io')).toBe('https://gitlab.internal.io/api/v4')
  })

  it('returns Bitbucket API URL', () => {
    expect(getApiBaseUrl('bitbucket', 'bitbucket.org')).toBe('https://api.bitbucket.org/2.0')
  })

  it('returns Azure API URL', () => {
    expect(getApiBaseUrl('azure', 'dev.azure.com')).toBe('https://dev.azure.com')
  })

  it('returns Gitea API URL', () => {
    expect(getApiBaseUrl('gitea', 'gitea.example.com')).toBe('https://gitea.example.com/api/v1')
  })

  it('returns generic HTTPS URL for unknown provider', () => {
    expect(getApiBaseUrl('unknown', 'git.example.com')).toBe('https://git.example.com')
  })
})

// ===========================================================================
// parseGitRemote — GitHub
// ===========================================================================

describe('parseGitRemote', () => {
  describe('GitHub URLs', () => {
    it('parses SSH format with .git', () => {
      const result = parseGitRemote('git@github.com:owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('parses SSH format without .git', () => {
      const result = parseGitRemote('git@github.com:owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('parses HTTPS format with .git', () => {
      const result = parseGitRemote('https://github.com/owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('parses HTTPS format without .git', () => {
      const result = parseGitRemote('https://github.com/owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('parses HTTP format', () => {
      const result = parseGitRemote('http://github.com/owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('handles hyphenated owner and repo', () => {
      const result = parseGitRemote('git@github.com:my-org/my-repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'my-org',
        repo: 'my-repo',
        baseUrl: 'https://api.github.com',
      })
    })

    it('trims whitespace', () => {
      const result = parseGitRemote('  git@github.com:owner/repo.git  ')
      expect(result).toEqual<ParsedRemote>({
        provider: 'github',
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.github.com',
      })
    })
  })

  describe('GitLab URLs', () => {
    it('parses SSH format with .git', () => {
      const result = parseGitRemote('git@gitlab.com:owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'gitlab',
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://gitlab.com/api/v4',
      })
    })

    it('parses SSH format without .git', () => {
      const result = parseGitRemote('git@gitlab.com:owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'gitlab',
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://gitlab.com/api/v4',
      })
    })

    it('parses HTTPS format with .git', () => {
      const result = parseGitRemote('https://gitlab.com/owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'gitlab',
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://gitlab.com/api/v4',
      })
    })

    it('parses HTTPS format without .git', () => {
      const result = parseGitRemote('https://gitlab.com/owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'gitlab',
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://gitlab.com/api/v4',
      })
    })
  })

  describe('Bitbucket URLs', () => {
    it('parses SSH format with .git', () => {
      const result = parseGitRemote('git@bitbucket.org:owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'bitbucket',
        host: 'bitbucket.org',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.bitbucket.org/2.0',
      })
    })

    it('parses SSH format without .git', () => {
      const result = parseGitRemote('git@bitbucket.org:owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'bitbucket',
        host: 'bitbucket.org',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.bitbucket.org/2.0',
      })
    })

    it('parses HTTPS format with .git', () => {
      const result = parseGitRemote('https://bitbucket.org/owner/repo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'bitbucket',
        host: 'bitbucket.org',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.bitbucket.org/2.0',
      })
    })

    it('parses HTTPS format without .git', () => {
      const result = parseGitRemote('https://bitbucket.org/owner/repo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'bitbucket',
        host: 'bitbucket.org',
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://api.bitbucket.org/2.0',
      })
    })
  })

  describe('Azure DevOps URLs', () => {
    it('parses SSH format', () => {
      const result = parseGitRemote('git@ssh.dev.azure.com:v3/myorg/myproject/myrepo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'azure',
        host: 'dev.azure.com',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        baseUrl: 'https://dev.azure.com',
      })
    })

    it('parses SSH format with .git suffix', () => {
      const result = parseGitRemote('git@ssh.dev.azure.com:v3/myorg/myproject/myrepo.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'azure',
        host: 'dev.azure.com',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        baseUrl: 'https://dev.azure.com',
      })
    })

    it('parses modern HTTPS format', () => {
      const result = parseGitRemote('https://dev.azure.com/myorg/myproject/_git/myrepo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'azure',
        host: 'dev.azure.com',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        baseUrl: 'https://dev.azure.com',
      })
    })

    it('parses legacy visualstudio.com HTTPS format', () => {
      const result = parseGitRemote('https://myorg.visualstudio.com/myproject/_git/myrepo')
      expect(result).toEqual<ParsedRemote>({
        provider: 'azure',
        host: 'myorg.visualstudio.com',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        baseUrl: 'https://dev.azure.com',
      })
    })
  })

  describe('Self-hosted / unknown URLs', () => {
    it('parses SSH URL for self-hosted instance', () => {
      const result = parseGitRemote('git@git.example.com:team/project.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'unknown',
        host: 'git.example.com',
        owner: 'team',
        repo: 'project',
        baseUrl: 'https://git.example.com',
      })
    })

    it('parses HTTPS URL for self-hosted instance', () => {
      const result = parseGitRemote('https://git.example.com/team/project.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'unknown',
        host: 'git.example.com',
        owner: 'team',
        repo: 'project',
        baseUrl: 'https://git.example.com',
      })
    })

    it('parses self-hosted GitLab SSH URL', () => {
      // Self-hosted GitLab won't match "gitlab.com" so it will be "unknown"
      const result = parseGitRemote('git@gitlab.mycompany.io:devops/infra.git')
      expect(result).toEqual<ParsedRemote>({
        provider: 'unknown',
        host: 'gitlab.mycompany.io',
        owner: 'devops',
        repo: 'infra',
        baseUrl: 'https://gitlab.mycompany.io',
      })
    })
  })

  describe('Edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseGitRemote('')).toBeNull()
    })

    it('returns null for malformed input', () => {
      expect(parseGitRemote('not-a-url')).toBeNull()
    })

    it('returns null for ftp URL', () => {
      expect(parseGitRemote('ftp://github.com/owner/repo.git')).toBeNull()
    })

    it('returns null for URL with no path segments', () => {
      expect(parseGitRemote('https://github.com')).toBeNull()
    })

    it('handles underscores in repo names', () => {
      const result = parseGitRemote('git@github.com:owner/my_repo.git')
      expect(result?.repo).toBe('my_repo')
    })

    it('handles dots in owner names', () => {
      const result = parseGitRemote('git@github.com:my.org/repo.git')
      expect(result?.owner).toBe('my.org')
    })
  })
})

// ===========================================================================
// parsePRUrl
// ===========================================================================

describe('parsePRUrl', () => {
  describe('GitHub PR URLs', () => {
    it('parses a standard GitHub PR URL', () => {
      const result = parsePRUrl('https://github.com/owner/repo/pull/42')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'github',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })

    it('parses GitHub PR URL with query parameters', () => {
      const result = parsePRUrl('https://github.com/owner/repo/pull/42?diff=unified')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'github',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })

    it('parses GitHub PR URL with hash fragment', () => {
      const result = parsePRUrl('https://github.com/owner/repo/pull/42#discussion_r123')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'github',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })

    it('parses HTTP GitHub PR URL', () => {
      const result = parsePRUrl('http://github.com/owner/repo/pull/7')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'github',
        owner: 'owner',
        repo: 'repo',
        number: 7,
      })
    })
  })

  describe('GitLab MR URLs', () => {
    it('parses a standard GitLab MR URL', () => {
      const result = parsePRUrl('https://gitlab.com/owner/repo/-/merge_requests/42')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'gitlab',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })

    it('parses GitLab MR URL with query parameters', () => {
      const result = parsePRUrl('https://gitlab.com/owner/repo/-/merge_requests/42?tab=notes')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'gitlab',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })
  })

  describe('Bitbucket PR URLs', () => {
    it('parses a standard Bitbucket PR URL', () => {
      const result = parsePRUrl('https://bitbucket.org/owner/repo/pull-requests/42')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'bitbucket',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })

    it('parses Bitbucket PR URL with query parameters', () => {
      const result = parsePRUrl('https://bitbucket.org/owner/repo/pull-requests/42?tab=diff')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'bitbucket',
        owner: 'owner',
        repo: 'repo',
        number: 42,
      })
    })
  })

  describe('Azure DevOps PR URLs', () => {
    it('parses a standard Azure PR URL', () => {
      const result = parsePRUrl('https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/42')
      expect(result).toEqual<ParsedPRUrl>({
        provider: 'azure',
        owner: 'myorg/myproject',
        repo: 'myrepo',
        number: 42,
      })
    })
  })

  describe('Edge cases', () => {
    it('returns null for empty string', () => {
      expect(parsePRUrl('')).toBeNull()
    })

    it('returns null for malformed URL', () => {
      expect(parsePRUrl('not-a-url')).toBeNull()
    })

    it('returns null for repo URL without PR path', () => {
      expect(parsePRUrl('https://github.com/owner/repo')).toBeNull()
    })

    it('returns null for unsupported provider PR URL', () => {
      expect(parsePRUrl('https://example.com/owner/repo/pull/42')).toBeNull()
    })
  })
})

// ===========================================================================
// Backward-compatible: parseGitHubUrl
// ===========================================================================

describe('parseGitHubUrl', () => {
  it('parses SSH format', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses SSH format without .git suffix', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTPS format', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTPS format without .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTP format', () => {
    const result = parseGitHubUrl('http://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseGitHubUrl('')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull()
  })
})

// ===========================================================================
// Backward-compatible: parseGitHubPRUrl
// ===========================================================================

describe('parseGitHubPRUrl', () => {
  it('parses a standard PR URL', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/42')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 42 })
  })

  it('parses a PR URL with query parameters', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/42?diff=unified')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 42 })
  })

  it('parses a PR URL with hash fragment', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/42#discussion_r123')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 42 })
  })

  it('parses a PR URL with hyphenated owner and repo', () => {
    const result = parseGitHubPRUrl('https://github.com/my-org/my-repo/pull/123')
    expect(result).toEqual({ owner: 'my-org', repo: 'my-repo', number: 123 })
  })

  it('parses a repo URL without PR number', () => {
    const result = parseGitHubPRUrl('https://github.com/owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
    expect(result?.number).toBeUndefined()
  })

  it('returns null for empty string', () => {
    expect(parseGitHubPRUrl('')).toBeNull()
  })

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubPRUrl('https://gitlab.com/owner/repo/merge_requests/42')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(parseGitHubPRUrl('not-a-url')).toBeNull()
  })

  it('parses HTTP (non-HTTPS) URLs', () => {
    const result = parseGitHubPRUrl('http://github.com/owner/repo/pull/7')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 7 })
  })

  it('handles PR number 0', () => {
    // PR numbers are always > 0 in practice, but the parser should handle it
    const result = parseGitHubPRUrl('https://github.com/owner/repo/pull/0')
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 0 })
  })

  it('returns null for GitHub URLs with only owner', () => {
    expect(parseGitHubPRUrl('https://github.com/owner')).toBeNull()
  })
})

// ===========================================================================
// Backward-compatible: extractRepoFromPRUrl
// ===========================================================================

describe('extractRepoFromPRUrl', () => {
  it('extracts owner/repo from a GitHub PR URL', () => {
    expect(extractRepoFromPRUrl('https://github.com/owner/repo/pull/42')).toBe('owner/repo')
  })

  it('returns null for a repo URL without /pull/ path', () => {
    expect(extractRepoFromPRUrl('https://github.com/owner/repo')).toBeNull()
  })

  it('returns null for non-GitHub URLs without PR path', () => {
    expect(extractRepoFromPRUrl('https://example.com')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractRepoFromPRUrl('')).toBeNull()
  })

  it('extracts from URL with query parameters', () => {
    expect(extractRepoFromPRUrl('https://github.com/owner/repo/pull/42?diff=unified')).toBe('owner/repo')
  })

  it('returns null for a GitHub URL without /pull/', () => {
    expect(extractRepoFromPRUrl('https://github.com/owner/repo/issues/5')).toBeNull()
  })

  it('extracts from GitLab MR URL', () => {
    expect(extractRepoFromPRUrl('https://gitlab.com/owner/repo/-/merge_requests/42')).toBe('owner/repo')
  })

  it('extracts from Bitbucket PR URL', () => {
    expect(extractRepoFromPRUrl('https://bitbucket.org/owner/repo/pull-requests/42')).toBe('owner/repo')
  })

  it('extracts from Azure DevOps PR URL', () => {
    expect(extractRepoFromPRUrl('https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/42')).toBe('myorg/myproject/myrepo')
  })
})

// ===========================================================================
// hasUncommittedChanges
// ===========================================================================

describe('hasUncommittedChanges', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns true when working tree has changes', async () => {
    mockExecSuccess(' M src/app.tsx\n?? new-file.ts\n')
    const result = await hasUncommittedChanges()
    expect(result).toBe(true)
  })

  it('returns false when working tree is clean', async () => {
    mockExecSuccess('')
    const result = await hasUncommittedChanges()
    expect(result).toBe(false)
  })

  it('returns false when git status fails (not a repo)', async () => {
    mockExecError('fatal: not a git repository')
    const result = await hasUncommittedChanges()
    expect(result).toBe(false)
  })
})

// ===========================================================================
// checkoutPR
// ===========================================================================

describe('checkoutPR', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when working tree is dirty', async () => {
    // First call: git status --porcelain returns changes
    mockExecSuccess(' M dirty-file.ts')
    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: false,
      message: 'Working tree has uncommitted changes. Commit or stash them first.',
      branchName: 'pr-42',
    })
  })

  it('fetches and checks out PR branch on clean tree', async () => {
    // Call 1: git status --porcelain (clean)
    // Call 2: git fetch origin pull/42/head:pr-42
    // Call 3: git checkout pr-42
    mockExecSequence([
      { stdout: '' },    // status: clean
      { stdout: '' },    // fetch: success
      { stdout: '' },    // checkout: success
    ])

    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: true,
      message: 'Checked out branch pr-42',
      branchName: 'pr-42',
    })
  })

  it('handles branch already exists by checking out and updating', async () => {
    // Call 1: git status --porcelain (clean)
    // Call 2: git fetch fails with "already exists"
    // Call 3: git checkout pr-42
    // Call 4: git pull origin pull/42/head
    mockExecSequence([
      { stdout: '' },
      { error: "fatal: couldn't find remote ref; branch 'pr-42' already exists" },
      { stdout: '' },
      { stdout: '' },
    ])

    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: true,
      message: 'Switched to existing branch pr-42 and updated',
      branchName: 'pr-42',
    })
  })

  it('returns error on fetch failure', async () => {
    mockExecSequence([
      { stdout: '' },
      { error: 'fatal: could not read from remote repository' },
    ])

    const result = await checkoutPR(99)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Failed to checkout PR #99')
    expect(result.branchName).toBe('pr-99')
  })
})
