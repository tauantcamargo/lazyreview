import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Theme } from '../theme';

export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  isActive?: boolean;
  width?: number;
  theme?: Theme;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
}

export function SearchInput({
  placeholder = 'Search...',
  value: controlledValue,
  isActive = true,
  width,
  theme,
  onChange,
  onSubmit,
  onCancel,
}: SearchInputProps): JSX.Element {
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue ?? internalValue;

  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  const handleChange = useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
    },
    [controlledValue, onChange]
  );

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        onCancel?.();
        return;
      }

      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.backspace || key.delete) {
        handleChange(value.slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        handleChange(value + input);
      }
    },
    { isActive }
  );

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <Box width={width}>
      <Text color={accentColor}>/ </Text>
      <Text color={isPlaceholder ? mutedColor : undefined} dimColor={isPlaceholder}>
        {displayValue}
      </Text>
      {isActive && <Text inverse> </Text>}
    </Box>
  );
}
