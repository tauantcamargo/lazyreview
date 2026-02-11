import React from 'react'
import { Box, Text, Modal } from 'tuir'
import type { ModalData } from 'tuir'
import { useTheme } from '../../theme/index'

interface HelpModalProps {
  readonly modal: ModalData
}

const shortcuts = [
  { key: 'j / Down', description: 'Move down' },
  { key: 'k / Up', description: 'Move up' },
  { key: 'Enter', description: 'Select / Open' },
  { key: 'Tab', description: 'Switch focus panel' },
  { key: 'b', description: 'Toggle sidebar' },
  { key: '1 / 2 / 3', description: 'Switch PR detail tabs' },
  { key: 'q', description: 'Back / Quit' },
  { key: '?', description: 'Toggle this help' },
  { key: 'Ctrl+c', description: 'Force quit' },
]

export function HelpModal({ modal }: HelpModalProps): React.ReactElement {
  const theme = useTheme()

  return (
    <Modal
      modal={modal}
      justifySelf="center"
      alignSelf="center"
      borderStyle="round"
      borderColor={theme.colors.accent}
      paddingX={2}
      paddingY={1}
    >
      <Box flexDirection="column" gap={1}>
        <Text color={theme.colors.accent} bold>
          Keyboard Shortcuts
        </Text>
        <Box flexDirection="column">
          {shortcuts.map((s) => (
            <Box key={s.key} gap={2}>
              <Box width={16}>
                <Text color={theme.colors.warning}>{s.key}</Text>
              </Box>
              <Text color={theme.colors.text}>{s.description}</Text>
            </Box>
          ))}
        </Box>
        <Text color={theme.colors.muted} dimColor>
          Press ? to close
        </Text>
      </Box>
    </Modal>
  )
}
