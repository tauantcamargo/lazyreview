import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { AppConfig, buildHostMappings, toConfiguredHosts, getConfiguredInstances } from './Config'
import type { ConfiguredInstance } from './Config'

describe('AppConfig schema', () => {
  it('creates default config from empty object', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.provider).toBe('github')
    expect(config.theme).toBe('tokyo-night')
    expect(config.pageSize).toBe(30)
    expect(config.refreshInterval).toBe(60)
    expect(config.keybindings?.toggleSidebar).toBe('b')
    expect(config.keybindings?.help).toBe('?')
    expect(config.keybindings?.quit).toBe('q')
  })

  it('parses valid config with overrides', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      theme: 'dracula',
      pageSize: 50,
      refreshInterval: 120,
    })
    expect(config.theme).toBe('dracula')
    expect(config.pageSize).toBe(50)
    expect(config.refreshInterval).toBe(120)
  })

  it('accepts optional owner/repo', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      defaultOwner: 'myorg',
      defaultRepo: 'myrepo',
    })
    expect(config.defaultOwner).toBe('myorg')
    expect(config.defaultRepo).toBe('myrepo')
  })

  it('rejects invalid pageSize', () => {
    expect(() => S.decodeUnknownSync(AppConfig)({ pageSize: 0 })).toThrow()
    expect(() => S.decodeUnknownSync(AppConfig)({ pageSize: 101 })).toThrow()
  })

  it('rejects invalid refreshInterval', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ refreshInterval: 5 }),
    ).toThrow()
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ refreshInterval: 601 }),
    ).toThrow()
  })

  it('accepts custom keybindings', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindings: { toggleSidebar: 's', help: 'h', quit: 'x' },
    })
    expect(config.keybindings?.toggleSidebar).toBe('s')
    expect(config.keybindings?.help).toBe('h')
    expect(config.keybindings?.quit).toBe('x')
  })

  it('accepts pageSize at minimum boundary (1)', () => {
    const config = S.decodeUnknownSync(AppConfig)({ pageSize: 1 })
    expect(config.pageSize).toBe(1)
  })

  it('accepts pageSize at maximum boundary (100)', () => {
    const config = S.decodeUnknownSync(AppConfig)({ pageSize: 100 })
    expect(config.pageSize).toBe(100)
  })

  it('accepts refreshInterval at minimum boundary (10)', () => {
    const config = S.decodeUnknownSync(AppConfig)({ refreshInterval: 10 })
    expect(config.refreshInterval).toBe(10)
  })

  it('accepts refreshInterval at maximum boundary (600)', () => {
    const config = S.decodeUnknownSync(AppConfig)({ refreshInterval: 600 })
    expect(config.refreshInterval).toBe(600)
  })

  it('rejects non-integer pageSize', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ pageSize: 30.5 }),
    ).toThrow()
  })

  it('rejects non-integer refreshInterval', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ refreshInterval: 60.5 }),
    ).toThrow()
  })

  it('rejects negative pageSize', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ pageSize: -1 }),
    ).toThrow()
  })

  it('rejects negative refreshInterval', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ refreshInterval: -10 }),
    ).toThrow()
  })

  it('handles undefined optional fields gracefully', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.defaultOwner).toBeUndefined()
    expect(config.defaultRepo).toBeUndefined()
  })

  it('defaults compactList to false', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.compactList).toBe(false)
  })

  it('accepts compactList as true', () => {
    const config = S.decodeUnknownSync(AppConfig)({ compactList: true })
    expect(config.compactList).toBe(true)
  })

  it('compactList round-trips through encode/decode', () => {
    const config = S.decodeUnknownSync(AppConfig)({ compactList: true })
    const encoded = S.encodeSync(AppConfig)(config)
    const decoded = S.decodeUnknownSync(AppConfig)(encoded)
    expect(decoded.compactList).toBe(true)
  })

  it('defaults hasOnboarded to false', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.hasOnboarded).toBe(false)
  })

  it('accepts hasOnboarded as true', () => {
    const config = S.decodeUnknownSync(AppConfig)({ hasOnboarded: true })
    expect(config.hasOnboarded).toBe(true)
  })

  it('preserves hasOnboarded through encode/decode round-trip', () => {
    const config = S.decodeUnknownSync(AppConfig)({ hasOnboarded: true })
    const encoded = S.encodeSync(AppConfig)(config)
    const decoded = S.decodeUnknownSync(AppConfig)(encoded)
    expect(decoded.hasOnboarded).toBe(true)
  })

  it('accepts github provider', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'github' })
    expect(config.provider).toBe('github')
  })

  it('accepts gitlab provider', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'gitlab' })
    expect(config.provider).toBe('gitlab')
  })

  it('accepts bitbucket provider', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'bitbucket' })
    expect(config.provider).toBe('bitbucket')
  })

  it('accepts azure provider', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'azure' })
    expect(config.provider).toBe('azure')
  })

  it('accepts gitea provider', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'gitea' })
    expect(config.provider).toBe('gitea')
  })

  it('rejects unknown provider', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ provider: 'sourcehut' }),
    ).toThrow()
  })

  it('accepts gitlab config block with defaults', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      provider: 'gitlab',
      gitlab: {},
    })
    expect(config.gitlab?.host).toBe('https://gitlab.com')
  })

  it('accepts gitlab config with custom host', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      provider: 'gitlab',
      gitlab: { host: 'https://gitlab.example.com' },
    })
    expect(config.gitlab?.host).toBe('https://gitlab.example.com')
  })

  it('gitlab config is optional', () => {
    const config = S.decodeUnknownSync(AppConfig)({ provider: 'gitlab' })
    expect(config.gitlab).toBeUndefined()
  })

  it('accepts partial keybindings with defaults', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindings: { toggleSidebar: 'x' },
    })
    expect(config.keybindings?.toggleSidebar).toBe('x')
    // Other keybindings should get defaults
    expect(config.keybindings?.help).toBe('?')
    expect(config.keybindings?.quit).toBe('q')
  })

  it('handles all themes as string values', () => {
    for (const theme of ['tokyo-night', 'dracula', 'catppuccin-mocha', 'gruvbox']) {
      const config = S.decodeUnknownSync(AppConfig)({ theme })
      expect(config.theme).toBe(theme)
    }
  })

  it('keybindingOverrides is optional and defaults to undefined', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.keybindingOverrides).toBeUndefined()
  })

  it('accepts keybindingOverrides with string bindings', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindingOverrides: {
        global: { toggleHelp: 'h' },
      },
    })
    expect(config.keybindingOverrides?.['global']?.['toggleHelp']).toBe('h')
  })

  it('accepts keybindingOverrides with array bindings', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindingOverrides: {
        prList: { filterPRs: ['/', 'f'] },
      },
    })
    expect(config.keybindingOverrides?.['prList']?.['filterPRs']).toEqual(['/', 'f'])
  })

  it('accepts keybindingOverrides for multiple contexts', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindingOverrides: {
        global: { toggleHelp: 'h' },
        prList: { filterPRs: 'f' },
        prDetail: { mergePR: 'M' },
      },
    })
    expect(config.keybindingOverrides?.['global']?.['toggleHelp']).toBe('h')
    expect(config.keybindingOverrides?.['prList']?.['filterPRs']).toBe('f')
    expect(config.keybindingOverrides?.['prDetail']?.['mergePR']).toBe('M')
  })

  it('keybindingOverrides round-trips through encode/decode', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      keybindingOverrides: {
        global: { toggleHelp: 'h', moveDown: ['j', 'ctrl+n'] },
      },
    })
    const encoded = S.encodeSync(AppConfig)(config)
    const decoded = S.decodeUnknownSync(AppConfig)(encoded)
    expect(decoded.keybindingOverrides?.['global']?.['toggleHelp']).toBe('h')
    expect(decoded.keybindingOverrides?.['global']?.['moveDown']).toEqual(['j', 'ctrl+n'])
  })

  it('config with gitlab round-trips through encode/decode', () => {
    const input = {
      provider: 'gitlab' as const,
      gitlab: { host: 'https://my.gitlab.com' },
      theme: 'dracula',
    }
    const config = S.decodeUnknownSync(AppConfig)(input)
    const encoded = S.encodeSync(AppConfig)(config)
    const decoded = S.decodeUnknownSync(AppConfig)(encoded)
    expect(decoded.provider).toBe('gitlab')
    expect(decoded.gitlab?.host).toBe('https://my.gitlab.com')
    expect(decoded.theme).toBe('dracula')
  })

  it('defaults providers to empty github and gitlab hosts', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.providers?.github?.hosts).toEqual([])
    expect(config.providers?.gitlab?.hosts).toEqual([])
  })

  it('accepts providers.github.hosts array', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['github.acme.com', 'ghe.corp.net'] },
      },
    })
    expect(config.providers?.github?.hosts).toEqual(['github.acme.com', 'ghe.corp.net'])
  })

  it('accepts providers.gitlab.hosts array', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        gitlab: { hosts: ['gitlab.internal.io'] },
      },
    })
    expect(config.providers?.gitlab?.hosts).toEqual(['gitlab.internal.io'])
  })

  it('defaults hostMappings to empty array', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    expect(config.hostMappings).toEqual([])
  })

  it('accepts hostMappings with various provider types', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      hostMappings: [
        { host: 'ghe.corp.com', provider: 'github' },
        { host: 'gl.corp.com', provider: 'gitlab' },
        { host: 'bb.corp.com', provider: 'bitbucket' },
        { host: 'az.corp.com', provider: 'azure' },
        { host: 'gt.corp.com', provider: 'gitea' },
      ],
    })
    expect(config.hostMappings).toHaveLength(5)
    expect(config.hostMappings?.[0]?.host).toBe('ghe.corp.com')
    expect(config.hostMappings?.[0]?.provider).toBe('github')
  })

  it('rejects hostMappings with unknown provider', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({
        hostMappings: [{ host: 'x.com', provider: 'sourcehut' }],
      }),
    ).toThrow()
  })

  it('providers config round-trips through encode/decode', () => {
    const input = {
      providers: {
        github: { hosts: ['ghe.corp.com'] },
        gitlab: { hosts: ['gl.internal.io'] },
      },
      hostMappings: [
        { host: 'gitea.corp.com', provider: 'gitea' as const },
      ],
    }
    const config = S.decodeUnknownSync(AppConfig)(input)
    const encoded = S.encodeSync(AppConfig)(config)
    const decoded = S.decodeUnknownSync(AppConfig)(encoded)
    expect(decoded.providers?.github?.hosts).toEqual(['ghe.corp.com'])
    expect(decoded.providers?.gitlab?.hosts).toEqual(['gl.internal.io'])
    expect(decoded.hostMappings).toHaveLength(1)
    expect(decoded.hostMappings?.[0]?.host).toBe('gitea.corp.com')
  })
})

