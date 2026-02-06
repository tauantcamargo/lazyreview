import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme, Theme } from '../theme';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  isFocused?: boolean;
  showIndicator?: boolean;
  theme?: Theme;
}

/**
 * Single select component with keyboard navigation
 */
export function Select<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  isFocused = true,
  showIndicator = true,
  theme = getTheme(),
}: SelectProps<T>): React.ReactElement {
  const enabledOptions = useMemo(
    () => options.filter((opt) => !opt.disabled),
    [options]
  );

  const [highlightIndex, setHighlightIndex] = useState(() => {
    if (value === undefined) return 0;
    const idx = enabledOptions.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  });

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || input === 'k') {
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : enabledOptions.length - 1
        );
      } else if (key.downArrow || input === 'j') {
        setHighlightIndex((prev) =>
          prev < enabledOptions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        const selected = enabledOptions[highlightIndex];
        if (selected) {
          onChange?.(selected.value);
        }
      }
    },
    { isActive: isFocused }
  );

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isHighlighted =
          enabledOptions.indexOf(option) === highlightIndex;
        const isSelected = option.value === value;
        const isDisabled = option.disabled;

        return (
          <Box key={String(option.value)} gap={1}>
            {showIndicator && (
              <Text color={theme.accent}>
                {isSelected ? '●' : isHighlighted ? '▸' : ' '}
              </Text>
            )}
            <Text
              color={
                isDisabled
                  ? theme.muted
                  : isHighlighted
                    ? theme.listSelectedForeground
                    : theme.text
              }
              backgroundColor={
                isHighlighted && !isDisabled
                  ? theme.listSelectedBackground
                  : undefined
              }
              dimColor={isDisabled}
            >
              {option.label}
            </Text>
            {option.description && (
              <Text color={theme.muted}> - {option.description}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export interface MultiSelectProps<T = string> {
  options: SelectOption<T>[];
  values?: T[];
  onChange?: (values: T[]) => void;
  minSelect?: number;
  maxSelect?: number;
  disabled?: boolean;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Multi-select component with checkboxes
 */
export function MultiSelect<T = string>({
  options,
  values = [],
  onChange,
  minSelect = 0,
  maxSelect = Infinity,
  disabled = false,
  isFocused = true,
  theme = getTheme(),
}: MultiSelectProps<T>): React.ReactElement {
  const enabledOptions = useMemo(
    () => options.filter((opt) => !opt.disabled),
    [options]
  );

  const [highlightIndex, setHighlightIndex] = useState(0);

  const toggleOption = useCallback(
    (optionValue: T) => {
      const isSelected = values.includes(optionValue);

      if (isSelected) {
        if (values.length > minSelect) {
          onChange?.(values.filter((v) => v !== optionValue));
        }
      } else {
        if (values.length < maxSelect) {
          onChange?.([...values, optionValue]);
        }
      }
    },
    [values, onChange, minSelect, maxSelect]
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || input === 'k') {
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : enabledOptions.length - 1
        );
      } else if (key.downArrow || input === 'j') {
        setHighlightIndex((prev) =>
          prev < enabledOptions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return || input === ' ') {
        const selected = enabledOptions[highlightIndex];
        if (selected) {
          toggleOption(selected.value);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box flexDirection="column">
      {options.map((option) => {
        const isHighlighted =
          enabledOptions.indexOf(option) === highlightIndex;
        const isSelected = values.includes(option.value);
        const isDisabled = option.disabled;

        return (
          <Box key={String(option.value)} gap={1}>
            <Text color={isSelected ? theme.accent : theme.muted}>
              {isSelected ? '☑' : '☐'}
            </Text>
            <Text
              color={
                isDisabled
                  ? theme.muted
                  : isHighlighted
                    ? theme.listSelectedForeground
                    : theme.text
              }
              backgroundColor={
                isHighlighted && !isDisabled
                  ? theme.listSelectedBackground
                  : undefined
              }
              dimColor={isDisabled}
            >
              {option.label}
            </Text>
            {option.description && (
              <Text color={theme.muted}> - {option.description}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export interface RadioGroupProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Radio button group
 */
export function RadioGroup<T = string>({
  options,
  value,
  onChange,
  disabled = false,
  isFocused = true,
  theme = getTheme(),
}: RadioGroupProps<T>): React.ReactElement {
  const enabledOptions = useMemo(
    () => options.filter((opt) => !opt.disabled),
    [options]
  );

  const [highlightIndex, setHighlightIndex] = useState(() => {
    if (value === undefined) return 0;
    const idx = enabledOptions.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  });

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || input === 'k') {
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : enabledOptions.length - 1
        );
      } else if (key.downArrow || input === 'j') {
        setHighlightIndex((prev) =>
          prev < enabledOptions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return || input === ' ') {
        const selected = enabledOptions[highlightIndex];
        if (selected) {
          onChange?.(selected.value);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box flexDirection="column">
      {options.map((option) => {
        const isHighlighted =
          enabledOptions.indexOf(option) === highlightIndex;
        const isSelected = option.value === value;
        const isDisabled = option.disabled;

        return (
          <Box key={String(option.value)} gap={1}>
            <Text color={isSelected ? theme.accent : theme.muted}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text
              color={
                isDisabled
                  ? theme.muted
                  : isHighlighted
                    ? theme.listSelectedForeground
                    : theme.text
              }
              backgroundColor={
                isHighlighted && !isDisabled
                  ? theme.listSelectedBackground
                  : undefined
              }
              dimColor={isDisabled}
            >
              {option.label}
            </Text>
            {option.description && (
              <Text color={theme.muted}> - {option.description}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export interface ToggleProps {
  value: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Toggle switch component
 */
export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
  isFocused = true,
  theme = getTheme(),
}: ToggleProps): React.ReactElement {
  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return || input === ' ') {
        onChange?.(!value);
      }
    },
    { isActive: isFocused }
  );

  const toggleDisplay = value ? '◉ On ' : '○ Off';

  return (
    <Box gap={1}>
      <Text
        color={value ? theme.added : theme.muted}
        dimColor={disabled}
      >
        {toggleDisplay}
      </Text>
      {label && (
        <Text color={disabled ? theme.muted : theme.text}>{label}</Text>
      )}
    </Box>
  );
}

export interface DropdownProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  width?: number;
  disabled?: boolean;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Dropdown select with open/close state
 */
export function Dropdown<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  isOpen: controlledIsOpen,
  onOpenChange,
  width,
  disabled = false,
  isFocused = true,
  theme = getTheme(),
}: DropdownProps<T>): React.ReactElement {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalIsOpen;

  const setIsOpen = useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open);
      } else {
        setInternalIsOpen(open);
      }
    },
    [onOpenChange]
  );

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  const enabledOptions = useMemo(
    () => options.filter((opt) => !opt.disabled),
    [options]
  );

  const [highlightIndex, setHighlightIndex] = useState(() => {
    if (value === undefined) return 0;
    const idx = enabledOptions.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  });

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return && !isOpen) {
        setIsOpen(true);
        return;
      }

      if (key.escape && isOpen) {
        setIsOpen(false);
        return;
      }

      if (!isOpen) return;

      if (key.upArrow || input === 'k') {
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : enabledOptions.length - 1
        );
      } else if (key.downArrow || input === 'j') {
        setHighlightIndex((prev) =>
          prev < enabledOptions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        const selected = enabledOptions[highlightIndex];
        if (selected) {
          onChange?.(selected.value);
          setIsOpen(false);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box flexDirection="column" width={width}>
      <Box
        borderStyle="round"
        borderColor={isOpen ? theme.accent : theme.border}
        paddingX={1}
      >
        <Text color={selectedOption ? theme.text : theme.muted}>
          {displayLabel}
        </Text>
        <Text color={theme.muted}> {isOpen ? '▲' : '▼'}</Text>
      </Box>

      {isOpen && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.border}
          marginTop={-1}
        >
          {options.map((option) => {
            const isHighlighted =
              enabledOptions.indexOf(option) === highlightIndex;
            const isDisabled = option.disabled;

            return (
              <Box key={String(option.value)} paddingX={1}>
                <Text
                  color={
                    isDisabled
                      ? theme.muted
                      : isHighlighted
                        ? theme.listSelectedForeground
                        : theme.text
                  }
                  backgroundColor={
                    isHighlighted && !isDisabled
                      ? theme.listSelectedBackground
                      : undefined
                  }
                  dimColor={isDisabled}
                >
                  {option.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
