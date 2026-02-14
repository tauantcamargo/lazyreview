/**
 * Pure state machine for recording and replaying keyboard macros.
 * Supports vim-style register-based recording (a-z).
 * All operations are immutable -- each function returns a new MacroRecorder.
 */

/** Maximum number of keystrokes per macro recording. */
export const MAX_KEYSTROKES_PER_MACRO = 100

/** A single keystroke captured during recording. */
export interface KeyStroke {
  readonly input: string
  readonly key: {
    readonly ctrl?: boolean
    readonly shift?: boolean
    readonly meta?: boolean
    readonly escape?: boolean
    readonly return?: boolean
  }
}

/** Internal state for the macro recorder. */
export interface MacroRecorder {
  readonly registers: Readonly<Record<string, readonly KeyStroke[]>>
  readonly activeRegister: string | null
  readonly pendingKeystrokes: readonly KeyStroke[]
}

/** Validate that a register name is a single lowercase letter a-z. */
function isValidRegister(register: string): boolean {
  return register.length === 1 && register >= 'a' && register <= 'z'
}

/** Create a new empty macro recorder. */
export function createMacroRecorder(): MacroRecorder {
  return {
    registers: {},
    activeRegister: null,
    pendingKeystrokes: [],
  }
}

/**
 * Start recording keystrokes to a register.
 * Returns the same recorder if already recording or register is invalid.
 */
export function startRecording(
  recorder: MacroRecorder,
  register: string,
): MacroRecorder {
  if (recorder.activeRegister !== null) return recorder
  if (!isValidRegister(register)) return recorder

  return {
    ...recorder,
    activeRegister: register,
    pendingKeystrokes: [],
  }
}

/**
 * Stop recording and save the pending keystrokes to the active register.
 * Returns the same recorder if not currently recording.
 */
export function stopRecording(recorder: MacroRecorder): MacroRecorder {
  if (recorder.activeRegister === null) return recorder

  return {
    ...recorder,
    registers: {
      ...recorder.registers,
      [recorder.activeRegister]: [...recorder.pendingKeystrokes],
    },
    activeRegister: null,
    pendingKeystrokes: [],
  }
}

/**
 * Add a keystroke to the active recording.
 * Returns the same recorder if not currently recording.
 * Auto-stops recording when MAX_KEYSTROKES_PER_MACRO is reached.
 */
export function addKeystroke(
  recorder: MacroRecorder,
  keystroke: KeyStroke,
): MacroRecorder {
  if (recorder.activeRegister === null) return recorder

  const newKeystrokes = [...recorder.pendingKeystrokes, keystroke]

  if (newKeystrokes.length >= MAX_KEYSTROKES_PER_MACRO) {
    return {
      ...recorder,
      registers: {
        ...recorder.registers,
        [recorder.activeRegister]: newKeystrokes,
      },
      activeRegister: null,
      pendingKeystrokes: [],
    }
  }

  return {
    ...recorder,
    pendingKeystrokes: newKeystrokes,
  }
}

/** Check if the recorder is currently recording. */
export function isRecording(recorder: MacroRecorder): boolean {
  return recorder.activeRegister !== null
}

/** Get the name of the currently active register, or null. */
export function getActiveRegister(recorder: MacroRecorder): string | null {
  return recorder.activeRegister
}

/**
 * Get a copy of the recording for a given register.
 * Returns undefined if the register has no recording.
 */
export function getRecording(
  recorder: MacroRecorder,
  register: string,
): readonly KeyStroke[] | undefined {
  const recording = recorder.registers[register]
  if (!recording) return undefined
  return [...recording]
}

/**
 * Get a deep copy of all register recordings.
 * Returns a new object with copies of each register's keystrokes.
 */
export function getAllRegisters(
  recorder: MacroRecorder,
): Record<string, readonly KeyStroke[]> {
  const result: Record<string, readonly KeyStroke[]> = {}
  for (const [key, value] of Object.entries(recorder.registers)) {
    result[key] = [...value]
  }
  return result
}

/**
 * Load registers from serialized data (e.g. from config persistence).
 * Only valid register names (a-z) are loaded.
 * Does not affect current recording state.
 */
export function loadRegisters(
  recorder: MacroRecorder,
  data: Record<string, readonly KeyStroke[]>,
): MacroRecorder {
  const validRegisters: Record<string, readonly KeyStroke[]> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isValidRegister(key)) {
      validRegisters[key] = [...value]
    }
  }

  return {
    ...recorder,
    registers: { ...recorder.registers, ...validRegisters },
  }
}
