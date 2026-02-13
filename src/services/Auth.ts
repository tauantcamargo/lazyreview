import { Context, Effect, Layer, Schema as S } from 'effect'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import { AuthError } from '../models/errors'
import { User } from '../models/user'
import { isValidGitHubToken } from '../utils/sanitize'
import type { Provider } from './Config'

const execFileAsync = promisify(execFile)

export type TokenSource = 'manual' | 'env' | 'gh_cli' | 'none'

export interface TokenInfo {
  readonly source: TokenSource
  readonly maskedToken: string | null
}

// Config directory for storing token
const CONFIG_DIR = join(homedir(), '.config', 'lazyreview')
const TOKEN_FILE = join(CONFIG_DIR, '.token')

// ---------------------------------------------------------------------------
// Immutable auth state
// ---------------------------------------------------------------------------

interface AuthState {
  readonly sessionToken: string | null
  readonly savedToken: string | null
  readonly preferredSource: TokenSource | null
  readonly provider: Provider
  readonly initialized: boolean
}

const initialState: AuthState = {
  sessionToken: null,
  savedToken: null,
  preferredSource: null,
  provider: 'github',
  initialized: false,
}

// Single mutable reference to an immutable state object.
// All updates create a new state object (no field mutation).
let authState: AuthState = initialState

function getState(): AuthState {
  return authState
}

