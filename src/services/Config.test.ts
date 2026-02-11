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
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ pageSize: 0 }),
    ).toThrow()
    expect(() =>
      S.decodeUnknownSync(AppConfig)({ pageSize: 101 }),
    ).toThrow()
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
})
