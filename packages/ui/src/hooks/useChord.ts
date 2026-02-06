import { useState, useEffect, useCallback, useRef } from 'react';

export type ChordDefinition = {
  keys: string;
  action: () => void;
  description?: string;
};

export type ChordState = {
  buffer: string;
  isActive: boolean;
  pendingChords: string[];
};

export type UseChordOptions = {
  timeout?: number;
  chords: ChordDefinition[];
  onChordStart?: (buffer: string, pending: string[]) => void;
  onChordComplete?: (chord: string) => void;
  onChordCancel?: () => void;
};

export type UseChordResult = {
  handleInput: (input: string) => boolean;
  state: ChordState;
  reset: () => void;
};

export function useChord({
  timeout = 500,
  chords,
  onChordStart,
  onChordComplete,
  onChordCancel,
}: UseChordOptions): UseChordResult {
  const [buffer, setBuffer] = useState('');
  const [pendingChords, setPendingChords] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setBuffer('');
    setPendingChords([]);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleInput = useCallback(
    (input: string): boolean => {
      const newBuffer = buffer + input;

      // Find exact match
      const exactMatch = chords.find((c) => c.keys === newBuffer);
      if (exactMatch) {
        reset();
        exactMatch.action();
        onChordComplete?.(newBuffer);
        return true;
      }

      // Find partial matches
      const partialMatches = chords.filter((c) => c.keys.startsWith(newBuffer));
      if (partialMatches.length > 0) {
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        setBuffer(newBuffer);
        const pending = partialMatches.map((c) => c.keys);
        setPendingChords(pending);
        onChordStart?.(newBuffer, pending);

        // Set new timeout
        timeoutRef.current = setTimeout(() => {
          reset();
          onChordCancel?.();
        }, timeout);

        return true;
      }

      // No match - if we had a buffer, cancel and let the input through
      if (buffer.length > 0) {
        reset();
        onChordCancel?.();
      }

      return false;
    },
    [buffer, chords, timeout, reset, onChordStart, onChordComplete, onChordCancel]
  );

  return {
    handleInput,
    state: {
      buffer,
      isActive: buffer.length > 0,
      pendingChords,
    },
    reset,
  };
}

// Common chord definitions
export const defaultChords: ChordDefinition[] = [
  { keys: 'gg', action: () => {}, description: 'Go to top' },
  { keys: 'gc', action: () => {}, description: 'General comment' },
  { keys: 'gr', action: () => {}, description: 'Refresh' },
  { keys: 'gd', action: () => {}, description: 'Go to diff' },
  { keys: 'gf', action: () => {}, description: 'Go to files' },
  { keys: 'gt', action: () => {}, description: 'Go to timeline' },
];
