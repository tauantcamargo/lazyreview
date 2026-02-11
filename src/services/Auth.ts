import { Context, Effect, Layer, Schema as S } from 'effect'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AuthError } from '../models/errors'
import { User } from '../models/user'

const execFileAsync = promisify(execFile)

export type TokenSource = 'manual' | 'env' | 'gh_cli' | 'none'

export interface TokenInfo {
  readonly source: TokenSource
  readonly token: string | null
  readonly maskedToken: string | null
}

// Config directory for storing token
const CONFIG_DIR = join(homedir(), '.config', 'lazyreview')
const TOKEN_FILE = join(CONFIG_DIR, '.token')

// In-memory token storage for current session
let sessionToken: string | null = null
let preferredSource: TokenSource | null = null

// Load saved token from file on startup
async function loadSavedToken(): Promise<string | null> {
  try {
    const token = await readFile(TOKEN_FILE, 'utf-8')
    return token.trim() || null
  } catch {
    return null
  }
}

// Save token to file for persistence
async function saveTokenToFile(token: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(TOKEN_FILE, token, { mode: 0o600 }) // Secure permissions
}

// Delete saved token file
async function deleteSavedToken(): Promise<void> {
  try {
    await unlink(TOKEN_FILE)
  } catch {
    // File might not exist
  }
}

// Initialize: load saved token on module load
let savedToken: string | null = null
loadSavedToken().then((token) => {
  savedToken = token
})

function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

async function tryGetGhToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export interface AuthService {
  readonly getToken: () => Effect.Effect<string, AuthError>
  readonly getUser: () => Effect.Effect<User, AuthError>
  readonly isAuthenticated: () => Effect.Effect<boolean, AuthError>
  readonly setToken: (token: string) => Effect.Effect<void, never>
  readonly getTokenInfo: () => Effect.Effect<TokenInfo, never>
  readonly setPreferredSource: (source: TokenSource) => Effect.Effect<void, never>
  readonly getAvailableSources: () => Effect.Effect<TokenSource[], never>
  readonly clearManualToken: () => Effect.Effect<void, never>
}

export class Auth extends Context.Tag('Auth')<Auth, AuthService>() {}

function resolveToken(): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    // If preferred source is set, use only that source
    if (preferredSource === 'manual') {
      const manualToken = sessionToken ?? savedToken
      if (manualToken) return manualToken
      return yield* Effect.fail(
        new AuthError({ message: 'No manual token found', reason: 'no_token' })
      )
    }

    if (preferredSource === 'env') {
      const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
      if (envToken) return envToken
      return yield* Effect.fail(
        new AuthError({ message: 'LAZYREVIEW_GITHUB_TOKEN not set', reason: 'no_token' })
      )
    }

    if (preferredSource === 'gh_cli') {
      const ghToken = yield* Effect.tryPromise({
        try: tryGetGhToken,
        catch: () => new AuthError({ message: 'gh CLI failed', reason: 'no_token' }),
      })
      if (ghToken) return ghToken
      return yield* Effect.fail(
        new AuthError({ message: 'gh CLI token not available', reason: 'no_token' })
      )
    }

    // Default priority order:
    // 1. LAZYREVIEW_GITHUB_TOKEN env var (highest priority)
    const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
    if (envToken) return envToken

    // 2. Manual/saved token (from settings or file)
    const manualToken = sessionToken ?? savedToken
    if (manualToken) return manualToken

    // 3. gh CLI fallback
    const ghResult = yield* Effect.tryPromise({
      try: tryGetGhToken,
      catch: () =>
        new AuthError({
          message: 'No GitHub token found. Set LAZYREVIEW_GITHUB_TOKEN or configure in Settings.',
          reason: 'no_token',
        }),
    })

    if (ghResult) return ghResult

    // 4. No token found - will show modal
    return yield* Effect.fail(
      new AuthError({
        message: 'No GitHub token found. Set LAZYREVIEW_GITHUB_TOKEN or configure in Settings.',
        reason: 'no_token',
      }),
    )
  })
}

function resolveTokenInfo(): Effect.Effect<TokenInfo, never> {
  return Effect.gen(function* () {
    // Check preferred source first
    if (preferredSource === 'manual') {
      const manualToken = sessionToken ?? savedToken
      if (manualToken) {
        return {
          source: 'manual' as TokenSource,
          token: manualToken,
          maskedToken: maskToken(manualToken),
        }
      }
    }

    if (preferredSource === 'env') {
      const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
      if (envToken) {
        return {
          source: 'env' as TokenSource,
          token: envToken,
          maskedToken: maskToken(envToken),
        }
      }
    }

    if (preferredSource === 'gh_cli') {
      const ghToken = yield* Effect.promise(tryGetGhToken)
      if (ghToken) {
        return {
          source: 'gh_cli' as TokenSource,
          token: ghToken,
          maskedToken: maskToken(ghToken),
        }
      }
    }

    // Default: show what's currently being used (following priority order)
    // 1. LAZYREVIEW_GITHUB_TOKEN
    const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
    if (envToken) {
      return {
        source: 'env' as TokenSource,
        token: envToken,
        maskedToken: maskToken(envToken),
      }
    }

    // 2. Manual/saved token
    const manualToken = sessionToken ?? savedToken
    if (manualToken) {
      return {
        source: 'manual' as TokenSource,
        token: manualToken,
        maskedToken: maskToken(manualToken),
      }
    }

    // 3. gh CLI
    const ghToken = yield* Effect.promise(tryGetGhToken)
    if (ghToken) {
      return {
        source: 'gh_cli' as TokenSource,
        token: ghToken,
        maskedToken: maskToken(ghToken),
      }
    }

    return {
      source: 'none' as TokenSource,
      token: null,
      maskedToken: null,
    }
  })
}

export const AuthLive = Layer.succeed(
  Auth,
  Auth.of({
    getToken: resolveToken,

    getUser: () =>
      Effect.gen(function* () {
        const token = yield* resolveToken()

        const user = yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
              },
            })

            if (!response.ok) {
              throw new Error(`GitHub API returned ${response.status}`)
            }

            const data = await response.json()
            return S.decodeUnknownSync(User)(data)
          },
          catch: (error) =>
            new AuthError({
              message: `Failed to get user: ${String(error)}`,
              reason: 'invalid_token',
            }),
        })

        return user
      }),

    isAuthenticated: () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(resolveToken())
        return result._tag === 'Right'
      }),

    setToken: (token: string) =>
      Effect.gen(function* () {
        sessionToken = token
        savedToken = token
        preferredSource = 'manual'
        // Save to file for persistence across launches
        yield* Effect.promise(() => saveTokenToFile(token))
      }),

    getTokenInfo: resolveTokenInfo,

    setPreferredSource: (source: TokenSource) =>
      Effect.sync(() => {
        preferredSource = source === 'none' ? null : source
      }),

    getAvailableSources: () =>
      Effect.gen(function* () {
        const sources: TokenSource[] = []

        // Check LAZYREVIEW_GITHUB_TOKEN only
        const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
        if (envToken) {
          sources.push('env')
        }

        // Check for manual token (session or saved)
        if (sessionToken || savedToken) {
          sources.push('manual')
        }

        // Check gh CLI
        const ghToken = yield* Effect.promise(tryGetGhToken)
        if (ghToken) {
          sources.push('gh_cli')
        }

        return sources
      }),

    clearManualToken: () =>
      Effect.gen(function* () {
        sessionToken = null
        savedToken = null
        if (preferredSource === 'manual') {
          preferredSource = null
        }
        // Delete the saved token file
        yield* Effect.promise(deleteSavedToken)
      }),
  }),
)
