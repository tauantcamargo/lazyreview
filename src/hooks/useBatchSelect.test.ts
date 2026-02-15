import { describe, it, expect } from 'vitest'
import { createBatchSelectStore, type BatchSelectStore } from './useBatchSelect'

describe('createBatchSelectStore', () => {
  function makeStore(): BatchSelectStore {
    return createBatchSelectStore()
  }

  it('starts in non-multi-select mode with no selections', () => {
    const store = makeStore()
    const snap = store.getSnapshot()
    expect(snap.isMultiSelect).toBe(false)
    expect(snap.selectedIndices).toEqual([])
  })

  it('enterMultiSelect activates multi-select mode', () => {
    const store = makeStore()
    store.enterMultiSelect()
    expect(store.getSnapshot().isMultiSelect).toBe(true)
  })

  it('exitMultiSelect deactivates multi-select mode and clears selections', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(0)
    store.toggle(2)
    store.exitMultiSelect()

    const snap = store.getSnapshot()
    expect(snap.isMultiSelect).toBe(false)
    expect(snap.selectedIndices).toEqual([])
  })

  it('toggle adds an index to selections', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(3)

    expect(store.getSnapshot().selectedIndices).toEqual([3])
  })

  it('toggle removes an already-selected index', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(3)
    store.toggle(3)

    expect(store.getSnapshot().selectedIndices).toEqual([])
  })

  it('toggle preserves order of selection', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(5)
    store.toggle(1)
    store.toggle(3)

    expect(store.getSnapshot().selectedIndices).toEqual([5, 1, 3])
  })

  it('selectAll sets selectedIndices to all indices in range', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.selectAll(5)

    expect(store.getSnapshot().selectedIndices).toEqual([0, 1, 2, 3, 4])
  })

  it('selectAll with 0 items produces empty selection', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.selectAll(0)

    expect(store.getSnapshot().selectedIndices).toEqual([])
  })

  it('clearAll removes all selections but stays in multi-select mode', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(0)
    store.toggle(1)
    store.clearAll()

    const snap = store.getSnapshot()
    expect(snap.isMultiSelect).toBe(true)
    expect(snap.selectedIndices).toEqual([])
  })

  it('notifies subscribers on enterMultiSelect', () => {
    const store = makeStore()
    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.enterMultiSelect()
    expect(callCount).toBe(1)
  })

  it('notifies subscribers on toggle', () => {
    const store = makeStore()
    store.enterMultiSelect()

    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.toggle(0)
    expect(callCount).toBe(1)
  })

  it('notifies subscribers on exitMultiSelect', () => {
    const store = makeStore()
    store.enterMultiSelect()

    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.exitMultiSelect()
    expect(callCount).toBe(1)
  })

  it('notifies subscribers on selectAll', () => {
    const store = makeStore()
    store.enterMultiSelect()

    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.selectAll(3)
    expect(callCount).toBe(1)
  })

  it('notifies subscribers on clearAll', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(0)

    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.clearAll()
    expect(callCount).toBe(1)
  })

  it('unsubscribe prevents further notifications', () => {
    const store = makeStore()
    let callCount = 0
    const unsub = store.subscribe(() => {
      callCount += 1
    })

    unsub()
    store.enterMultiSelect()
    expect(callCount).toBe(0)
  })

  it('toggle is a no-op when not in multi-select mode', () => {
    const store = makeStore()
    store.toggle(0)

    expect(store.getSnapshot().selectedIndices).toEqual([])
    expect(store.getSnapshot().isMultiSelect).toBe(false)
  })

  it('selectAll is a no-op when not in multi-select mode', () => {
    const store = makeStore()
    store.selectAll(5)

    expect(store.getSnapshot().selectedIndices).toEqual([])
    expect(store.getSnapshot().isMultiSelect).toBe(false)
  })

  it('clearAll is a no-op when not in multi-select mode', () => {
    const store = makeStore()
    store.clearAll()

    expect(store.getSnapshot().selectedIndices).toEqual([])
    expect(store.getSnapshot().isMultiSelect).toBe(false)
  })

  it('enterMultiSelect is idempotent', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(2)
    store.enterMultiSelect() // second call should not clear selections

    const snap = store.getSnapshot()
    expect(snap.isMultiSelect).toBe(true)
    expect(snap.selectedIndices).toEqual([2])
  })

  it('exitMultiSelect is idempotent', () => {
    const store = makeStore()
    let callCount = 0
    store.subscribe(() => {
      callCount += 1
    })

    store.exitMultiSelect() // already not in multi-select
    expect(callCount).toBe(0)
    expect(store.getSnapshot().isMultiSelect).toBe(false)
  })

  it('getSnapshot returns a stable reference when state has not changed', () => {
    const store = makeStore()
    const snap1 = store.getSnapshot()
    const snap2 = store.getSnapshot()
    expect(snap1).toBe(snap2)
  })

  it('toggle does not duplicate indices', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(2)
    store.toggle(2)
    store.toggle(2)

    expect(store.getSnapshot().selectedIndices).toEqual([2])
  })

  it('selectAll replaces any existing selections', () => {
    const store = makeStore()
    store.enterMultiSelect()
    store.toggle(0)
    store.toggle(1)
    store.selectAll(4)

    expect(store.getSnapshot().selectedIndices).toEqual([0, 1, 2, 3])
  })
})
