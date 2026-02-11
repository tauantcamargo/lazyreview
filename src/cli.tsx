import React from 'react'
import { render } from 'ink'
import { App } from './app'

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

const { owner, repo } = parseArgs(process.argv)

render(<App owner={owner} repo={repo} />)
