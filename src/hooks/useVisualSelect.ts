import { useState, useCallback } from 'react'

export interface VisualSelectState {
  readonly visualStart: number | null
}

export interface VisualSelectActions {
  readonly setVisualStart: (value: number | null) => void
  readonly toggleVisual: (currentLine: number) => void
  readonly clearVisual: () => void
}

export function useVisualSelect(): VisualSelectState & VisualSelectActions {
  const [visualStart, setVisualStart] = useState<number | null>(null)

  const toggleVisual = useCallback(
    (currentLine: number) => {
      setVisualStart((prev) => (prev != null ? null : currentLine))
    },
    [],
  )

  const clearVisual = useCallback(() => {
    setVisualStart(null)
  }, [])

  return {
    visualStart,
    setVisualStart,
    toggleVisual,
    clearVisual,
  }
}
