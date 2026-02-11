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

function parseGitHubUrl(
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
