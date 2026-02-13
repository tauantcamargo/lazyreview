import { describe, it, expect } from 'vitest'
import {
  GitLabNoteSchema,
  GitLabNotePositionSchema,
  GitLabDiscussionSchema,
} from './note'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  username: 'janedoe',
  name: 'Jane Doe',
  avatar_url: 'https://gitlab.com/avatar.png',
  web_url: 'https://gitlab.com/janedoe',
}

const validPosition = {
  base_sha: 'aaa111',
  head_sha: 'bbb222',
  start_sha: 'ccc333',
  old_path: 'src/old.ts',
  new_path: 'src/new.ts',
  old_line: 10,
  new_line: 15,
}

const minimalNote = {
  id: 500,
  body: 'Looks good to me!',
  author: validUser,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  system: false,
}

// ---------------------------------------------------------------------------
// GitLabNotePositionSchema
// ---------------------------------------------------------------------------

describe('GitLabNotePositionSchema', () => {
  it('parses a valid position', () => {
    const result = GitLabNotePositionSchema.parse(validPosition)
    expect(result.base_sha).toBe('aaa111')
    expect(result.old_path).toBe('src/old.ts')
    expect(result.new_path).toBe('src/new.ts')
    expect(result.old_line).toBe(10)
    expect(result.new_line).toBe(15)
  })

  it('accepts null line numbers', () => {
    const result = GitLabNotePositionSchema.parse({
      ...validPosition,
      old_line: null,
      new_line: null,
    })
    expect(result.old_line).toBeNull()
    expect(result.new_line).toBeNull()
  })

  it('rejects missing old_path', () => {
    const { old_path: _, ...partial } = validPosition
    expect(() => GitLabNotePositionSchema.parse(partial)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GitLabNoteSchema
// ---------------------------------------------------------------------------

describe('GitLabNoteSchema', () => {
  it('parses a minimal note', () => {
    const result = GitLabNoteSchema.parse(minimalNote)
    expect(result.id).toBe(500)
    expect(result.body).toBe('Looks good to me!')
    expect(result.system).toBe(false)
    expect(result.resolvable).toBe(false)
    expect(result.resolved).toBe(false)
  })

  it('parses a system note', () => {
    const result = GitLabNoteSchema.parse({
      ...minimalNote,
      system: true,
      body: 'mentioned in issue #5',
    })
    expect(result.system).toBe(true)
  })

  it('parses a resolvable diff note', () => {
    const diffNote = {
      ...minimalNote,
      resolvable: true,
      resolved: false,
      type: 'DiffNote',
      position: validPosition,
    }
    const result = GitLabNoteSchema.parse(diffNote)
    expect(result.resolvable).toBe(true)
    expect(result.resolved).toBe(false)
    expect(result.type).toBe('DiffNote')
    expect(result.position?.new_path).toBe('src/new.ts')
  })

  it('parses a resolved note', () => {
    const result = GitLabNoteSchema.parse({
      ...minimalNote,
      resolvable: true,
      resolved: true,
      resolved_by: { ...validUser, id: 2, username: 'resolver' },
    })
    expect(result.resolved).toBe(true)
    expect(result.resolved_by?.username).toBe('resolver')
  })

  it('accepts null type', () => {
    const result = GitLabNoteSchema.parse({ ...minimalNote, type: null })
    expect(result.type).toBeNull()
  })

  it('accepts null resolved_by', () => {
    const result = GitLabNoteSchema.parse({
      ...minimalNote,
      resolved_by: null,
    })
    expect(result.resolved_by).toBeNull()
  })

  it('rejects missing body', () => {
    const { body: _, ...noBody } = minimalNote
    expect(() => GitLabNoteSchema.parse(noBody)).toThrow()
  })

  it('rejects missing author', () => {
    const { author: _, ...noAuthor } = minimalNote
    expect(() => GitLabNoteSchema.parse(noAuthor)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GitLabDiscussionSchema
// ---------------------------------------------------------------------------

describe('GitLabDiscussionSchema', () => {
  it('parses a discussion with notes', () => {
    const discussion = {
      id: 'disc-abc-123',
      individual_note: false,
      notes: [minimalNote, { ...minimalNote, id: 501, body: 'Reply here' }],
    }
    const result = GitLabDiscussionSchema.parse(discussion)
    expect(result.id).toBe('disc-abc-123')
    expect(result.individual_note).toBe(false)
    expect(result.notes).toHaveLength(2)
    expect(result.notes[1].body).toBe('Reply here')
  })

  it('parses an individual note discussion', () => {
    const discussion = {
      id: 'disc-single',
      individual_note: true,
      notes: [minimalNote],
    }
    const result = GitLabDiscussionSchema.parse(discussion)
    expect(result.individual_note).toBe(true)
    expect(result.notes).toHaveLength(1)
  })

  it('rejects missing id', () => {
    expect(() =>
      GitLabDiscussionSchema.parse({
        individual_note: true,
        notes: [minimalNote],
      }),
    ).toThrow()
  })
})