// ===========================================================================
// buildHostMappings
// ===========================================================================

describe('buildHostMappings', () => {
  it('returns empty map when no hosts configured', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    const result = buildHostMappings(config)
    expect(result.size).toBe(0)
  })

  it('maps providers.github.hosts to github', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { github: { hosts: ['ghe.acme.com'] } },
    })
    const result = buildHostMappings(config)
    expect(result.get('ghe.acme.com')).toBe('github')
  })

  it('maps providers.gitlab.hosts to gitlab', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { gitlab: { hosts: ['gl.corp.io'] } },
    })
    const result = buildHostMappings(config)
    expect(result.get('gl.corp.io')).toBe('gitlab')
  })

  it('hostMappings take precedence over provider-specific hosts', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { github: { hosts: ['git.example.com'] } },
      hostMappings: [{ host: 'git.example.com', provider: 'gitea' }],
    })
    const result = buildHostMappings(config)
    expect(result.get('git.example.com')).toBe('gitea')
  })

  it('lowercases all hostnames in the map', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { github: { hosts: ['GHE.ACME.COM'] } },
    })
    const result = buildHostMappings(config)
    expect(result.get('ghe.acme.com')).toBe('github')
    expect(result.has('GHE.ACME.COM')).toBe(false)
  })

  it('combines entries from multiple sources', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['ghe.corp.com'] },
        gitlab: { hosts: ['gl.corp.com'] },
      },
      hostMappings: [
        { host: 'gitea.corp.com', provider: 'gitea' },
      ],
    })
    const result = buildHostMappings(config)
    expect(result.size).toBe(3)
    expect(result.get('ghe.corp.com')).toBe('github')
    expect(result.get('gl.corp.com')).toBe('gitlab')
    expect(result.get('gitea.corp.com')).toBe('gitea')
  })
})