function setState(update: Partial<AuthState>): void {
  authState = { ...authState, ...update }
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

async function loadSavedToken(): Promise<string | null> {
  try {
    const fileStat = await stat(TOKEN_FILE)
    const perms = fileStat.mode & 0o777
    if (perms !== 0o600) {
      return null
    }
    const token = await readFile(TOKEN_FILE, 'utf-8')
    return token.trim() || null
  } catch {
    return null
  }
}

async function saveTokenToFile(token: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(TOKEN_FILE, token, { mode: 0o600 })
}

async function deleteSavedToken(): Promise<void> {
  try {
    await unlink(TOKEN_FILE)
  } catch {
    // File might not exist
  }
}

// ---------------------------------------------------------------------------
// Lazy initialization (replaces eager side effect on module load)
// ---------------------------------------------------------------------------

async function ensureInitialized(): Promise<void> {
  if (getState().initialized) return
  const token = await loadSavedToken()
  setState({ savedToken: token, initialized: true })
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function maskToken(token: string): string {
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

async function tryGetGlabToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('glab', ['auth', 'token'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export function getEnvVarName(provider: Provider): string {
  return provider === 'gitlab' ? 'LAZYREVIEW_GITLAB_TOKEN' : 'LAZYREVIEW_GITHUB_TOKEN'
}

export function setAuthProvider(provider: Provider): void {
  setState({ provider })
}

export function getAuthProvider(): Provider {
  return getState().provider
}

// ---------------------------------------------------------------------------
// For testing: reset all auth state
// ---------------------------------------------------------------------------

export function resetAuthState(): void {
  authState = initialState
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GitHub token resolution
// ---------------------------------------------------------------------------

function resolveGitHubToken(): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    yield* Effect.promise(ensureInitialized)
    const state = getState()

    if (state.preferredSource === 'manual') {
      const manualToken = state.sessionToken ?? state.savedToken
      if (manualToken) return manualToken
      return yield* Effect.fail(
        new AuthError({ message: 'No manual token found', reason: 'no_token' })
      )
    }

    if (state.preferredSource === 'env') {
      const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
      if (envToken) return envToken
      return yield* Effect.fail(
        new AuthError({ message: 'LAZYREVIEW_GITHUB_TOKEN not set', reason: 'no_token' })
      )
    }

    if (state.preferredSource === 'gh_cli') {
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
    // 1. LAZYREVIEW_GITHUB_TOKEN env var
    const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
    if (envToken) return envToken

    // 2. Manual/saved token
    const manualToken = state.sessionToken ?? state.savedToken
    if (manualToken) return manualToken

    // 3. GITHUB_TOKEN env var
    const genericToken = process.env['GITHUB_TOKEN']
    if (genericToken) return genericToken

    // 4. gh CLI fallback
    const ghResult = yield* Effect.tryPromise({
      try: tryGetGhToken,
      catch: () =>
        new AuthError({
          message: 'No GitHub token found. Set LAZYREVIEW_GITHUB_TOKEN or configure in Settings.',
          reason: 'no_token',
        }),
    })

    if (ghResult) return ghResult

    return yield* Effect.fail(
      new AuthError({
        message: 'No GitHub token found. Set LAZYREVIEW_GITHUB_TOKEN or configure in Settings.',
        reason: 'no_token',
      }),
    )
  })
}

// ---------------------------------------------------------------------------
// GitLab token resolution (stub)
// ---------------------------------------------------------------------------

function resolveGitLabToken(): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    const envToken = process.env['LAZYREVIEW_GITLAB_TOKEN']
    if (envToken) {
      return yield* Effect.fail(
        new AuthError({ message: 'GitLab not yet supported', reason: 'no_token' }),
      )
    }

    const glabToken = yield* Effect.tryPromise({
      try: tryGetGlabToken,
      catch: () =>
        new AuthError({ message: 'GitLab not yet supported', reason: 'no_token' }),
    })

    if (glabToken) {
      return yield* Effect.fail(
        new AuthError({ message: 'GitLab not yet supported', reason: 'no_token' }),
      )
    }

    return yield* Effect.fail(
      new AuthError({ message: 'GitLab not yet supported', reason: 'no_token' }),
    )
  })
}

// ---------------------------------------------------------------------------
// Provider-dispatched resolution
// ---------------------------------------------------------------------------

function resolveToken(): Effect.Effect<string, AuthError> {
  return getState().provider === 'gitlab' ? resolveGitLabToken() : resolveGitHubToken()
}

function resolveGitHubTokenInfo(): Effect.Effect<TokenInfo, never> {
  return Effect.gen(function* () {
    yield* Effect.promise(ensureInitialized)
    const state = getState()

    if (state.preferredSource === 'manual') {
      const manualToken = state.sessionToken ?? state.savedToken
      if (manualToken) {
        return {
          source: 'manual' as TokenSource,
          maskedToken: maskToken(manualToken),
        }
      }
    }

    if (state.preferredSource === 'env') {
      const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
      if (envToken) {
        return {
          source: 'env' as TokenSource,
          maskedToken: maskToken(envToken),
        }
      }
    }

    if (state.preferredSource === 'gh_cli') {
      const ghToken = yield* Effect.promise(tryGetGhToken)
      if (ghToken) {
        return {
          source: 'gh_cli' as TokenSource,
          maskedToken: maskToken(ghToken),
        }
      }
    }

    const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
    if (envToken) {
      return { source: 'env' as TokenSource, maskedToken: maskToken(envToken) }
    }

    const manualToken = state.sessionToken ?? state.savedToken
    if (manualToken) {
      return { source: 'manual' as TokenSource, maskedToken: maskToken(manualToken) }
    }

    const genericToken = process.env['GITHUB_TOKEN']
    if (genericToken) {
      return { source: 'env' as TokenSource, maskedToken: maskToken(genericToken) }
    }

    const ghToken = yield* Effect.promise(tryGetGhToken)
    if (ghToken) {
      return { source: 'gh_cli' as TokenSource, maskedToken: maskToken(ghToken) }
    }

    return { source: 'none' as TokenSource, maskedToken: null }
  })
}

function resolveTokenInfo(): Effect.Effect<TokenInfo, never> {
  if (getState().provider === 'gitlab') {
    return Effect.succeed({ source: 'none' as TokenSource, maskedToken: null })
  }
  return resolveGitHubTokenInfo()
}

// ---------------------------------------------------------------------------
// Provider-dispatched getUser
// ---------------------------------------------------------------------------

function getGitHubUser(token: string): Effect.Effect<User, AuthError> {
  return Effect.tryPromise({
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
        message: `Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reason: 'invalid_token',
      }),
  })
}

function getGitLabUser(_token: string): Effect.Effect<User, AuthError> {
  return Effect.fail(
    new AuthError({ message: 'GitLab not yet supported', reason: 'no_token' }),
  )
}

function getUser(): Effect.Effect<User, AuthError> {
  return Effect.gen(function* () {
    const token = yield* resolveToken()
    return getState().provider === 'gitlab'
      ? yield* getGitLabUser(token)
      : yield* getGitHubUser(token)
  })
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

export const AuthLive = Layer.succeed(
  Auth,
  Auth.of({
    getToken: resolveToken,

    getUser,

    isAuthenticated: () =>
      Effect.gen(function* () {
        const result = yield* Effect.either(resolveToken())
        return result._tag === 'Right'
      }),

    setToken: (token: string) =>
      Effect.gen(function* () {
        if (getState().provider === 'github' && !isValidGitHubToken(token)) {
          yield* Effect.logWarning('Token does not match known GitHub token formats')
        }
        setState({
          sessionToken: token,
          savedToken: token,
          preferredSource: 'manual',
        })
        yield* Effect.promise(() => saveTokenToFile(token))
      }),

    getTokenInfo: resolveTokenInfo,

    setPreferredSource: (source: TokenSource) =>
      Effect.sync(() => {
        setState({ preferredSource: source === 'none' ? null : source })
      }),

    getAvailableSources: () =>
      Effect.gen(function* () {
        yield* Effect.promise(ensureInitialized)
        const state = getState()
        const sources: TokenSource[] = []

        if (state.provider === 'gitlab') {
          const envToken = process.env['LAZYREVIEW_GITLAB_TOKEN']
          if (envToken) {
            sources.push('env')
          }
          const glabToken = yield* Effect.promise(tryGetGlabToken)
          if (glabToken) {
            sources.push('gh_cli')
          }
          return sources
        }

        const envToken = process.env['LAZYREVIEW_GITHUB_TOKEN']
        if (envToken) {
          sources.push('env')
        }

        if (state.sessionToken || state.savedToken) {
          sources.push('manual')
        }

        const ghToken = yield* Effect.promise(tryGetGhToken)
        if (ghToken) {
          sources.push('gh_cli')
        }

        return sources
      }),

    clearManualToken: () =>
      Effect.gen(function* () {
        const state = getState()
        setState({
          sessionToken: null,
          savedToken: null,
          preferredSource: state.preferredSource === 'manual' ? null : state.preferredSource,
        })
        yield* Effect.promise(deleteSavedToken)
      }),
  }),
)
