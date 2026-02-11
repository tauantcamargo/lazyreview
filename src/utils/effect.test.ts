import { describe, it, expect, vi } from 'vitest'

// Mock the AppLayer import before importing the module under test
vi.mock('../services/index', () => {
  const { Layer, Effect, Context } = require('effect')

  // Create minimal service tags
  const Config = Context.GenericTag('Config')
  const Auth = Context.GenericTag('Auth')
  const GitHubApi = Context.GenericTag('GitHubApi')
  const Loading = Context.GenericTag('Loading')

  const ConfigLive = Layer.succeed(Config, {
    load: () => Effect.succeed({}),
    save: () => Effect.succeed(undefined),
  })
  const AuthLive = Layer.succeed(Auth, {
    getToken: () => Effect.succeed('mock-token'),
  })
  const GitHubApiLive = Layer.succeed(GitHubApi, {})
  const LoadingLive = Layer.succeed(Loading, {
    start: () => Effect.succeed(undefined),
    stop: () => Effect.succeed(undefined),
  })

  const AppLayer = Layer.mergeAll(ConfigLive, AuthLive, GitHubApiLive, LoadingLive)

  return { AppLayer, Config, Auth, GitHubApi, Loading }
})

import { runEffect } from './effect'
import { Effect } from 'effect'

describe('runEffect', () => {
  it('resolves a successful effect', async () => {
    const effect = Effect.succeed(42)
    const result = await runEffect(effect)
    expect(result).toBe(42)
  })

  it('resolves with complex values', async () => {
    const effect = Effect.succeed({ name: 'test', count: 5 })
    const result = await runEffect(effect)
    expect(result).toEqual({ name: 'test', count: 5 })
  })

  it('rejects when effect fails', async () => {
    const effect = Effect.fail(new Error('boom'))
    await expect(runEffect(effect)).rejects.toThrow()
  })

  it('handles mapped effects', async () => {
    const effect = Effect.succeed(10).pipe(Effect.map((n) => n * 2))
    const result = await runEffect(effect)
    expect(result).toBe(20)
  })

  it('handles chained effects', async () => {
    const effect = Effect.succeed('hello').pipe(
      Effect.flatMap((s) => Effect.succeed(s.toUpperCase())),
    )
    const result = await runEffect(effect)
    expect(result).toBe('HELLO')
  })
})
