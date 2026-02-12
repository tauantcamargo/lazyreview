import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { AppConfig } from './Config'

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

  it('provider only accepts github', () => {
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ provider: 'gitlab' }),
    ).toThrow()
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
})
