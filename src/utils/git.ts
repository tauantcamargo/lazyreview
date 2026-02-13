import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

export type ProviderType =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure'
  | 'gitea'
  | 'unknown'

export interface ParsedRemote {
  readonly provider: ProviderType
  readonly host: string
  readonly owner: string
  readonly repo: string
  readonly baseUrl: string
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/**
 * Detect the git hosting provider from a hostname.
 */
export function detectProvider(host: string): ProviderType {
  const lower = host.toLowerCase()
  if (lower === 'github.com') return 'github'
  if (lower === 'gitlab.com') return 'gitlab'
  if (lower === 'bitbucket.org') return 'bitbucket'
  if (lower.includes('dev.azure.com') || lower.includes('visualstudio.com')) return 'azure'
  if (lower.includes('ssh.dev.azure.com')) return 'azure'
  return 'unknown'
}

/**
 * Get the API base URL for a given provider and host.
 */
export function getApiBaseUrl(provider: ProviderType, host: string): string {
  switch (provider) {
    case 'github':
      return host.toLowerCase() === 'github.com'
        ? 'https://api.github.com'
        : `https://${host}/api/v3`
    case 'gitlab':
      return host.toLowerCase() === 'gitlab.com'
        ? 'https://gitlab.com/api/v4'
        : `https://${host}/api/v4`
    case 'bitbucket':
      return 'https://api.bitbucket.org/2.0'
    case 'azure':
      return 'https://dev.azure.com'
    case 'gitea':
      return `https://${host}/api/v1`
    default:
      return `https://${host}`
  }
}

// ---------------------------------------------------------------------------
// Git remote URL parsing
// ---------------------------------------------------------------------------

/**
 * Parse Azure DevOps SSH URL format:
 *   git@ssh.dev.azure.com:v3/org/project/repo
 */
function parseAzureSsh(url: string): ParsedRemote | null {
  const match = url.match(
    /git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/([^/.]+?)(?:\.git)?$/,
  )
  if (!match?.[1] || !match[2] || !match[3]) return null
  return {
    provider: 'azure',
    host: 'dev.azure.com',
    owner: `${match[1]}/${match[2]}`,
    repo: match[3],
    baseUrl: 'https://dev.azure.com',
  }
}

/**
 * Parse Azure DevOps HTTPS URL format:
 *   https://dev.azure.com/org/project/_git/repo
 *   https://org.visualstudio.com/project/_git/repo
 */
function parseAzureHttps(url: string): ParsedRemote | null {
  // Modern format: https://dev.azure.com/org/project/_git/repo
  const devMatch = url.match(
    /https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/?#.]+?)(?:\.git)?$/,
  )
  if (devMatch?.[1] && devMatch[2] && devMatch[3]) {
    return {
      provider: 'azure',
      host: 'dev.azure.com',
      owner: `${devMatch[1]}/${devMatch[2]}`,
      repo: devMatch[3],
      baseUrl: 'https://dev.azure.com',
    }
  }

  // Legacy format: https://org.visualstudio.com/project/_git/repo
  const vsMatch = url.match(
    /https?:\/\/([^.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/?#.]+?)(?:\.git)?$/,
  )
  if (vsMatch?.[1] && vsMatch[2] && vsMatch[3]) {
    return {
      provider: 'azure',
      host: `${vsMatch[1]}.visualstudio.com`,
      owner: `${vsMatch[1]}/${vsMatch[2]}`,
      repo: vsMatch[3],
      baseUrl: 'https://dev.azure.com',
    }
  }

  return null
}

/**
 * Parse a generic SSH URL: git@host:owner/repo.git
 */
function parseSshUrl(url: string): ParsedRemote | null {
  // Handle Azure SSH first (special format)
  const azureResult = parseAzureSsh(url)
  if (azureResult) return azureResult

  const match = url.match(/git@([^:]+):([^/]+)\/([^/.]+?)(?:\.git)?$/)
  if (!match?.[1] || !match[2] || !match[3]) return null

  const host = match[1]
  const provider = detectProvider(host)

  return {
    provider,
    host,
    owner: match[2],
    repo: match[3],
    baseUrl: getApiBaseUrl(provider, host),
  }
}

/**
 * Parse a generic HTTPS URL: https://host/owner/repo.git
 */
function parseHttpsUrl(url: string): ParsedRemote | null {
  // Handle Azure HTTPS first (special format with _git)
  const azureResult = parseAzureHttps(url)
  if (azureResult) return azureResult

  const match = url.match(
    /https?:\/\/([^/]+)\/([^/]+)\/([^/?#.]+?)(?:\.git)?$/,
  )
  if (!match?.[1] || !match[2] || !match[3]) return null

  const host = match[1]
  const provider = detectProvider(host)

  return {
    provider,
    host,
    owner: match[2],
    repo: match[3],
    baseUrl: getApiBaseUrl(provider, host),
  }
}

/**
 * Parse a git remote URL (SSH or HTTPS) and extract provider, owner, and repo.
 *
 * Supported formats:
 *   - SSH: git@github.com:owner/repo.git
 *   - HTTPS: https://github.com/owner/repo.git
 *   - Azure SSH: git@ssh.dev.azure.com:v3/org/project/repo
 *   - Azure HTTPS: https://dev.azure.com/org/project/_git/repo
 *   - Legacy Azure: https://org.visualstudio.com/project/_git/repo
 *   - Self-hosted: any SSH/HTTPS git URL
 *
 * Returns null for unparseable URLs.
 */
export function parseGitRemote(url: string): ParsedRemote | null {
  if (!url) return null

  const trimmed = url.trim()

  // Try SSH format first
  if (trimmed.startsWith('git@')) {
    return parseSshUrl(trimmed)
  }

  // Try HTTPS/HTTP format
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return parseHttpsUrl(trimmed)
  }

  return null
}

// ---------------------------------------------------------------------------
// Backward-compatible helpers
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub remote URL and extract owner/repo.
 *
 * @deprecated Use parseGitRemote() for provider-agnostic parsing.
 */
export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const parsed = parseGitRemote(url)
  if (!parsed) return null
  // Original function only worked with GitHub URLs
  if (parsed.provider !== 'github') return null
  return { owner: parsed.owner, repo: parsed.repo }
}

// ---------------------------------------------------------------------------
// PR / MR URL parsing
// ---------------------------------------------------------------------------

export interface ParsedPRUrl {
  readonly provider: ProviderType
  readonly owner: string
  readonly repo: string
  readonly number: number
}

/**
 * Parse a pull/merge request URL from any supported provider.
 *
 * Supported URL patterns:
 *   - GitHub:    https://github.com/owner/repo/pull/123
 *   - GitLab:    https://gitlab.com/owner/repo/-/merge_requests/123
 *   - Bitbucket: https://bitbucket.org/owner/repo/pull-requests/123
 *   - Azure:     https://dev.azure.com/org/project/_git/repo/pullrequest/123
 */
export function parsePRUrl(url: string): ParsedPRUrl | null {
  if (!url) return null

  // GitHub: https://github.com/owner/repo/pull/123
  const ghMatch = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  )
  if (ghMatch?.[1] && ghMatch[2] && ghMatch[3]) {
    return {
      provider: 'github',
      owner: ghMatch[1],
      repo: ghMatch[2],
      number: parseInt(ghMatch[3], 10),
    }
  }

  // GitLab: https://gitlab.com/owner/repo/-/merge_requests/123
  const glMatch = url.match(
    /https?:\/\/gitlab\.com\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/,
  )
  if (glMatch?.[1] && glMatch[2] && glMatch[3]) {
    return {
      provider: 'gitlab',
      owner: glMatch[1],
      repo: glMatch[2],
      number: parseInt(glMatch[3], 10),
    }
  }

  // Bitbucket: https://bitbucket.org/owner/repo/pull-requests/123
  const bbMatch = url.match(
    /https?:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/,
  )
  if (bbMatch?.[1] && bbMatch[2] && bbMatch[3]) {
    return {
      provider: 'bitbucket',
      owner: bbMatch[1],
      repo: bbMatch[2],
      number: parseInt(bbMatch[3], 10),
    }
  }

  // Azure: https://dev.azure.com/org/project/_git/repo/pullrequest/123
  const azMatch = url.match(
    /https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/,
  )
  if (azMatch?.[1] && azMatch[2] && azMatch[3] && azMatch[4]) {
    return {
      provider: 'azure',
      owner: `${azMatch[1]}/${azMatch[2]}`,
      repo: azMatch[3],
      number: parseInt(azMatch[4], 10),
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Backward-compatible PR URL helpers
// ---------------------------------------------------------------------------

export interface ParsedGitHubPRUrl {
  readonly owner: string
  readonly repo: string
  readonly number?: number
}

/**
 * Parse a GitHub PR URL and extract owner, repo, and optionally the PR number.
 * Supports:
 *   - https://github.com/owner/repo/pull/42
 *   - https://github.com/owner/repo/pull/42?diff=unified
 *   - https://github.com/owner/repo (repo URL without PR number)
 * Returns null for non-GitHub URLs and malformed URLs.
 */
export function parseGitHubPRUrl(url: string): ParsedGitHubPRUrl | null {
  if (!url) return null

  // Try the provider-agnostic parser first for PR URLs
  const prResult = parsePRUrl(url)
  if (prResult && prResult.provider === 'github') {
    return {
      owner: prResult.owner,
      repo: prResult.repo,
      number: prResult.number,
    }
  }

  // Match repo URL without PR: https://github.com/owner/repo
  const repoMatch = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/,
  )
  if (repoMatch?.[1] && repoMatch[2]) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2],
    }
  }

  return null
}

/**
 * Extract the "owner/repo" string from a PR URL.
 * Works with GitHub PR URLs containing /pull/ path segment.
 *
 * For multi-provider support, also works with GitLab, Bitbucket, and Azure PR URLs.
 */
export function extractRepoFromPRUrl(url: string): string | null {
  if (!url) return null

  // Try provider-agnostic PR parser
  const parsed = parsePRUrl(url)
  if (parsed) {
    return `${parsed.owner}/${parsed.repo}`
  }

  // Fall back to GitHub-specific pattern for non-PR URLs with /pull/ path
  const match = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull/,
  )
  if (!match?.[1] || !match[2]) return null
  return `${match[1]}/${match[2]}`
}

