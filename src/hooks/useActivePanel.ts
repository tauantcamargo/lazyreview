import { useInput } from 'ink'
import { useCallback, useEffect, useState } from 'react'

export type Panel = 'sidebar' | 'list' | 'detail'

interface UseActivePanelOptions {
  readonly hasSelection: boolean
  readonly isInputActive?: boolean
}

interface UseActivePanelResult {
  readonly activePanel: Panel
  readonly setActivePanel: (panel: Panel) => void
}

export function useActivePanel({
  hasSelection,
  isInputActive = false,
}: UseActivePanelOptions): UseActivePanelResult {
  const [activePanel, setActivePanel] = useState<Panel>('sidebar')

  // Reset to list when selection is lost
  useEffect(() => {
    if (!hasSelection && activePanel === 'detail') {
      setActivePanel('list')
    }
  }, [hasSelection, activePanel])

  const handleEscape = useCallback(() => {
    if (activePanel === 'detail') {
      setActivePanel('list')
    } else if (activePanel === 'list') {
      setActivePanel('sidebar')
    }
  }, [activePanel])

  const handleTab = useCallback(() => {
    if (activePanel === 'sidebar') {
      setActivePanel('list')
    } else if (activePanel === 'list' && hasSelection) {
      setActivePanel('detail')
    } else if (activePanel === 'detail') {
      setActivePanel('sidebar')
    }
  }, [activePanel, hasSelection])

  useInput(
    (_input, key) => {
      if (key.escape) {
        handleEscape()
      } else if (key.tab) {
        handleTab()
      }
    },
    { isActive: !isInputActive },
  )

  return { activePanel, setActivePanel }
}
