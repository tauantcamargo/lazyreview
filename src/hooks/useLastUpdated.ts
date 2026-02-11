import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

type Listener = () => void

interface LastUpdatedStore {
  readonly subscribe: (listener: Listener) => () => void
  readonly getSnapshot: () => number | null
  readonly touch: () => void
}

function createLastUpdatedStore(): LastUpdatedStore {
  let updatedAt: number | null = null
  let listeners: readonly Listener[] = []

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
    getSnapshot() {
      return updatedAt
    },
    touch() {
      updatedAt = Date.now()
      notify()
    },
  }
}

const store = createLastUpdatedStore()

export function touchLastUpdated(): void {
  store.touch()
}

export function useLastUpdated(): {
  readonly label: string
  readonly touch: () => void
} {
  const updatedAt = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => null,
  )

  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const touch = useCallback(() => {
    store.touch()
  }, [])

  const label = formatElapsed(updatedAt, now)

  return { label, touch } as const
}

function formatElapsed(updatedAt: number | null, now: number): string {
  if (updatedAt === null) return ''

  const seconds = Math.floor((now - updatedAt) / 1000)

  if (seconds < 5) return 'Updated just now'
  if (seconds < 60) return `Updated ${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  return `Updated ${hours}h ago`
}
