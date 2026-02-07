import React, { useState, useCallback, ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme, Theme } from '../theme';

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: string;
  color?: string;
}

export interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[];
  selected: T | null;
  onSelect: (value: T | null) => void;
  label?: string;
  allowClear?: boolean;
  isFocused?: boolean;
  theme?: Theme;
}

/**
 * Horizontal filter bar with selectable options
 */
export function FilterBar<T extends string = string>({
  options,
  selected,
  onSelect,
  label,
  allowClear = true,
  isFocused = true,
  theme = getTheme(),
}: FilterBarProps<T>): React.ReactElement {
  const [focusIndex, setFocusIndex] = useState(() => {
    const idx = options.findIndex(o => o.value === selected);
    return idx >= 0 ? idx : 0;
  });

  useInput(
    (input, key) => {
      if (key.leftArrow || input === 'h') {
        setFocusIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.rightArrow || input === 'l') {
        setFocusIndex((prev) => Math.min(options.length - 1, prev + 1));
        return;
      }

      if (key.return || input === ' ') {
        const option = options[focusIndex];
        if (option) {
          if (selected === option.value && allowClear) {
            onSelect(null);
          } else {
            onSelect(option.value);
          }
        }
        return;
      }

      if (key.escape && allowClear) {
        onSelect(null);
        return;
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box gap={2}>
      {label && (
        <Text color={theme.muted}>{label}:</Text>
      )}
      {options.map((option, index) => {
        const isSelected = option.value === selected;
        const isFocused2 = index === focusIndex && isFocused;
        const color = option.color ?? (isSelected ? theme.accent : theme.text);

        return (
          <Box key={option.value}>
            <Text
              color={isFocused2 ? theme.listSelectedForeground : color}
              backgroundColor={isFocused2 ? theme.listSelectedBackground : undefined}
              bold={isSelected}
            >
              {option.icon && `${option.icon} `}
              {option.label}
              {option.count !== undefined && (
                <Text color={theme.muted}> ({option.count})</Text>
              )}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export interface FilterChipsProps<T extends string = string> {
  filters: FilterOption<T>[];
  active: T[];
  onToggle: (value: T) => void;
  onClear?: () => void;
  theme?: Theme;
}

/**
 * Filter chips that can be toggled on/off
 */
export function FilterChips<T extends string = string>({
  filters,
  active,
  onToggle,
  onClear,
  theme = getTheme(),
}: FilterChipsProps<T>): React.ReactElement {
  return (
    <Box gap={1} flexWrap="wrap">
      {filters.map((filter) => {
        const isActive = active.includes(filter.value);
        const color = filter.color ?? (isActive ? theme.accent : theme.muted);

        return (
          <Box
            key={filter.value}
            borderStyle="round"
            borderColor={isActive ? theme.accent : theme.muted}
            paddingX={1}
          >
            <Text color={color}>
              {filter.icon && `${filter.icon} `}
              {filter.label}
              {filter.count !== undefined && ` (${filter.count})`}
            </Text>
          </Box>
        );
      })}
      {onClear && active.length > 0 && (
        <Box paddingX={1}>
          <Text color={theme.muted}>×</Text>
        </Box>
      )}
    </Box>
  );
}

export interface QuickFilterProps {
  label: string;
  active: boolean;
  hotkey?: string;
  onToggle: () => void;
  theme?: Theme;
}

/**
 * Single quick filter toggle
 */
export function QuickFilter({
  label,
  active,
  hotkey,
  onToggle,
  theme = getTheme(),
}: QuickFilterProps): React.ReactElement {
  return (
    <Box gap={1}>
      {hotkey && (
        <Text color={theme.accent}>[{hotkey}]</Text>
      )}
      <Text
        color={active ? theme.accent : theme.muted}
        bold={active}
      >
        {active ? '☑' : '☐'} {label}
      </Text>
    </Box>
  );
}

export interface FilterGroupProps {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  theme?: Theme;
}

/**
 * Group of filters with title
 */
export function FilterGroup({
  title,
  children,
  collapsed = false,
  onToggle,
  theme = getTheme(),
}: FilterGroupProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        {onToggle && (
          <Text color={theme.muted}>{collapsed ? '▸' : '▾'}</Text>
        )}
        <Text color={theme.accent} bold>{title}</Text>
      </Box>
      {!collapsed && (
        <Box marginLeft={onToggle ? 2 : 0}>
          {children}
        </Box>
      )}
    </Box>
  );
}

export interface ActiveFiltersProps<T extends string = string> {
  filters: Array<{ key: string; value: T; label: string }>;
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  theme?: Theme;
}

/**
 * Display active filters with remove buttons
 */
export function ActiveFilters<T extends string = string>({
  filters,
  onRemove,
  onClearAll,
  theme = getTheme(),
}: ActiveFiltersProps<T>): React.ReactElement | null {
  if (filters.length === 0) {
    return null;
  }

  return (
    <Box gap={2}>
      <Text color={theme.muted}>Filters:</Text>
      {filters.map((filter) => (
        <Box key={filter.key} gap={1}>
          <Text color={theme.accent}>{filter.label}</Text>
          <Text color={theme.muted}>×</Text>
        </Box>
      ))}
      {onClearAll && filters.length > 1 && (
        <Text color={theme.muted} underline>Clear all</Text>
      )}
    </Box>
  );
}

export interface SortOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
}

export interface SortSelectProps<T extends string = string> {
  options: SortOption<T>[];
  selected: T;
  direction: 'asc' | 'desc';
  onSelect: (value: T) => void;
  onToggleDirection: () => void;
  theme?: Theme;
}

/**
 * Sort selector with direction toggle
 */
export function SortSelect<T extends string = string>({
  options,
  selected,
  direction,
  onSelect,
  onToggleDirection,
  theme = getTheme(),
}: SortSelectProps<T>): React.ReactElement {
  const selectedOption = options.find(o => o.value === selected);

  return (
    <Box gap={2}>
      <Text color={theme.muted}>Sort:</Text>
      <Text color={theme.accent}>
        {selectedOption?.icon && `${selectedOption.icon} `}
        {selectedOption?.label ?? selected}
      </Text>
      <Text color={theme.muted}>{direction === 'asc' ? '↑' : '↓'}</Text>
    </Box>
  );
}

export interface FilterSummaryProps {
  total: number;
  filtered: number;
  label?: string;
  theme?: Theme;
}

/**
 * Summary showing filtered vs total count
 */
export function FilterSummary({
  total,
  filtered,
  label = 'items',
  theme = getTheme(),
}: FilterSummaryProps): React.ReactElement {
  const isFiltered = filtered !== total;

  return (
    <Box>
      <Text color={theme.muted}>
        {isFiltered ? (
          <>
            Showing <Text color={theme.accent}>{filtered}</Text> of {total} {label}
          </>
        ) : (
          <>{total} {label}</>
        )}
      </Text>
    </Box>
  );
}

export interface SearchFilterProps {
  query: string;
  placeholder?: string;
  onClear: () => void;
  theme?: Theme;
}

/**
 * Display current search filter
 */
export function SearchFilter({
  query,
  placeholder = 'Search',
  onClear,
  theme = getTheme(),
}: SearchFilterProps): React.ReactElement {
  if (!query) {
    return (
      <Text color={theme.muted}>{placeholder}...</Text>
    );
  }

  return (
    <Box gap={1}>
      <Text color={theme.muted}>🔍</Text>
      <Text color={theme.accent}>{query}</Text>
      <Text color={theme.muted}>×</Text>
    </Box>
  );
}

export interface PresetFilterProps<T extends string = string> {
  presets: Array<{
    id: string;
    label: string;
    filters: Record<string, T>;
    icon?: string;
  }>;
  activePreset?: string;
  onApply: (presetId: string) => void;
  theme?: Theme;
}

/**
 * Preset filter combinations
 */
export function PresetFilter<T extends string = string>({
  presets,
  activePreset,
  onApply,
  theme = getTheme(),
}: PresetFilterProps<T>): React.ReactElement {
  return (
    <Box gap={2}>
      {presets.map((preset) => {
        const isActive = preset.id === activePreset;

        return (
          <Box
            key={preset.id}
            borderStyle={isActive ? 'round' : undefined}
            borderColor={isActive ? theme.accent : undefined}
            paddingX={isActive ? 1 : 0}
          >
            <Text
              color={isActive ? theme.accent : theme.muted}
              bold={isActive}
            >
              {preset.icon && `${preset.icon} `}
              {preset.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
