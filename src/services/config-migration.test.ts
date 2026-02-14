import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isV1Config,
  isV2Config,
  migrateV1Config,
  resolveEnvVars,
  mergeRepoConfig,
  type V2ConfigFile,
  type AiConfig,
} from './config-migration'

// ===========================================================================
// isV1Config / isV2Config
// ===========================================================================

describe('isV1Config', () => {
  it('returns true when version field is missing', () => {
    expect(isV1Config({ provider: 'github', theme: 'dracula' })).toBe(true)
  })

  it('returns true for empty object', () => {
    expect(isV1Config({})).toBe(true)
  })

  it('returns false when version is 2', () => {
    expect(isV1Config({ version: 2 })).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(isV1Config(null)).toBe(false)
    expect(isV1Config(undefined)).toBe(false)
    expect(isV1Config('string')).toBe(false)
    expect(isV1Config(42)).toBe(false)
  })
})

describe('isV2Config', () => {
  it('returns true when version is 2', () => {
    expect(isV2Config({ version: 2, defaults: {} })).toBe(true)
  })

  it('returns false when version is missing', () => {
    expect(isV2Config({ provider: 'github' })).toBe(false)
  })

  it('returns false when version is 1', () => {
    expect(isV2Config({ version: 1 })).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(isV2Config(null)).toBe(false)
    expect(isV2Config(undefined)).toBe(false)
  })
})

// ===========================================================================
// migrateV1Config
// ===========================================================================

describe('migrateV1Config', () => {
  it('converts empty v1 config to v2 with defaults', () => {
    const result = migrateV1Config({})
    expect(result.version).toBe(2)
    expect(result.defaults.provider).toBe('github')
    expect(result.defaults.theme).toBe('tokyo-night')
    expect(result.defaults.pageSize).toBe(30)
    expect(result.defaults.refreshInterval).toBe(60)
    expect(result.defaults.compactList).toBe(false)
  })

  it('maps v1 provider to defaults.provider', () => {
    const result = migrateV1Config({ provider: 'gitlab' })
    expect(result.defaults.provider).toBe('gitlab')
  })

  it('maps v1 theme to defaults.theme', () => {
    const result = migrateV1Config({ theme: 'dracula' })
    expect(result.defaults.theme).toBe('dracula')
  })

  it('maps v1 pageSize to defaults.pageSize', () => {
    const result = migrateV1Config({ pageSize: 50 })
    expect(result.defaults.pageSize).toBe(50)
  })

  it('maps v1 refreshInterval to defaults.refreshInterval', () => {
    const result = migrateV1Config({ refreshInterval: 120 })
    expect(result.defaults.refreshInterval).toBe(120)
  })

  it('maps v1 defaultOwner/defaultRepo to defaults.owner/repo', () => {
    const result = migrateV1Config({ defaultOwner: 'myorg', defaultRepo: 'myrepo' })
    expect(result.defaults.owner).toBe('myorg')
    expect(result.defaults.repo).toBe('myrepo')
  })

  it('maps v1 compactList to defaults.compactList', () => {
    const result = migrateV1Config({ compactList: true })
    expect(result.defaults.compactList).toBe(true)
  })

  it('preserves v1 providers config', () => {
    const result = migrateV1Config({
      providers: {
        github: { hosts: ['ghe.corp.com'] },
        gitlab: { hosts: ['gl.internal.io'] },
      },
    })
    expect(result.providers.github.hosts).toEqual(['ghe.corp.com'])
    expect(result.providers.gitlab.hosts).toEqual(['gl.internal.io'])
  })

  it('initializes all provider host sections', () => {
    const result = migrateV1Config({})
    expect(result.providers.github.hosts).toEqual([])
    expect(result.providers.gitlab.hosts).toEqual([])
    expect(result.providers.bitbucket.hosts).toEqual([])
    expect(result.providers.azure.hosts).toEqual([])
    expect(result.providers.gitea.hosts).toEqual([])
  })

  it('preserves v1 keybindingOverrides', () => {
    const result = migrateV1Config({
      keybindingOverrides: {
        global: { toggleHelp: 'h' },
      },
    })
    expect(result.keybindingOverrides).toEqual({ global: { toggleHelp: 'h' } })
  })

  it('preserves v1 recentRepos', () => {
    const repos = [{ owner: 'foo', repo: 'bar', lastUsed: '2026-01-01' }]
    const result = migrateV1Config({ recentRepos: repos })
    expect(result.recentRepos).toEqual(repos)
  })

  it('preserves v1 bookmarkedRepos', () => {
    const repos = [{ owner: 'foo', repo: 'bar' }]
    const result = migrateV1Config({ bookmarkedRepos: repos })
    expect(result.bookmarkedRepos).toEqual(repos)
  })

  it('initializes empty ai config', () => {
    const result = migrateV1Config({})
    expect(result.ai.provider).toBe('')
    expect(result.ai.model).toBe('')
    expect(result.ai.apiKey).toBe('')
    expect(result.ai.endpoint).toBe('')
    expect(result.ai.maxTokens).toBe(4096)
    expect(result.ai.temperature).toBe(0.3)
  })

  it('initializes empty plugins config', () => {
    const result = migrateV1Config({})
    expect(result.plugins).toEqual({})
  })

  it('preserves v1 notification settings', () => {
    const result = migrateV1Config({
      notifications: false,
      notifyOnNewPR: false,
      notifyOnUpdate: false,
      notifyOnReviewRequest: false,
    })
    expect(result.defaults.notifications).toBe(false)
    expect(result.defaults.notifyOnNewPR).toBe(false)
    expect(result.defaults.notifyOnUpdate).toBe(false)
    expect(result.defaults.notifyOnReviewRequest).toBe(false)
  })

  it('preserves v1 hasOnboarded', () => {
    const result = migrateV1Config({ hasOnboarded: true })
    expect(result.defaults.hasOnboarded).toBe(true)
  })

  it('preserves v1 hostMappings', () => {
    const result = migrateV1Config({
      hostMappings: [{ host: 'gitea.corp.com', provider: 'gitea' }],
    })
    expect(result.defaults.hostMappings).toEqual([
      { host: 'gitea.corp.com', provider: 'gitea' },
    ])
  })

  it('preserves v1 botUsernames', () => {
    const result = migrateV1Config({ botUsernames: ['dependabot', 'renovate'] })
    expect(result.defaults.botUsernames).toEqual(['dependabot', 'renovate'])
  })

  it('preserves v1 keybindings', () => {
    const result = migrateV1Config({
      keybindings: { toggleSidebar: 'x', help: 'h', quit: 'q' },
    })
    expect(result.defaults.keybindings).toEqual({
      toggleSidebar: 'x',
      help: 'h',
      quit: 'q',
    })
  })

  it('is a pure function (does not mutate input)', () => {
    const input = { provider: 'github', theme: 'dracula' }
    const inputCopy = { ...input }
    migrateV1Config(input)
    expect(input).toEqual(inputCopy)
  })

  it('preserves v1 baseUrl', () => {
    const result = migrateV1Config({ baseUrl: 'https://api.github.com' })
    expect(result.defaults.baseUrl).toBe('https://api.github.com')
  })

  it('preserves v1 gitlab config', () => {
    const result = migrateV1Config({
      gitlab: { host: 'https://gitlab.example.com' },
    })
    expect(result.defaults.gitlab).toEqual({ host: 'https://gitlab.example.com' })
  })
})

