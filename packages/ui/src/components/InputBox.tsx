import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Theme } from '../theme';

export interface InputBoxProps {
  label: string;
  placeholder?: string;
  value?: string;
  multiline?: boolean;
  maxLength?: number;
  theme?: Theme;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  onChange?: (value: string) => void;
}

export function InputBox({
  label,
  placeholder = '',
  value: initialValue = '',
  multiline = false,
  maxLength,
  theme,
  onSubmit,
  onCancel,
  onChange,
}: InputBoxProps): JSX.Element {
  const [value, setValue] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(initialValue.length);

  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (multiline && key.shift) {
        const newValue = value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition);
        setValue(newValue);
        setCursorPosition(cursorPosition + 1);
        onChange?.(newValue);
      } else {
        onSubmit?.(value);
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        setValue(newValue);
        setCursorPosition(cursorPosition - 1);
        onChange?.(newValue);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      if (maxLength && value.length >= maxLength) return;

      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      setValue(newValue);
      setCursorPosition(cursorPosition + input.length);
      onChange?.(newValue);
    }
  });

  const renderValue = useCallback(() => {
    if (value.length === 0) {
      return <Text color={mutedColor}>{placeholder}</Text>;
    }

    const beforeCursor = value.slice(0, cursorPosition);
    const cursorChar = value[cursorPosition] ?? ' ';
    const afterCursor = value.slice(cursorPosition + 1);

    return (
      <Text>
        {beforeCursor}
        <Text inverse>{cursorChar}</Text>
        {afterCursor}
      </Text>
    );
  }, [value, cursorPosition, placeholder, mutedColor]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accentColor}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text color={accentColor} bold>
          {label}
        </Text>
        {maxLength && (
          <Text color={mutedColor}>
            {' '}
            ({value.length}/{maxLength})
          </Text>
        )}
      </Box>

      <Box minHeight={multiline ? 3 : 1}>{renderValue()}</Box>

      <Box marginTop={1}>
        <Text color={mutedColor}>
          {multiline ? 'Shift+Enter for newline, ' : ''}
          Enter to submit, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
