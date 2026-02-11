import React from 'react'
import { render } from 'ink'
import { App } from './app'
import { detectGitRepo } from './utils/git'

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
      return { owner, repo }
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

  if (argsRepo) {
    repoOwner = argsRepo.owner
    repoName = argsRepo.repo
  } else {
    const gitInfo = await detectGitRepo()
    if (gitInfo.isGitRepo && gitInfo.owner && gitInfo.repo) {
      repoOwner = gitInfo.owner
      repoName = gitInfo.repo
    }
  }

  render(<App repoOwner={repoOwner} repoName={repoName} />)
}

main().catch((error) => {
  cleanup()
  console.error('Failed to start:', error)
  process.exit(1)
})