// ===========================================================================
// toConfiguredHosts
// ===========================================================================

describe('toConfiguredHosts', () => {
  it('returns empty record when no hosts configured', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    const result = toConfiguredHosts(config)
    expect(result).toEqual({})
  })

  it('converts buildHostMappings result to plain record', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['ghe.acme.com'] },
        gitlab: { hosts: ['gl.internal.io'] },
      },
    })
    const result = toConfiguredHosts(config)
    expect(result).toEqual({
      'ghe.acme.com': 'github',
      'gl.internal.io': 'gitlab',
    })
  })

  it('includes hostMappings entries', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      hostMappings: [
        { host: 'gitea.corp.com', provider: 'gitea' },
        { host: 'bb.corp.com', provider: 'bitbucket' },
      ],
    })
    const result = toConfiguredHosts(config)
    expect(result['gitea.corp.com']).toBe('gitea')
    expect(result['bb.corp.com']).toBe('bitbucket')
  })

  it('result is compatible with ConfiguredHosts type from git.ts', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { github: { hosts: ['ghe.corp.com'] } },
    })
    const result = toConfiguredHosts(config)
    // Verify it works with detectProvider from git.ts
    expect(result['ghe.corp.com']).toBe('github')
  })
})

// ===========================================================================
// getConfiguredInstances
// ===========================================================================

