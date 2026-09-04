import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { runProviderEffect } from './providerEffect'

const createBitbucketApiAdapter = vi.fn()
vi.mock('../services/BitbucketApiAdapter', () => ({
  createBitbucketApiAdapter: () => createBitbucketApiAdapter(),
}))

describe('runProviderEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes the Bitbucket adapter for provider "bitbucket"', async () => {
    const bitbucketApi = {
      getPR: vi.fn().mockReturnValue(Effect.succeed({ id: 1 })),
    }
    createBitbucketApiAdapter.mockReturnValue(bitbucketApi)

    const effectFn = vi.fn((api: typeof bitbucketApi) => api.getPR())
    const result = await runProviderEffect('bitbucket', effectFn as never)

    expect(createBitbucketApiAdapter).toHaveBeenCalledOnce()
    expect(effectFn).toHaveBeenCalledWith(bitbucketApi)
    expect(result).toEqual({ id: 1 })
  })

  it('propagates a Bitbucket-branch failure by rejecting the promise', async () => {
    const bitbucketApi = {
      getPR: vi.fn().mockReturnValue(Effect.fail(new Error('boom'))),
    }
    createBitbucketApiAdapter.mockReturnValue(bitbucketApi)

    const effectFn = (api: typeof bitbucketApi) => api.getPR()
    await expect(
      runProviderEffect('bitbucket', effectFn as never),
    ).rejects.toThrow()
  })

  it('does not construct a Bitbucket adapter for provider "github"', async () => {
    const effectFn = vi.fn(() => Effect.succeed('unused'))
    // The github branch goes through the real Effect/AppLayer machinery,
    // which isn't stood up in this unit test and will reject -- that's
    // expected here. The point is dispatch never touched the Bitbucket path.
    await runProviderEffect('github', effectFn as never).catch(() => {})
    expect(createBitbucketApiAdapter).not.toHaveBeenCalled()
  })

  it('does not construct a Bitbucket adapter when provider is undefined', async () => {
    const effectFn = vi.fn(() => Effect.succeed('unused'))
    await runProviderEffect(undefined, effectFn as never).catch(() => {})
    expect(createBitbucketApiAdapter).not.toHaveBeenCalled()
  })
})
