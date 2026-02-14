import { useCallback, useSyncExternalStore } from 'react'

export type StatusMessageType = 'success' | 'error' | 'info'

type Listener = () => void

interface StatusState {
  readonly message: string | null
  readonly type: StatusMessageType
}

interface StatusMessageStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly setMessage: (msg: string, durationMs?: number, type?: StatusMessageType) => void
  readonly getSnapshot: () => StatusState
}

const EMPTY_STATE: StatusState = { message: null, type: 'info' }

function createStatusMessageStore(): StatusMessageStore {
  let state: StatusState = EMPTY_STATE
  let listeners: readonly Listener[] = []
  let timerId: ReturnType<typeof setTimeout> | null = null

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  return {
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
    setMessage(msg: string, durationMs = 2000, type: StatusMessageType = 'info') {
      if (timerId !== null) {
        clearTimeout(timerId)
      }
      state = { message: msg, type }
      notify()
      timerId = setTimeout(() => {
        state = EMPTY_STATE
        timerId = null
        notify()
      }, durationMs)
    },
    getSnapshot() {
      return state
    },
  }
}

const store = createStatusMessageStore()

export function useStatusMessage(): {
  readonly message: string | null
  readonly messageType: StatusMessageType
  readonly setStatusMessage: (msg: string, durationMsOrType?: number | StatusMessageType, type?: StatusMessageType) => void
} {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY_STATE,
  )

  const setStatusMessage = useCallback(
    (msg: string, durationMsOrType?: number | StatusMessageType, type?: StatusMessageType) => {
      // Support both call signatures:
      // setStatusMessage('msg', 2000, 'success')
      // setStatusMessage('msg', 'success')
      if (typeof durationMsOrType === 'string') {
        store.setMessage(msg, undefined, durationMsOrType)
      } else {
        store.setMessage(msg, durationMsOrType, type)
      }
    },
    [],
  )

  return { message: state.message, messageType: state.type, setStatusMessage } as const
}