describe('getConfiguredInstances', () => {
  it('returns default instances for all providers with empty config', () => {
    const config = S.decodeUnknownSync(AppConfig)({})
    const instances = getConfiguredInstances(config)
    // At minimum, the active provider (github) should have its default instance
    const githubInstances = instances.filter((i) => i.provider === 'github')
    expect(githubInstances.length).toBeGreaterThanOrEqual(1)
    expect(githubInstances[0]?.host).toBe('github.com')
    expect(githubInstances[0]?.isDefault).toBe(true)
  })

  it('includes custom github hosts from providers config', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['github.mycompany.com'] },
      },
    })
    const instances = getConfiguredInstances(config)
    const githubInstances = instances.filter((i) => i.provider === 'github')
    expect(githubInstances.length).toBe(2)
    const defaultInstance = githubInstances.find((i) => i.isDefault)
    const customInstance = githubInstances.find((i) => !i.isDefault)
    expect(defaultInstance?.host).toBe('github.com')
    expect(customInstance?.host).toBe('github.mycompany.com')
  })

  it('includes custom gitlab hosts from providers config', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        gitlab: { hosts: ['gitlab.internal.io'] },
      },
    })
    const instances = getConfiguredInstances(config)
    const gitlabInstances = instances.filter((i) => i.provider === 'gitlab')
    expect(gitlabInstances.length).toBe(2)
    expect(gitlabInstances.some((i) => i.host === 'gitlab.com')).toBe(true)
    expect(gitlabInstances.some((i) => i.host === 'gitlab.internal.io')).toBe(true)
  })

  it('includes instances from hostMappings', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      hostMappings: [
        { host: 'gitea.mycompany.com', provider: 'gitea' },
      ],
    })
    const instances = getConfiguredInstances(config)
    const giteaInstances = instances.filter((i) => i.provider === 'gitea')
    expect(giteaInstances.length).toBe(2) // default + custom
    expect(giteaInstances.some((i) => i.host === 'gitea.mycompany.com')).toBe(true)
  })

  it('does not duplicate default hosts', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['github.com'] },
      },
    })
    const instances = getConfiguredInstances(config)
    const githubInstances = instances.filter((i) => i.provider === 'github')
    // github.com should appear only once
    const defaultInstances = githubInstances.filter((i) => i.host === 'github.com')
    expect(defaultInstances.length).toBe(1)
    expect(defaultInstances[0]?.isDefault).toBe(true)
  })

  it('combines multiple sources without duplicates', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: {
        github: { hosts: ['github.acme.com'] },
        gitlab: { hosts: ['gitlab.acme.com'] },
      },
      hostMappings: [
        { host: 'gitea.acme.com', provider: 'gitea' },
      ],
    })
    const instances = getConfiguredInstances(config)
    // Should have defaults for all provider types + 3 custom
    const hosts = instances.map((i) => i.host)
    expect(hosts).toContain('github.com')
    expect(hosts).toContain('github.acme.com')
    expect(hosts).toContain('gitlab.com')
    expect(hosts).toContain('gitlab.acme.com')
    expect(hosts).toContain('gitea.acme.com')
  })

  it('instance has correct shape', () => {
    const config = S.decodeUnknownSync(AppConfig)({
      providers: { github: { hosts: ['ghe.corp.com'] } },
    })
    const instances = getConfiguredInstances(config)
    const custom = instances.find((i) => i.host === 'ghe.corp.com')
    expect(custom).toBeDefined()
    expect(custom?.provider).toBe('github')
    expect(custom?.host).toBe('ghe.corp.com')
    expect(custom?.isDefault).toBe(false)
  })
})
