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
// Configured hosts for self-hosted provider detection
// ---------------------------------------------------------------------------

/**
 * Map of hostnames to provider types, sourced from user config.
 * Keys are lowercase hostnames (e.g., "gitlab.mycompany.com").
 */
export interface ConfiguredHosts {
  readonly [hostname: string]: ProviderType
}

/**
 * Build a ConfiguredHosts map from config's providers and hostMappings.
 *
 * Merges:
 *   - providers.github.hosts -> all map to 'github'
 *   - providers.gitlab.hosts -> all map to 'gitlab'
 *   - gitlab.hosts -> all map to 'gitlab' (legacy field)
 *   - hostMappings -> explicit host-to-provider mappings
 */
export function buildConfiguredHosts(config: {
  readonly providers?: {
    readonly github?: { readonly hosts?: readonly string[] }
    readonly gitlab?: { readonly hosts?: readonly string[] }
  }
  readonly gitlab?: { readonly hosts?: readonly string[] }
  readonly hostMappings?: ReadonlyArray<{
    readonly host: string
    readonly provider: ProviderType
  }>
}): ConfiguredHosts {
  const hosts: Record<string, ProviderType> = {}

  // Add GitHub Enterprise hosts
  for (const h of config.providers?.github?.hosts ?? []) {
    hosts[h.toLowerCase()] = 'github'
  }

  // Add self-hosted GitLab hosts from providers.gitlab.hosts
  for (const h of config.providers?.gitlab?.hosts ?? []) {
    hosts[h.toLowerCase()] = 'gitlab'
  }

  // Add self-hosted GitLab hosts from legacy gitlab.hosts field
  for (const h of config.gitlab?.hosts ?? []) {
    hosts[h.toLowerCase()] = 'gitlab'
  }

  // Add explicit host mappings (these take precedence)
  for (const mapping of config.hostMappings ?? []) {
    hosts[mapping.host.toLowerCase()] = mapping.provider
  }

  return hosts
}

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/**
 * Detect the git hosting provider from a hostname.
 *
 * First checks well-known hosts (github.com, gitlab.com, etc.),
 * then falls back to user-configured hosts from config.
 */
