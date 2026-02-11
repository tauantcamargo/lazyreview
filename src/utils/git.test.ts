import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseGitHubUrl, checkoutPR, hasUncommittedChanges } from './git'
import type { CheckoutResult } from './git'

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

// Mock node:util to provide promisify that wraps our mocked execFile
import { execFile } from 'node:child_process'

// Get reference to the mocked execFile
const mockExecFile = vi.mocked(execFile)

/**
 * Helper to make execFile resolve with given stdout
 */
function mockExecSuccess(stdout: string): void {
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      if (typeof callback === 'function') {
        callback(null, { stdout, stderr: '' })
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

/**
 * Helper to make execFile reject with given error
 */
function mockExecError(message: string): void {
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      if (typeof callback === 'function') {
        callback(new Error(message), { stdout: '', stderr: '' })
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

/**
 * Helper to make execFile behave differently per call
 */
function mockExecSequence(
  behaviors: ReadonlyArray<{ stdout?: string; error?: string }>,
): void {
  let callIndex = 0
  mockExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      const behavior = behaviors[callIndex] ?? behaviors[behaviors.length - 1]
      callIndex++
      if (typeof callback === 'function') {
        if (behavior?.error) {
          callback(new Error(behavior.error), { stdout: '', stderr: '' })
        } else {
          callback(null, { stdout: behavior?.stdout ?? '', stderr: '' })
        }
      }
      return {} as ReturnType<typeof execFile>
    },
  )
}

describe('parseGitHubUrl', () => {
  it('parses SSH format', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses SSH format without .git suffix', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTPS format', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTPS format without .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses HTTP format', () => {
    const result = parseGitHubUrl('http://github.com/owner/repo.git')
    expect(result).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseGitHubUrl('')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull()
  })
})

describe('hasUncommittedChanges', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns true when working tree has changes', async () => {
    mockExecSuccess(' M src/app.tsx\n?? new-file.ts\n')
    const result = await hasUncommittedChanges()
    expect(result).toBe(true)
  })

  it('returns false when working tree is clean', async () => {
    mockExecSuccess('')
    const result = await hasUncommittedChanges()
    expect(result).toBe(false)
  })

  it('returns false when git status fails (not a repo)', async () => {
    mockExecError('fatal: not a git repository')
    const result = await hasUncommittedChanges()
    expect(result).toBe(false)
  })
})

describe('checkoutPR', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when working tree is dirty', async () => {
    // First call: git status --porcelain returns changes
    mockExecSuccess(' M dirty-file.ts')
    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: false,
      message: 'Working tree has uncommitted changes. Commit or stash them first.',
      branchName: 'pr-42',
    })
  })

  it('fetches and checks out PR branch on clean tree', async () => {
    // Call 1: git status --porcelain (clean)
    // Call 2: git fetch origin pull/42/head:pr-42
    // Call 3: git checkout pr-42
    mockExecSequence([
      { stdout: '' },    // status: clean
      { stdout: '' },    // fetch: success
      { stdout: '' },    // checkout: success
    ])

    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: true,
      message: 'Checked out branch pr-42',
      branchName: 'pr-42',
    })
  })

  it('handles branch already exists by checking out and updating', async () => {
    // Call 1: git status --porcelain (clean)
    // Call 2: git fetch fails with "already exists"
    // Call 3: git checkout pr-42
    // Call 4: git pull origin pull/42/head
    mockExecSequence([
      { stdout: '' },
      { error: "fatal: couldn't find remote ref; branch 'pr-42' already exists" },
      { stdout: '' },
      { stdout: '' },
    ])

    const result = await checkoutPR(42)
    expect(result).toEqual<CheckoutResult>({
      success: true,
      message: 'Switched to existing branch pr-42 and updated',
      branchName: 'pr-42',
    })
  })

  it('returns error on fetch failure', async () => {
    mockExecSequence([
      { stdout: '' },
      { error: 'fatal: could not read from remote repository' },
    ])

    const result = await checkoutPR(99)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Failed to checkout PR #99')
    expect(result.branchName).toBe('pr-99')
  })
})
