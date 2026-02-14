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

interface CommentModalProps {
  readonly title: string
  readonly context?: string
  readonly defaultValue?: string
  readonly onSubmit: (body: string) => void
  readonly onClose: () => void
  readonly isSubmitting: boolean
  readonly error: string | null
  readonly templateVariables?: TemplateVariables
}

export function CommentModal({
  title,
  context,
  defaultValue,
  onSubmit,
  onClose,
  isSubmitting,
  error,
  templateVariables,
}: CommentModalProps): React.ReactElement {
  const theme = useTheme()
  const { setInputActive } = useInputFocus()
  const { config } = useConfig()
  const [body, setBody] = useState(defaultValue ?? '')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [pendingInsert, setPendingInsert] = useState<InsertTextRequest | null>(null)

  useEffect(() => {
    setInputActive(!showTemplatePicker)
    return () => setInputActive(false)
  }, [setInputActive, showTemplatePicker])

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim()
    if (trimmed && !isSubmitting) {
      onSubmit(trimmed)
    }
  }, [body, isSubmitting, onSubmit])

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
    (_input, key) => {
      if (isSubmitting || showTemplatePicker) return

      if (key.escape) {
        onClose()
      } else if (key.return && (key.meta || key.ctrl)) {
        handleSubmit()
      } else if (_input === 's' && key.ctrl) {
        handleSubmit()
      } else if (_input === 't' && key.ctrl) {
        setShowTemplatePicker(true)
      }
    },
    { isActive: !showTemplatePicker },
  )

  const isInline = title === 'Add Inline Comment'

  if (showTemplatePicker) {
    return (
      <TemplatePickerModal
        templates={templates}
        onSelect={handleTemplateSelect}
        onClose={() => setShowTemplatePicker(false)}
      />
    )
  }

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
        width={70}
      >
        <Text color={theme.colors.accent} bold>
          {title}
        </Text>

        {context && (
          <Text color={theme.colors.muted}>{context}</Text>
        )}

        <Box
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
          flexDirection="column"
        >
          <MultiLineInput
            placeholder="Write your comment... (Markdown supported)"
            defaultValue={defaultValue}
            onChange={setBody}
            isActive={!isSubmitting && !showTemplatePicker}
            minHeight={5}
            insertText={pendingInsert}
          />
        </Box>

        <Box flexDirection="column" gap={0}>
          <Text color={theme.colors.muted} dimColor>
            Markdown: **bold** *italic* `code` ```lang code block```
          </Text>
          {isInline && (
            <Text color={theme.colors.muted} dimColor>
              Suggestion: ```suggestion{'\n'}replacement code{'\n'}```
            </Text>
          )}
          <Text color={theme.colors.muted} dimColor>
            Tab: indent | Enter: new line | Ctrl+S: submit | Ctrl+T: template | Esc: cancel
          </Text>
        </Box>

        {isSubmitting && (
          <Text color={theme.colors.info}>Posting comment...</Text>
        )}

        {error && (
          <Text color={theme.colors.error}>{error}</Text>
        )}
      </Box>
    </Modal>
  )
}
