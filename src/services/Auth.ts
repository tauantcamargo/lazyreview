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
const TOKENS_DIR = join(CONFIG_DIR, 'tokens')

// ---------------------------------------------------------------------------
// Immutable auth state
// ---------------------------------------------------------------------------

interface AuthState {
  readonly sessionToken: string | null
  readonly savedToken: string | null
  readonly preferredSource: TokenSource | null
  readonly provider: Provider
  readonly baseUrl: string | null
  readonly initialized: boolean
}

const initialState: AuthState = {
  sessionToken: null,
  savedToken: null,
  preferredSource: null,
  provider: 'github',
  baseUrl: null,
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
// Provider metadata
// ---------------------------------------------------------------------------

interface ProviderMeta {
  readonly label: string
  readonly envVars: readonly string[]
  readonly cliCommand: readonly string[] | null
  readonly tokenUrl: string
  readonly requiredScopes: string
  readonly tokenPlaceholder: string
}

const PROVIDER_META: Readonly<Record<Provider, ProviderMeta>> = {
  github: {
    label: 'GitHub',
    envVars: ['LAZYREVIEW_GITHUB_TOKEN', 'GITHUB_TOKEN'],
    cliCommand: ['gh', 'auth', 'token'],
    tokenUrl: 'github.com/settings/tokens',
    requiredScopes: 'repo, read:user',
    tokenPlaceholder: 'ghp_xxxx...',
  },
  gitlab: {
    label: 'GitLab',
    envVars: ['LAZYREVIEW_GITLAB_TOKEN', 'GITLAB_TOKEN'],
    cliCommand: ['glab', 'auth', 'token'],
    tokenUrl: 'gitlab.com/-/user_settings/personal_access_tokens',
    requiredScopes: 'api, read_user',
    tokenPlaceholder: 'glpat-xxxx...',
  },
  bitbucket: {
    label: 'Bitbucket',
    envVars: ['LAZYREVIEW_BITBUCKET_TOKEN', 'BITBUCKET_TOKEN'],
    cliCommand: null,
    tokenUrl: 'bitbucket.org/account/settings/app-passwords/',
    requiredScopes: 'Repositories: Read, Pull requests: Read/Write',
    tokenPlaceholder: 'xxxx...',
  },
  azure: {
    label: 'Azure DevOps',
    envVars: ['LAZYREVIEW_AZURE_TOKEN', 'AZURE_DEVOPS_TOKEN'],
    cliCommand: null,
    tokenUrl: 'dev.azure.com → User Settings → Personal access tokens',
    requiredScopes: 'Code: Read & Write',
    tokenPlaceholder: 'xxxx...',
  },
  gitea: {
    label: 'Gitea',
    envVars: ['LAZYREVIEW_GITEA_TOKEN', 'GITEA_TOKEN'],
    cliCommand: null,
    tokenUrl: 'your-instance/user/settings/applications',
    requiredScopes: 'repo',
    tokenPlaceholder: 'xxxx...',
  },
}

export function getProviderMeta(provider: Provider): ProviderMeta {
  return PROVIDER_META[provider]
}

// ---------------------------------------------------------------------------
// File I/O helpers (per-provider token storage)
// ---------------------------------------------------------------------------

function getProviderTokenFile(provider: Provider): string {
  return join(TOKENS_DIR, `${provider}.token`)
}

async function loadSavedToken(): Promise<string | null> {
  const provider = getState().provider

  // Try provider-specific token file first
  const providerFile = getProviderTokenFile(provider)
  const providerToken = await readTokenFile(providerFile)
  if (providerToken) return providerToken

  // Fall back to legacy token file for GitHub (backward compatibility)
  if (provider === 'github') {
    const legacyToken = await readTokenFile(TOKEN_FILE)
    if (legacyToken) {
      // Migrate to new location
      await saveTokenToProviderFile(provider, legacyToken)
      return legacyToken
    }
  }

  return null
}

async function readTokenFile(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath)
    const perms = fileStat.mode & 0o777
    if (perms !== 0o600) {
      return null
    }
    const token = await readFile(filePath, 'utf-8')
    return token.trim() || null
  } catch {
    return null
  }
}

async function saveTokenToProviderFile(provider: Provider, token: string): Promise<void> {
  await mkdir(TOKENS_DIR, { recursive: true, mode: 0o700 })
  await writeFile(getProviderTokenFile(provider), token, { mode: 0o600 })
}

