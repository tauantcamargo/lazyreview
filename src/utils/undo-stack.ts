/**
 * Pure undo/redo stack for editor state management.
 * Stores snapshots of lines and cursor position with a configurable max depth.
 * Provides debounce support to batch rapid keystrokes.
 */

/** Maximum number of states stored in the undo stack. */
export const MAX_UNDO_STATES = 50

/** Debounce window in milliseconds for batching rapid edits. */
export const DEBOUNCE_MS = 300

/** Snapshot of editor state at a point in time. */
export interface EditorState {
  readonly lines: readonly string[]
  readonly cursorRow: number
  readonly cursorCol: number
}

/**
 * Immutable undo/redo stack.
 * The `past` array stores previous states (oldest first).
 * The `present` holds the current state.
 * The `future` array stores redo states (most recent undo first).
 */
export interface UndoStack {
  readonly past: readonly EditorState[]
  readonly present: EditorState
  readonly future: readonly EditorState[]
}

/** Create a new undo stack with the given initial state. */
export function createUndoStack(initial: EditorState): UndoStack {
  return {
    past: [],
    present: initial,
    future: [],
  }
}

/** Push a new state onto the stack, clearing redo history. */
export function pushState(stack: UndoStack, state: EditorState): UndoStack {
  const newPast = [...stack.past, stack.present]
  // Trim to max size, keeping the most recent entries
  const trimmedPast =
    newPast.length > MAX_UNDO_STATES - 1
      ? newPast.slice(newPast.length - (MAX_UNDO_STATES - 1))
      : newPast

  return {
    past: trimmedPast,
    present: state,
    future: [],
  }
}

/** Undo the last change, moving the current state to the redo stack. */
export function undo(stack: UndoStack): UndoStack {
  if (stack.past.length === 0) return stack

  const newPast = stack.past.slice(0, -1)
  const previousState = stack.past[stack.past.length - 1]!

  return {
    past: newPast,
    present: previousState,
    future: [stack.present, ...stack.future],
  }
}

/** Redo the last undone change, moving the redo state back to current. */
export function redo(stack: UndoStack): UndoStack {
  if (stack.future.length === 0) return stack

  const nextState = stack.future[0]!
  const newFuture = stack.future.slice(1)

  return {
    past: [...stack.past, stack.present],
    present: nextState,
    future: newFuture,
  }
}

/** Check if undo is available. */
export function canUndo(stack: UndoStack): boolean {
  return stack.past.length > 0
}

/** Check if redo is available. */
export function canRedo(stack: UndoStack): boolean {
  return stack.future.length > 0
}

/** Get the current state from the stack. */
export function currentState(stack: UndoStack): EditorState {
  return stack.present
}

/**
 * Determine whether enough time has elapsed since the last push
 * to warrant a new undo snapshot (debounce check).
 *
 * @param lastPushTime - Timestamp (ms) of the last push, or 0 if never pushed.
 * @returns true if a new state should be pushed.
 */
export function shouldPushState(lastPushTime: number): boolean {
  if (lastPushTime === 0) return true
  return Date.now() - lastPushTime >= DEBOUNCE_MS
}
