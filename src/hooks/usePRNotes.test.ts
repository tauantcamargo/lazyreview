import { describe, it, expect } from 'vitest'
import {
  createPRNotesStore,
  type PRNotesStore,
} from './usePRNotes'

describe('PRNotesStore', () => {
  function makeStore(): PRNotesStore {
    return createPRNotesStore()
  }

  it('returns null for a key with no note', () => {
    const store = makeStore()
    expect(store.getNote('github:owner/repo#1')).toBeNull()
  })

  it('saves and retrieves a note', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'My review notes')
    expect(store.getNote(key)).toBe('My review notes')
  })

  it('updates an existing note', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'First version')
    expect(store.getNote(key)).toBe('First version')

    store.saveNote(key, 'Updated version')
    expect(store.getNote(key)).toBe('Updated version')
  })

  it('deletes a note', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'Some notes')
    expect(store.getNote(key)).toBe('Some notes')

    store.deleteNote(key)
    expect(store.getNote(key)).toBeNull()
  })

  it('delete on non-existent key is a no-op', () => {
    const store = makeStore()
    // Should not throw
    store.deleteNote('github:owner/repo#999')
    expect(store.getNote('github:owner/repo#999')).toBeNull()
  })

  it('isolates notes by PR key', () => {
    const store = makeStore()
    const key1 = 'github:owner/repo#1'
    const key2 = 'github:owner/repo#2'
    const key3 = 'gitlab:org/project#10'

    store.saveNote(key1, 'Note for PR 1')
    store.saveNote(key2, 'Note for PR 2')
    store.saveNote(key3, 'Note for MR 10')

    expect(store.getNote(key1)).toBe('Note for PR 1')
    expect(store.getNote(key2)).toBe('Note for PR 2')
    expect(store.getNote(key3)).toBe('Note for MR 10')
  })

  it('hasNote returns false for missing key', () => {
    const store = makeStore()
    expect(store.hasNote('github:owner/repo#1')).toBe(false)
  })

  it('hasNote returns true after saving', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'notes')
    expect(store.hasNote(key)).toBe(true)
  })

  it('hasNote returns false after deleting', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'notes')
    store.deleteNote(key)
    expect(store.hasNote(key)).toBe(false)
  })

  it('saving empty string is allowed', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, '')
    expect(store.getNote(key)).toBe('')
    expect(store.hasNote(key)).toBe(true)
  })

  it('notifies listeners on save', () => {
    const store = makeStore()
    const listener = vi.fn()

    store.subscribe(listener)
    store.saveNote('github:owner/repo#1', 'note')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('notifies listeners on delete', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'
    store.saveNote(key, 'note')

    const listener = vi.fn()
    store.subscribe(listener)
    store.deleteNote(key)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('unsubscribe stops notifications', () => {
    const store = makeStore()
    const listener = vi.fn()

    const unsub = store.subscribe(listener)
    unsub()
    store.saveNote('github:owner/repo#1', 'note')
    expect(listener).not.toHaveBeenCalled()
  })

  it('snapshot reflects current state', () => {
    const store = makeStore()
    const key1 = 'github:owner/repo#1'
    const key2 = 'github:owner/repo#2'

    store.saveNote(key1, 'Note 1')
    store.saveNote(key2, 'Note 2')

    const snapshot = store.getSnapshot()
    expect(snapshot[key1]).toBe('Note 1')
    expect(snapshot[key2]).toBe('Note 2')
  })

  it('snapshot updates after delete', () => {
    const store = makeStore()
    const key = 'github:owner/repo#1'

    store.saveNote(key, 'Note 1')
    store.deleteNote(key)

    const snapshot = store.getSnapshot()
    expect(snapshot[key]).toBeUndefined()
  })

  it('multiple unsubscribes are idempotent', () => {
    const store = makeStore()
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    unsub() // Should not throw
    store.saveNote('github:owner/repo#1', 'note')
    expect(listener).not.toHaveBeenCalled()
  })
})
