import { describe, it, expect } from 'vitest'
import {
  createMacroRecorder,
  startRecording,
  stopRecording,
  addKeystroke,
  getRecording,
  isRecording,
  getActiveRegister,
  getAllRegisters,
  loadRegisters,
  MAX_KEYSTROKES_PER_MACRO,
  type MacroRecorder,
  type KeyStroke,
} from './macro-recorder'

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

describe('createMacroRecorder', () => {
  it('creates a recorder with empty state', () => {
    const recorder = createMacroRecorder()
    expect(isRecording(recorder)).toBe(false)
    expect(getActiveRegister(recorder)).toBeNull()
    expect(getAllRegisters(recorder)).toEqual({})
  })
})

describe('startRecording', () => {
  it('starts recording to a register', () => {
    const recorder = createMacroRecorder()
    const recording = startRecording(recorder, 'a')
    expect(isRecording(recording)).toBe(true)
    expect(getActiveRegister(recording)).toBe('a')
  })

  it('accepts any single lowercase letter as register', () => {
    const recorder = createMacroRecorder()
    const recording = startRecording(recorder, 'z')
    expect(getActiveRegister(recording)).toBe('z')
  })

  it('returns same recorder if already recording', () => {
    const recorder = createMacroRecorder()
    const recording = startRecording(recorder, 'a')
    const second = startRecording(recording, 'b')
    expect(second).toBe(recording)
    expect(getActiveRegister(second)).toBe('a')
  })

  it('rejects invalid register names', () => {
    const recorder = createMacroRecorder()
    const result = startRecording(recorder, '1')
    expect(result).toBe(recorder)
    expect(isRecording(result)).toBe(false)
  })

  it('rejects uppercase register names', () => {
    const recorder = createMacroRecorder()
    const result = startRecording(recorder, 'A')
    expect(result).toBe(recorder)
    expect(isRecording(result)).toBe(false)
  })

  it('rejects multi-character register names', () => {
    const recorder = createMacroRecorder()
    const result = startRecording(recorder, 'ab')
    expect(result).toBe(recorder)
    expect(isRecording(result)).toBe(false)
  })
})

describe('addKeystroke', () => {
  it('adds a keystroke to the active recording', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)
    const recording = getRecording(recorder, 'a')
    expect(recording).toEqual([makeKeystroke('j')])
  })

  it('returns same recorder if not recording', () => {
    const recorder = createMacroRecorder()
    const result = addKeystroke(recorder, makeKeystroke('j'))
    expect(result).toBe(recorder)
  })

  it('accumulates multiple keystrokes', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = addKeystroke(recorder, makeKeystroke('k'))
    recorder = addKeystroke(recorder, makeKeystroke('l'))
    recorder = stopRecording(recorder)
    const recording = getRecording(recorder, 'a')
    expect(recording).toHaveLength(3)
    expect(recording![0]!.input).toBe('j')
    expect(recording![1]!.input).toBe('k')
    expect(recording![2]!.input).toBe('l')
  })

  it('preserves modifier keys', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('b', { ctrl: true }))
    recorder = stopRecording(recorder)
    const recording = getRecording(recorder, 'a')
    expect(recording![0]!.key.ctrl).toBe(true)
  })
})

describe('stopRecording', () => {
  it('stops recording and saves the macro', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)
    expect(isRecording(recorder)).toBe(false)
    expect(getActiveRegister(recorder)).toBeNull()
    expect(getRecording(recorder, 'a')).toEqual([makeKeystroke('j')])
  })

  it('returns same recorder if not recording', () => {
    const recorder = createMacroRecorder()
    const result = stopRecording(recorder)
    expect(result).toBe(recorder)
  })

  it('overwrites existing register when re-recording', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)

    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('k'))
    recorder = stopRecording(recorder)

    const recording = getRecording(recorder, 'a')
    expect(recording).toEqual([makeKeystroke('k')])
  })

  it('saves empty macro if no keystrokes were recorded', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = stopRecording(recorder)
    const recording = getRecording(recorder, 'a')
    expect(recording).toEqual([])
  })
})

describe('getRecording', () => {
  it('returns undefined for non-existent register', () => {
    const recorder = createMacroRecorder()
    expect(getRecording(recorder, 'b')).toBeUndefined()
  })

  it('returns a copy of the recording (immutable)', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)

    const first = getRecording(recorder, 'a')
    const second = getRecording(recorder, 'a')
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})

describe('getAllRegisters', () => {
  it('returns all saved registers', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)

    recorder = startRecording(recorder, 'b')
    recorder = addKeystroke(recorder, makeKeystroke('k'))
    recorder = stopRecording(recorder)

    const all = getAllRegisters(recorder)
    expect(Object.keys(all)).toEqual(['a', 'b'])
    expect(all['a']).toEqual([makeKeystroke('j')])
    expect(all['b']).toEqual([makeKeystroke('k')])
  })

  it('returns a deep copy (immutable)', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)

    const first = getAllRegisters(recorder)
    const second = getAllRegisters(recorder)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})

