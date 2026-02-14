/**
 * Macro recording and replay hook + store for LazyReview.
 *
 * Uses a module-level external store (like useStatusMessage, useTokenExpired)
 * so that macro state is shared across all components and can be tested
 * without rendering React components.
 *
 * The React hook `useMacros` provides a thin wrapper via useSyncExternalStore.
 */

import { useSyncExternalStore, useCallback, useEffect, useRef } from 'react'
import {
  createMacroRecorder,
  startRecording as startRec,
  stopRecording as stopRec,
  addKeystroke as addKs,
  isRecording as isRec,
  getActiveRegister as getActiveReg,
  getAllRegisters,
  getRecording,
  loadRegisters as loadRegs,
  type MacroRecorder,
  type KeyStroke,
} from '../utils/macro-recorder'
import { useConfig } from './useConfig'

export type { KeyStroke }

type Listener = () => void

export interface MacroStoreState {
  readonly isRecording: boolean
  readonly activeRegister: string | null
  readonly registers: Record<string, readonly KeyStroke[]>
  readonly isReplaying: boolean
}

interface MacroStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => MacroStoreState
  readonly startRecording: (register: string) => void
  readonly stopRecording: () => void
  readonly addKeystroke: (keystroke: KeyStroke) => void
  readonly replay: (
    register: string,
    handler: (input: string, key: KeyStroke['key']) => void,
  ) => boolean
  readonly loadRegisters: (data: Record<string, readonly KeyStroke[]>) => void
  readonly reset: () => void
}

function buildSnapshot(recorder: MacroRecorder, replaying: boolean): MacroStoreState {
  return {
    isRecording: isRec(recorder),
    activeRegister: getActiveReg(recorder),
    registers: getAllRegisters(recorder),
    isReplaying: replaying,
  }
}

function createMacroStore(): MacroStore {
  let recorder = createMacroRecorder()
  let replaying = false
  let snapshot = buildSnapshot(recorder, replaying)
  let listeners: readonly Listener[] = []

  const notify = (): void => {
    snapshot = buildSnapshot(recorder, replaying)
    listeners.forEach((l) => l())
  }

  return {
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },

    getSnapshot() {
      return snapshot
    },

    startRecording(register: string) {
      const next = startRec(recorder, register)
      if (next === recorder) return
      recorder = next
      notify()
    },

    stopRecording() {
      const next = stopRec(recorder)
      if (next === recorder) return
      recorder = next
      notify()
    },

    addKeystroke(keystroke: KeyStroke) {
      const next = addKs(recorder, keystroke)
      if (next === recorder) return
      recorder = next
      notify()
    },

    replay(
      register: string,
      handler: (input: string, key: KeyStroke['key']) => void,
    ): boolean {
      if (isRec(recorder)) return false
      const recording = getRecording(recorder, register)
      if (!recording) return false

      replaying = true
      snapshot = buildSnapshot(recorder, replaying)

      for (const ks of recording) {
        handler(ks.input, ks.key)
      }

      replaying = false
      snapshot = buildSnapshot(recorder, replaying)
      return true
    },

    loadRegisters(data: Record<string, readonly KeyStroke[]>) {
      recorder = loadRegs(recorder, data)
      notify()
    },

    reset() {
      recorder = createMacroRecorder()
      replaying = false
      notify()
    },
  }
}

export const macroStore = createMacroStore()

/** Reset the store to initial state (for testing). */
export function resetMacroStore(): void {
  macroStore.reset()
}

/**
 * React hook for macro recording and replay.
 *
 * Loads macros from config on mount and saves when recording stops.
 * Provides recording state and replay functionality.
 */
export function useMacros(): {
  readonly isRecording: boolean
  readonly isReplaying: boolean
  readonly activeRegister: string | null
  readonly registers: Record<string, readonly KeyStroke[]>
  readonly startRecording: (register: string) => void
  readonly stopRecording: () => void
  readonly addKeystroke: (keystroke: KeyStroke) => void
  readonly replay: (
    register: string,
    handler: (input: string, key: KeyStroke['key']) => void,
  ) => boolean
} {
  const { config, updateConfig } = useConfig()
  const configLoadedRef = useRef(false)

  const state = useSyncExternalStore(
    macroStore.subscribe,
    macroStore.getSnapshot,
    () => macroStore.getSnapshot(),
  )

  // Load macros from config on mount
  useEffect(() => {
    if (config && !configLoadedRef.current) {
      configLoadedRef.current = true
      const savedMacros = (config as unknown as Record<string, unknown>)['macros'] as
        | Record<string, readonly KeyStroke[]>
        | undefined
      if (savedMacros && typeof savedMacros === 'object') {
        macroStore.loadRegisters(savedMacros)
      }
    }
  }, [config])

  // Save macros to config when recording stops
  const prevRecordingRef = useRef(state.isRecording)
  useEffect(() => {
    if (prevRecordingRef.current && !state.isRecording) {
      const allRegisters = state.registers
      if (Object.keys(allRegisters).length > 0) {
        updateConfig({ macros: allRegisters } as never)
      }
    }
    prevRecordingRef.current = state.isRecording
  }, [state.isRecording, state.registers, updateConfig])

  const startRecording = useCallback((register: string) => {
    macroStore.startRecording(register)
  }, [])

  const stopRecording = useCallback(() => {
    macroStore.stopRecording()
  }, [])

  const addKeystroke = useCallback((keystroke: KeyStroke) => {
    macroStore.addKeystroke(keystroke)
  }, [])

  const replay = useCallback(
    (
      register: string,
      handler: (input: string, key: KeyStroke['key']) => void,
    ): boolean => {
      return macroStore.replay(register, handler)
    },
    [],
  )

  return {
    isRecording: state.isRecording,
    isReplaying: state.isReplaying,
    activeRegister: state.activeRegister,
    registers: state.registers,
    startRecording,
    stopRecording,
    addKeystroke,
    replay,
  }
}
