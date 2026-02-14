import { describe, it, expect } from 'vitest'
import {
  buildPRSummaryPrompt,
  truncateDiffSample,
  formatCommitList,
  formatFileStats,
  type PRSummaryPromptParams,
} from './pr-summary-prompts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseParams: PRSummaryPromptParams = {
  title: 'Fix authentication bug in login flow',
  description: 'This PR fixes a race condition in the OAuth callback handler.',
  commits: [
    { message: 'fix: handle race condition in OAuth callback', sha: 'abc1234' },
    { message: 'test: add integration test for login flow', sha: 'def5678' },
  ],
  files: [
    { filename: 'src/auth/oauth.ts', additions: 25, deletions: 10 },
    { filename: 'src/auth/oauth.test.ts', additions: 40, deletions: 0 },
  ],
}

// ---------------------------------------------------------------------------
// buildPRSummaryPrompt
// ---------------------------------------------------------------------------

describe('buildPRSummaryPrompt', () => {
  it('returns a system message and a user message', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
  })

  it('system message instructs structured summary with required sections', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const system = messages[0]!.content
    expect(system).toContain('What changed')
    expect(system).toContain('Why')
    expect(system).toContain('Risk areas')
    expect(system).toContain('Complexity')
  })

  it('system message mentions Low/Medium/High complexity levels', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const system = messages[0]!.content
    expect(system).toContain('Low')
    expect(system).toContain('Medium')
    expect(system).toContain('High')
  })

  it('user message contains the PR title', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('Fix authentication bug in login flow')
  })

  it('user message contains the PR description', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('race condition in the OAuth callback handler')
  })

  it('user message contains commit messages', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('fix: handle race condition in OAuth callback')
    expect(user).toContain('test: add integration test for login flow')
  })

  it('user message contains commit SHAs (short)', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('abc1234')
    expect(user).toContain('def5678')
  })

  it('user message contains file stats', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).toContain('src/auth/oauth.ts')
    expect(user).toContain('+25')
    expect(user).toContain('-10')
    expect(user).toContain('src/auth/oauth.test.ts')
    expect(user).toContain('+40')
  })

  it('user message includes diff sample when provided', () => {
    const messages = buildPRSummaryPrompt({
      ...baseParams,
      diffSample: 'diff --git a/src/auth/oauth.ts\n+const handler = async () => {}',
    })
    const user = messages[1]!.content
    expect(user).toContain('diff --git a/src/auth/oauth.ts')
    expect(user).toContain('+const handler = async () => {}')
  })

  it('user message omits diff sample section when not provided', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    expect(user).not.toContain('Diff sample')
  })

  it('handles empty description', () => {
    const messages = buildPRSummaryPrompt({
      ...baseParams,
      description: '',
    })
    const user = messages[1]!.content
    expect(user).toContain('No description provided')
  })

  it('handles empty commits list', () => {
    const messages = buildPRSummaryPrompt({
      ...baseParams,
      commits: [],
    })
    const user = messages[1]!.content
    expect(user).toContain('No commits')
  })

  it('handles empty files list', () => {
    const messages = buildPRSummaryPrompt({
      ...baseParams,
      files: [],
    })
    const user = messages[1]!.content
    expect(user).toContain('No files')
  })

  it('truncates long PR descriptions to 1000 chars', () => {
    const longDesc = 'a'.repeat(1200)
    const messages = buildPRSummaryPrompt({
      ...baseParams,
      description: longDesc,
    })
    const user = messages[1]!.content
    expect(user).toContain('a'.repeat(1000) + '...')
    expect(user).not.toContain('a'.repeat(1001))
  })

  it('returns immutable message array', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    expect(Object.isFrozen(messages)).toBe(true)
  })

  it('includes total additions and deletions summary', () => {
    const messages = buildPRSummaryPrompt(baseParams)
    const user = messages[1]!.content
    // Total: +65 -10 across 2 files
    expect(user).toContain('2 files')
  })
})

// ---------------------------------------------------------------------------
// truncateDiffSample
// ---------------------------------------------------------------------------

describe('truncateDiffSample', () => {
  it('returns the diff unchanged when under the limit', () => {
    const diff = 'short diff content'
    expect(truncateDiffSample(diff, 16000)).toBe(diff)
  })

  it('truncates diff to the specified character limit', () => {
    const diff = 'x'.repeat(20000)
    const result = truncateDiffSample(diff, 16000)
    expect(result.length).toBeLessThanOrEqual(16000 + 50) // allow for suffix
    expect(result).toContain('... (truncated)')
  })

  it('returns empty string for undefined input', () => {
    expect(truncateDiffSample(undefined, 16000)).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(truncateDiffSample('', 16000)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatCommitList
// ---------------------------------------------------------------------------

describe('formatCommitList', () => {
  it('formats commits as bullet list with short SHA', () => {
    const result = formatCommitList([
      { message: 'feat: add new feature', sha: 'abcdef1234567890' },
    ])
    expect(result).toContain('abcdef1')
    expect(result).toContain('feat: add new feature')
  })

  it('returns placeholder for empty commits', () => {
    const result = formatCommitList([])
    expect(result).toContain('No commits')
  })

  it('limits to first 20 commits for large PRs', () => {
    const manyCommits = Array.from({ length: 30 }, (_, i) => ({
      message: `commit ${i}`,
      sha: `sha${i}`,
    }))
    const result = formatCommitList(manyCommits)
    expect(result).toContain('commit 0')
    expect(result).toContain('commit 19')
    expect(result).toContain('10 more commits')
    expect(result).not.toContain('commit 20')
  })

  it('handles commits with multiline messages (uses first line)', () => {
    const result = formatCommitList([
      { message: 'First line\nSecond line\nThird line', sha: 'abc1234' },
    ])
    expect(result).toContain('First line')
    expect(result).not.toContain('Second line')
  })
})

// ---------------------------------------------------------------------------
// formatFileStats
// ---------------------------------------------------------------------------

describe('formatFileStats', () => {
  it('formats files with additions and deletions', () => {
    const result = formatFileStats([
      { filename: 'src/index.ts', additions: 10, deletions: 5 },
    ])
    expect(result).toContain('src/index.ts')
    expect(result).toContain('+10')
    expect(result).toContain('-5')
  })

  it('returns placeholder for empty files', () => {
    const result = formatFileStats([])
    expect(result).toContain('No files')
  })

  it('limits to first 30 files for large PRs', () => {
    const manyFiles = Array.from({ length: 50 }, (_, i) => ({
      filename: `src/file${i}.ts`,
      additions: i,
      deletions: 0,
    }))
    const result = formatFileStats(manyFiles)
    expect(result).toContain('src/file0.ts')
    expect(result).toContain('src/file29.ts')
    expect(result).toContain('20 more files')
    expect(result).not.toContain('src/file30.ts')
  })

  it('includes total summary line', () => {
    const result = formatFileStats([
      { filename: 'a.ts', additions: 10, deletions: 5 },
      { filename: 'b.ts', additions: 20, deletions: 3 },
    ])
    expect(result).toContain('2 files')
    expect(result).toContain('+30')
    expect(result).toContain('-8')
  })
})