// ===========================================================================
// resolveEnvVars
// ===========================================================================

describe('resolveEnvVars', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves ${VAR_NAME} to environment variable value', () => {
    process.env['MY_API_KEY'] = 'secret-key-123'
    expect(resolveEnvVars('${MY_API_KEY}')).toBe('secret-key-123')
  })

  it('returns empty string when env var is not set', () => {
    delete process.env['NONEXISTENT_VAR']
    expect(resolveEnvVars('${NONEXISTENT_VAR}')).toBe('')
  })

  it('returns plain strings unchanged', () => {
    expect(resolveEnvVars('plain-value')).toBe('plain-value')
  })

  it('returns empty string unchanged', () => {
    expect(resolveEnvVars('')).toBe('')
  })

  it('resolves multiple env vars in a single string', () => {
    process.env['HOST'] = 'localhost'
    process.env['PORT'] = '8080'
    expect(resolveEnvVars('${HOST}:${PORT}')).toBe('localhost:8080')
  })

  it('handles mixed literal and env var text', () => {
    process.env['TOKEN'] = 'abc123'
    expect(resolveEnvVars('Bearer ${TOKEN}')).toBe('Bearer abc123')
  })

  it('handles nested-looking but invalid patterns gracefully', () => {
    expect(resolveEnvVars('${}')).toBe('${}')
  })

  it('is case-sensitive for env var names', () => {
    process.env['my_key'] = 'lower'
    process.env['MY_KEY'] = 'upper'
    expect(resolveEnvVars('${MY_KEY}')).toBe('upper')
    expect(resolveEnvVars('${my_key}')).toBe('lower')
  })
})

// ===========================================================================
// resolveEnvVars on config objects
// ===========================================================================

