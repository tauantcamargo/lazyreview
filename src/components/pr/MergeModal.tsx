import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import type { MergeMethod } from '../../hooks/useGitHub'
import type { PullRequest } from '../../models/pull-request'

interface MergeModalProps {
  readonly pr: PullRequest
  readonly onSubmit: (mergeMethod: MergeMethod, commitTitle?: string) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
}

const MERGE_METHODS: readonly {
  readonly method: MergeMethod
  readonly label: string
  readonly description: string
}[] = [
  { method: 'merge', label: 'Merge Commit', description: 'All commits preserved' },
  { method: 'squash', label: 'Squash and Merge', description: 'Combine into one commit' },
  { method: 'rebase', label: 'Rebase and Merge', description: 'Linear history, no merge commit' },
]

type Step = 'select_method' | 'edit_title' | 'confirm'

function getMergeabilityMessage(pr: PullRequest): string | null {
  if (pr.draft) {
    return 'This PR is a draft and cannot be merged'
  }
  if (pr.state !== 'open') {
    return 'This PR is not open'
  }
  if (pr.merged) {
    return 'This PR is already merged'
  }
  if (pr.mergeable === false) {
    return 'This PR has merge conflicts that must be resolved first'
  }
  if (pr.mergeable_state === 'blocked') {
    return 'This PR is blocked (failing checks or missing required reviews)'
  }
  return null
}

export function MergeModal({
  pr,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: MergeModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [step, setStep] = useState<Step>('select_method')
  const [selectedMethod, setSelectedMethod] = useState(0)
  const [commitTitle, setCommitTitle] = useState(`${pr.title} (#${pr.number})`)

  const mergeBlockReason = getMergeabilityMessage(pr)
  const canMerge = mergeBlockReason === null

  useEffect(() => {
    if (step === 'edit_title') {
      setInputActive(true)
    }
    return () => setInputActive(false)
  }, [step, setInputActive])

  useInput(
    (input, key) => {
      if (isSubmitting) return

      if (step === 'select_method') {
        if (key.escape) {
          onClose()
        } else if (input === 'j' || key.downArrow) {
          setSelectedMethod((prev) => Math.min(prev + 1, MERGE_METHODS.length - 1))
        } else if (input === 'k' || key.upArrow) {
          setSelectedMethod((prev) => Math.max(prev - 1, 0))
        } else if (key.return && canMerge) {
          const method = MERGE_METHODS[selectedMethod]!.method
          if (method === 'squash') {
            setStep('edit_title')
          } else {
            setStep('confirm')
          }
        }
      } else if (step === 'edit_title') {
        if (key.escape) {
          setStep('select_method')
          setInputActive(false)
        } else if (key.return) {
          setStep('confirm')
          setInputActive(false)
        }
      } else if (step === 'confirm') {
        if (key.escape) {
          const method = MERGE_METHODS[selectedMethod]!.method
          setStep(method === 'squash' ? 'edit_title' : 'select_method')
        } else if (input === 'y' || input === 'Y') {
          const method = MERGE_METHODS[selectedMethod]!.method
          const title = method === 'squash' ? commitTitle.trim() : undefined
          onSubmit(method, title)
        }
      }
    },
    { isActive: true },
  )

  if (step === 'confirm') {
    const method = MERGE_METHODS[selectedMethod]!

    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.warning}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={60}
        >
          <Text color={theme.colors.warning} bold>
            Confirm Merge
          </Text>

          <Box flexDirection="column" gap={0}>
            <Box gap={1}>
              <Text color={theme.colors.muted}>PR:</Text>
              <Text color={theme.colors.text}>#{pr.number} {pr.title}</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.colors.muted}>Method:</Text>
              <Text color={theme.colors.accent}>{method.label}</Text>
            </Box>
            {method.method === 'squash' && (
              <Box gap={1}>
                <Text color={theme.colors.muted}>Title:</Text>
                <Text color={theme.colors.text}>{commitTitle}</Text>
              </Box>
            )}
            <Box gap={1}>
              <Text color={theme.colors.muted}>Into:</Text>
              <Text color={theme.colors.text}>{pr.base.ref}</Text>
            </Box>
          </Box>

          <Text color={theme.colors.error} bold>
            This action cannot be undone.
          </Text>

          {isSubmitting && (
            <Text color={theme.colors.info}>Merging...</Text>
          )}

          {error && (
            <Text color={theme.colors.error}>{error}</Text>
          )}

          <Text color={theme.colors.muted} dimColor>
            y: confirm merge | Esc: back
          </Text>
        </Box>
      </Modal>
    )
  }

  if (step === 'edit_title') {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={60}
        >
          <Text color={theme.colors.accent} bold>
            Squash Commit Title
          </Text>

          <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
            <TextInput
              defaultValue={commitTitle}
              onChange={setCommitTitle}
              placeholder="Commit title..."
            />
          </Box>

          <Text color={theme.colors.muted} dimColor>
            Enter: continue | Esc: back
          </Text>
        </Box>
      </Modal>
    )
  }

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={55}
      >
        <Text color={theme.colors.accent} bold>
          Merge Pull Request #{pr.number}
        </Text>

        {!canMerge && (
          <Box borderStyle="single" borderColor={theme.colors.error} paddingX={1}>
            <Text color={theme.colors.error}>{mergeBlockReason}</Text>
          </Box>
        )}

        {pr.mergeable === null && (
          <Text color={theme.colors.warning}>
            Mergeability is being checked...
          </Text>
        )}

        <Text color={theme.colors.muted}>
          {canMerge ? 'Select merge method:' : 'Merge is not available:'}
        </Text>

        <Box flexDirection="column">
          {MERGE_METHODS.map((m, index) => (
            <Box key={m.method} gap={1}>
              <Text color={index === selectedMethod ? theme.colors.accent : theme.colors.muted}>
                {index === selectedMethod ? '>' : ' '}
              </Text>
              <Text
                bold={index === selectedMethod}
                inverse={index === selectedMethod && canMerge}
                color={canMerge
                  ? (index === selectedMethod ? theme.colors.accent : theme.colors.text)
                  : theme.colors.muted}
                dimColor={!canMerge}
              >
                {m.label}
              </Text>
              <Text color={theme.colors.muted} dimColor>
                - {m.description}
              </Text>
            </Box>
          ))}
        </Box>

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          {canMerge ? 'j/k: navigate | Enter: select | Esc: cancel' : 'Esc: cancel'}
        </Text>
      </Box>
    </Modal>
  )
}