export function detectProvider(
  host: string,
  configuredHosts?: ConfiguredHosts,
): ProviderType {
  const lower = host.toLowerCase()
  if (lower === 'github.com') return 'github'
  if (lower === 'gitlab.com') return 'gitlab'
  if (lower === 'bitbucket.org') return 'bitbucket'
  if (lower.includes('dev.azure.com') || lower.includes('visualstudio.com')) return 'azure'
  if (lower.includes('ssh.dev.azure.com')) return 'azure'

  // Check user-configured host mappings
  if (configuredHosts) {
    const mapped = configuredHosts[lower]
    if (mapped) return mapped
  }

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
 *
 * For GitLab (including self-hosted), supports nested group paths:
 *   git@gitlab.com:group/subgroup/project.git
 *   -> owner = "group/subgroup", repo = "project"
 */
function parseSshUrl(
  url: string,
  configuredHosts?: ConfiguredHosts,
): ParsedRemote | null {
  // Handle Azure SSH first (special format)
  const azureResult = parseAzureSsh(url)
  if (azureResult) return azureResult

  // Match: git@host:path.git or git@host:path
  // Capture host and the full path after the colon
  const match = url.match(/git@([^:]+):(.+?)(?:\.git)?$/)
  if (!match?.[1] || !match[2]) return null

  const host = match[1]
  const fullPath = match[2]
  const provider = detectProvider(host, configuredHosts)

  // Split path into segments
  const segments = fullPath.split('/')
  if (segments.length < 2) return null

  // For GitLab, support nested groups: group/subgroup/project
  // The last segment is always the repo, everything before is the owner
  if (provider === 'gitlab' && segments.length > 2) {
    const repo = segments[segments.length - 1]!
    const owner = segments.slice(0, -1).join('/')
    return {
      provider,
      host,
      owner,
      repo,
      baseUrl: getApiBaseUrl(provider, host),
    }
  }

  // Standard two-segment path: owner/repo
  const owner = segments[0]
  const repo = segments[1]
  if (!owner || !repo) return null

  return {
    provider,
    host,
    owner,
    repo,
    baseUrl: getApiBaseUrl(provider, host),
  }
}

/**
 * Parse a generic HTTPS URL: https://host/owner/repo.git
 *
 * For GitLab (including self-hosted), supports nested group paths:
 *   https://gitlab.com/group/subgroup/project.git
 *   -> owner = "group/subgroup", repo = "project"
 */
function parseHttpsUrl(
  url: string,
  configuredHosts?: ConfiguredHosts,
): ParsedRemote | null {
  // Handle Azure HTTPS first (special format with _git)
  const azureResult = parseAzureHttps(url)
  if (azureResult) return azureResult

  // Extract host and full path
  const baseMatch = url.match(/https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (!baseMatch?.[1] || !baseMatch[2]) return null

  const host = baseMatch[1]
  const fullPath = baseMatch[2]
  const provider = detectProvider(host, configuredHosts)

  // Remove query string and hash
  const cleanPath = fullPath.replace(/[?#].*$/, '')
  const segments = cleanPath.split('/').filter((s) => s.length > 0)

  if (segments.length < 2) return null

  // For GitLab, support nested groups: group/subgroup/project
  if (provider === 'gitlab' && segments.length > 2) {
    const repo = segments[segments.length - 1]!
    const owner = segments.slice(0, -1).join('/')
    return {
      provider,
      host,
      owner,
      repo,
      baseUrl: getApiBaseUrl(provider, host),
    }
  }

  // Standard two-segment path: owner/repo
  const owner = segments[0]
  const repo = segments[1]
  if (!owner || !repo) return null

  return {
    provider,
    host,
    owner,
    repo,
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
 *   - GitLab nested groups: git@gitlab.com:group/subgroup/project.git
 *
 * Pass configuredHosts to detect self-hosted instances from config.
 * Returns null for unparseable URLs.
 */
export function parseGitRemote(
  url: string,
  configuredHosts?: ConfiguredHosts,
): ParsedRemote | null {
  if (!url) return null

  const trimmed = url.trim()

  // Try SSH format first
  if (trimmed.startsWith('git@')) {
    return parseSshUrl(trimmed, configuredHosts)
  }

  // Try HTTPS/HTTP format
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return parseHttpsUrl(trimmed, configuredHosts)
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
 *   - GitLab:    https://gitlab.com/group/subgroup/project/-/merge_requests/123
 *   - GitLab:    https://gitlab.mycompany.com/group/project/-/merge_requests/123 (self-hosted)
 *   - Bitbucket: https://bitbucket.org/owner/repo/pull-requests/123
 *   - Azure:     https://dev.azure.com/org/project/_git/repo/pullrequest/123
 *
 * Pass configuredHosts to detect self-hosted GitLab MR URLs.
 */
export function parsePRUrl(
  url: string,
  configuredHosts?: ConfiguredHosts,
): ParsedPRUrl | null {
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

  // GitLab: https://host/.../-/merge_requests/123
  // Supports gitlab.com, self-hosted, and nested groups
  const glMatch = url.match(
    /https?:\/\/([^/]+)\/(.+?)\/-\/merge_requests\/(\d+)/,
  )
  if (glMatch?.[1] && glMatch[2] && glMatch[3]) {
    const glHost = glMatch[1]
    const glProvider = detectProvider(glHost, configuredHosts)
    // Only match if this is a known GitLab host
    if (glProvider === 'gitlab') {
      const pathSegments = glMatch[2].split('/')
      const repo = pathSegments[pathSegments.length - 1]!
      const owner =
        pathSegments.length > 1
          ? pathSegments.slice(0, -1).join('/')
          : pathSegments[0]!
      return {
        provider: 'gitlab',
        owner,
        repo,
        number: parseInt(glMatch[3], 10),
      }
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

  // Gitea/Forgejo: https://host/owner/repo/pulls/123
  // This is a catch-all for self-hosted Gitea instances (any domain)
  const giteaMatch = url.match(
    /https?:\/\/[^/]+\/([^/]+)\/([^/]+)\/pulls\/(\d+)/,
  )
  if (giteaMatch?.[1] && giteaMatch[2] && giteaMatch[3]) {
    return {
      provider: 'gitea',
      owner: giteaMatch[1],
      repo: giteaMatch[2],
      number: parseInt(giteaMatch[3], 10),
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
 *
 * Pass configuredHosts to resolve self-hosted instances (e.g., GitHub Enterprise)
 * from user config.
 */
export async function detectGitRepo(
  configuredHosts?: ConfiguredHosts,
): Promise<GitRepoInfo> {
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
    const parsed = parseGitRemote(remoteUrl, configuredHosts)

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