describe('resolveEnvVars on AiConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves env vars in ai.apiKey', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test'
    const ai: AiConfig = {
      provider: 'anthropic',
      model: 'claude-3',
      apiKey: '${ANTHROPIC_API_KEY}',
      endpoint: '',
      maxTokens: 4096,
      temperature: 0.3,
    }
    const resolved = resolveEnvVars(ai.apiKey)
    expect(resolved).toBe('sk-ant-test')
  })
})

// ===========================================================================
// mergeRepoConfig
// ===========================================================================

describe('mergeRepoConfig', () => {
  it('returns global config when repo config is empty', () => {
    const global: V2ConfigFile = {
      version: 2,
      defaults: {
        provider: 'github',
        theme: 'tokyo-night',
        pageSize: 30,
        refreshInterval: 60,
        owner: '',
        repo: '',
        compactList: false,
      },
      providers: {
        github: { hosts: [] },
        gitlab: { hosts: [] },
        bitbucket: { hosts: [] },
        azure: { hosts: [] },
        gitea: { hosts: [] },
      },
      ai: {
        provider: '',
        model: '',
        apiKey: '',
        endpoint: '',
        maxTokens: 4096,
        temperature: 0.3,
      },
      plugins: {},
      keybindingOverrides: {},
      recentRepos: [],
      bookmarkedRepos: [],
    }
    const result = mergeRepoConfig(global, {})
    expect(result).toEqual(global)
  })

  it('shallow merges defaults from repo config', () => {
    const global: V2ConfigFile = {
      version: 2,
      defaults: {
        provider: 'github',
        theme: 'tokyo-night',
        pageSize: 30,
        refreshInterval: 60,
        owner: '',
        repo: '',
        compactList: false,
      },
      providers: {
        github: { hosts: [] },
        gitlab: { hosts: [] },
        bitbucket: { hosts: [] },
        azure: { hosts: [] },
        gitea: { hosts: [] },
      },
      ai: {
        provider: '',
        model: '',
        apiKey: '',
        endpoint: '',
        maxTokens: 4096,
        temperature: 0.3,
      },
      plugins: {},
      keybindingOverrides: {},
      recentRepos: [],
      bookmarkedRepos: [],
    }
    const repoConfig = {
      defaults: { theme: 'dracula', pageSize: 50 },
    }
    const result = mergeRepoConfig(global, repoConfig)
    expect(result.defaults.theme).toBe('dracula')
    expect(result.defaults.pageSize).toBe(50)
    expect(result.defaults.provider).toBe('github')
    expect(result.defaults.refreshInterval).toBe(60)
  })

  it('deep merges providers from repo config', () => {
    const global: V2ConfigFile = {
      version: 2,
      defaults: {
        provider: 'github',
        theme: 'tokyo-night',
        pageSize: 30,
        refreshInterval: 60,
        owner: '',
        repo: '',
        compactList: false,
      },
      providers: {
        github: { hosts: ['ghe.corp.com'] },
        gitlab: { hosts: [] },
        bitbucket: { hosts: [] },
        azure: { hosts: [] },
        gitea: { hosts: [] },
      },
      ai: {
        provider: '',
        model: '',
        apiKey: '',
        endpoint: '',
        maxTokens: 4096,
        temperature: 0.3,
      },
      plugins: {},
      keybindingOverrides: {},
      recentRepos: [],
      bookmarkedRepos: [],
    }
    const repoConfig = {
      providers: {
        gitlab: { hosts: ['gitlab.internal.io'] },
      },
    }
    const result = mergeRepoConfig(global, repoConfig)
    expect(result.providers.github.hosts).toEqual(['ghe.corp.com'])
    expect(result.providers.gitlab.hosts).toEqual(['gitlab.internal.io'])
  })

  it('does not mutate the global config', () => {
    const global: V2ConfigFile = {
      version: 2,
      defaults: {
        provider: 'github',
        theme: 'tokyo-night',
        pageSize: 30,
        refreshInterval: 60,
        owner: '',
        repo: '',
        compactList: false,
      },
      providers: {
        github: { hosts: [] },
        gitlab: { hosts: [] },
        bitbucket: { hosts: [] },
        azure: { hosts: [] },
        gitea: { hosts: [] },
      },
      ai: {
        provider: '',
        model: '',
        apiKey: '',
        endpoint: '',
        maxTokens: 4096,
        temperature: 0.3,
      },
      plugins: {},
      keybindingOverrides: {},
      recentRepos: [],
      bookmarkedRepos: [],
    }
    const globalCopy = JSON.parse(JSON.stringify(global))
    mergeRepoConfig(global, { defaults: { theme: 'dracula' } })
    expect(global).toEqual(globalCopy)
  })

  it('overrides ai config from repo config', () => {
    const global: V2ConfigFile = {
      version: 2,
      defaults: {
        provider: 'github',
        theme: 'tokyo-night',
        pageSize: 30,
        refreshInterval: 60,
        owner: '',
        repo: '',
        compactList: false,
      },
      providers: {
        github: { hosts: [] },
        gitlab: { hosts: [] },
        bitbucket: { hosts: [] },
        azure: { hosts: [] },
        gitea: { hosts: [] },
      },
      ai: {
        provider: '',
        model: '',
        apiKey: '',
        endpoint: '',
        maxTokens: 4096,
        temperature: 0.3,
      },
      plugins: {},
      keybindingOverrides: {},
      recentRepos: [],
      bookmarkedRepos: [],
    }
    const repoConfig = {
      ai: { provider: 'openai', model: 'gpt-4o' },
    }
    const result = mergeRepoConfig(global, repoConfig)
    expect(result.ai.provider).toBe('openai')
    expect(result.ai.model).toBe('gpt-4o')
    expect(result.ai.maxTokens).toBe(4096)
  })
})