describe('loadRegisters', () => {
  it('loads registers from serialized data', () => {
    const data: Record<string, readonly KeyStroke[]> = {
      a: [makeKeystroke('j'), makeKeystroke('k')],
      b: [makeKeystroke('l')],
    }
    const recorder = loadRegisters(createMacroRecorder(), data)
    expect(getRecording(recorder, 'a')).toEqual(data['a'])
    expect(getRecording(recorder, 'b')).toEqual(data['b'])
  })

  it('overwrites existing registers', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    recorder = addKeystroke(recorder, makeKeystroke('j'))
    recorder = stopRecording(recorder)

    const data: Record<string, readonly KeyStroke[]> = {
      a: [makeKeystroke('x')],
    }
    recorder = loadRegisters(recorder, data)
    expect(getRecording(recorder, 'a')).toEqual([makeKeystroke('x')])
  })

  it('does not affect recording state', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'b')
    const data: Record<string, readonly KeyStroke[]> = {
      a: [makeKeystroke('x')],
    }
    recorder = loadRegisters(recorder, data)
    expect(isRecording(recorder)).toBe(true)
    expect(getActiveRegister(recorder)).toBe('b')
  })

  it('filters out invalid register names', () => {
    const data: Record<string, readonly KeyStroke[]> = {
      a: [makeKeystroke('j')],
      '1': [makeKeystroke('k')],
      AB: [makeKeystroke('l')],
    }
    const recorder = loadRegisters(createMacroRecorder(), data)
    expect(getRecording(recorder, 'a')).toEqual([makeKeystroke('j')])
    expect(getRecording(recorder, '1')).toBeUndefined()
    expect(getRecording(recorder, 'AB')).toBeUndefined()
  })
})

describe('keystroke overflow (max 100)', () => {
  it('auto-stops recording at MAX_KEYSTROKES_PER_MACRO', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')

    for (let i = 0; i < MAX_KEYSTROKES_PER_MACRO; i++) {
      recorder = addKeystroke(recorder, makeKeystroke(String(i % 10)))
    }

    // Should auto-stop after reaching limit
    expect(isRecording(recorder)).toBe(false)
    const recording = getRecording(recorder, 'a')
    expect(recording).toHaveLength(MAX_KEYSTROKES_PER_MACRO)
  })

  it('saves all keystrokes up to the limit', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')

    for (let i = 0; i < MAX_KEYSTROKES_PER_MACRO + 5; i++) {
      recorder = addKeystroke(recorder, makeKeystroke('x'))
    }

    const recording = getRecording(recorder, 'a')
    expect(recording).toHaveLength(MAX_KEYSTROKES_PER_MACRO)
  })

  it('exported MAX_KEYSTROKES_PER_MACRO is 100', () => {
    expect(MAX_KEYSTROKES_PER_MACRO).toBe(100)
  })
})

describe('immutability', () => {
  it('startRecording returns a new object', () => {
    const recorder = createMacroRecorder()
    const recording = startRecording(recorder, 'a')
    expect(recording).not.toBe(recorder)
  })

  it('addKeystroke returns a new object', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    const withKey = addKeystroke(recorder, makeKeystroke('j'))
    expect(withKey).not.toBe(recorder)
  })

  it('stopRecording returns a new object', () => {
    let recorder = createMacroRecorder()
    recorder = startRecording(recorder, 'a')
    const stopped = stopRecording(recorder)
    expect(stopped).not.toBe(recorder)
  })

  it('loadRegisters returns a new object', () => {
    const recorder = createMacroRecorder()
    const loaded = loadRegisters(recorder, { a: [makeKeystroke('j')] })
    expect(loaded).not.toBe(recorder)
  })

  it('original recorder is unchanged after operations', () => {
    const original = createMacroRecorder()
    startRecording(original, 'a')
    expect(isRecording(original)).toBe(false)
    expect(getActiveRegister(original)).toBeNull()
  })
})

describe('isValidRegister', () => {
  it('validates register in startRecording', () => {
    const recorder = createMacroRecorder()
    // Valid registers
    for (const reg of ['a', 'b', 'z', 'm']) {
      const result = startRecording(recorder, reg)
      expect(isRecording(result)).toBe(true)
    }

    // Invalid registers
    for (const reg of ['1', 'A', 'ab', '', ' ', '@', '#']) {
      const result = startRecording(recorder, reg)
      expect(result).toBe(recorder)
    }
  })
})
