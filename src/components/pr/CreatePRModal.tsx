import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MultiLineInput } from '../common/MultiLineInput'

type Step = 'title' | 'body' | 'options' | 'confirm'

interface CreatePRModalProps {
  readonly headBranch: string
  readonly defaultBaseBranch: string
  readonly supportsDraft: boolean
  readonly onSubmit: (params: {
    readonly title: string
    readonly body: string
    readonly baseBranch: string
    readonly headBranch: string
    readonly draft: boolean
  }) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
}

export function CreatePRModal({
  headBranch,
  defaultBaseBranch,
  supportsDraft,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: CreatePRModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const [step, setStep] = useState<Step>('title')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [baseBranch, setBaseBranch] = useState(defaultBaseBranch)
  const [draft, setDraft] = useState(false)
  const [editingBase, setEditingBase] = useState(false)
  const [optionIndex, setOptionIndex] = useState(0)

  useEffect(() => {
    if (step === 'title' || step === 'body' || editingBase) {
      setInputActive(true)
    } else {
      setInputActive(false)
    }
    return () => setInputActive(false)
  }, [step, editingBase, setInputActive])

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      body: body.trim(),
      baseBranch,
      headBranch,
      draft,
    })
  }, [title, body, baseBranch, headBranch, draft, isSubmitting, onSubmit])

  // Count option items (base branch, draft toggle if supported)
  const optionCount = supportsDraft ? 2 : 1

  useInput(
    (input, key) => {
      if (isSubmitting) return

      if (step === 'title') {
        if (key.escape) {
          onClose()
        } else if (key.return) {
          if (title.trim()) {
            setStep('body')
          }
        }
      } else if (step === 'body') {
        if (key.escape) {
          setStep('title')
        } else if (key.ctrl && input === 's') {
          setStep('options')
        }
      } else if (step === 'options') {
        if (editingBase) {
          if (key.escape) {
            setEditingBase(false)
          } else if (key.return) {
            setEditingBase(false)
          }
          return
        }
        if (key.escape) {
          setStep('body')
        } else if (input === 'j' || key.downArrow) {
          setOptionIndex((prev) => Math.min(prev + 1, optionCount - 1))
        } else if (input === 'k' || key.upArrow) {
          setOptionIndex((prev) => Math.max(prev - 1, 0))
        } else if (key.return) {
          if (optionIndex === 0) {
            setEditingBase(true)
          } else if (optionIndex === 1 && supportsDraft) {
            setDraft((prev) => !prev)
          }
        } else if (input === ' ') {
          if (optionIndex === 1 && supportsDraft) {
            setDraft((prev) => !prev)
          }
        } else if (input === 'c' || input === 'C') {
          setStep('confirm')
        }
      } else if (step === 'confirm') {
        if (key.escape) {
          setStep('options')
        } else if (input === 'y' || input === 'Y') {
          handleSubmit()
        }
      }
    },
    { isActive: true },
  )

  if (step === 'confirm') {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.warning}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={65}
        >
          <Text color={theme.colors.warning} bold>
            Confirm PR Creation
          </Text>

          <Box flexDirection="column" gap={0}>
            <Box gap={1}>
              <Text color={theme.colors.muted}>Title:</Text>
              <Text color={theme.colors.text}>{title}</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.colors.muted}>Head:</Text>
              <Text color={theme.colors.accent}>{headBranch}</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.colors.muted}>Base:</Text>
              <Text color={theme.colors.text}>{baseBranch}</Text>
            </Box>
            {supportsDraft && (
              <Box gap={1}>
                <Text color={theme.colors.muted}>Draft:</Text>
                <Text color={draft ? theme.colors.warning : theme.colors.success}>
                  {draft ? 'Yes' : 'No'}
                </Text>
              </Box>
            )}
            {body.trim() && (
              <Box gap={1}>
                <Text color={theme.colors.muted}>Body:</Text>
                <Text color={theme.colors.text}>
                  {body.length > 50 ? `${body.slice(0, 50)}...` : body}
                </Text>
              </Box>
            )}
          </Box>

          {isSubmitting && (
            <Text color={theme.colors.info}>Creating PR...</Text>
          )}

          {error && (
            <Text color={theme.colors.error}>{error}</Text>
          )}

          <Text color={theme.colors.muted} dimColor>
            y: create PR | Esc: back
          </Text>
        </Box>
      </Modal>
    )
  }

  if (step === 'options') {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={65}
        >
          <Text color={theme.colors.accent} bold>
            PR Options
          </Text>

          <Box flexDirection="column">
            <Box gap={1}>
              <Text color={optionIndex === 0 ? theme.colors.accent : theme.colors.muted}>
                {optionIndex === 0 ? '>' : ' '}
              </Text>
              <Text color={theme.colors.muted}>Base branch:</Text>
              {editingBase ? (
                <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
                  <TextInput
                    defaultValue={baseBranch}
                    onChange={setBaseBranch}
                    placeholder="Base branch..."
                  />
                </Box>
              ) : (
                <Text color={theme.colors.text} bold={optionIndex === 0}>
                  {baseBranch}
                </Text>
              )}
            </Box>

            {supportsDraft && (
              <Box gap={1}>
                <Text color={optionIndex === 1 ? theme.colors.accent : theme.colors.muted}>
                  {optionIndex === 1 ? '>' : ' '}
                </Text>
                <Text color={theme.colors.muted}>Draft:</Text>
                <Text color={draft ? theme.colors.warning : theme.colors.success} bold={optionIndex === 1}>
                  {draft ? '[x] Draft PR' : '[ ] Ready for review'}
                </Text>
              </Box>
            )}
          </Box>

          <Box flexDirection="column" gap={0}>
            <Box gap={1}>
              <Text color={theme.colors.muted} dimColor>Head:</Text>
              <Text color={theme.colors.accent}>{headBranch}</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.colors.muted} dimColor>Title:</Text>
              <Text color={theme.colors.text}>{title}</Text>
            </Box>
          </Box>

          {error && (
            <Text color={theme.colors.error}>{error}</Text>
          )}

          <Text color={theme.colors.muted} dimColor>
            {editingBase
              ? 'Enter: confirm | Esc: cancel'
              : 'j/k: navigate | Enter: edit | Space: toggle | c: create | Esc: back'}
          </Text>
        </Box>
      </Modal>
    )
  }

  if (step === 'body') {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={65}
        >
          <Text color={theme.colors.accent} bold>
            PR Description (optional)
          </Text>

          <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
            <MultiLineInput
              placeholder="Enter a description for your PR..."
              defaultValue={body}
              onChange={setBody}
              isActive={true}
              minHeight={5}
            />
          </Box>

          <Box flexDirection="column" gap={0}>
            <Box gap={1}>
              <Text color={theme.colors.muted} dimColor>Title:</Text>
              <Text color={theme.colors.text}>{title}</Text>
            </Box>
            <Box gap={1}>
              <Text color={theme.colors.muted} dimColor>Branch:</Text>
              <Text color={theme.colors.accent}>{headBranch}</Text>
              <Text color={theme.colors.muted}>{'->'}</Text>
              <Text color={theme.colors.text}>{baseBranch}</Text>
            </Box>
          </Box>

          <Text color={theme.colors.muted} dimColor>
            Ctrl+S: continue | Esc: back to title
          </Text>
        </Box>
      </Modal>
    )
  }

  // step === 'title'
  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={65}
      >
        <Text color={theme.colors.accent} bold>
          Create Pull Request
        </Text>

        <Box flexDirection="column" gap={0}>
          <Box gap={1}>
            <Text color={theme.colors.muted}>Head:</Text>
            <Text color={theme.colors.accent}>{headBranch}</Text>
          </Box>
          <Box gap={1}>
            <Text color={theme.colors.muted}>Base:</Text>
            <Text color={theme.colors.text}>{defaultBaseBranch}</Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text color={theme.colors.muted}>Title:</Text>
          <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
            <TextInput
              defaultValue={title}
              onChange={setTitle}
              placeholder="Enter PR title..."
            />
          </Box>
        </Box>

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          Enter: continue | Esc: cancel
        </Text>
      </Box>
    </Modal>
  )
}
