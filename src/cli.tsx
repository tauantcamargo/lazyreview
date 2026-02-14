import React from 'react'
import { render } from 'ink'
import { App } from './app'
import { detectGitRepo } from './utils/git'
import type { ProviderType } from './utils/git'
import { validateOwner, validateRepo } from './utils/sanitize'

// ANSI escape codes for alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h'
const EXIT_ALT_SCREEN = '\x1b[?1049l'
const CLEAR_SCREEN = '\x1b[2J'
const CURSOR_HOME = '\x1b[H'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'

interface RepoInfo {
  readonly owner: string | null
  readonly repo: string | null
}

function parseArgs(argv: string[]): RepoInfo | null {
  const repoArg = argv[2]

  if (repoArg && repoArg.includes('/')) {
    const [owner, repo] = repoArg.split('/')
    if (owner && repo) {
      try {
        validateOwner(owner)
        validateRepo(repo)
        return { owner, repo }
      } catch {
        return null
      }
    }
  }

  return null
}

// Cleanup on exit
function cleanup(): void {
  process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN)
}

async function main(): Promise<void> {
  const arg = process.argv[2]

  if (arg === '--version' || arg === '-v') {
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const dir = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(resolve(dir, '..', 'package.json'), 'utf-8'))
    console.log(pkg.version)
    process.exit(0)
  }

  if (arg === '--help' || arg === '-h') {
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const dir = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(resolve(dir, '..', 'package.json'), 'utf-8'))
    const version = pkg.version as string

    const help = [
      `lazyreview v${version}`,
      '',
      'A TUI code review tool for GitHub, GitLab, and Bitbucket PRs.',
      '',
      'USAGE:',
      '  lazyreview                   Launch TUI (auto-detects repo)',
      '  lazyreview owner/repo        Launch TUI for a specific repo',
      '  lazyreview --help | -h       Show this help',
      '  lazyreview --version | -v    Show version',
      '',
      'ENVIRONMENT:',
      '  LAZYREVIEW_GITHUB_TOKEN      GitHub personal access token (preferred)',
      '  GITHUB_TOKEN                 Fallback if LAZYREVIEW_GITHUB_TOKEN is not set',
      '                               (also supports gh CLI token and in-app Settings)',
      '  LAZYREVIEW_GITLAB_TOKEN      GitLab personal access token',
      '  GITLAB_TOKEN                 Fallback if LAZYREVIEW_GITLAB_TOKEN is not set',
      '                               (also supports glab CLI token and in-app Settings)',
      '  LAZYREVIEW_BITBUCKET_TOKEN   Bitbucket app password (preferred)',
      '  BITBUCKET_TOKEN              Fallback if LAZYREVIEW_BITBUCKET_TOKEN is not set',
      '                               (also supports in-app Settings)',
      '',
      'CONFIG:',
      '  ~/.config/lazyreview/config.yaml',
      '',
      'IN-APP HELP:',
      '  Press ? inside the TUI to see all keyboard shortcuts.',
    ].join('\n')

    console.log(help)
    process.exit(0)
  }

  // Enter alternate screen buffer
  process.stdout.write(
    ENTER_ALT_SCREEN + CLEAR_SCREEN + CURSOR_HOME + HIDE_CURSOR,
  )

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  // Check for CLI args first
  const argsRepo = parseArgs(process.argv)

  // If no args, try to detect from current git repo
  let repoOwner: string | null = null
  let repoName: string | null = null
  let detectedProvider: ProviderType | null = null
  let detectedBaseUrl: string | null = null

  if (argsRepo) {
    repoOwner = argsRepo.owner
    repoName = argsRepo.repo
  } else {
    const gitInfo = await detectGitRepo()
    if (gitInfo.isGitRepo && gitInfo.owner && gitInfo.repo) {
      repoOwner = gitInfo.owner
      repoName = gitInfo.repo
      detectedProvider = gitInfo.provider
      detectedBaseUrl = gitInfo.baseUrl
    }
  }

  render(
    <App
      repoOwner={repoOwner}
      repoName={repoName}
      detectedProvider={detectedProvider}
      detectedBaseUrl={detectedBaseUrl}
    />,
  )
}

main().catch((error: unknown) => {
  cleanup()
  console.error('Failed to start:', error instanceof Error ? error.message : 'Unknown error')
  process.exit(1)
})
