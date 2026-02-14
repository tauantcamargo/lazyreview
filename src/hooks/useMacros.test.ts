import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  macroStore,
  resetMacroStore,
  type MacroStoreState,
} from './useMacros'
import type { KeyStroke } from '../utils/macro-recorder'

function makeKeystroke(input: string, key: Partial<KeyStroke['key']> = {}): KeyStroke {
  return {
    input,
    key: {
      ctrl: key.ctrl ?? false,
      shift: key.shift ?? false,
      meta: key.meta ?? false,
      escape: key.escape ?? false,
      return: key.return ?? false,
    },
  }
}

beforeEach(() => {
  resetMacroStore()
})

describe('macroStore initial state', () => {
  it('starts with recording false and no active register', () => {
    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(false)
    expect(state.activeRegister).toBeNull()
    expect(state.registers).toEqual({})
  })
})

describe('macroStore.startRecording', () => {
  it('sets recording state', () => {
    macroStore.startRecording('a')
    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(true)
    expect(state.activeRegister).toBe('a')
  })

  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    macroStore.startRecording('a')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('does not start if already recording', () => {
    macroStore.startRecording('a')
    macroStore.startRecording('b')
    const state = macroStore.getSnapshot()
    expect(state.activeRegister).toBe('a')
  })

  it('rejects invalid register names', () => {
    macroStore.startRecording('1')
    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(false)
  })
})

describe('macroStore.addKeystroke', () => {
  it('captures keystrokes during recording', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.stopRecording()
    const state = macroStore.getSnapshot()
    expect(state.registers['a']).toEqual([makeKeystroke('j')])
  })

  it('does nothing when not recording', () => {
    const before = macroStore.getSnapshot()
    macroStore.addKeystroke(makeKeystroke('j'))
    const after = macroStore.getSnapshot()
    expect(before).toBe(after)
  })

  it('notifies subscribers', () => {
    macroStore.startRecording('a')
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    macroStore.addKeystroke(makeKeystroke('j'))
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })
})

describe('macroStore.stopRecording', () => {
  it('stops recording and saves macro', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.addKeystroke(makeKeystroke('k'))
    macroStore.stopRecording()

    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(false)
    expect(state.activeRegister).toBeNull()
    expect(state.registers['a']).toEqual([makeKeystroke('j'), makeKeystroke('k')])
  })

  it('notifies subscribers', () => {
    macroStore.startRecording('a')
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    macroStore.stopRecording()
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('does nothing if not recording', () => {
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    macroStore.stopRecording()
    expect(listener).not.toHaveBeenCalled()
    unsub()
  })
})

describe('macroStore.replay', () => {
  it('replays keystrokes via callback', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.addKeystroke(makeKeystroke('k'))
    macroStore.addKeystroke(makeKeystroke('l'))
    macroStore.stopRecording()

    const handler = vi.fn()
    const result = macroStore.replay('a', handler)
    expect(result).toBe(true)
    expect(handler).toHaveBeenCalledTimes(3)
    expect(handler).toHaveBeenNthCalledWith(1, 'j', {
      ctrl: false,
      shift: false,
      meta: false,
      escape: false,
      return: false,
    })
    expect(handler).toHaveBeenNthCalledWith(2, 'k', {
      ctrl: false,
      shift: false,
      meta: false,
      escape: false,
      return: false,
    })
    expect(handler).toHaveBeenNthCalledWith(3, 'l', {
      ctrl: false,
      shift: false,
      meta: false,
      escape: false,
      return: false,
    })
  })

  it('returns false for empty register', () => {
    const handler = vi.fn()
    const result = macroStore.replay('x', handler)
    expect(result).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not replay during recording', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.stopRecording()

    macroStore.startRecording('b')
    const handler = vi.fn()
    const result = macroStore.replay('a', handler)
    expect(result).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('sets replaying flag to prevent nested recording', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.stopRecording()

    const handler = vi.fn((_input: string, _key: KeyStroke['key']) => {
      const state = macroStore.getSnapshot()
      expect(state.isReplaying).toBe(true)
    })

    macroStore.replay('a', handler)
    const afterReplay = macroStore.getSnapshot()
    expect(afterReplay.isReplaying).toBe(false)
  })

  it('replays macro with modifier keys', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('b', { ctrl: true }))
    macroStore.stopRecording()

    const handler = vi.fn()
    macroStore.replay('a', handler)
    expect(handler).toHaveBeenCalledWith('b', expect.objectContaining({ ctrl: true }))
  })
})

describe('macroStore.loadRegisters', () => {
  it('loads registers from persisted data', () => {
    macroStore.loadRegisters({
      a: [makeKeystroke('j')],
      b: [makeKeystroke('k'), makeKeystroke('l')],
    })

    const state = macroStore.getSnapshot()
    expect(state.registers['a']).toEqual([makeKeystroke('j')])
    expect(state.registers['b']).toEqual([makeKeystroke('k'), makeKeystroke('l')])
  })

  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    macroStore.loadRegisters({ a: [makeKeystroke('j')] })
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
  })
})

describe('macroStore.subscribe', () => {
  it('unsubscribes correctly', () => {
    const listener = vi.fn()
    const unsub = macroStore.subscribe(listener)
    unsub()
    macroStore.startRecording('a')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', () => {
    const listener1 = vi.fn()
    const listener2 = vi.fn()
    const unsub1 = macroStore.subscribe(listener1)
    const unsub2 = macroStore.subscribe(listener2)
    macroStore.startRecording('a')
    expect(listener1).toHaveBeenCalledTimes(1)
    expect(listener2).toHaveBeenCalledTimes(1)
    unsub1()
    unsub2()
  })
})

describe('resetMacroStore', () => {
  it('resets all state', () => {
    macroStore.startRecording('a')
    macroStore.addKeystroke(makeKeystroke('j'))
    macroStore.stopRecording()
    resetMacroStore()

    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(false)
    expect(state.activeRegister).toBeNull()
    expect(state.registers).toEqual({})
  })
})

describe('overflow handling in store', () => {
  it('auto-stops recording at keystroke limit', () => {
    macroStore.startRecording('a')
    for (let i = 0; i < 100; i++) {
      macroStore.addKeystroke(makeKeystroke('x'))
    }
    const state = macroStore.getSnapshot()
    expect(state.isRecording).toBe(false)
    expect(Object.keys(state.registers['a'] ?? [])).toHaveLength(100)
  })
})
