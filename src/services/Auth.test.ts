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

vi.mock('node:fs/promises', () => ({
  stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: vi.fn().mockImplementation(async (path: string, content: string) => {
    savedFiles[path] = content
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
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
