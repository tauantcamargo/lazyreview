import { useState, useCallback, useRef } from 'react';

export interface UseHistoryOptions<T> {
  initialValue: T;
  maxHistory?: number;
}

export interface UseHistoryResult<T> {
  value: T;
  history: T[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  set: (value: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (value?: T) => void;
  clear: () => void;
}

export function useHistory<T>({
  initialValue,
  maxHistory = 50,
}: UseHistoryOptions<T>): UseHistoryResult<T> {
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const value = history[historyIndex] ?? initialValue;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const set = useCallback(
    (newValue: T) => {
      setHistory((prev) => {
        // Remove any redo history
        const newHistory = prev.slice(0, historyIndex + 1);

        // Add new value
        newHistory.push(newValue);

        // Limit history size
        if (newHistory.length > maxHistory) {
          return newHistory.slice(newHistory.length - maxHistory);
        }

        return newHistory;
      });

      setHistoryIndex((prev) => Math.min(prev + 1, maxHistory - 1));
    },
    [historyIndex, maxHistory]
  );

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1);
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1);
    }
  }, [canRedo]);

  const reset = useCallback(
    (newValue?: T) => {
      const resetValue = newValue ?? initialValue;
      setHistory([resetValue]);
      setHistoryIndex(0);
    },
    [initialValue]
  );

  const clear = useCallback(() => {
    setHistory([value]);
    setHistoryIndex(0);
  }, [value]);

  return {
    value,
    history,
    historyIndex,
    canUndo,
    canRedo,
    set,
    undo,
    redo,
    reset,
    clear,
  };
}

export interface UseUndoableOptions<T> {
  initialValue: T;
  onUndo?: (value: T) => void;
  onRedo?: (value: T) => void;
}

export interface UseUndoableResult<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

export function useUndoable<T>({
  initialValue,
  onUndo,
  onRedo,
}: UseUndoableOptions<T>): UseUndoableResult<T> {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialValue);
  const [future, setFuture] = useState<T[]>([]);

  const setValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setPresent((prev) => {
        const newValue =
          typeof valueOrUpdater === 'function'
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;

        setPast((pastHistory) => [...pastHistory, prev]);
        setFuture([]);

        return newValue;
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    if (previous === undefined) return;

    setPast((pastHistory) => pastHistory.slice(0, -1));
    setFuture((futureHistory) => [present, ...futureHistory]);
    setPresent(previous);
    onUndo?.(previous);
  }, [past, present, onUndo]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    if (next === undefined) return;

    setFuture((futureHistory) => futureHistory.slice(1));
    setPast((pastHistory) => [...pastHistory, present]);
    setPresent(next);
    onRedo?.(next);
  }, [future, present, onRedo]);

  return {
    value: present,
    setValue,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
  };
}

export interface Command {
  execute: () => void;
  undo: () => void;
  description?: string;
}

export interface UseCommandHistoryResult {
  execute: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: Command[];
  redoStack: Command[];
  clear: () => void;
}

export function useCommandHistory(): UseCommandHistoryResult {
  const [history, setHistory] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);

  const execute = useCallback((command: Command) => {
    command.execute();
    setHistory((prev) => [...prev, command]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;

    const command = history[history.length - 1];
    if (!command) return;

    command.undo();
    setHistory((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [command, ...prev]);
  }, [history]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const command = redoStack[0];
    if (!command) return;

    command.execute();
    setRedoStack((prev) => prev.slice(1));
    setHistory((prev) => [...prev, command]);
  }, [redoStack]);

  const clear = useCallback(() => {
    setHistory([]);
    setRedoStack([]);
  }, []);

  return {
    execute,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
    history,
    redoStack,
    clear,
  };
}
