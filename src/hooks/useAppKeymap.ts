import { useKeymap } from 'tuir'
import type { KeyMap } from 'tuir'

interface AppKeymapActions {
  readonly toggleSidebar: () => void
  readonly toggleHelp: () => void
  readonly quit: () => void
  readonly switchFocus: () => void
}

const appKeymap = {
  toggleSidebar: { input: 'b' },
  toggleHelp: { input: '?' },
  quit: { input: 'q' },
  switchFocus: { key: 'tab' },
} satisfies KeyMap

export function useAppKeymap(actions: AppKeymapActions): void {
  const { useEvent: useKeymapEvent } = useKeymap(appKeymap)

  useKeymapEvent('toggleSidebar', actions.toggleSidebar)
  useKeymapEvent('toggleHelp', actions.toggleHelp)
  useKeymapEvent('quit', actions.quit)
  useKeymapEvent('switchFocus', actions.switchFocus)
}
