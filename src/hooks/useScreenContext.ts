import { useSyncExternalStore } from 'react'
import type { ScreenContext } from '../components/layout/StatusBar'

type Listener = () => void

let current: ScreenContext | undefined = undefined
let listeners: readonly Listener[] = []

function notify(): void {
  listeners.forEach((l) => l())
}

function subscribe(listener: Listener): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): ScreenContext | undefined {
  return current
}

export function setScreenContext(context: ScreenContext | undefined): void {
  if (current !== context) {
    current = context
    notify()
  }
}

export function useScreenContext(): ScreenContext | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}
