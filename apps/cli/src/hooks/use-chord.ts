import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChordDefinition {
  sequence: string[];
  action: () => void;
  description?: string;
}

export interface UseChordOptions {
  chords: ChordDefinition[];
  timeout?: number;
  enabled?: boolean;
  onChordStart?: (key: string) => void;
  onChordComplete?: (sequence: string[]) => void;
  onChordCancel?: () => void;
}

export interface UseChordResult {
  handleKey: (key: string) => boolean;
  pendingChord: string[];
  isChordActive: boolean;
  reset: () => void;
}

const DEFAULT_TIMEOUT = 500;

export function useChord(options: UseChordOptions): UseChordResult {
  const { chords, timeout = DEFAULT_TIMEOUT, enabled = true, onChordStart, onChordComplete, onChordCancel } = options;

  const [pendingChord, setPendingChord] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chordsRef = useRef(chords);

  // Keep chords ref current
  useEffect(() => {
    chordsRef.current = chords;
  }, [chords]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingChord([]);
    onChordCancel?.();
  }, [onChordCancel]);

  const handleKey = useCallback(
    (key: string): boolean => {
      if (!enabled) return false;

      const newPending = [...pendingChord, key];

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Check for exact match
      const exactMatch = chordsRef.current.find(
        (chord) =>
          chord.sequence.length === newPending.length &&
          chord.sequence.every((k, i) => k === newPending[i])
      );

      if (exactMatch) {
        setPendingChord([]);
        onChordComplete?.(newPending);
        exactMatch.action();
        return true;
      }

      // Check if this could be a prefix of any chord
      const isPotentialPrefix = chordsRef.current.some(
        (chord) =>
          chord.sequence.length > newPending.length &&
          chord.sequence.slice(0, newPending.length).every((k, i) => k === newPending[i])
      );

      if (isPotentialPrefix) {
        if (pendingChord.length === 0) {
          onChordStart?.(key);
        }
        setPendingChord(newPending);

        // Set timeout to cancel chord
        timeoutRef.current = setTimeout(() => {
          setPendingChord([]);
          onChordCancel?.();
          timeoutRef.current = null;
        }, timeout);

        return true; // Consume the key
      }

      // Not a match or prefix - reset
      if (pendingChord.length > 0) {
        setPendingChord([]);
        onChordCancel?.();
      }

      return false;
    },
    [enabled, pendingChord, timeout, onChordStart, onChordComplete, onChordCancel]
  );

  return {
    handleKey,
    pendingChord,
    isChordActive: pendingChord.length > 0,
    reset,
  };
}

// Default vim chords for LazyReview
export function createDefaultChords(actions: {
  goToTop?: () => void;
  generalComment?: () => void;
  refresh?: () => void;
  gitStatus?: () => void;
  gitFetch?: () => void;
  previousFile?: () => void;
  nextFile?: () => void;
}): ChordDefinition[] {
  const chords: ChordDefinition[] = [];

  if (actions.goToTop) {
    chords.push({
      sequence: ['g', 'g'],
      action: actions.goToTop,
      description: 'Go to top',
    });
  }

  if (actions.generalComment) {
    chords.push({
      sequence: ['g', 'c'],
      action: actions.generalComment,
      description: 'General comment',
    });
  }

  if (actions.refresh) {
    chords.push({
      sequence: ['g', 'r'],
      action: actions.refresh,
      description: 'Refresh',
    });
  }

  if (actions.gitStatus) {
    chords.push({
      sequence: ['g', 's'],
      action: actions.gitStatus,
      description: 'Git status',
    });
  }

  if (actions.gitFetch) {
    chords.push({
      sequence: ['g', 'f'],
      action: actions.gitFetch,
      description: 'Git fetch',
    });
  }

  if (actions.previousFile) {
    chords.push({
      sequence: ['[', 'c'],
      action: actions.previousFile,
      description: 'Previous file with changes',
    });
  }

  if (actions.nextFile) {
    chords.push({
      sequence: [']', 'c'],
      action: actions.nextFile,
      description: 'Next file with changes',
    });
  }

  return chords;
}
