import React, { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { Text } from 'ink'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createGitHubMutation,
  createOptimisticMutation,
} from './useGitHubMutations'

const runProviderEffect = vi.fn()
vi.mock('../utils/providerEffect', () => ({
  runProviderEffect: (...args: unknown[]) => runProviderEffect(...args),
}))

interface Params {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly provider?: string
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function MutationRunner({
  hook,
  params,
  onDone,
}: {
  readonly hook: () => { readonly mutate: (p: Params) => void }
  readonly params: Params
  readonly onDone: () => void
}): React.ReactElement {
  const mutation = hook()
  useEffect(() => {
    mutation.mutate(params)
    onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Text>done</Text>
}

function renderMutation(
  hook: () => { readonly mutate: (p: Params) => void },
  params: Params,
): void {
  const queryClient = makeQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MutationRunner hook={hook} params={params} onDone={() => {}} />
    </QueryClientProvider>,
  )
}

describe('createGitHubMutation provider dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runProviderEffect.mockReturnValue(Promise.resolve(undefined))
  })

  it("passes the params' provider through to runProviderEffect", async () => {
    const effect = vi.fn((api: { closePR: () => void }) => api.closePR())
    const useHook = createGitHubMutation<Params>({ effect })

    renderMutation(useHook, {
      owner: 'acme',
      repo: 'web',
      prNumber: 1,
      provider: 'bitbucket',
    })

    await vi.waitFor(() => {
      expect(runProviderEffect).toHaveBeenCalledWith(
        'bitbucket',
        expect.any(Function),
      )
    })
  })

  it('passes undefined provider through unchanged (defaults to github downstream)', async () => {
    const effect = vi.fn((api: { closePR: () => void }) => api.closePR())
    const useHook = createGitHubMutation<Params>({ effect })

    renderMutation(useHook, { owner: 'acme', repo: 'web', prNumber: 1 })

    await vi.waitFor(() => {
      expect(runProviderEffect).toHaveBeenCalledWith(
        undefined,
        expect.any(Function),
      )
    })
  })
})

describe('createOptimisticMutation provider dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runProviderEffect.mockReturnValue(Promise.resolve(undefined))
  })

  it("passes the params' provider through to runProviderEffect", async () => {
    const effect = vi.fn((api: { closePR: () => void }) => api.closePR())
    const useHook = createOptimisticMutation<Params>({
      effect,
      invalidateKeys: () => [],
      cacheUpdates: [],
    })

    renderMutation(useHook, {
      owner: 'acme',
      repo: 'web',
      prNumber: 1,
      provider: 'bitbucket',
    })

    await vi.waitFor(() => {
      expect(runProviderEffect).toHaveBeenCalledWith(
        'bitbucket',
        expect.any(Function),
      )
    })
  })
})
