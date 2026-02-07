import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  selectedIndex?: number;
  showHeader?: boolean;
  showBorder?: boolean;
  striped?: boolean;
  width?: number;
  maxHeight?: number;
  emptyMessage?: string;
  theme?: Theme;
  onSelect?: (row: T, index: number) => void;
}

function getColumnValue<T>(row: T, key: keyof T | string): unknown {
  if (typeof key === 'string' && key.includes('.')) {
    const parts = key.split('.');
    let value: unknown = row;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
  return row[key as keyof T];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function alignText(text: string, width: number, align: 'left' | 'center' | 'right'): string {
  if (text.length >= width) {
    return text.slice(0, width - 1) + '…';
  }

  const padding = width - text.length;
  if (align === 'right') {
    return ' '.repeat(padding) + text;
  }
  if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }
  return text + ' '.repeat(padding);
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  selectedIndex,
  showHeader = true,
  showBorder = false,
  striped = false,
  width,
  maxHeight,
  emptyMessage = 'No data',
  theme = defaultTheme,
}: TableProps<T>): JSX.Element {
  // Calculate column widths
  const totalWidth = width ?? columns.reduce((sum, col) => sum + (col.width ?? 10), 0);
  const columnWidths = columns.map((col) => col.width ?? Math.floor(totalWidth / columns.length));

  if (data.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color={theme.muted}>{emptyMessage}</Text>
      </Box>
    );
  }

  // Apply maxHeight by slicing data if needed
  const visibleData = maxHeight && maxHeight > 0 && data.length > maxHeight - (showHeader ? 2 : 0)
    ? data.slice(0, maxHeight - (showHeader ? 2 : 0))
    : data;

  return (
    <Box flexDirection="column" width={totalWidth}>
      {/* Header */}
      {showHeader && (
        <Box
          borderStyle={showBorder ? 'single' : undefined}
          borderBottom={!showBorder}
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor={theme.border}
        >
          {columns.map((col, i) => (
            <Box key={String(col.key)} width={columnWidths[i]}>
              <Text color={theme.muted} bold>
                {alignText(col.header, columnWidths[i] ?? 10, col.align ?? 'left')}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Rows */}
      {visibleData.map((row, rowIndex) => {
        const isSelected = selectedIndex === rowIndex;
        const isStriped = striped && rowIndex % 2 === 1;

        return (
          <Box
            key={rowIndex}
            backgroundColor={
              isSelected
                ? theme.selection
                : isStriped
                ? theme.secondary
                : undefined
            }
          >
            {columns.map((col, colIndex) => {
              const value = getColumnValue(row, col.key);
              const content = col.render
                ? col.render(value, row, rowIndex)
                : formatValue(value);

              return (
                <Box key={String(col.key)} width={columnWidths[colIndex]}>
                  {typeof content === 'string' ? (
                    <Text
                      color={isSelected ? theme.primary : theme.text}
                      bold={isSelected}
                    >
                      {alignText(content, columnWidths[colIndex] ?? 10, col.align ?? 'left')}
                    </Text>
                  ) : (
                    content
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}

      {/* Show truncation indicator */}
      {maxHeight && data.length > visibleData.length && (
        <Box paddingX={1}>
          <Text color={theme.muted}>
            ... and {data.length - visibleData.length} more rows
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface SimpleTableProps {
  headers: string[];
  rows: string[][];
  selectedRow?: number;
  columnWidths?: number[];
  theme?: Theme;
}

export function SimpleTable({
  headers,
  rows,
  selectedRow,
  columnWidths,
  theme = defaultTheme,
}: SimpleTableProps): JSX.Element {
  const widths = columnWidths ?? headers.map(() => 15);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor={theme.border}>
        {headers.map((header, i) => (
          <Box key={i} width={widths[i]}>
            <Text color={theme.muted} bold>
              {header}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {rows.map((row, rowIndex) => (
        <Box
          key={rowIndex}
          backgroundColor={selectedRow === rowIndex ? theme.selection : undefined}
        >
          {row.map((cell, cellIndex) => (
            <Box key={cellIndex} width={widths[cellIndex]}>
              <Text
                color={selectedRow === rowIndex ? theme.primary : theme.text}
                bold={selectedRow === rowIndex}
              >
                {cell}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
