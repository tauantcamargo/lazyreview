import { describe, it, expect } from 'vitest'
import {
  GitLabUserSchema,
  GitLabDiffRefsSchema,
  GitLabHeadPipelineSchema,
  GitLabMergeRequestSchema,
} from './merge-request'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  username: 'janedoe',
  name: 'Jane Doe',
  avatar_url: 'https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png',
  web_url: 'https://gitlab.com/janedoe',
}

const validDiffRefs = {
  base_sha: 'aaa111',
  head_sha: 'bbb222',
  start_sha: 'ccc333',
}

const validPipeline = {
  id: 100,
  status: 'success',
  web_url: 'https://gitlab.com/project/-/pipelines/100',
}

const minimalMR = {
  id: 1001,
  iid: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  state: 'opened' as const,
  source_branch: 'feature/dark-mode',
  target_branch: 'main',
  author: validUser,
  sha: 'abc123def',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-16T12:00:00Z',
  web_url: 'https://gitlab.com/project/-/merge_requests/42',
}

// ---------------------------------------------------------------------------
// GitLabUserSchema
// ---------------------------------------------------------------------------

describe('GitLabUserSchema', () => {
  it('parses a valid user', () => {
    const result = GitLabUserSchema.parse(validUser)
    expect(result.id).toBe(1)
    expect(result.username).toBe('janedoe')
    expect(result.name).toBe('Jane Doe')
    expect(result.avatar_url).toBe(
      'https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png',
    )
    expect(result.web_url).toBe('https://gitlab.com/janedoe')
  })

  it('accepts null avatar_url', () => {
    const result = GitLabUserSchema.parse({ ...validUser, avatar_url: null })
    expect(result.avatar_url).toBeNull()
  })

  it('rejects missing username', () => {
    const { username: _, ...noUsername } = validUser
    expect(() => GitLabUserSchema.parse(noUsername)).toThrow()
  })

  it('rejects non-number id', () => {
    expect(() =>
      GitLabUserSchema.parse({ ...validUser, id: 'not-a-number' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GitLabDiffRefsSchema
// ---------------------------------------------------------------------------

describe('GitLabDiffRefsSchema', () => {
  it('parses valid diff refs', () => {
    const result = GitLabDiffRefsSchema.parse(validDiffRefs)
    expect(result.base_sha).toBe('aaa111')
    expect(result.head_sha).toBe('bbb222')
    expect(result.start_sha).toBe('ccc333')
  })

  it('rejects missing base_sha', () => {
    const { base_sha: _, ...partial } = validDiffRefs
    expect(() => GitLabDiffRefsSchema.parse(partial)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GitLabHeadPipelineSchema
// ---------------------------------------------------------------------------

describe('GitLabHeadPipelineSchema', () => {
  it('parses a valid pipeline', () => {
    const result = GitLabHeadPipelineSchema.parse(validPipeline)
    expect(result.id).toBe(100)
    expect(result.status).toBe('success')
    expect(result.web_url).toBe(
      'https://gitlab.com/project/-/pipelines/100',
    )
  })
})

// ---------------------------------------------------------------------------
// GitLabMergeRequestSchema
// ---------------------------------------------------------------------------

describe('GitLabMergeRequestSchema', () => {
  it('parses a minimal merge request', () => {
    const result = GitLabMergeRequestSchema.parse(minimalMR)
    expect(result.id).toBe(1001)
    expect(result.iid).toBe(42)
    expect(result.title).toBe('Add dark mode')
    expect(result.description).toBe('Implements dark mode toggle')
    expect(result.state).toBe('opened')
    expect(result.source_branch).toBe('feature/dark-mode')
    expect(result.target_branch).toBe('main')
    expect(result.sha).toBe('abc123def')
  })

  it('defaults optional fields', () => {
    const result = GitLabMergeRequestSchema.parse(minimalMR)
    expect(result.draft).toBe(false)
    expect(result.assignees).toEqual([])
    expect(result.reviewers).toEqual([])
    expect(result.labels).toEqual([])
    expect(result.user_notes_count).toBe(0)
    expect(result.has_conflicts).toBe(false)
  })

  it('parses a fully-populated merge request', () => {
    const fullMR = {
      ...minimalMR,
      draft: true,
      assignees: [validUser],
      reviewers: [{ ...validUser, id: 2, username: 'reviewer1' }],
      labels: ['bug', 'urgent'],
      merged_at: '2026-01-17T08:00:00Z',
      closed_at: null,
      merge_commit_sha: 'merged123',
      diff_refs: validDiffRefs,
      user_notes_count: 5,
      has_conflicts: true,
      merge_status: 'can_be_merged',
      head_pipeline: validPipeline,
    }

    const result = GitLabMergeRequestSchema.parse(fullMR)
    expect(result.draft).toBe(true)
    expect(result.assignees).toHaveLength(1)
    expect(result.reviewers).toHaveLength(1)
    expect(result.reviewers[0].username).toBe('reviewer1')
    expect(result.labels).toEqual(['bug', 'urgent'])
    expect(result.merged_at).toBe('2026-01-17T08:00:00Z')
    expect(result.merge_commit_sha).toBe('merged123')
    expect(result.diff_refs?.base_sha).toBe('aaa111')
    expect(result.user_notes_count).toBe(5)
    expect(result.has_conflicts).toBe(true)
    expect(result.merge_status).toBe('can_be_merged')
    expect(result.head_pipeline?.status).toBe('success')
  })

  it('accepts null description', () => {
    const result = GitLabMergeRequestSchema.parse({
      ...minimalMR,
      description: null,
    })
    expect(result.description).toBeNull()
  })

  it('accepts null head_pipeline', () => {
    const result = GitLabMergeRequestSchema.parse({
      ...minimalMR,
      head_pipeline: null,
    })
    expect(result.head_pipeline).toBeNull()
  })

  it('rejects invalid state', () => {
    expect(() =>
      GitLabMergeRequestSchema.parse({ ...minimalMR, state: 'open' }),
    ).toThrow()
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = minimalMR
    expect(() => GitLabMergeRequestSchema.parse(noTitle)).toThrow()
  })

  it('rejects missing author', () => {
    const { author: _, ...noAuthor } = minimalMR
    expect(() => GitLabMergeRequestSchema.parse(noAuthor)).toThrow()
  })
})