async function saveTokenToFile(token: string): Promise<void> {
  const provider = getState().provider

  // Save to provider-specific file
  await saveTokenToProviderFile(provider, token)

  // Also save to legacy location for GitHub backward compatibility
  if (provider === 'github') {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
    await writeFile(TOKEN_FILE, token, { mode: 0o600 })
  }
}

async function deleteSavedToken(): Promise<void> {
  const provider = getState().provider

  // Delete provider-specific token file
  try {
    await unlink(getProviderTokenFile(provider))
  } catch {
    // File might not exist
  }

  // Also delete legacy file for GitHub
  if (provider === 'github') {
    try {
      await unlink(TOKEN_FILE)
    } catch {
      // File might not exist
    }
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

async function tryCliToken(command: readonly string[]): Promise<string | null> {
  try {
    const [cmd, ...args] = command
    if (!cmd) return null
    const { stdout } = await execFileAsync(cmd, args)
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function tryGetGhToken(): Promise<string | null> {
  return tryCliToken(['gh', 'auth', 'token'])
}

async function tryGetGlabToken(): Promise<string | null> {
  return tryCliToken(['glab', 'auth', 'token'])
}

function tryGetCliTokenForProvider(provider: Provider): Promise<string | null> {
  const meta = PROVIDER_META[provider]
  if (!meta.cliCommand) return Promise.resolve(null)
  return tryCliToken(meta.cliCommand)
}

export function getEnvVarName(provider: Provider): string {
  const meta = PROVIDER_META[provider]
  return meta.envVars[0] ?? `LAZYREVIEW_${provider.toUpperCase()}_TOKEN`
}

export function getProviderTokenFilePath(provider: Provider): string {
  return getProviderTokenFile(provider)
}

export function setAuthProvider(provider: Provider): void {
  setState({ provider, initialized: false })
}

export function getAuthProvider(): Provider {
  return getState().provider
}

export function setAuthBaseUrl(baseUrl: string | null): void {
  setState({ baseUrl })
}

export function getAuthBaseUrl(): string | null {
  return getState().baseUrl
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
// Generic token resolution for any provider
// ---------------------------------------------------------------------------

function resolveProviderToken(provider: Provider): Effect.Effect<string, AuthError> {
  return Effect.gen(function* () {
    yield* Effect.promise(ensureInitialized)
    const state = getState()
    const meta = PROVIDER_META[provider]

    // When a preferred source is set, use only that source
    if (state.preferredSource === 'manual') {
      const manualToken = state.sessionToken ?? state.savedToken
      if (manualToken) return manualToken
      return yield* Effect.fail(
        new AuthError({ message: 'No manual token found', reason: 'no_token' })
      )
    }

    if (state.preferredSource === 'env') {
      const envToken = findEnvToken(meta.envVars)
      if (envToken) return envToken
      return yield* Effect.fail(
        new AuthError({
          message: `${meta.envVars[0]} not set`,
          reason: 'no_token',
        })
      )
    }

    if (state.preferredSource === 'gh_cli') {
      const cliToken = yield* Effect.tryPromise({
        try: () => tryGetCliTokenForProvider(provider),
        catch: () => new AuthError({ message: 'CLI failed', reason: 'no_token' }),
      })
      if (cliToken) return cliToken
      return yield* Effect.fail(
        new AuthError({ message: 'CLI token not available', reason: 'no_token' })
      )
    }

    // Default priority order:
    // 1. Primary env var (e.g. LAZYREVIEW_GITHUB_TOKEN)
    const primaryEnvVar = meta.envVars[0]
    if (primaryEnvVar) {
      const primaryToken = process.env[primaryEnvVar]
      if (primaryToken) return primaryToken
    }

    // 2. Manual/saved token
    const manualToken = state.sessionToken ?? state.savedToken
    if (manualToken) return manualToken

    // 3. Secondary env var (e.g. GITHUB_TOKEN)
    const secondaryEnvVar = meta.envVars[1]
    if (secondaryEnvVar) {
      const secondaryToken = process.env[secondaryEnvVar]
      if (secondaryToken) return secondaryToken
    }

    // 4. CLI fallback (if available for this provider)
    if (meta.cliCommand) {
      const cliResult = yield* Effect.tryPromise({
        try: () => tryGetCliTokenForProvider(provider),
        catch: () =>
          new AuthError({
            message: `No ${meta.label} token found. Set ${meta.envVars[0]} or configure in Settings.`,
            reason: 'no_token',
          }),
      })

      if (cliResult) return cliResult
    }

    return yield* Effect.fail(
      new AuthError({
        message: `No ${meta.label} token found. Set ${meta.envVars[0]} or configure in Settings.`,
        reason: 'no_token',
      }),
    )
  })
}

function findEnvToken(envVars: readonly string[]): string | undefined {
  for (const varName of envVars) {
    const value = process.env[varName]
    if (value) return value
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Provider-dispatched resolution
// ---------------------------------------------------------------------------

function resolveToken(): Effect.Effect<string, AuthError> {
  return resolveProviderToken(getState().provider)
}

// ---------------------------------------------------------------------------
// Generic token info resolution
// ---------------------------------------------------------------------------

function resolveProviderTokenInfo(provider: Provider): Effect.Effect<TokenInfo, never> {
  return Effect.gen(function* () {
    yield* Effect.promise(ensureInitialized)
    const state = getState()
    const meta = PROVIDER_META[provider]

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
      const envToken = findEnvToken(meta.envVars)
      if (envToken) {
        return {
          source: 'env' as TokenSource,
          maskedToken: maskToken(envToken),
        }
      }
    }

    if (state.preferredSource === 'gh_cli') {
      const cliToken = yield* Effect.promise(() => tryGetCliTokenForProvider(provider))
      if (cliToken) {
        return {
          source: 'gh_cli' as TokenSource,
          maskedToken: maskToken(cliToken),
        }
      }
    }

    // Default priority
    const primaryEnvVar = meta.envVars[0]
    if (primaryEnvVar) {
      const primaryToken = process.env[primaryEnvVar]
      if (primaryToken) {
        return { source: 'env' as TokenSource, maskedToken: maskToken(primaryToken) }
      }
    }

    const manualToken = state.sessionToken ?? state.savedToken
    if (manualToken) {
      return { source: 'manual' as TokenSource, maskedToken: maskToken(manualToken) }
    }

    const secondaryEnvVar = meta.envVars[1]
    if (secondaryEnvVar) {
      const secondaryToken = process.env[secondaryEnvVar]
      if (secondaryToken) {
        return { source: 'env' as TokenSource, maskedToken: maskToken(secondaryToken) }
      }
    }

    if (meta.cliCommand) {
      const cliToken = yield* Effect.promise(() => tryGetCliTokenForProvider(provider))
      if (cliToken) {
        return { source: 'gh_cli' as TokenSource, maskedToken: maskToken(cliToken) }
      }
    }

    return { source: 'none' as TokenSource, maskedToken: null }
  })
}

function resolveTokenInfo(): Effect.Effect<TokenInfo, never> {
  return resolveProviderTokenInfo(getState().provider)
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

function getGitLabUser(token: string): Effect.Effect<User, AuthError> {
  return Effect.tryPromise({
    try: async () => {
      const baseUrl = getState().baseUrl ?? 'https://gitlab.com'
      const apiUrl = baseUrl.includes('/api/v4') ? baseUrl : `${baseUrl}/api/v4`
      const response = await fetch(`${apiUrl}/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`GitLab API returned ${response.status}`)
      }

      const data = await response.json() as { username: string; avatar_url: string; id: number }
      // Map GitLab user fields to our User schema
      return S.decodeUnknownSync(User)({
        login: data.username,
        avatar_url: data.avatar_url ?? '',
        id: data.id,
      })
    },
    catch: (error) =>
      new AuthError({
        message: `Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reason: 'invalid_token',
      }),
  })
}

function getProviderUser(provider: Provider, token: string): Effect.Effect<User, AuthError> {
  if (provider === 'github') return getGitHubUser(token)
  if (provider === 'gitlab') return getGitLabUser(token)
  return Effect.fail(
    new AuthError({ message: `${PROVIDER_META[provider].label} not yet supported`, reason: 'no_token' }),
  )
}

function getUser(): Effect.Effect<User, AuthError> {
  return Effect.gen(function* () {
    const token = yield* resolveToken()
    return yield* getProviderUser(getState().provider, token)
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
        const meta = PROVIDER_META[state.provider]
        const sources: TokenSource[] = []

        // Check env vars
        const envToken = findEnvToken(meta.envVars)
        if (envToken) {
          sources.push('env')
        }

        // Check manual/saved tokens
        if (state.sessionToken || state.savedToken) {
          sources.push('manual')
        }

        // Check CLI availability
        if (meta.cliCommand) {
          const cliToken = yield* Effect.promise(() => tryGetCliTokenForProvider(state.provider))
          if (cliToken) {
            sources.push('gh_cli')
          }
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
