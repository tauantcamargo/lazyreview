import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TimelineEvent } from '../models/timeline-event'

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
// ---------------------------------------------------------------------------

let capturedQueryOptions: {
  queryKey: unknown[]
  queryFn: () => Promise<unknown>
  enabled: boolean
  refetchInterval: number
} | null = null

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: typeof capturedQueryOptions) => {
    capturedQueryOptions = options
    return {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: false,
    }
  }),
}))

// Mock Effect and CodeReviewApi
vi.mock('../utils/effect', () => ({
  runEffect: vi.fn((effect: unknown) => effect),
}))

vi.mock('./useRefreshInterval', () => ({
  useRefreshInterval: () => 30000,
}))

vi.mock('./useConfig', () => ({
  useConfig: () => ({ config: { refreshInterval: 60 } }),
}))

vi.mock('./useRateLimit', () => ({
  useRateLimit: () => ({ remaining: 5000 }),
  updateRateLimit: vi.fn(),
}))

// Import after mocks
const { useTimeline } = await import('./useTimeline')

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const sampleTimeline: readonly TimelineEvent[] = [
  {
    type: 'commit',
    id: 'abc123',
    timestamp: '2025-06-01T12:00:00Z',
    sha: 'abc123',
    message: 'feat: add feature',
    author: { login: 'user1' },
  },
  {
    type: 'review',
    id: '456',
    timestamp: '2025-06-01T14:00:00Z',
    state: 'APPROVED',
    body: 'LGTM',
    author: { login: 'reviewer1' },
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTimeline', () => {
  beforeEach(() => {
    capturedQueryOptions = null
    vi.clearAllMocks()
  })

  it('passes correct query key with owner, repo, and prNumber', () => {
    useTimeline('octocat', 'hello-world', 42)

    expect(capturedQueryOptions).not.toBeNull()
    expect(capturedQueryOptions!.queryKey).toEqual([
      'pr-timeline',
      'octocat',
      'hello-world',
      42,
    ])
  })

  it('is enabled when owner, repo, and prNumber are all truthy', () => {
    useTimeline('owner', 'repo', 1)

    expect(capturedQueryOptions!.enabled).toBe(true)
  })

  it('is disabled when owner is empty', () => {
    useTimeline('', 'repo', 1)

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('is disabled when repo is empty', () => {
    useTimeline('owner', '', 1)

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('is disabled when prNumber is 0', () => {
    useTimeline('owner', 'repo', 0)

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('is disabled when enabled option is false', () => {
    useTimeline('owner', 'repo', 42, { enabled: false })

    expect(capturedQueryOptions!.enabled).toBe(false)
  })

  it('is enabled when enabled option is true', () => {
    useTimeline('owner', 'repo', 42, { enabled: true })

    expect(capturedQueryOptions!.enabled).toBe(true)
  })

  it('is enabled when no options are provided', () => {
    useTimeline('owner', 'repo', 42)

    expect(capturedQueryOptions!.enabled).toBe(true)
  })

  it('uses refetchInterval from useRefreshInterval', () => {
    useTimeline('owner', 'repo', 42)

    expect(capturedQueryOptions!.refetchInterval).toBe(30000)
  })

  it('provides a queryFn that is callable', () => {
    useTimeline('owner', 'repo', 42)

    expect(typeof capturedQueryOptions!.queryFn).toBe('function')
  })

  it('uses distinct query keys for different PRs', () => {
    useTimeline('owner', 'repo', 1)
    const key1 = [...capturedQueryOptions!.queryKey]

    useTimeline('owner', 'repo', 2)
    const key2 = [...capturedQueryOptions!.queryKey]

    expect(key1).not.toEqual(key2)
  })

  it('uses distinct query keys for different repos', () => {
    useTimeline('owner', 'repo1', 1)
    const key1 = [...capturedQueryOptions!.queryKey]

    useTimeline('owner', 'repo2', 1)
    const key2 = [...capturedQueryOptions!.queryKey]

    expect(key1).not.toEqual(key2)
  })

  it('uses distinct query keys for different owners', () => {
    useTimeline('owner1', 'repo', 1)
    const key1 = [...capturedQueryOptions!.queryKey]

    useTimeline('owner2', 'repo', 1)
    const key2 = [...capturedQueryOptions!.queryKey]

    expect(key1).not.toEqual(key2)
  })

  it('returns the result shape from useQuery', () => {
    const result = useTimeline('owner', 'repo', 42)

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('isLoading')
    expect(result).toHaveProperty('isError')
    expect(result).toHaveProperty('error')
  })
})
