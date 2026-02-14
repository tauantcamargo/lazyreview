import { describe, it, expect } from 'vitest'
import {
  GiteaIssueCommentSchema,
  GiteaReviewCommentSchema,
} from './comment'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  login: 'janedoe',
  full_name: 'Jane Doe',
  avatar_url: 'https://gitea.example.com/avatars/1',
}

const validIssueComment = {
  id: 100,
  body: 'This looks great!',
  user: validUser,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  html_url: 'https://gitea.example.com/owner/repo/issues/1#issuecomment-100',
}

const validReviewComment = {
  id: 200,
  body: 'Nit: rename this variable',
  user: validUser,
  path: 'src/main.ts',
  line: 42,
  old_line_num: 0,
  new_line_num: 42,
  diff_hunk: '@@ -40,6 +40,8 @@',
  pull_request_review_id: 10,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  html_url: 'https://gitea.example.com/owner/repo/pulls/1#issuecomment-200',
  commit_id: 'abc123',
  original_commit_id: 'abc123',
}

// ---------------------------------------------------------------------------
// GiteaIssueCommentSchema
// ---------------------------------------------------------------------------

describe('GiteaIssueCommentSchema', () => {
  it('parses a fully-populated issue comment', () => {
    const result = GiteaIssueCommentSchema.parse(validIssueComment)
    expect(result.id).toBe(100)
    expect(result.body).toBe('This looks great!')
    expect(result.user.login).toBe('janedoe')
    expect(result.created_at).toBe('2026-01-15T10:00:00Z')
  })

  it('defaults optional fields', () => {
    const minimal = {
      id: 101,
      body: 'test',
      user: { id: 1, login: 'test' },
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    }
    const result = GiteaIssueCommentSchema.parse(minimal)
    expect(result.html_url).toBe('')
  })

  it('rejects missing body', () => {
    const { body: _, ...noBody } = validIssueComment
    expect(() => GiteaIssueCommentSchema.parse(noBody)).toThrow()
  })

  it('rejects missing user', () => {
    const { user: _, ...noUser } = validIssueComment
    expect(() => GiteaIssueCommentSchema.parse(noUser)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GiteaReviewCommentSchema
// ---------------------------------------------------------------------------

describe('GiteaReviewCommentSchema', () => {
  it('parses a fully-populated review comment', () => {
    const result = GiteaReviewCommentSchema.parse(validReviewComment)
    expect(result.id).toBe(200)
    expect(result.body).toBe('Nit: rename this variable')
    expect(result.path).toBe('src/main.ts')
    expect(result.new_line_num).toBe(42)
    expect(result.old_line_num).toBe(0)
    expect(result.diff_hunk).toBe('@@ -40,6 +40,8 @@')
    expect(result.pull_request_review_id).toBe(10)
    expect(result.commit_id).toBe('abc123')
  })

  it('defaults optional fields', () => {
    const minimal = {
      id: 201,
      body: 'test',
      user: { id: 1, login: 'test' },
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    }
    const result = GiteaReviewCommentSchema.parse(minimal)
    expect(result.path).toBe('')
    expect(result.line).toBeUndefined()
    expect(result.old_line_num).toBeUndefined()
    expect(result.new_line_num).toBeUndefined()
    expect(result.diff_hunk).toBe('')
    expect(result.pull_request_review_id).toBeUndefined()
    expect(result.html_url).toBe('')
    expect(result.commit_id).toBe('')
    expect(result.original_commit_id).toBe('')
  })

  it('accepts null line values', () => {
    const result = GiteaReviewCommentSchema.parse({
      ...validReviewComment,
      line: null,
      old_line_num: null,
      new_line_num: null,
    })
    expect(result.line).toBeNull()
    expect(result.old_line_num).toBeNull()
    expect(result.new_line_num).toBeNull()
  })

  it('rejects missing id', () => {
    const { id: _, ...noId } = validReviewComment
    expect(() => GiteaReviewCommentSchema.parse(noId)).toThrow()
  })
})
