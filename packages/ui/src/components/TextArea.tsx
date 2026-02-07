import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme, Theme } from '../theme';

export interface TextAreaProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  isFocused?: boolean;
  showLineNumbers?: boolean;
  showHelp?: boolean;
  theme?: Theme;
}

/**
 * Multi-line text input with vim-like navigation
 */
export function TextArea({
  value = '',
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Enter text...',
  rows = 5,
  maxLength,
  disabled = false,
  isFocused = true,
  showLineNumbers = false,
  showHelp = true,
  theme = getTheme(),
}: TextAreaProps): React.ReactElement {
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);

  const lines = useMemo(() => value.split('\n'), [value]);
  const currentLine = lines[cursorLine] ?? '';

  const updateValue = useCallback((newLines: string[]) => {
    const newValue = newLines.join('\n');
    if (maxLength && newValue.length > maxLength) return;
    onChange?.(newValue);
  }, [maxLength, onChange]);

  useInput(
    (input, key) => {
      if (disabled) return;

      // Submit with Ctrl+Enter
      if (key.ctrl && key.return) {
        onSubmit?.(value);
        return;
      }

      // Cancel with Escape
      if (key.escape) {
        onCancel?.();
        return;
      }

      // Navigation
      if (key.upArrow) {
        setCursorLine((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setCursorLine((prev) => Math.min(lines.length - 1, prev + 1));
        return;
      }

      if (key.leftArrow) {
        if (cursorCol > 0) {
          setCursorCol((prev) => prev - 1);
        } else if (cursorLine > 0) {
          setCursorLine((prev) => prev - 1);
          setCursorCol(lines[cursorLine - 1]?.length ?? 0);
        }
        return;
      }

      if (key.rightArrow) {
        if (cursorCol < currentLine.length) {
          setCursorCol((prev) => prev + 1);
        } else if (cursorLine < lines.length - 1) {
          setCursorLine((prev) => prev + 1);
          setCursorCol(0);
        }
        return;
      }

      // New line
      if (key.return) {
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);
        const newLines = [
          ...lines.slice(0, cursorLine),
          before,
          after,
          ...lines.slice(cursorLine + 1),
        ];
        updateValue(newLines);
        setCursorLine((prev) => prev + 1);
        setCursorCol(0);
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        if (cursorCol > 0) {
          const newLine = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
          const newLines = [...lines];
          newLines[cursorLine] = newLine;
          updateValue(newLines);
          setCursorCol((prev) => prev - 1);
        } else if (cursorLine > 0) {
          const prevLine = lines[cursorLine - 1] ?? '';
          const newLine = prevLine + currentLine;
          const newLines = [
            ...lines.slice(0, cursorLine - 1),
            newLine,
            ...lines.slice(cursorLine + 1),
          ];
          updateValue(newLines);
          setCursorLine((prev) => prev - 1);
          setCursorCol(prevLine.length);
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const newLine = currentLine.slice(0, cursorCol) + input + currentLine.slice(cursorCol);
        const newLines = [...lines];
        newLines[cursorLine] = newLine;
        updateValue(newLines);
        setCursorCol((prev) => prev + input.length);
      }
    },
    { isActive: isFocused }
  );

  // Clamp cursor position
  const displayCursorLine = Math.min(cursorLine, lines.length - 1);
  const displayCursorCol = Math.min(cursorCol, (lines[displayCursorLine] ?? '').length);

  const displayLines = lines.slice(0, rows);
  const isEmpty = value === '';

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={isFocused ? theme.accent : theme.border}
        paddingX={1}
      >
        {displayLines.map((line, index) => (
          <Box key={index}>
            {showLineNumbers && (
              <Text color={theme.muted}>
                {String(index + 1).padStart(3, ' ')} │{' '}
              </Text>
            )}
            <Text color={isEmpty ? theme.muted : theme.text}>
              {isEmpty && index === 0 ? placeholder : line}
              {index === displayCursorLine && isFocused && (
                <Text inverse> </Text>
              )}
            </Text>
          </Box>
        ))}
        {lines.length < rows &&
          Array.from({ length: rows - lines.length }).map((_, index) => (
            <Box key={`empty-${index}`}>
              {showLineNumbers && (
                <Text color={theme.muted}>
                  {String(lines.length + index + 1).padStart(3, ' ')} │{' '}
                </Text>
              )}
              <Text> </Text>
            </Box>
          ))}
      </Box>

      {showHelp && (
        <Box marginTop={1} gap={2}>
          <Text color={theme.muted}>Ctrl+Enter: Submit</Text>
          <Text color={theme.muted}>Esc: Cancel</Text>
          {maxLength && (
            <Text color={value.length > maxLength * 0.9 ? theme.removed : theme.muted}>
              {value.length}/{maxLength}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export interface CommentInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  title?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Comment input with title and submit/cancel buttons
 */
export function CommentInput({
  value = '',
  onChange,
  onSubmit,
  onCancel,
  title = 'Add comment',
  placeholder = 'Write your comment...',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  maxLength,
  isFocused = true,
  theme = getTheme(),
}: CommentInputProps): React.ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      <Text color={theme.accent} bold>
        {title}
      </Text>

      <TextArea
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        onCancel={onCancel}
        placeholder={placeholder}
        rows={5}
        maxLength={maxLength}
        isFocused={isFocused}
        showHelp={false}
        theme={theme}
      />

      <Box gap={2}>
        <Text color={theme.muted}>[Ctrl+Enter] {submitLabel}</Text>
        <Text color={theme.muted}>[Esc] {cancelLabel}</Text>
        {maxLength && (
          <Text color={value.length > maxLength * 0.9 ? theme.removed : theme.muted}>
            {value.length}/{maxLength}
          </Text>
        )}
      </Box>
    </Box>
  );
}

export interface InlineInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  prefix?: string;
  placeholder?: string;
  maxLength?: number;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Single-line inline input
 */
export function InlineInput({
  value = '',
  onChange,
  onSubmit,
  onCancel,
  prefix,
  placeholder = '',
  maxLength,
  isFocused = true,
  theme = getTheme(),
}: InlineInputProps): React.ReactElement {
  const [cursorPos, setCursorPos] = useState(value.length);

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.escape) {
        onCancel?.();
        return;
      }

      if (key.leftArrow) {
        setCursorPos((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorPos((prev) => Math.min(value.length, prev + 1));
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          onChange?.(newValue);
          setCursorPos((prev) => prev - 1);
        }
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        if (maxLength && value.length >= maxLength) return;
        const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
        onChange?.(newValue);
        setCursorPos((prev) => prev + input.length);
      }
    },
    { isActive: isFocused }
  );

  const displayValue = value || placeholder;
  const isEmpty = value === '';

  return (
    <Box>
      {prefix && (
        <Text color={theme.accent}>{prefix}</Text>
      )}
      <Text color={isEmpty ? theme.muted : theme.text}>
        {displayValue.slice(0, cursorPos)}
      </Text>
      {isFocused && (
        <Text inverse>{displayValue[cursorPos] ?? ' '}</Text>
      )}
      <Text color={isEmpty ? theme.muted : theme.text}>
        {displayValue.slice(cursorPos + 1)}
      </Text>
    </Box>
  );
}
