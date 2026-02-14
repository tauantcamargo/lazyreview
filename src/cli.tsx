import React from 'react'
import { render } from 'ink'
import { App } from './app'
import { detectGitRepo, buildConfiguredHosts } from './utils/git'
import type { ProviderType, ConfiguredHosts } from './utils/git'
import { parseCliArgs } from './utils/cli-args'
import { loadCustomThemes, setCustomThemes } from './theme/index'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

// ANSI escape codes for alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h'
const EXIT_ALT_SCREEN = '\x1b[?1049l'
const CLEAR_SCREEN = '\x1b[2J'
const CURSOR_HOME = '\x1b[H'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'

// Cleanup on exit
function cleanup(): void {
  process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN)
}

async function showVersion(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const { resolve, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const dir = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(
    readFileSync(resolve(dir, '..', 'package.json'), 'utf-8'),
  )
  console.log(pkg.version)
  process.exit(0)
}

async function showHelp(): Promise<void> {
  const { readFileSync } = await import('node:fs')
  const { resolve, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const dir = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(
    readFileSync(resolve(dir, '..', 'package.json'), 'utf-8'),
  )
  const version = pkg.version as string

  const help = [
    `lazyreview v${version}`,
    '',
    'A TUI code review tool for GitHub, GitLab, Bitbucket, Azure DevOps, and Gitea/Forgejo PRs.',
    '',
    'USAGE:',
    '  lazyreview                           Launch TUI (auto-detects repo)',
    '  lazyreview owner/repo                Launch TUI for a specific repo',
    '  lazyreview --pr <number>             Open PR directly (auto-detects repo)',
    '  lazyreview -p <number>               Open PR directly (short flag)',
    '  lazyreview owner/repo --pr <number>  Open PR in a specific repo',
    '  lazyreview <pr-url>                  Open PR directly from a URL',
    '  lazyreview --help | -h               Show this help',
    '  lazyreview --version | -v            Show version',
    '',
    'EXAMPLES:',
    '  lazyreview --pr 42',
    '  lazyreview facebook/react --pr 42',
    '  lazyreview https://github.com/facebook/react/pull/42',
    '  lazyreview https://gitlab.com/org/project/-/merge_requests/99',
    '  lazyreview https://bitbucket.org/team/repo/pull-requests/5',
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
    '  LAZYREVIEW_AZURE_TOKEN       Azure DevOps PAT (preferred)',
    '  AZURE_DEVOPS_TOKEN           Fallback if LAZYREVIEW_AZURE_TOKEN is not set',
    '                               (also supports in-app Settings)',
    '  LAZYREVIEW_GITEA_TOKEN       Gitea/Forgejo personal access token (preferred)',
    '  GITEA_TOKEN                  Fallback if LAZYREVIEW_GITEA_TOKEN is not set',
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

/**
 * Load configured hosts from config file for self-hosted provider detection.
 * This runs before the React app starts so we can pass hosts to git detection.
 * Returns an empty map if config is missing or invalid.
 */
async function loadConfiguredHosts(): Promise<ConfiguredHosts> {
  try {
    const configPath = join(homedir(), '.config', 'lazyreview', 'config.yaml')
    const content = await readFile(configPath, 'utf-8')
    const parsed = parseYaml(content, { maxAliasCount: 10 })
    if (parsed && typeof parsed === 'object') {
      return buildConfiguredHosts(parsed as Record<string, unknown>)
    }
  } catch {
    // Config file doesn't exist or is invalid -- that's fine
  }
  return {}
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv)

  if (parsed.command === 'version') {
    await showVersion()
    return
  }

  if (parsed.command === 'help') {
    await showHelp()
    return
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

  // Load configured hosts from config for self-hosted provider detection
  const configuredHosts = await loadConfiguredHosts()

  // Load custom themes from ~/.config/lazyreview/themes/
  const themesDir = join(homedir(), '.config', 'lazyreview', 'themes')
  const customThemesResult = await loadCustomThemes(themesDir)
  setCustomThemes(customThemesResult.themes)

  // Resolve repo info: CLI args take priority, then git detection
  let repoOwner: string | null = parsed.owner
  let repoName: string | null = parsed.repo
  let detectedProvider: ProviderType | null = parsed.provider as ProviderType | null
  let detectedBaseUrl: string | null = null

  // If no repo specified in args, try to detect from current git repo
  if (!repoOwner || !repoName) {
    const gitInfo = await detectGitRepo(configuredHosts)
    if (gitInfo.isGitRepo && gitInfo.owner && gitInfo.repo) {
      repoOwner = repoOwner ?? gitInfo.owner
      repoName = repoName ?? gitInfo.repo
      detectedProvider = detectedProvider ?? gitInfo.provider
      detectedBaseUrl = gitInfo.baseUrl
    }
  }

  render(
    <App
      repoOwner={repoOwner}
      repoName={repoName}
      detectedProvider={detectedProvider}
      detectedBaseUrl={detectedBaseUrl}
      directPR={parsed.directPR}
    />,
  )
}

main().catch((error: unknown) => {
  cleanup()
  console.error(
    'Failed to start:',
    error instanceof Error ? error.message : 'Unknown error',
  )
  process.exit(1)
})