// ---------------------------------------------------------------------------
// Git repo detection
// ---------------------------------------------------------------------------

export interface GitRepoInfo {
  readonly isGitRepo: boolean
  readonly owner: string | null
  readonly repo: string | null
  readonly remoteUrl: string | null
  readonly provider: ProviderType | null
  readonly host: string | null
  readonly baseUrl: string | null
}

/**
 * Detect if current directory is a git repo and extract owner/repo from remote.
 * Uses provider-agnostic parsing to support GitHub, GitLab, Bitbucket, Azure, and more.
 */
export async function detectGitRepo(): Promise<GitRepoInfo> {
  try {
    // Check if we're in a git repo
    await execFileAsync('git', ['rev-parse', '--git-dir'])

    // Get the remote URL
    const { stdout } = await execFileAsync('git', [
      'remote',
      'get-url',
      'origin',
    ])
    const remoteUrl = stdout.trim()

    // Parse owner/repo from URL (provider-agnostic)
    const parsed = parseGitRemote(remoteUrl)

    return {
      isGitRepo: true,
      owner: parsed?.owner ?? null,
      repo: parsed?.repo ?? null,
      remoteUrl,
      provider: parsed?.provider ?? null,
      host: parsed?.host ?? null,
      baseUrl: parsed?.baseUrl ?? null,
    }
  } catch {
    return {
      isGitRepo: false,
      owner: null,
      repo: null,
      remoteUrl: null,
      provider: null,
      host: null,
      baseUrl: null,
    }
  }
}

