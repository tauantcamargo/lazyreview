import { parsePRUrl } from './git'
import type { ParsedPRUrl } from './git'
import type { ProviderType } from './git'
import { validateOwner, validateRepo } from './sanitize'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DirectPR {
  readonly prNumber: number
  readonly owner: string | null
  readonly repo: string | null
  readonly provider: ProviderType | null
}

export interface ParsedCliArgs {
  readonly command: 'run' | 'help' | 'version'
  readonly owner: string | null
  readonly repo: string | null
  readonly directPR: DirectPR | null
  readonly provider: ProviderType | null
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * Find the value of a flag in argv.
 * Supports `--pr 42` and `-p 42` formats.
 * Returns the numeric value or null if not found.
 */
function findPRFlag(args: readonly string[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--pr' || arg === '-p') {
      const next = args[i + 1]
      if (next !== undefined && /^\d+$/.test(next)) {
        const num = parseInt(next, 10)
        if (Number.isFinite(num) && num > 0) {
          return num
        }
      }
      return null
    }
  }
  return null
}

/**
 * Find a positional argument (not a flag or flag value).
 * Skips --pr/N and -p/N pairs, --help, --version, -h, -v.
 */
function findPositionalArg(args: readonly string[]): string | null {
  const flagsWithValue = new Set(['--pr', '-p'])
  const standaloneFlags = new Set(['--help', '-h', '--version', '-v'])

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue

    // Skip flags that consume the next arg
    if (flagsWithValue.has(arg)) {
      i++ // skip the value too
      continue
    }

    // Skip standalone flags
    if (standaloneFlags.has(arg)) {
      continue
    }

    // This is a positional argument
    return arg
  }
  return null
}

/**
 * Try to parse an owner/repo string.
 * Returns validated owner and repo, or null if invalid.
 */
function parseOwnerRepo(
  value: string,
): { readonly owner: string; readonly repo: string } | null {
  if (!value.includes('/')) return null

  const parts = value.split('/')
  // Simple owner/repo format (exactly 2 parts)
  if (parts.length === 2 && parts[0] && parts[1]) {
    try {
      validateOwner(parts[0])
      validateRepo(parts[1])
      return { owner: parts[0], repo: parts[1] }
    } catch {
      return null
    }
  }

  return null
}

/**
 * Parse CLI arguments into a structured result.
 *
 * Supported invocations:
 *   lazyreview                           - Launch TUI
 *   lazyreview --help | -h               - Show help
 *   lazyreview --version | -v            - Show version
 *   lazyreview --pr 42                   - Open PR #42 in auto-detected repo
 *   lazyreview -p 42                     - Open PR #42 (short flag)
 *   lazyreview owner/repo --pr 42        - Open PR #42 in specified repo
 *   lazyreview https://github.com/o/r/pull/42  - Open PR from URL
 */
export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  // argv[0] = node, argv[1] = script, rest are user args
  const userArgs = argv.slice(2)

  // Check for help/version first
  if (userArgs.includes('--help') || userArgs.includes('-h')) {
    return { command: 'help', owner: null, repo: null, directPR: null, provider: null }
  }

  if (userArgs.includes('--version') || userArgs.includes('-v')) {
    return { command: 'version', owner: null, repo: null, directPR: null, provider: null }
  }

  // Check for --pr / -p flag
  const prNumber = findPRFlag(userArgs)

  // Find positional argument (owner/repo or URL)
  const positional = findPositionalArg(userArgs)

  // Try to parse positional as a full PR URL
  if (positional) {
    const prUrl = parsePRUrl(positional)
    if (prUrl) {
      return {
        command: 'run',
        owner: prUrl.owner,
        repo: prUrl.repo,
        directPR: {
          prNumber: prUrl.number,
          owner: prUrl.owner,
          repo: prUrl.repo,
          provider: prUrl.provider,
        },
        provider: prUrl.provider,
      }
    }

    // Try to parse as owner/repo
    const ownerRepo = parseOwnerRepo(positional)
    if (ownerRepo) {
      return {
        command: 'run',
        owner: ownerRepo.owner,
        repo: ownerRepo.repo,
        directPR: prNumber
          ? {
              prNumber,
              owner: ownerRepo.owner,
              repo: ownerRepo.repo,
              provider: null,
            }
          : null,
        provider: null,
      }
    }
  }

  // Only --pr flag (no positional or positional was invalid)
  if (prNumber) {
    return {
      command: 'run',
      owner: null,
      repo: null,
      directPR: {
        prNumber,
        owner: null,
        repo: null,
        provider: null,
      },
      provider: null,
    }
  }

  // Default: launch TUI
  return { command: 'run', owner: null, repo: null, directPR: null, provider: null }
}
