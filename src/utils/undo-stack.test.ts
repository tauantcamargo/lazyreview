import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createUndoStack,
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
  currentState,
  type EditorState,
  type UndoStack,
  MAX_UNDO_STATES,
  shouldPushState,
  DEBOUNCE_MS,
} from './undo-stack'

function makeState(
  lines: readonly string[] = [''],
  cursorRow = 0,
  cursorCol = 0,
): EditorState {
  return { lines, cursorRow, cursorCol }
}

describe('createUndoStack', () => {
  it('creates a stack with the initial state', () => {
    const initial = makeState(['hello'])
    const stack = createUndoStack(initial)
    expect(currentState(stack)).toEqual(initial)
  })

  it('starts with no undo or redo available', () => {
    const stack = createUndoStack(makeState())
    expect(canUndo(stack)).toBe(false)
    expect(canRedo(stack)).toBe(false)
  })
})

describe('pushState', () => {
  it('adds a new state to the stack', () => {
    const stack = createUndoStack(makeState(['a']))
    const state2 = makeState(['a', 'b'], 1, 0)
    const updated = pushState(stack, state2)
    expect(currentState(updated)).toEqual(state2)
    expect(canUndo(updated)).toBe(true)
  })

  it('clears redo history when pushing new state after undo', () => {
    const stack = createUndoStack(makeState(['a']))
    const s1 = pushState(stack, makeState(['a', 'b']))
    const s2 = pushState(s1, makeState(['a', 'b', 'c']))
    const afterUndo = undo(s2)
    // Now push a new state - should clear redo
    const s3 = pushState(afterUndo, makeState(['a', 'b', 'd']))
    expect(canRedo(s3)).toBe(false)
    expect(currentState(s3)).toEqual(makeState(['a', 'b', 'd']))
  })

  it('limits the stack to MAX_UNDO_STATES entries', () => {
    let stack = createUndoStack(makeState(['0']))
    for (let i = 1; i <= MAX_UNDO_STATES + 10; i++) {
      stack = pushState(stack, makeState([String(i)]))
    }
    // Should be able to undo MAX_UNDO_STATES - 1 times (current is top)
    let undoCount = 0
    let s = stack
    while (canUndo(s)) {
      s = undo(s)
      undoCount++
    }
    expect(undoCount).toBeLessThanOrEqual(MAX_UNDO_STATES - 1)
  })
})

describe('undo', () => {
  it('returns previous state when undoing', () => {
    const initial = makeState(['a'])
    const stack = createUndoStack(initial)
    const updated = pushState(stack, makeState(['a', 'b']))
    const afterUndo = undo(updated)
    expect(currentState(afterUndo)).toEqual(initial)
  })

  it('returns same stack when nothing to undo', () => {
    const stack = createUndoStack(makeState(['a']))
    const afterUndo = undo(stack)
    expect(currentState(afterUndo)).toEqual(makeState(['a']))
    expect(afterUndo).toBe(stack)
  })

  it('supports multiple undos', () => {
    const s0 = makeState(['a'])
    const s1 = makeState(['a', 'b'])
    const s2 = makeState(['a', 'b', 'c'])

    let stack = createUndoStack(s0)
    stack = pushState(stack, s1)
    stack = pushState(stack, s2)

    stack = undo(stack)
    expect(currentState(stack)).toEqual(s1)

    stack = undo(stack)
    expect(currentState(stack)).toEqual(s0)
  })

  it('enables redo after undo', () => {
    const stack = createUndoStack(makeState(['a']))
    const updated = pushState(stack, makeState(['a', 'b']))
    const afterUndo = undo(updated)
    expect(canRedo(afterUndo)).toBe(true)
  })
})

describe('redo', () => {
  it('restores undone state', () => {
    const initial = makeState(['a'])
    const second = makeState(['a', 'b'])
    let stack = createUndoStack(initial)
    stack = pushState(stack, second)
    stack = undo(stack)
    stack = redo(stack)
    expect(currentState(stack)).toEqual(second)
  })

  it('returns same stack when nothing to redo', () => {
    const stack = createUndoStack(makeState(['a']))
    const afterRedo = redo(stack)
    expect(afterRedo).toBe(stack)
  })

  it('supports multiple redo after multiple undo', () => {
    const s0 = makeState(['a'])
    const s1 = makeState(['a', 'b'])
    const s2 = makeState(['a', 'b', 'c'])

    let stack = createUndoStack(s0)
    stack = pushState(stack, s1)
    stack = pushState(stack, s2)

    // Undo twice
    stack = undo(stack)
    stack = undo(stack)
    expect(currentState(stack)).toEqual(s0)

    // Redo twice
    stack = redo(stack)
    expect(currentState(stack)).toEqual(s1)

    stack = redo(stack)
    expect(currentState(stack)).toEqual(s2)
  })
})

describe('canUndo / canRedo', () => {
  it('canUndo is false with only initial state', () => {
    const stack = createUndoStack(makeState())
    expect(canUndo(stack)).toBe(false)
  })

  it('canUndo is true after push', () => {
    let stack = createUndoStack(makeState())
    stack = pushState(stack, makeState(['x']))
    expect(canUndo(stack)).toBe(true)
  })

  it('canRedo is false initially', () => {
    const stack = createUndoStack(makeState())
    expect(canRedo(stack)).toBe(false)
  })

  it('canRedo is true after undo', () => {
    let stack = createUndoStack(makeState())
    stack = pushState(stack, makeState(['x']))
    stack = undo(stack)
    expect(canRedo(stack)).toBe(true)
  })

  it('canRedo is false after push following undo', () => {
    let stack = createUndoStack(makeState())
    stack = pushState(stack, makeState(['x']))
    stack = undo(stack)
    stack = pushState(stack, makeState(['y']))
    expect(canRedo(stack)).toBe(false)
  })
})

describe('shouldPushState (debouncing)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when lastPushTime is 0 (first push)', () => {
    expect(shouldPushState(0)).toBe(true)
  })

  it('returns false when called within debounce window', () => {
    const now = Date.now()
    expect(shouldPushState(now)).toBe(false)
  })

  it('returns true when debounce window has elapsed', () => {
    const pastTime = Date.now() - DEBOUNCE_MS - 1
    expect(shouldPushState(pastTime)).toBe(true)
  })
})

describe('cursor position preservation', () => {
  it('preserves cursor position through undo/redo cycle', () => {
    const s0 = makeState(['hello'], 0, 5)
    const s1 = makeState(['hello', 'world'], 1, 5)
    const s2 = makeState(['hello', 'world', '!'], 2, 1)

    let stack = createUndoStack(s0)
    stack = pushState(stack, s1)
    stack = pushState(stack, s2)

    stack = undo(stack)
    expect(currentState(stack).cursorRow).toBe(1)
    expect(currentState(stack).cursorCol).toBe(5)

    stack = undo(stack)
    expect(currentState(stack).cursorRow).toBe(0)
    expect(currentState(stack).cursorCol).toBe(5)

    stack = redo(stack)
    expect(currentState(stack).cursorRow).toBe(1)
    expect(currentState(stack).cursorCol).toBe(5)
  })
})
