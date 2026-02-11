import { useInput } from 'ink'

interface AppKeymapActions {
  readonly toggleSidebar: () => void
  readonly toggleHelp: () => void
  readonly quit: () => void
  readonly switchFocus: () => void
}

export function useAppKeymap(actions: AppKeymapActions): void {
  useInput((input, key) => {
    if (input === 'b') {
      actions.toggleSidebar()
    } else if (input === '?') {
      actions.toggleHelp()
    } else if (input === 'q') {
      actions.quit()
    } else if (key.tab) {
      actions.switchFocus()
    }
  })
}
