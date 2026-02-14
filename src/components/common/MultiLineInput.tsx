import React, { useState, useCallback, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import {
  createUndoStack,
  pushState,
  undo as undoStack,
  redo as redoStack,
  canUndo,
  canRedo,
  currentState,
  shouldPushState,
  type UndoStack,
} from '../../utils/undo-stack'

interface MultiLineInputProps {
  readonly placeholder?: string
  readonly defaultValue?: string
  readonly onChange: (value: string) => void
  readonly isActive: boolean
  readonly minHeight?: number
}

export function MultiLineInput({
  placeholder,
  defaultValue,
  onChange,
  isActive,
  minHeight = 3,
}: MultiLineInputProps): React.ReactElement {
  const theme = useTheme()
  const initialLines = defaultValue ? defaultValue.split('\n') : ['']
  const [lines, setLines] = useState<readonly string[]>(initialLines)
  const [cursorRow, setCursorRow] = useState(0)
  const [cursorCol, setCursorCol] = useState(0)
  const [undoState, setUndoState] = useState<UndoStack>(() =>
    createUndoStack({ lines: initialLines, cursorRow: 0, cursorCol: 0 }),
  )
  const lastPushTimeRef = useRef(0)

  const pushUndoSnapshot = useCallback(
    (newLines: readonly string[], newRow: number, newCol: number) => {
      if (shouldPushState(lastPushTimeRef.current)) {
        setUndoState((prev) =>
          pushState(prev, { lines: newLines, cursorRow: newRow, cursorCol: newCol }),
        )
        lastPushTimeRef.current = Date.now()
      } else {
        // Update the present state in-place for batched edits
        setUndoState((prev) => ({
          ...prev,
          present: { lines: newLines, cursorRow: newRow, cursorCol: newCol },
        }))
      }
    },
    [],
  )

  const updateLines = useCallback(
    (newLines: readonly string[], newRow: number, newCol: number) => {
      setLines(newLines)
      setCursorRow(newRow)
      setCursorCol(newCol)
      onChange(newLines.join('\n'))
      pushUndoSnapshot(newLines, newRow, newCol)
    },
    [onChange, pushUndoSnapshot],
  )

  const handleUndo = useCallback(() => {
    setUndoState((prev) => {
      if (!canUndo(prev)) return prev
      const next = undoStack(prev)
      const state = currentState(next)
      setLines(state.lines)
      setCursorRow(state.cursorRow)
      setCursorCol(state.cursorCol)
      onChange(state.lines.join('\n'))
      return next
    })
  }, [onChange])

  const handleRedo = useCallback(() => {
    setUndoState((prev) => {
      if (!canRedo(prev)) return prev
      const next = redoStack(prev)
      const state = currentState(next)
      setLines(state.lines)
      setCursorRow(state.cursorRow)
      setCursorCol(state.cursorCol)
      onChange(state.lines.join('\n'))
      return next
    })
  }, [onChange])

  useInput(
    (input, key) => {
      if (!isActive) return

      // Ctrl+Z: undo
      if (key.ctrl && input === 'z') {
        handleUndo()
        return
      }

      // Ctrl+Y: redo
      if (key.ctrl && input === 'y') {
        handleRedo()
        return
      }

      if (key.tab) {
        // Insert 2 spaces for indentation
        const currentLine = lines[cursorRow] ?? ''
        const before = currentLine.slice(0, cursorCol)
        const after = currentLine.slice(cursorCol)
        const newLine = `${before}  ${after}`
        const newLines = lines.map((l, i) => (i === cursorRow ? newLine : l))
        updateLines(newLines, cursorRow, cursorCol + 2)
        return
      }

      if (key.return && !key.meta && !key.ctrl) {
        // Regular Enter: new line
        const currentLine = lines[cursorRow] ?? ''
        const before = currentLine.slice(0, cursorCol)
        const after = currentLine.slice(cursorCol)
        const newLines = [
          ...lines.slice(0, cursorRow),
          before,
          after,
          ...lines.slice(cursorRow + 1),
        ]
        updateLines(newLines, cursorRow + 1, 0)
        return
      }

      if (key.backspace || key.delete) {
        if (cursorCol > 0) {
          const currentLine = lines[cursorRow] ?? ''
          const newLine = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol)
          const newLines = lines.map((l, i) => (i === cursorRow ? newLine : l))
          updateLines(newLines, cursorRow, cursorCol - 1)
        } else if (cursorRow > 0) {
          // Merge with previous line
          const prevLine = lines[cursorRow - 1] ?? ''
          const currentLine = lines[cursorRow] ?? ''
          const merged = prevLine + currentLine
          const newLines = [
            ...lines.slice(0, cursorRow - 1),
            merged,
            ...lines.slice(cursorRow + 1),
          ]
          updateLines(newLines, cursorRow - 1, prevLine.length)
        }
        return
      }

      if (key.upArrow) {
        if (cursorRow > 0) {
          const newRow = cursorRow - 1
          setCursorRow(newRow)
          setCursorCol(Math.min(cursorCol, (lines[newRow] ?? '').length))
        }
        return
      }

      if (key.downArrow) {
        if (cursorRow < lines.length - 1) {
          const newRow = cursorRow + 1
          setCursorRow(newRow)
          setCursorCol(Math.min(cursorCol, (lines[newRow] ?? '').length))
        }
        return
      }

      if (key.leftArrow) {
        if (cursorCol > 0) {
          setCursorCol(cursorCol - 1)
        } else if (cursorRow > 0) {
          setCursorRow(cursorRow - 1)
          setCursorCol((lines[cursorRow - 1] ?? '').length)
        }
        return
      }

      if (key.rightArrow) {
        const currentLine = lines[cursorRow] ?? ''
        if (cursorCol < currentLine.length) {
          setCursorCol(cursorCol + 1)
        } else if (cursorRow < lines.length - 1) {
          setCursorRow(cursorRow + 1)
          setCursorCol(0)
        }
        return
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const currentLine = lines[cursorRow] ?? ''
        const before = currentLine.slice(0, cursorCol)
        const after = currentLine.slice(cursorCol)
        const newLine = `${before}${input}${after}`
        const newLines = lines.map((l, i) => (i === cursorRow ? newLine : l))
        updateLines(newLines, cursorRow, cursorCol + input.length)
      }
    },
    { isActive },
  )

  const isEmpty = lines.length === 1 && lines[0] === ''
  const displayHeight = Math.max(minHeight, lines.length)

  return (
    <Box flexDirection="column" minHeight={displayHeight}>
      {isEmpty && !isActive && placeholder ? (
        <Text color={theme.colors.muted} dimColor>{placeholder}</Text>
      ) : (
        lines.map((line, rowIndex) => {
          if (rowIndex === cursorRow && isActive) {
            const before = line.slice(0, cursorCol)
            const cursorChar = line[cursorCol] ?? ' '
            const after = line.slice(cursorCol + 1)
            return (
              <Text key={rowIndex} color={theme.colors.text}>
                {before}
                <Text inverse>{cursorChar}</Text>
                {after}
              </Text>
            )
          }
          return (
            <Text key={rowIndex} color={theme.colors.text}>
              {line || ' '}
            </Text>
          )
        })
      )}
    </Box>
  )
}
