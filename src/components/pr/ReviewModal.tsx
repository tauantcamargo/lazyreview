import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { useInputFocus } from '../../hooks/useInputFocus'
import { Modal } from '../common/Modal'
import { MultiLineInput, type InsertTextRequest } from '../common/MultiLineInput'
import { TemplatePickerModal } from './TemplatePickerModal'
import { DEFAULT_TEMPLATES, mergeTemplates, type CommentTemplate } from '../../models/comment-template'
import { resolveTemplate, type TemplateVariables } from '../../utils/template-engine'
import { useConfig } from '../../hooks/useConfig'
import type { ReviewEvent } from '../../hooks/useGitHub'

interface ReviewModalProps {
  readonly onSubmit: (body: string, event: ReviewEvent) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
  readonly templateVariables?: TemplateVariables
}

const REVIEW_TYPES: readonly {
  readonly event: ReviewEvent
  readonly label: string
  readonly color: 'success' | 'error' | 'info'
}[] = [
  { event: 'APPROVE', label: 'Approve', color: 'success' },
  { event: 'REQUEST_CHANGES', label: 'Request Changes', color: 'error' },
  { event: 'COMMENT', label: 'Comment', color: 'info' },
]

type Step = 'select_type' | 'enter_body'

export function ReviewModal({
  onSubmit,
  onClose,
  isSubmitting,
  error,
  templateVariables,
}: ReviewModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const { config } = useConfig()
  const [step, setStep] = useState<Step>('select_type')
  const [selectedType, setSelectedType] = useState(0)
  const [reviewEvent, setReviewEvent] = useState<ReviewEvent>('APPROVE')
  const [body, setBody] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [pendingInsert, setPendingInsert] = useState<InsertTextRequest | null>(null)

  useEffect(() => {
    if (step === 'enter_body' && !showTemplatePicker) {
      setInputActive(true)
    }
    return () => setInputActive(false)
  }, [step, setInputActive, showTemplatePicker])

  const handleSubmit = useCallback(() => {
    if (reviewEvent === 'REQUEST_CHANGES' && !body.trim()) {
      return
    }
    if (!isSubmitting) {
      onSubmit(body, reviewEvent)
    }
  }, [body, reviewEvent, isSubmitting, onSubmit])

  const handleTemplateSelect = useCallback(
    (template: CommentTemplate) => {
      const resolved = resolveTemplate(template, templateVariables ?? {})
      setPendingInsert({ text: resolved.text, cursorOffset: resolved.cursorOffset })
      setShowTemplatePicker(false)
    },
    [templateVariables],
  )

  const templates = mergeTemplates(
    DEFAULT_TEMPLATES,
    config?.commentTemplates as readonly CommentTemplate[] | undefined,
  )

  useInput(
    (input, key) => {
      if (isSubmitting || showTemplatePicker) return

      if (step === 'select_type') {
        if (key.escape) {
          onClose()
        } else if (input === 'j' || key.downArrow) {
          setSelectedType((prev) => Math.min(prev + 1, REVIEW_TYPES.length - 1))
        } else if (input === 'k' || key.upArrow) {
          setSelectedType((prev) => Math.max(prev - 1, 0))
        } else if (key.return) {
          setReviewEvent(REVIEW_TYPES[selectedType]!.event)
          setStep('enter_body')
        }
      } else if (step === 'enter_body') {
        if (key.escape) {
          setStep('select_type')
          setInputActive(false)
        } else if (key.return && (key.meta || key.ctrl)) {
          handleSubmit()
        } else if (input === 's' && key.ctrl) {
          handleSubmit()
        } else if (input === 't' && key.ctrl) {
          setShowTemplatePicker(true)
        }
      }
    },
    { isActive: !showTemplatePicker },
  )

  if (showTemplatePicker) {
    return (
      <TemplatePickerModal
        templates={templates}
        onSelect={handleTemplateSelect}
        onClose={() => setShowTemplatePicker(false)}
      />
    )
  }

  if (step === 'select_type') {
    return (
      <Modal>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.colors.accent}
          backgroundColor={theme.colors.bg}
          paddingX={2}
          paddingY={1}
          gap={1}
          width={50}
        >
          <Text color={theme.colors.accent} bold>
            Submit Review
          </Text>

          <Text color={theme.colors.muted}>Select review type:</Text>

          <Box flexDirection="column">
            {REVIEW_TYPES.map((type, index) => (
              <Box key={type.event} gap={1}>
                <Text color={index === selectedType ? theme.colors.accent : theme.colors.muted}>
                  {index === selectedType ? '>' : ' '}
                </Text>
                <Text
                  color={theme.colors[type.color]}
                  bold={index === selectedType}
                  inverse={index === selectedType}
                >
                  {type.label}
                </Text>
              </Box>
            ))}
          </Box>

          {error && (
            <Text color={theme.colors.error}>{error}</Text>
          )}

          <Text color={theme.colors.muted} dimColor>
            j/k: navigate | Enter: select | Esc: cancel
          </Text>
        </Box>
      </Modal>
    )
  }

  const selectedReviewType = REVIEW_TYPES.find((t) => t.event === reviewEvent)

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={2}
        paddingY={1}
        gap={1}
        width={60}
      >
        <Box gap={1}>
          <Text color={theme.colors.accent} bold>
            Submit Review
          </Text>
          <Text color={theme.colors.muted}>-</Text>
          <Text color={selectedReviewType ? theme.colors[selectedReviewType.color] : theme.colors.text}>
            {selectedReviewType?.label}
          </Text>
        </Box>

        <Text color={theme.colors.muted}>
          {reviewEvent === 'APPROVE'
            ? 'Add an optional message:'
            : 'Enter your review message:'}
        </Text>

        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <MultiLineInput
            placeholder="Review message... (Markdown supported)"
            onChange={setBody}
            isActive={step === 'enter_body' && !isSubmitting && !showTemplatePicker}
            minHeight={5}
            insertText={pendingInsert}
          />
        </Box>

        {isSubmitting && (
          <Text color={theme.colors.info}>Submitting review...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}

        <Text color={theme.colors.muted} dimColor>
          Enter: new line | Ctrl+S: submit | Ctrl+T: template | Esc: back
        </Text>
      </Box>
    </Modal>
  )
}
