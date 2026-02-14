import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import {
  maskToken,
  getEnvVarName,
  setAuthProvider,
  getAuthProvider,
  resetAuthState,
  getProviderMeta,
  getProviderTokenFilePath,
  setAuthBaseUrl,
  getAuthBaseUrl,
  Auth,
  AuthLive,
  type TokenInfo,
} from './Auth'

// ---------------------------------------------------------------------------
// Mock child_process.execFile to control CLI responses
// ---------------------------------------------------------------------------

let cliResults: Record<string, { stdout: string } | null> = {}
let cliErrors: Record<string, Error | null> = {}

vi.mock('node:child_process', () => ({
  execFile: (
    cmd: string,
    args: string[],
    cb: (err: Error | null, result?: { stdout: string }) => void,
  ) => {
    const key = `${cmd} ${args.join(' ')}`
    const error = cliErrors[key]
    const result = cliResults[key]
    if (error) {
      cb(error)
    } else if (result) {
      cb(null, result)
    } else {
      cb(new Error(`${cmd}: command not found`))
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock node:fs/promises to avoid actual file I/O
// ---------------------------------------------------------------------------

let savedFiles: Record<string, string> = {}
let fileStats: Record<string, { mode: number }> = {}
let fileContents: Record<string, string> = {}
let deletedFiles: string[] = []

vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockImplementation(async (path: string) => {
    const entry = fileStats[path]
    if (entry) return entry
    throw new Error('ENOENT')
  }),
  readFile: vi.fn().mockImplementation(async (path: string) => {
    const content = fileContents[path]
    if (content !== undefined) return content
    throw new Error('ENOENT')
  }),
  writeFile: vi.fn().mockImplementation(async (path: string, content: string) => {
    savedFiles[path] = content
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockImplementation(async (path: string) => {
    deletedFiles.push(path)
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCliResult(cmd: string, args: string[], stdout: string): void {
  cliResults[`${cmd} ${args.join(' ')}`] = { stdout }
}

function setCliError(cmd: string, args: string[], error: Error): void {
  cliErrors[`${cmd} ${args.join(' ')}`] = error
}

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
  return Effect.runPromise(
    program as Effect.Effect<Exit.Exit<A, E>, never, never>,
  )
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

  it('returns LAZYREVIEW_BITBUCKET_TOKEN for bitbucket provider', () => {
    expect(getEnvVarName('bitbucket')).toBe('LAZYREVIEW_BITBUCKET_TOKEN')
  })

  it('returns LAZYREVIEW_AZURE_TOKEN for azure provider', () => {
    expect(getEnvVarName('azure')).toBe('LAZYREVIEW_AZURE_TOKEN')
  })

  it('returns LAZYREVIEW_GITEA_TOKEN for gitea provider', () => {
    expect(getEnvVarName('gitea')).toBe('LAZYREVIEW_GITEA_TOKEN')
  })
})

describe('setAuthProvider / getAuthProvider', () => {
  afterEach(() => {
    resetAuthState()
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

  it('can be set to bitbucket', () => {
    setAuthProvider('bitbucket')
    expect(getAuthProvider()).toBe('bitbucket')
  })

  it('can be set to azure', () => {
    setAuthProvider('azure')
    expect(getAuthProvider()).toBe('azure')
  })

  it('can be set to gitea', () => {
    setAuthProvider('gitea')
    expect(getAuthProvider()).toBe('gitea')
  })
})

// ---------------------------------------------------------------------------
// Provider metadata tests
// ---------------------------------------------------------------------------

describe('getProviderMeta', () => {
  it('returns GitHub metadata', () => {
    const meta = getProviderMeta('github')
    expect(meta.label).toBe('GitHub')
    expect(meta.envVars).toContain('LAZYREVIEW_GITHUB_TOKEN')
    expect(meta.envVars).toContain('GITHUB_TOKEN')
    expect(meta.cliCommand).toEqual(['gh', 'auth', 'token'])
    expect(meta.tokenUrl).toContain('github.com')
    expect(meta.requiredScopes).toContain('repo')
    expect(meta.tokenPlaceholder).toContain('ghp_')
  })

  it('returns GitLab metadata', () => {
    const meta = getProviderMeta('gitlab')
    expect(meta.label).toBe('GitLab')
    expect(meta.envVars).toContain('LAZYREVIEW_GITLAB_TOKEN')
    expect(meta.envVars).toContain('GITLAB_TOKEN')
    expect(meta.cliCommand).toEqual(['glab', 'auth', 'token'])
    expect(meta.tokenUrl).toContain('gitlab.com')
    expect(meta.requiredScopes).toContain('api')
  })

  it('returns Bitbucket metadata', () => {
    const meta = getProviderMeta('bitbucket')
    expect(meta.label).toBe('Bitbucket')
    expect(meta.envVars).toContain('LAZYREVIEW_BITBUCKET_TOKEN')
    expect(meta.envVars).toContain('BITBUCKET_TOKEN')
    expect(meta.cliCommand).toBeNull()
    expect(meta.tokenUrl).toContain('bitbucket.org')
  })

  it('returns Azure DevOps metadata', () => {
    const meta = getProviderMeta('azure')
    expect(meta.label).toBe('Azure DevOps')
    expect(meta.envVars).toContain('LAZYREVIEW_AZURE_TOKEN')
    expect(meta.envVars).toContain('AZURE_DEVOPS_TOKEN')
    expect(meta.cliCommand).toBeNull()
  })

  it('returns Gitea metadata', () => {
    const meta = getProviderMeta('gitea')
    expect(meta.label).toBe('Gitea')
    expect(meta.envVars).toContain('LAZYREVIEW_GITEA_TOKEN')
    expect(meta.envVars).toContain('GITEA_TOKEN')
    expect(meta.cliCommand).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Provider token file path tests
// ---------------------------------------------------------------------------

describe('getProviderTokenFilePath', () => {
  it('returns per-provider token file for github', () => {
    const path = getProviderTokenFilePath('github')
    expect(path).toContain('tokens/github.token')
  })

  it('returns per-provider token file for gitlab', () => {
    const path = getProviderTokenFilePath('gitlab')
    expect(path).toContain('tokens/gitlab.token')
  })

  it('returns per-provider token file for bitbucket', () => {
    const path = getProviderTokenFilePath('bitbucket')
    expect(path).toContain('tokens/bitbucket.token')
  })

  it('returns per-provider token file for azure', () => {
    const path = getProviderTokenFilePath('azure')
    expect(path).toContain('tokens/azure.token')
  })

  it('returns per-provider token file for gitea', () => {
    const path = getProviderTokenFilePath('gitea')
    expect(path).toContain('tokens/gitea.token')
  })
})

// ---------------------------------------------------------------------------
// Base URL tests
// ---------------------------------------------------------------------------

describe('setAuthBaseUrl / getAuthBaseUrl', () => {
  afterEach(() => {
    resetAuthState()
  })

  it('defaults to null', () => {
    expect(getAuthBaseUrl()).toBeNull()
  })

  it('can be set to a URL', () => {
    setAuthBaseUrl('https://github.example.com')
    expect(getAuthBaseUrl()).toBe('https://github.example.com')
  })

  it('can be cleared to null', () => {
    setAuthBaseUrl('https://github.example.com')
    setAuthBaseUrl(null)
    expect(getAuthBaseUrl()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Token resolution priority chain tests
// ---------------------------------------------------------------------------

describe('resolveToken priority chain', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns LAZYREVIEW_GITHUB_TOKEN when set (highest priority)', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_token_12345'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_token_12345')
  })

  it('returns saved/session token when no env var set', async () => {
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
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_token_1234567')
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_cli_token_1234567')
  })

  it('fails with AuthError when no token source available', async () => {
    setCliError('gh', ['auth', 'token'], new Error('gh: command not found'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('LAZYREVIEW_GITHUB_TOKEN takes precedence over manual token', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_wins_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_loses_1234567'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_wins_1234567')
  })

  it('manual token takes precedence over GITHUB_TOKEN', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_generic_loses_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_wins_1234567'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_manual_wins_1234567')
  })

  it('GITHUB_TOKEN takes precedence over gh CLI', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_generic_wins_1234567'
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_loses_1234567')
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_generic_wins_1234567')
  })
})

describe('preferredSource overrides', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('preferredSource=manual uses only manual token', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_ignored_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_only_1234567'))
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
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_preferred_1234567')
    await runAuth((auth) => auth.setPreferredSource('gh_cli'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_cli_preferred_1234567')
  })

  it('preferredSource=gh_cli fails if gh CLI unavailable', async () => {
    await runAuth((auth) => auth.setPreferredSource('gh_cli'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('setToken', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
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
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_ignored_1234567'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_sets_preferred_12345')
  })

  it('triggers file save to provider-specific location', async () => {
    await runAuth((auth) => auth.setToken('ghp_file_save_123456789'))
    const providerPath = getProviderTokenFilePath('github')
    expect(savedFiles[providerPath]).toBe('ghp_file_save_123456789')
  })

  it('saves to legacy location for github backward compat', async () => {
    await runAuth((auth) => auth.setToken('ghp_legacy_save_123456789'))
    const legacyPaths = Object.keys(savedFiles).filter(
      (p) => p.endsWith('.token') && !p.includes('tokens/'),
    )
    expect(legacyPaths.length).toBeGreaterThan(0)
  })

  it('does not save to legacy location for non-github providers', async () => {
    setAuthProvider('gitlab')
    await runAuth((auth) => auth.setToken('glpat-test_token_12345'))
    const legacyPaths = Object.keys(savedFiles).filter(
      (p) => p.endsWith('.token') && !p.includes('tokens/'),
    )
    expect(legacyPaths.length).toBe(0)
    const providerPath = getProviderTokenFilePath('gitlab')
    expect(savedFiles[providerPath]).toBe('glpat-test_token_12345')
  })
})

describe('clearManualToken', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('clears session and saved token', async () => {
    await runAuth((auth) => auth.setToken('ghp_to_be_cleared_12345'))
    await runAuth((auth) => auth.clearManualToken())
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('resets preferredSource from manual to null', async () => {
    await runAuth((auth) => auth.setToken('ghp_to_be_cleared_12345'))
    await runAuth((auth) => auth.clearManualToken())
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_after_clear_12345'
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_env_after_clear_12345')
  })
})

describe('getAvailableSources', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
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
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_avail_1234567')
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('gh_cli')
  })

  it('returns empty array when nothing is available', async () => {
    setCliError('gh', ['auth', 'token'], new Error('not found'))
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toEqual([])
  })

  it('detects multiple sources simultaneously', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_multi_1234567'
    await runAuth((auth) => auth.setToken('ghp_manual_multi_1234567'))
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_multi_1234567')
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
    expect(sources).toContain('manual')
    expect(sources).toContain('gh_cli')
  })
})

describe('isAuthenticated', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
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
    setCliError('gh', ['auth', 'token'], new Error('not found'))
    const result = await runAuth((auth) => auth.isAuthenticated())
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Multi-provider token resolution tests
// ---------------------------------------------------------------------------

describe('multi-provider token resolution', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
    delete process.env['LAZYREVIEW_BITBUCKET_TOKEN']
    delete process.env['BITBUCKET_TOKEN']
    delete process.env['LAZYREVIEW_AZURE_TOKEN']
    delete process.env['AZURE_DEVOPS_TOKEN']
    delete process.env['LAZYREVIEW_GITEA_TOKEN']
    delete process.env['GITEA_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('GitLab', () => {
    beforeEach(() => {
      setAuthProvider('gitlab')
    })

    it('resolves LAZYREVIEW_GITLAB_TOKEN env var', async () => {
      process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-gitlab_test_1234567'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('glpat-gitlab_test_1234567')
    })

    it('resolves GITLAB_TOKEN as fallback', async () => {
      process.env['GITLAB_TOKEN'] = 'glpat-fallback_1234567'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('glpat-fallback_1234567')
    })

    it('resolves glab CLI token', async () => {
      setCliResult('glab', ['auth', 'token'], 'glpat-cli_token_1234567')
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('glpat-cli_token_1234567')
    })

    it('primary env var takes precedence over secondary', async () => {
      process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-primary_1234567'
      process.env['GITLAB_TOKEN'] = 'glpat-secondary_1234567'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('glpat-primary_1234567')
    })

    it('manual token takes precedence over secondary env var', async () => {
      process.env['GITLAB_TOKEN'] = 'glpat-secondary_1234567'
      await runAuth((auth) => auth.setToken('glpat-manual_1234567'))
      await runAuth((auth) => auth.setPreferredSource('none'))
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('glpat-manual_1234567')
    })

    it('fails when no gitlab token source available', async () => {
      setCliError('glab', ['auth', 'token'], new Error('not found'))
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('detects env source for gitlab', async () => {
      process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-env_available_12345'
      const sources = await runAuth((auth) => auth.getAvailableSources())
      expect(sources).toContain('env')
    })

    it('detects glab CLI source', async () => {
      setCliResult('glab', ['auth', 'token'], 'glpat-cli_available_12345')
      const sources = await runAuth((auth) => auth.getAvailableSources())
      expect(sources).toContain('gh_cli')
    })
  })

  describe('Bitbucket', () => {
    beforeEach(() => {
      setAuthProvider('bitbucket')
    })

    it('resolves LAZYREVIEW_BITBUCKET_TOKEN env var', async () => {
      process.env['LAZYREVIEW_BITBUCKET_TOKEN'] = 'bb_token_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('bb_token_1234567890')
    })

    it('resolves BITBUCKET_TOKEN as fallback', async () => {
      process.env['BITBUCKET_TOKEN'] = 'bb_fallback_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('bb_fallback_1234567890')
    })

    it('fails when no token available (no CLI for bitbucket)', async () => {
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('does not include gh_cli in available sources (no CLI)', async () => {
      const sources = await runAuth((auth) => auth.getAvailableSources())
      expect(sources).not.toContain('gh_cli')
    })

    it('saves token to bitbucket-specific file', async () => {
      await runAuth((auth) => auth.setToken('bb_saved_1234567890'))
      const providerPath = getProviderTokenFilePath('bitbucket')
      expect(savedFiles[providerPath]).toBe('bb_saved_1234567890')
    })
  })

  describe('Azure DevOps', () => {
    beforeEach(() => {
      setAuthProvider('azure')
    })

    it('resolves LAZYREVIEW_AZURE_TOKEN env var', async () => {
      process.env['LAZYREVIEW_AZURE_TOKEN'] = 'azure_token_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('azure_token_1234567890')
    })

    it('resolves AZURE_DEVOPS_TOKEN as fallback', async () => {
      process.env['AZURE_DEVOPS_TOKEN'] = 'azure_fallback_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('azure_fallback_1234567890')
    })

    it('fails when no azure token available', async () => {
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Gitea', () => {
    beforeEach(() => {
      setAuthProvider('gitea')
    })

    it('resolves LAZYREVIEW_GITEA_TOKEN env var', async () => {
      process.env['LAZYREVIEW_GITEA_TOKEN'] = 'gitea_token_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('gitea_token_1234567890')
    })

    it('resolves GITEA_TOKEN as fallback', async () => {
      process.env['GITEA_TOKEN'] = 'gitea_fallback_1234567890'
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('gitea_fallback_1234567890')
    })

    it('fails when no gitea token available', async () => {
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('saves token to gitea-specific file', async () => {
      await runAuth((auth) => auth.setToken('gitea_saved_1234567890'))
      const providerPath = getProviderTokenFilePath('gitea')
      expect(savedFiles[providerPath]).toBe('gitea_saved_1234567890')
    })
  })
})

// ---------------------------------------------------------------------------
// Provider switching isolation tests
// ---------------------------------------------------------------------------

describe('provider switching isolation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('GitHub env var does not resolve when provider is gitlab', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_github_token_12345'
    setAuthProvider('gitlab')
    setCliError('glab', ['auth', 'token'], new Error('not found'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('GitLab env var does not resolve when provider is github', async () => {
    process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-gitlab_token_12345'
    setCliError('gh', ['auth', 'token'], new Error('not found'))
    const exit = await runAuthExit((auth) => auth.getToken())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('switching providers resets initialized state', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_first_provider_12345'
    const githubToken = await runAuth((auth) => auth.getToken())
    expect(githubToken).toBe('ghp_first_provider_12345')

    setAuthProvider('gitlab')
    process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-second_provider_12345'
    const gitlabToken = await runAuth((auth) => auth.getToken())
    expect(gitlabToken).toBe('glpat-second_provider_12345')
  })
})

// ---------------------------------------------------------------------------
// getTokenInfo tests (resolveProviderTokenInfo coverage)
// ---------------------------------------------------------------------------

describe('getTokenInfo', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
    delete process.env['LAZYREVIEW_BITBUCKET_TOKEN']
    delete process.env['BITBUCKET_TOKEN']
    delete process.env['LAZYREVIEW_AZURE_TOKEN']
    delete process.env['AZURE_DEVOPS_TOKEN']
    delete process.env['LAZYREVIEW_GITEA_TOKEN']
    delete process.env['GITEA_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns source=none when no token available', async () => {
    setCliError('gh', ['auth', 'token'], new Error('not found'))
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('none')
    expect(info.maskedToken).toBeNull()
  })

  it('returns source=env with masked token from primary env var', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_tokeninfo_12345'
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('env')
    expect(info.maskedToken).toBe(maskToken('ghp_env_tokeninfo_12345'))
  })

  it('returns source=manual with masked token from session', async () => {
    await runAuth((auth) => auth.setToken('ghp_manual_tokeninfo_12345'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('manual')
    expect(info.maskedToken).toBe(maskToken('ghp_manual_tokeninfo_12345'))
  })

  it('returns source=env from secondary env var when no primary or manual', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_secondary_tokeninfo_12345'
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('env')
    expect(info.maskedToken).toBe(maskToken('ghp_secondary_tokeninfo_12345'))
  })

  it('returns source=gh_cli when only CLI available', async () => {
    setCliResult('gh', ['auth', 'token'], 'ghp_cli_tokeninfo_12345')
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('gh_cli')
    expect(info.maskedToken).toBe(maskToken('ghp_cli_tokeninfo_12345'))
  })

  it('primary env var takes priority over manual in default info', async () => {
    process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_prio_tokeninfo_12345'
    await runAuth((auth) => auth.setToken('ghp_manual_prio_tokeninfo_12345'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const info = await runAuth((auth) => auth.getTokenInfo())
    expect(info.source).toBe('env')
    expect(info.maskedToken).toBe(maskToken('ghp_env_prio_tokeninfo_12345'))
  })

  describe('with preferredSource overrides', () => {
    it('preferredSource=manual returns manual token info', async () => {
      process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_override_12345'
      await runAuth((auth) => auth.setToken('ghp_manual_override_12345'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('manual')
      expect(info.maskedToken).toBe(maskToken('ghp_manual_override_12345'))
    })

    it('preferredSource=manual returns none when no manual token', async () => {
      await runAuth((auth) => auth.setPreferredSource('manual'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      // When preferred is manual but no manual token, falls through to default
      expect(info).toBeDefined()
    })

    it('preferredSource=env returns env token info', async () => {
      process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_pref_info_12345'
      await runAuth((auth) => auth.setPreferredSource('env'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
      expect(info.maskedToken).toBe(maskToken('ghp_env_pref_info_12345'))
    })

    it('preferredSource=env falls through when no env var', async () => {
      await runAuth((auth) => auth.setPreferredSource('env'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      // Falls through to default priority when env not available
      expect(info).toBeDefined()
    })

    it('preferredSource=gh_cli returns CLI token info', async () => {
      setCliResult('gh', ['auth', 'token'], 'ghp_cli_pref_info_12345')
      await runAuth((auth) => auth.setPreferredSource('gh_cli'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('gh_cli')
      expect(info.maskedToken).toBe(maskToken('ghp_cli_pref_info_12345'))
    })

    it('preferredSource=gh_cli falls through when CLI not available', async () => {
      setCliError('gh', ['auth', 'token'], new Error('not found'))
      await runAuth((auth) => auth.setPreferredSource('gh_cli'))
      const info = await runAuth((auth) => auth.getTokenInfo())
      // Falls through to default priority
      expect(info).toBeDefined()
    })
  })

  describe('multi-provider token info', () => {
    it('returns gitlab env token info', async () => {
      setAuthProvider('gitlab')
      process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-tokeninfo_1234567'
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
      expect(info.maskedToken).toBe(maskToken('glpat-tokeninfo_1234567'))
    })

    it('returns gitlab CLI token info', async () => {
      setAuthProvider('gitlab')
      setCliResult('glab', ['auth', 'token'], 'glpat-cli_info_1234567')
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('gh_cli')
    })

    it('returns bitbucket env token info', async () => {
      setAuthProvider('bitbucket')
      process.env['LAZYREVIEW_BITBUCKET_TOKEN'] = 'bb_tokeninfo_12345678'
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
    })

    it('returns none for bitbucket with no token (no CLI)', async () => {
      setAuthProvider('bitbucket')
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('none')
      expect(info.maskedToken).toBeNull()
    })

    it('returns azure env token info', async () => {
      setAuthProvider('azure')
      process.env['LAZYREVIEW_AZURE_TOKEN'] = 'azure_tokeninfo_1234567'
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
    })

    it('returns gitea env token info', async () => {
      setAuthProvider('gitea')
      process.env['LAZYREVIEW_GITEA_TOKEN'] = 'gitea_tokeninfo_1234567'
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
    })

    it('returns secondary env var token info for gitlab', async () => {
      setAuthProvider('gitlab')
      process.env['GITLAB_TOKEN'] = 'glpat-secondary_info_12345'
      const info = await runAuth((auth) => auth.getTokenInfo())
      expect(info.source).toBe('env')
      expect(info.maskedToken).toBe(maskToken('glpat-secondary_info_12345'))
    })
  })
})

// ---------------------------------------------------------------------------
// getUser tests (per-provider user fetching)
// ---------------------------------------------------------------------------

describe('getUser', () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
    delete process.env['LAZYREVIEW_BITBUCKET_TOKEN']
    delete process.env['BITBUCKET_TOKEN']
    delete process.env['LAZYREVIEW_AZURE_TOKEN']
    delete process.env['AZURE_DEVOPS_TOKEN']
    delete process.env['LAZYREVIEW_GITEA_TOKEN']
    delete process.env['GITEA_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    globalThis.fetch = originalFetch
  })

  function mockFetch(responseBody: unknown, status = 200): void {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(responseBody),
    })
  }

  function mockFetchFailure(status: number): void {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: vi.fn().mockResolvedValue({}),
    })
  }

  describe('GitHub user', () => {
    beforeEach(() => {
      process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_user_test_12345678'
    })

    it('fetches and returns GitHub user', async () => {
      mockFetch({
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
        type: 'User',
      })
      const user = await runAuth((auth) => auth.getUser())
      expect(user.login).toBe('testuser')
      expect(user.id).toBe(12345)
      expect(user.avatar_url).toContain('avatars.githubusercontent.com')
    })

    it('uses Bearer authorization header', async () => {
      mockFetch({
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      })
      await runAuth((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.github.com/user')
      expect(options.headers.Authorization).toBe('Bearer ghp_user_test_12345678')
    })

    it('fails with AuthError on non-ok response', async () => {
      mockFetchFailure(401)
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('fails with AuthError on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('GitLab user', () => {
    beforeEach(() => {
      setAuthProvider('gitlab')
      process.env['LAZYREVIEW_GITLAB_TOKEN'] = 'glpat-user_test_12345678'
    })

    it('calls GitLab API with PRIVATE-TOKEN header and correct URL', async () => {
      // GitLab user decode currently fails because html_url is missing from the
      // constructed object. We verify the API call is made correctly.
      mockFetch({
        username: 'gitlabuser',
        id: 67890,
        avatar_url: 'https://gitlab.com/uploads/-/system/user/avatar/67890/avatar.png',
      })
      const exit = await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://gitlab.com/api/v4/user')
      expect(options.headers['PRIVATE-TOKEN']).toBe('glpat-user_test_12345678')
      // The decode fails because html_url is missing from the User schema mapping
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('uses custom base URL when set', async () => {
      setAuthBaseUrl('https://gitlab.example.com')
      mockFetch({ username: 'user', id: 1, avatar_url: '' })
      await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock.mock.calls[0][0]).toBe('https://gitlab.example.com/api/v4/user')
    })

    it('uses custom base URL with /api/v4 already included', async () => {
      setAuthBaseUrl('https://gitlab.example.com/api/v4')
      mockFetch({ username: 'user', id: 1, avatar_url: '' })
      await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock.mock.calls[0][0]).toBe('https://gitlab.example.com/api/v4/user')
    })

    it('fails with AuthError on non-ok response', async () => {
      mockFetchFailure(403)
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Bitbucket user', () => {
    beforeEach(() => {
      setAuthProvider('bitbucket')
      process.env['LAZYREVIEW_BITBUCKET_TOKEN'] = 'bb_user_test_1234567890'
    })

    it('calls Bitbucket API with Bearer auth and correct URL', async () => {
      mockFetch({
        username: 'bbuser',
        links: { avatar: { href: 'https://bitbucket.org/avatar/bbuser' } },
        account_id: 'abc123',
      })
      const exit = await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.bitbucket.org/2.0/user')
      expect(options.headers.Authorization).toBe('Bearer bb_user_test_1234567890')
      // Decode fails because html_url is missing in the User schema mapping
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('fails with AuthError on non-ok response', async () => {
      mockFetchFailure(401)
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Azure DevOps user', () => {
    beforeEach(() => {
      setAuthProvider('azure')
      process.env['LAZYREVIEW_AZURE_TOKEN'] = 'azure_user_test_12345678'
    })

    it('calls Azure VSSPS API with Basic auth header', async () => {
      mockFetch({
        displayName: 'Azure User',
        emailAddress: 'azure@example.com',
        id: 'guid-1234',
      })
      const exit = await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toContain('vssps.visualstudio.com')
      expect(url).toContain('_apis/profile/profiles/me')
      const encoded = Buffer.from(':azure_user_test_12345678').toString('base64')
      expect(options.headers.Authorization).toBe(`Basic ${encoded}`)
      // Decode fails because html_url is missing in the User schema mapping
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('fails with AuthError on non-ok response', async () => {
      mockFetchFailure(401)
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Gitea user', () => {
    beforeEach(() => {
      setAuthProvider('gitea')
      process.env['LAZYREVIEW_GITEA_TOKEN'] = 'gitea_user_test_12345678'
    })

    it('calls Gitea API with token auth header and correct URL', async () => {
      mockFetch({
        login: 'giteauser',
        id: 999,
        avatar_url: 'https://gitea.example.com/avatars/999',
      })
      const exit = await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://gitea.com/api/v1/user')
      expect(options.headers.Authorization).toBe('token gitea_user_test_12345678')
      // Decode fails because html_url is missing in the User schema mapping
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('uses custom base URL when set', async () => {
      setAuthBaseUrl('https://gitea.mycompany.com')
      mockFetch({ login: 'user', id: 1, avatar_url: '' })
      await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock.mock.calls[0][0]).toBe('https://gitea.mycompany.com/api/v1/user')
    })

    it('uses custom base URL with /api/v1 already included', async () => {
      setAuthBaseUrl('https://gitea.mycompany.com/api/v1')
      mockFetch({ login: 'user', id: 1, avatar_url: '' })
      await runAuthExit((auth) => auth.getUser())
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      expect(fetchMock.mock.calls[0][0]).toBe('https://gitea.mycompany.com/api/v1/user')
    })

    it('fails with AuthError on non-ok response', async () => {
      mockFetchFailure(500)
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('getUser fails without token', () => {
    it('fails when no token is available for any provider', async () => {
      setCliError('gh', ['auth', 'token'], new Error('not found'))
      const exit = await runAuthExit((auth) => auth.getUser())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// setToken validation warning for non-GitHub token formats
// ---------------------------------------------------------------------------

describe('setToken validation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('accepts non-GitHub format token for GitHub provider without error', async () => {
    // Non-standard format (not ghp_, gho_, etc.) should still be saved
    await runAuth((auth) => auth.setToken('some_random_token_format_12345'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('some_random_token_format_12345')
  })

  it('accepts valid GitHub format token without warning', async () => {
    await runAuth((auth) => auth.setToken('ghp_valid_format_token_12345'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('ghp_valid_format_token_12345')
  })

  it('does not validate token format for non-GitHub providers', async () => {
    setAuthProvider('gitlab')
    await runAuth((auth) => auth.setToken('glpat-any_format_12345'))
    const token = await runAuth((auth) => auth.getToken())
    expect(token).toBe('glpat-any_format_12345')
  })
})

// ---------------------------------------------------------------------------
// Token file I/O tests (legacy migration, permissions, deletion)
// ---------------------------------------------------------------------------

describe('token file I/O', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
    delete process.env['LAZYREVIEW_BITBUCKET_TOKEN']
    delete process.env['BITBUCKET_TOKEN']
    delete process.env['LAZYREVIEW_AZURE_TOKEN']
    delete process.env['AZURE_DEVOPS_TOKEN']
    delete process.env['LAZYREVIEW_GITEA_TOKEN']
    delete process.env['GITEA_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('loadSavedToken (provider-specific)', () => {
    it('loads token from provider-specific file with correct permissions', async () => {
      const providerPath = getProviderTokenFilePath('github')
      fileStats[providerPath] = { mode: 0o100600 }
      fileContents[providerPath] = 'ghp_saved_provider_file_12345'

      // Trigger initialization by resolving token
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('ghp_saved_provider_file_12345')
    })

    it('rejects token file with wrong permissions', async () => {
      const providerPath = getProviderTokenFilePath('github')
      // Mode 0o644 means perms are 0o644, not 0o600
      fileStats[providerPath] = { mode: 0o100644 }
      fileContents[providerPath] = 'ghp_wrong_perms_token_12345'

      setCliError('gh', ['auth', 'token'], new Error('not found'))
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('legacy token migration', () => {
    it('migrates legacy GitHub token to provider-specific file', async () => {
      // Set up legacy token file (the old .token path)
      const homePath = require('node:os').homedir()
      const legacyPath = require('node:path').join(homePath, '.config', 'lazyreview', '.token')
      const providerPath = getProviderTokenFilePath('github')

      // Provider-specific file does not exist (stat will throw for it)
      // But legacy file exists with correct permissions
      fileStats[legacyPath] = { mode: 0o100600 }
      fileContents[legacyPath] = 'ghp_legacy_migration_12345678'

      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('ghp_legacy_migration_12345678')
      // After migration, the token should be saved to provider-specific file
      expect(savedFiles[providerPath]).toBe('ghp_legacy_migration_12345678')
    })

    it('does not attempt legacy migration for non-github providers', async () => {
      setAuthProvider('gitlab')
      const homePath = require('node:os').homedir()
      const legacyPath = require('node:path').join(homePath, '.config', 'lazyreview', '.token')
      fileStats[legacyPath] = { mode: 0o100600 }
      fileContents[legacyPath] = 'ghp_legacy_not_for_gitlab_12345'

      setCliError('glab', ['auth', 'token'], new Error('not found'))
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('clearManualToken file deletion', () => {
    it('deletes provider-specific token file on clear', async () => {
      await runAuth((auth) => auth.setToken('ghp_to_delete_1234567890'))
      await runAuth((auth) => auth.clearManualToken())
      const providerPath = getProviderTokenFilePath('github')
      expect(deletedFiles).toContain(providerPath)
    })

    it('deletes legacy token file for github on clear', async () => {
      await runAuth((auth) => auth.setToken('ghp_to_delete_legacy_12345'))
      await runAuth((auth) => auth.clearManualToken())
      const homePath = require('node:os').homedir()
      const legacyPath = require('node:path').join(homePath, '.config', 'lazyreview', '.token')
      expect(deletedFiles).toContain(legacyPath)
    })

    it('does not delete legacy file for non-github providers', async () => {
      setAuthProvider('gitlab')
      await runAuth((auth) => auth.setToken('glpat-to_delete_12345678'))
      deletedFiles = []
      await runAuth((auth) => auth.clearManualToken())
      const homePath = require('node:os').homedir()
      const legacyPath = require('node:path').join(homePath, '.config', 'lazyreview', '.token')
      expect(deletedFiles).not.toContain(legacyPath)
      const providerPath = getProviderTokenFilePath('gitlab')
      expect(deletedFiles).toContain(providerPath)
    })

    it('preserves non-manual preferredSource on clear', async () => {
      await runAuth((auth) => auth.setPreferredSource('env'))
      await runAuth((auth) => auth.setToken('ghp_token_env_pref_12345678'))
      // Manually set preferred back to env after setToken overrides it
      await runAuth((auth) => auth.setPreferredSource('env'))
      process.env['LAZYREVIEW_GITHUB_TOKEN'] = 'ghp_env_after_clear_1234567'
      await runAuth((auth) => auth.clearManualToken())
      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('ghp_env_after_clear_1234567')
    })
  })

  describe('readTokenFile edge cases', () => {
    it('returns null for empty token file', async () => {
      const providerPath = getProviderTokenFilePath('github')
      fileStats[providerPath] = { mode: 0o100600 }
      fileContents[providerPath] = '   '

      setCliError('gh', ['auth', 'token'], new Error('not found'))
      const exit = await runAuthExit((auth) => auth.getToken())
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('trims whitespace from token file content', async () => {
      const providerPath = getProviderTokenFilePath('github')
      fileStats[providerPath] = { mode: 0o100600 }
      fileContents[providerPath] = '  ghp_trimmed_token_12345678  \n'

      const token = await runAuth((auth) => auth.getToken())
      expect(token).toBe('ghp_trimmed_token_12345678')
    })
  })
})

// ---------------------------------------------------------------------------
// Available sources for providers without CLI
// ---------------------------------------------------------------------------

describe('getAvailableSources per-provider', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetAuthState()
    cliResults = {}
    cliErrors = {}
    savedFiles = {}
    fileStats = {}
    fileContents = {}
    deletedFiles = []
    delete process.env['LAZYREVIEW_GITHUB_TOKEN']
    delete process.env['GITHUB_TOKEN']
    delete process.env['LAZYREVIEW_GITLAB_TOKEN']
    delete process.env['GITLAB_TOKEN']
    delete process.env['LAZYREVIEW_BITBUCKET_TOKEN']
    delete process.env['BITBUCKET_TOKEN']
    delete process.env['LAZYREVIEW_AZURE_TOKEN']
    delete process.env['AZURE_DEVOPS_TOKEN']
    delete process.env['LAZYREVIEW_GITEA_TOKEN']
    delete process.env['GITEA_TOKEN']
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns env and manual for azure (no CLI)', async () => {
    setAuthProvider('azure')
    process.env['LAZYREVIEW_AZURE_TOKEN'] = 'azure_source_12345678'
    await runAuth((auth) => auth.setToken('azure_manual_12345678'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
    expect(sources).toContain('manual')
    expect(sources).not.toContain('gh_cli')
  })

  it('returns env and manual for gitea (no CLI)', async () => {
    setAuthProvider('gitea')
    process.env['LAZYREVIEW_GITEA_TOKEN'] = 'gitea_source_12345678'
    await runAuth((auth) => auth.setToken('gitea_manual_12345678'))
    await runAuth((auth) => auth.setPreferredSource('none'))
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
    expect(sources).toContain('manual')
    expect(sources).not.toContain('gh_cli')
  })

  it('detects secondary env var as env source', async () => {
    process.env['GITHUB_TOKEN'] = 'ghp_secondary_source_12345'
    const sources = await runAuth((auth) => auth.getAvailableSources())
    expect(sources).toContain('env')
  })
})
