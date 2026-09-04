import { useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

type Listener = () => void

let current: ReactNode = null
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

function getSnapshot(): ReactNode {
  return current
}

export function setModalOverlay(node: ReactNode): void {
  if (current !== node) {
    current = node
    notify()
  }
}

/**
 * Registers `node` as the app's full-screen modal overlay while the calling
 * component is mounted with a non-null node.
 *
 * Ink computes a `position="absolute"` Box's screen coordinates relative to
 * its immediate parent's offset, not the terminal origin -- there is no true
 * portal. A full-screen Modal rendered deep inside MainPanel (e.g. from
 * PRListScreen) ends up shifted by the Sidebar/TopBar offset instead of
 * covering the terminal, which is what made the filter/sort modals render
 * garbled. This hook "portals" the modal content up to be rendered once at
 * the app root (see AppContent), where the accumulated offset is (0, 0).
 */
export function useModalOverlay(node: ReactNode): void {
  useEffect(() => {
    setModalOverlay(node)
    return () => setModalOverlay(null)
  }, [node])
}

export function useModalOverlayOutlet(): ReactNode {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
