import { describe, it, expect, beforeEach } from 'vitest'
import {
  setSelectionContext,
  getSelectionSnapshot,
  clearSelectionContext,
  subscribe,
} from './useSelectionContext'
import type { SelectionContext } from './useContextualHints'

describe('useSelectionContext store', () => {
  beforeEach(() => {
    clearSelectionContext()
  })

  it('returns undefined when no context has been set', () => {
    expect(getSelectionSnapshot()).toBeUndefined()
  })

  it('returns the current selection context after setSelectionContext', () => {
    const context: SelectionContext = {
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    }

    setSelectionContext(context)
    expect(getSelectionSnapshot()).toEqual(context)
  })

  it('updates when selection context changes', () => {
    setSelectionContext({
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    })
    expect(getSelectionSnapshot()?.type).toBe('pr-list-item')

    setSelectionContext({
      type: 'timeline-item',
      itemType: 'comment',
      hasThread: true,
      isResolved: false,
      isOwnComment: true,
      hasPath: true,
    })
    expect(getSelectionSnapshot()?.type).toBe('timeline-item')
  })

  it('returns undefined after clearSelectionContext', () => {
    setSelectionContext({
      type: 'diff-row',
      isCommentRow: true,
      hasThread: true,
      isOwnComment: false,
    })
    expect(getSelectionSnapshot()).toBeDefined()

    clearSelectionContext()
    expect(getSelectionSnapshot()).toBeUndefined()
  })

  it('does not notify listeners when set to the same reference', () => {
    const context: SelectionContext = {
      type: 'pr-detail',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    }

    let notifyCount = 0
    const unsub = subscribe(() => {
      notifyCount++
    })

    setSelectionContext(context)
    expect(notifyCount).toBe(1)

    setSelectionContext(context) // same reference
    expect(notifyCount).toBe(1) // no extra notification

    unsub()
  })

  it('notifies listeners when context changes', () => {
    let notifyCount = 0
    const unsub = subscribe(() => {
      notifyCount++
    })

    setSelectionContext({
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    })
    expect(notifyCount).toBe(1)

    setSelectionContext({
      type: 'pr-list-item',
      prState: 'closed',
      prMerged: true,
      prDraft: false,
    })
    expect(notifyCount).toBe(2)

    unsub()
  })

  it('supports multiple listeners', () => {
    const calls: string[] = []

    const unsub1 = subscribe(() => calls.push('listener1'))
    const unsub2 = subscribe(() => calls.push('listener2'))

    setSelectionContext({
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    })

    expect(calls).toEqual(['listener1', 'listener2'])

    unsub1()
    unsub2()
  })

  it('unsubscribe removes specific listener', () => {
    const calls: string[] = []

    const unsub1 = subscribe(() => calls.push('listener1'))
    const unsub2 = subscribe(() => calls.push('listener2'))

    unsub1() // unsubscribe listener1

    setSelectionContext({
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    })

    expect(calls).toEqual(['listener2'])

    unsub2()
  })
})
