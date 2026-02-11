import { useCallback, useSyncExternalStore } from 'react'

type Listener = () => void

interface StatusMessageStore {
  readonly message: string | null
  readonly subscribe: (listener: Listener) => () => void
  readonly setMessage: (msg: string, durationMs?: number) => void
  readonly getSnapshot: () => string | null
}

function createStatusMessageStore(): StatusMessageStore {
  let message: string | null = null
  let listeners: readonly Listener[] = []
  let timerId: ReturnType<typeof setTimeout> | null = null

  const notify = (): void => {
    listeners.forEach((l) => l())
  }

  return {
    get message() {
      return message
    },
    subscribe(listener: Listener) {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((l) => l !== listener)
      }
    },
    setMessage(msg: string, durationMs = 2000) {
      if (timerId !== null) {
        clearTimeout(timerId)
      }
      message = msg
      notify()
      timerId = setTimeout(() => {
        message = null
        timerId = null
        notify()
      }, durationMs)
    },
    getSnapshot() {
      return message
    },
  }
}

const store = createStatusMessageStore()

export function useStatusMessage(): {
  readonly message: string | null
  readonly setStatusMessage: (msg: string, durationMs?: number) => void
} {
  const message = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => null,
  )

  const setStatusMessage = useCallback(
    (msg: string, durationMs?: number) => {
      store.setMessage(msg, durationMs)
    },
    [],
  )

  return { message, setStatusMessage } as const
}
