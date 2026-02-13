import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitRepoInfo {
  readonly isGitRepo: boolean
  readonly owner: string | null
  readonly repo: string | null
  readonly remoteUrl: string | null
}

/**
 * Detect if current directory is a git repo and extract owner/repo from remote
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

    // Parse owner/repo from URL
    // Supports: git@github.com:owner/repo.git, https://github.com/owner/repo.git
    const parsed = parseGitHubUrl(remoteUrl)

    return {
      isGitRepo: true,
      owner: parsed?.owner ?? null,
      repo: parsed?.repo ?? null,
      remoteUrl,
    }
  } catch {
    return {
      isGitRepo: false,
      owner: null,
      repo: null,
      remoteUrl: null,
    }
  }
}

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

export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/)
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: sshMatch[2]! }
  }

  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/,
  )
  if (httpsMatch) {
    return { owner: httpsMatch[1]!, repo: httpsMatch[2]! }
  }

  return null
}

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

  // Match PR URL: https://github.com/owner/repo/pull/123
  const prMatch = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  )
  if (prMatch?.[1] && prMatch[2] && prMatch[3]) {
    return {
      owner: prMatch[1],
      repo: prMatch[2],
      number: parseInt(prMatch[3], 10),
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
 * Extract the "owner/repo" string from a GitHub PR URL.
 * Only matches URLs containing /pull/ path segment.
 */
export function extractRepoFromPRUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(
    /https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull/,
  )
  if (!match?.[1] || !match[2]) return null
  return `${match[1]}/${match[2]}`
}
