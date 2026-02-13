import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { maskToken, getEnvVarName, setAuthProvider, getAuthProvider, Auth, AuthLive } from './Auth'

// ---------------------------------------------------------------------------
// Mock child_process.execFile to control gh CLI responses
// ---------------------------------------------------------------------------

let ghCliResult: { stdout: string } | null = null
let ghCliError: Error | null = null

vi.mock('node:child_process', () => ({
  execFile: (_cmd: string, _args: string[], cb: (err: Error | null, result?: { stdout: string }) => void) => {
    if (ghCliError) {
      cb(ghCliError)
    } else if (ghCliResult) {
      cb(null, ghCliResult)
    } else {
      cb(new Error('gh: command not found'))
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock node:fs/promises to avoid actual file I/O
// ---------------------------------------------------------------------------

let savedFileContent: string | null = null

vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: vi.fn().mockImplementation(async (_path: string, content: string) => {
    savedFileContent = content
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runAuth<A>(
  effect: (auth: typeof Auth.Type) => Effect.Effect<A, unknown>,
): Promise<A> {
  const program = Effect.gen(function* () {
    const auth = yield* Auth
    return yield* effect(auth)
  }).pipe(
    Effect.provide(AuthLive),
    Effect.catchAll((error) => Effect.die(error)),
  )
  return Effect.runPromise(program as Effect.Effect<A, never, never>)
}

function runAuthExit<A, E>(
  effect: (auth: typeof Auth.Type) => Effect.Effect<A, E>,
): Promise<Exit.Exit<A, E>> {
  const program = Effect.gen(function* () {
    const auth = yield* Auth
    return yield* Effect.exit(effect(auth))
  }).pipe(Effect.provide(AuthLive))
  return Effect.runPromise(program as Effect.Effect<Exit.Exit<A, E>, never, never>)
}

// ---------------------------------------------------------------------------
// Existing tests (preserved)
// ---------------------------------------------------------------------------

describe('maskToken', () => {
  it('masks short tokens with ****', () => {
    expect(maskToken('short')).toBe('****')
  })

  it('masks tokens of exactly 8 characters', () => {
    expect(maskToken('12345678')).toBe('****')
  })

  it('shows first 4 and last 4 chars for longer tokens', () => {
    expect(maskToken('ghp_abcdef123456')).toBe('ghp_...3456')
  })

  it('handles a 9-character token', () => {
    const result = maskToken('123456789')
    expect(result).toBe('1234...6789')
  })

  it('masks a 1-character token', () => {
    expect(maskToken('x')).toBe('****')
  })

  it('masks an empty token', () => {
    expect(maskToken('')).toBe('****')
  })

  it('masks a typical GitHub PAT', () => {
    const pat = 'ghp_1234567890abcdefghijklmno'
    const result = maskToken(pat)
    expect(result).toBe('ghp_...lmno')
    // Must not contain the full token
    expect(result).not.toBe(pat)
  })

  it('masks a classic GitHub token', () => {
    const token = 'github_pat_01234567890abcdefghij'
    const result = maskToken(token)
    expect(result.startsWith('gith')).toBe(true)
    expect(result.endsWith('ghij')).toBe(true)
    expect(result).toContain('...')
  })

  it('handles exactly 7-char token (boundary below 8)', () => {
    expect(maskToken('1234567')).toBe('****')
  })

  it('handles exactly 9-char token (boundary above 8)', () => {
    const result = maskToken('abcdefghi')
    expect(result).toBe('abcd...fghi')
  })
})

describe('getEnvVarName', () => {
  it('returns LAZYREVIEW_GITHUB_TOKEN for github provider', () => {
    expect(getEnvVarName('github')).toBe('LAZYREVIEW_GITHUB_TOKEN')
  })

  it('returns LAZYREVIEW_GITLAB_TOKEN for gitlab provider', () => {
    expect(getEnvVarName('gitlab')).toBe('LAZYREVIEW_GITLAB_TOKEN')
  })
})

describe('setAuthProvider / getAuthProvider', () => {
  afterEach(() => {
    // Reset to default
    setAuthProvider('github')
  })

  it('defaults to github', () => {
    expect(getAuthProvider()).toBe('github')
  })

  it('can be set to gitlab', () => {
    setAuthProvider('gitlab')
    expect(getAuthProvider()).toBe('gitlab')
  })

  it('can be switched back to github', () => {
    setAuthProvider('gitlab')
    setAuthProvider('github')
    expect(getAuthProvider()).toBe('github')
  })
})

// ---------------------------------------------------------------------------
// Token resolution priority chain tests
// ---------------------------------------------------------------------------

describe('resolveToken priority chain', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    // Clear module-level state by clearing manual token
    ghCliResult = null
    ghCliError = null
    savedFileContent = null
    setAuthProvider('github')

    // Clear env vars
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']

    // Clear manual token state
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv }
  })

  it('returns LAZYREVIEW_GITHUB_TOKEN when set (highest priority)', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_token_12345'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_token_12345')
  })

  it('returns saved/session token when no env var set', async () => {
    // Set a manual token
    await runAuth((auth) => auth.setToken('ghp_manual_token_12345'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_manual_token_12345')
  })

  it('returns GITHUB_TOKEN as fallback after manual token', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_generic_fallback_12345'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_generic_fallback_12345')
  })

  it('returns gh CLI token when no env vars or manual token', async () => {
    ghCliResult = { stdout: 'ghp_cli_token_1234567' }
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_cli_token_1234567')
  })

  it('fails with AuthError when no token source available', async () => {
    ghCliResult = null
    ghCliError = new Error('gh: command not found')
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('LAZYREVIEW_GITHUB_TOKEN takes precedence over manual token', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_wins_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_loses_1234567'))
    // Reset preferredSource to default (not manual)
    await runAuth((auth) => auth.setPreferredSource('none'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_wins_1234567')
  })

  it('manual token takes precedence over GITHUB_TOKEN', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_generic_loses_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_wins_1234567'))
    // Reset to default priority
    await runAuth((auth) => auth.setPreferredSource('none'))
    const token = await runAuth((auth) => auth.getToken())
    // setToken sets preferredSource to 'manual', so we need to reset
    // Actually, setToken sets preferredSource to 'manual', so it will use manual
    expect(token).toBe('ghp_manual_wins_1234567')
  })

  it('GITHUB_TOKEN takes precedence over gh CLI', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_generic_wins_1234567'
    ghCliResult = { stdout: 'ghp_cli_loses_1234567' }
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_generic_wins_1234567')
  })
})

describe('preferredSource overrides', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ghCliResult = null
    ghCliError = null
    setAuthProvider('github')
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('preferredSource=manual uses only manual token', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_ignored_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_only_1234567'))
    // setToken already sets preferredSource to manual
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_manual_only_1234567')
  })

  it('preferredSource=manual fails if no manual token exists', async () => {
    await runAuth((auth) => auth.setPreferredSource('manual'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('preferredSource=env uses only LAZYREVIEW_GITHUB_TOKEN', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_preferred_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_ignored_1234567'))
    await runAuth((auth) => auth.setPreferredSource('env'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_preferred_1234567')
  })

  it('preferredSource=env fails if env var not set', async () => {
    await runAuth((auth) => auth.setPreferredSource('env'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('preferredSource=gh_cli uses only gh CLI token', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_ignored_1234567'
    ghCliResult = { stdout: 'ghp_cli_preferred_1234567' }
    await runAuth((auth) => auth.setPreferredSource('gh_cli'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_cli_preferred_1234567')
  })

  it('preferredSource=gh_cli fails if gh CLI unavailable', async () => {
    ghCliResult = null
    ghCliError = null
    await runAuth((auth) => auth.setPreferredSource('gh_cli'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('setToken', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ghCliResult = null
    savedFileContent = null
    setAuthProvider('github')
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('saves token to session and makes it available via getToken', async () => {
    await runAuth((auth) => auth.setToken('ghp_new_token_123456789'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_new_token_123456789')
  })

  it('sets preferredSource to manual', async () => {
    await runAuth((auth) => auth.setToken('ghp_sets_preferred_12345'))
    // After setToken, getToken should use manual even if env is set
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_ignored_1234567'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_sets_preferred_12345')
  })

  it('triggers file save', async () => {
    await runAuth((auth) => auth.setToken('ghp_file_save_123456789'))
    expect(savedFileContent).toBe('ghp_file_save_123456789')
  })
})

describe('clearManualToken', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ghCliResult = null
    ghCliError = null
    savedFileContent = null
    setAuthProvider('github')
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('clears session and saved token', async () => {
    await runAuth((auth) => auth.setToken('ghp_to_be_cleared_12345'))
    await runAuth((auth) => auth.clearManualToken())
    // With no tokens available and no gh CLI, should fail
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('resets preferredSource from manual to null', async () => {
    await runAuth((auth) => auth.setToken('ghp_to_be_cleared_12345'))
    // preferredSource is now 'manual'
    await runAuth((auth) => auth.clearManualToken())
    // preferredSource should be null, so default priority chain is used
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_after_clear_12345'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_after_clear_12345')
  })
})

describe('getAvailableSources', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ghCliResult = null
    ghCliError = null
    setAuthProvider('github')
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('detects env source when LAZYREVIEW_GITHUB_TOKEN is set', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_available_12345678'
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
  })

  it('detects manual source when session token exists', async () => {
    await runAuth((auth) => auth.setToken('ghp_manual_avail_12345'))
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('manual')
  })

  it('detects gh_cli source when gh CLI is available', async () => {
    ghCliResult = { stdout: 'ghp_cli_avail_1234567' }
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('gh_cli')
  })

  it('returns empty array when nothing is available', async () => {
    ghCliResult = null
    ghCliError = new Error('not found')
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toEqual([])
  })

  it('detects multiple sources simultaneously', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_multi_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_multi_1234567'))
    ghCliResult = { stdout: 'ghp_cli_multi_1234567' }
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
    expect(sources).toContain('manual')
    expect(sources).toContain('gh_cli')
  })
})

describe('isAuthenticated', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    ghCliResult = null
    ghCliError = null
    setAuthProvider('github')
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    await runAuth((auth) => auth.clearManualToken())
    await runAuth((auth) => auth.setPreferredSource('none'))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true when a token is available', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_authenticated_12345'
    const result = await runAuth((auth) => auth.isAuthenticated())
    expect(result).toBe(true)
  })

  it('returns false when no token is available', async () => {
    ghCliError = new Error('not found')
    const result = await runAuth((auth) => auth.isAuthenticated())
    expect(result).toBe(false)
  })
})