// ===========================================================================
// V2 config structure validation
// ===========================================================================

describe('V2ConfigFile structure', () => {
  it('has correct shape after migration from full v1', () => {
    const v1 = {
      provider: 'gitlab',
      theme: 'gruvbox',
      pageSize: 25,
      refreshInterval: 30,
      defaultOwner: 'acme',
      defaultRepo: 'web',
      compactList: true,
      hasOnboarded: true,
      notifications: true,
      notifyOnNewPR: false,
      notifyOnUpdate: true,
      notifyOnReviewRequest: false,
      providers: {
        github: { hosts: ['ghe.corp.com'] },
        gitlab: { hosts: ['gl.corp.com'] },
      },
      hostMappings: [{ host: 'gt.corp.com', provider: 'gitea' }],
      botUsernames: ['renovate'],
      keybindings: { toggleSidebar: 'x', help: 'h', quit: 'q' },
      keybindingOverrides: { global: { toggleHelp: 'h' } },
      recentRepos: [{ owner: 'foo', repo: 'bar', lastUsed: '2026-01-01' }],
      bookmarkedRepos: [{ owner: 'baz', repo: 'qux' }],
    }
    const result = migrateV1Config(v1)

    expect(result.version).toBe(2)
    expect(result.defaults.provider).toBe('gitlab')
    expect(result.defaults.theme).toBe('gruvbox')
    expect(result.defaults.pageSize).toBe(25)
    expect(result.defaults.refreshInterval).toBe(30)
    expect(result.defaults.owner).toBe('acme')
    expect(result.defaults.repo).toBe('web')
    expect(result.defaults.compactList).toBe(true)
    expect(result.defaults.hasOnboarded).toBe(true)
    expect(result.defaults.notifications).toBe(true)
    expect(result.defaults.notifyOnNewPR).toBe(false)
    expect(result.defaults.notifyOnUpdate).toBe(true)
    expect(result.defaults.notifyOnReviewRequest).toBe(false)
    expect(result.defaults.hostMappings).toEqual([
      { host: 'gt.corp.com', provider: 'gitea' },
    ])
    expect(result.defaults.botUsernames).toEqual(['renovate'])
    expect(result.defaults.keybindings).toEqual({
      toggleSidebar: 'x',
      help: 'h',
      quit: 'q',
    })
    expect(result.providers.github.hosts).toEqual(['ghe.corp.com'])
    expect(result.providers.gitlab.hosts).toEqual(['gl.corp.com'])
    expect(result.providers.bitbucket.hosts).toEqual([])
    expect(result.providers.azure.hosts).toEqual([])
    expect(result.providers.gitea.hosts).toEqual([])
    expect(result.keybindingOverrides).toEqual({ global: { toggleHelp: 'h' } })
    expect(result.recentRepos).toEqual([
      { owner: 'foo', repo: 'bar', lastUsed: '2026-01-01' },
    ])
    expect(result.bookmarkedRepos).toEqual([{ owner: 'baz', repo: 'qux' }])
    expect(result.ai.provider).toBe('')
    expect(result.plugins).toEqual({})
  })
})

// ===========================================================================
// AiConfig type
// ===========================================================================

describe('AiConfig', () => {
  it('has all required fields', () => {
    const ai: AiConfig = {
      provider: 'anthropic',
      model: 'claude-3',
      apiKey: 'sk-test',
      endpoint: '',
      maxTokens: 4096,
      temperature: 0.3,
    }
    expect(ai.provider).toBe('anthropic')
    expect(ai.model).toBe('claude-3')
    expect(ai.apiKey).toBe('sk-test')
    expect(ai.endpoint).toBe('')
    expect(ai.maxTokens).toBe(4096)
    expect(ai.temperature).toBe(0.3)
  })
})
