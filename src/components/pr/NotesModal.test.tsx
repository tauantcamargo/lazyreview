import { describe, it, expect } from 'vitest'
import {
  getNotesModalTitle,
  computeCharCount,
  getNotesHintText,
} from './NotesModal'

// ---------------------------------------------------------------------------
// Pure helper tests for NotesModal
// ---------------------------------------------------------------------------

describe('getNotesModalTitle', () => {
  it('returns title for new note', () => {
    expect(getNotesModalTitle(false)).toBe('Add Note')
  })

  it('returns title for editing existing note', () => {
    expect(getNotesModalTitle(true)).toBe('Edit Note')
  })
})

describe('computeCharCount', () => {
  it('returns 0 for empty string', () => {
    expect(computeCharCount('')).toBe(0)
  })

  it('counts characters correctly', () => {
    expect(computeCharCount('hello')).toBe(5)
  })

  it('counts multiline content', () => {
    expect(computeCharCount('line1\nline2')).toBe(11)
  })

  it('counts spaces', () => {
    expect(computeCharCount('  ')).toBe(2)
  })
})

describe('getNotesHintText', () => {
  it('includes save hint', () => {
    const hint = getNotesHintText(false)
    expect(hint).toContain('Ctrl+S')
    expect(hint).toContain('save')
  })

  it('includes cancel hint', () => {
    const hint = getNotesHintText(false)
    expect(hint).toContain('Esc')
    expect(hint).toContain('cancel')
  })

  it('includes delete hint when note exists', () => {
    const hint = getNotesHintText(true)
    expect(hint).toContain('Ctrl+D')
    expect(hint).toContain('delete')
  })

  it('does not include delete hint for new note', () => {
    const hint = getNotesHintText(false)
    expect(hint).not.toContain('Ctrl+D')
  })
})
