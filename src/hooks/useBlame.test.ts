import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for useBlame hook.
 *
 * Since we don't have @testing-library/react-hooks, we test the behavior
 * by mocking React hooks (useState, useCallback, useMemo) and capturing
 * the query options passed to useQuery.
 */

// ---------------------------------------------------------------------------
// State tracking
// ---------------------------------------------------------------------------

let isEnabledState = false
const mockSetIsEnabled = vi.fn((updater: boolean | ((prev: boolean) => boolean)) => {
  if (typeof updater === 'function') {
    isEnabledState = updater(isEnabledState)
  } else {
    isEnabledState = updater
  }
})

let useStateCalls = 0

// ---------------------------------------------------------------------------
// Mock React
// ---------------------------------------------------------------------------

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      const callIndex = useStateCalls++
      if (callIndex % 1 === 0) return [isEnabledState ?? initial, mockSetIsEnabled]
      return [initial, vi.fn()]
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
  }
})

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
// ---------------------------------------------------------------------------

interface CapturedQueryOptions {
  queryKey: unknown[]
  queryFn: () => Promise<unknown>
  enabled: boolean
  staleTime: number
}

let capturedQueryOptions: CapturedQueryOptions | null = null
let mockQueryReturn: { data: unknown; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null,
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: CapturedQueryOptions) => {
    capturedQueryOptions = options
    return mockQueryReturn
  }),
}))

// ---------------------------------------------------------------------------
// Mock Effect / services
// ---------------------------------------------------------------------------

vi.mock('../utils/effect', () => ({
  runEffect: vi.fn((effect: unknown) => effect),
}))

vi.mock('../services/GitHubApi', () => ({
  CodeReviewApi: {
    key: 'CodeReviewApi',
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { useBlame } = await import('./useBlame')
import type { UseBlameOptions } from './useBlame'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultOptions: UseBlameOptions = {
  owner: 'testorg',
  repo: 'testrepo',
  path: 'src/index.ts',
  ref: 'abc123',
  supportsBlame: true,
}

function resetState() {
  isEnabledState = false
  useStateCalls = 0
  capturedQueryOptions = null
  mockQueryReturn = {
    data: undefined,
    isLoading: false,
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBlame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  it('returns initial state with blame disabled', () => {
    const result = useBlame(defaultOptions)

    expect(result.isEnabled).toBe(false)
    expect(result.isSupported).toBe(true)
    expect(result.isLoading).toBe(false)
    expect(result.blameData.size).toBe(0)
    expect(result.error).toBeNull()
  })

  it('toggleBlame calls setState to enable blame when supported', () => {
    const result = useBlame(defaultOptions)

    result.toggleBlame()

    expect(mockSetIsEnabled).toHaveBeenCalled()
    // Verify the updater function toggles from false to true
    const updater = mockSetIsEnabled.mock.calls[0]![0] as (prev: boolean) => boolean
    expect(updater(false)).toBe(true)
  })

  it('toggleBlame updater toggles from true to false', () => {
    const result = useBlame(defaultOptions)

    result.toggleBlame()

    const updater = mockSetIsEnabled.mock.calls[0]![0] as (prev: boolean) => boolean
    expect(updater(true)).toBe(false)
  })

  it('toggleBlame is a no-op when supportsBlame is false', () => {
    const result = useBlame({ ...defaultOptions, supportsBlame: false })

    result.toggleBlame()

    expect(mockSetIsEnabled).not.toHaveBeenCalled()
    expect(result.isSupported).toBe(false)
  })

  it('isSupported reflects supportsBlame prop', () => {
    const supported = useBlame(defaultOptions)
    expect(supported.isSupported).toBe(true)

    resetState()
    const unsupported = useBlame({ ...defaultOptions, supportsBlame: false })
    expect(unsupported.isSupported).toBe(false)
  })

  it('passes correct query key to useQuery', () => {
    useBlame(defaultOptions)

    expect(capturedQueryOptions).not.toBeNull()
    expect(capturedQueryOptions!.queryKey).toEqual([
      'file-blame',
      'testorg',
      'testrepo',
      'src/index.ts',
      'abc123',
    ])
  })

  it('query is disabled when blame is not toggled on', () => {
    useBlame(defaultOptions)

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('query is disabled when path is null', () => {
    useBlame({ ...defaultOptions, path: null })

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('query is disabled when owner is empty', () => {
    useBlame({ ...defaultOptions, owner: '' })

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('query is disabled when provider does not support blame', () => {
    useBlame({ ...defaultOptions, supportsBlame: false })

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('query is enabled when blame is toggled on and all params are truthy', () => {
    isEnabledState = true
    useBlame(defaultOptions)

    expect(capturedQueryOptions!.enabled).toBe(true)
  })

  it('returns blame data as a Map keyed by line number', () => {
    const blameEntries = [
      { line: 1, author: 'alice', date: '2025-01-01T00:00:00Z', commitSha: 'abc', commitMessage: 'init' },
      { line: 2, author: 'bob', date: '2025-02-01T00:00:00Z', commitSha: 'def', commitMessage: 'fix' },
    ]

    mockQueryReturn = {
      data: blameEntries,
      isLoading: false,
      error: null,
    }

    const result = useBlame(defaultOptions)

    expect(result.blameData.size).toBe(2)
    expect(result.blameData.get(1)?.author).toBe('alice')
    expect(result.blameData.get(2)?.author).toBe('bob')
  })

  it('returns empty map when data is undefined', () => {
    mockQueryReturn = {
      data: undefined,
      isLoading: false,
      error: null,
    }

    const result = useBlame(defaultOptions)

    expect(result.blameData.size).toBe(0)
  })

  it('isLoading is false when blame is not enabled even if query is loading', () => {
    mockQueryReturn = {
      data: undefined,
      isLoading: true,
      error: null,
    }

    const result = useBlame(defaultOptions)

    // isEnabled is false, so isLoading should be false
    expect(result.isLoading).toBe(false)
  })

  it('isLoading is true when blame is enabled and query is loading', () => {
    isEnabledState = true
    mockQueryReturn = {
      data: undefined,
      isLoading: true,
      error: null,
    }

    const result = useBlame(defaultOptions)

    expect(result.isLoading).toBe(true)
  })

  it('returns error from query', () => {
    const error = new Error('GraphQL error')
    mockQueryReturn = {
      data: undefined,
      isLoading: false,
      error,
    }

    const result = useBlame(defaultOptions)

    expect(result.error).toBe(error)
  })

  it('uses correct staleTime for caching', () => {
    useBlame(defaultOptions)

    expect(capturedQueryOptions!.staleTime).toBe(5 * 60 * 1000)
  })

  it('uses distinct query keys for different files', () => {
    useBlame({ ...defaultOptions, path: 'file1.ts' })
    const key1 = [...capturedQueryOptions!.queryKey]

    resetState()
    useBlame({ ...defaultOptions, path: 'file2.ts' })
    const key2 = [...capturedQueryOptions!.queryKey]

    expect(key1).not.toEqual(key2)
  })

  it('uses distinct query keys for different refs', () => {
    useBlame({ ...defaultOptions, ref: 'sha1' })
    const key1 = [...capturedQueryOptions!.queryKey]

    resetState()
    useBlame({ ...defaultOptions, ref: 'sha2' })
    const key2 = [...capturedQueryOptions!.queryKey]

    expect(key1).not.toEqual(key2)
  })
})
