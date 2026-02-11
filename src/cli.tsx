import React from 'react'
import { render } from 'ink'
import { App } from './app'

// ANSI escape codes for alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h'
const EXIT_ALT_SCREEN = '\x1b[?1049l'
const CLEAR_SCREEN = '\x1b[2J'
const CURSOR_HOME = '\x1b[H'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'

function parseArgs(argv: string[]): { owner: string; repo: string } {
  const repoArg = argv[2]

  if (repoArg && repoArg.includes('/')) {
    const [owner, repo] = repoArg.split('/')
    if (owner && repo) {
      return { owner, repo }
    }
  }

  return {
    owner: process.env['LAZY_OWNER'] ?? 'facebook',
    repo: process.env['LAZY_REPO'] ?? 'react',
  }
}

// Enter alternate screen buffer
process.stdout.write(ENTER_ALT_SCREEN + CLEAR_SCREEN + CURSOR_HOME + HIDE_CURSOR)

// Cleanup on exit
function cleanup(): void {
  process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN)
}

process.on('exit', cleanup)
process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})

const { owner, repo } = parseArgs(process.argv)

render(<App owner={owner} repo={repo} />)