// ---------------------------------------------------------------------------
// Git operations
// ---------------------------------------------------------------------------

export interface CheckoutResult {
  readonly success: boolean
  readonly message: string
  readonly branchName: string
}

/**
 * Check if the working tree has uncommitted changes (staged or unstaged).
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', [
      'status',
      '--porcelain',
    ])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Checkout a PR branch by fetching the PR ref and creating a local branch.
 * Runs: git fetch origin pull/{n}/head:pr-{n} && git checkout pr-{n}
 */
export async function checkoutPR(prNumber: number): Promise<CheckoutResult> {
  const branchName = `pr-${prNumber}`

  try {
    // Check for uncommitted changes first
    const dirty = await hasUncommittedChanges()
    if (dirty) {
      return {
        success: false,
        message: 'Working tree has uncommitted changes. Commit or stash them first.',
        branchName,
      }
    }

    // Fetch the PR ref into a local branch
    await execFileAsync('git', [
      'fetch',
      'origin',
      `pull/${prNumber}/head:${branchName}`,
    ])

    // Checkout the branch
    await execFileAsync('git', ['checkout', branchName])

    return {
      success: true,
      message: `Checked out branch ${branchName}`,
      branchName,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // If branch already exists, try checking it out directly
    if (errorMessage.includes('already exists')) {
      try {
        await execFileAsync('git', ['checkout', branchName])
        // Update the branch with latest PR changes
        await execFileAsync('git', [
          'pull',
          'origin',
          `pull/${prNumber}/head`,
        ])
        return {
          success: true,
          message: `Switched to existing branch ${branchName} and updated`,
          branchName,
        }
      } catch (checkoutError) {
        return {
          success: false,
          message: `Failed to checkout ${branchName}: ${checkoutError instanceof Error ? checkoutError.message : String(checkoutError)}`,
          branchName,
        }
      }
    }

    return {
      success: false,
      message: `Failed to checkout PR #${prNumber}: ${errorMessage}`,
      branchName,
    }
  }
}
