import { useState, useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  selected?: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface UseDiffOptions {
  showContext?: boolean;
  contextLines?: number;
  splitView?: boolean;
}

export interface UseDiffResult {
  currentFile: FileDiff | null;
  currentHunkIndex: number;
  currentLineIndex: number;
  setCurrentFile: (file: FileDiff | null) => void;
  nextHunk: () => void;
  prevHunk: () => void;
  nextLine: () => void;
  prevLine: () => void;
  goToLine: (hunkIndex: number, lineIndex: number) => void;
  currentHunk: DiffHunk | null;
  currentLine: DiffLine | null;
  lineCount: number;
  hunkCount: number;
}

/**
 * Hook for navigating diff content
 */
export function useDiff(options: UseDiffOptions = {}): UseDiffResult {
  const [currentFile, setCurrentFile] = useState<FileDiff | null>(null);
  const [currentHunkIndex, setCurrentHunkIndex] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const currentHunk = useMemo(() => {
    if (!currentFile) return null;
    return currentFile.hunks[currentHunkIndex] ?? null;
  }, [currentFile, currentHunkIndex]);

  const currentLine = useMemo(() => {
    if (!currentHunk) return null;
    return currentHunk.lines[currentLineIndex] ?? null;
  }, [currentHunk, currentLineIndex]);

  const hunkCount = currentFile?.hunks.length ?? 0;
  const lineCount = currentHunk?.lines.length ?? 0;

  const nextHunk = useCallback(() => {
    if (!currentFile) return;
    setCurrentHunkIndex((prev) => Math.min(prev + 1, hunkCount - 1));
    setCurrentLineIndex(0);
  }, [currentFile, hunkCount]);

  const prevHunk = useCallback(() => {
    setCurrentHunkIndex((prev) => Math.max(prev - 1, 0));
    setCurrentLineIndex(0);
  }, []);

  const nextLine = useCallback(() => {
    if (!currentHunk) return;

    if (currentLineIndex < lineCount - 1) {
      setCurrentLineIndex((prev) => prev + 1);
    } else if (currentHunkIndex < hunkCount - 1) {
      setCurrentHunkIndex((prev) => prev + 1);
      setCurrentLineIndex(0);
    }
  }, [currentHunk, currentLineIndex, lineCount, currentHunkIndex, hunkCount]);

  const prevLine = useCallback(() => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex((prev) => prev - 1);
    } else if (currentHunkIndex > 0) {
      setCurrentHunkIndex((prev) => prev - 1);
      const prevHunk = currentFile?.hunks[currentHunkIndex - 1];
      if (prevHunk) {
        setCurrentLineIndex(prevHunk.lines.length - 1);
      }
    }
  }, [currentFile, currentHunkIndex, currentLineIndex]);

  const goToLine = useCallback((hunkIndex: number, lineIndex: number) => {
    setCurrentHunkIndex(hunkIndex);
    setCurrentLineIndex(lineIndex);
  }, []);

  const handleSetCurrentFile = useCallback((file: FileDiff | null) => {
    setCurrentFile(file);
    setCurrentHunkIndex(0);
    setCurrentLineIndex(0);
  }, []);

  return {
    currentFile,
    currentHunkIndex,
    currentLineIndex,
    setCurrentFile: handleSetCurrentFile,
    nextHunk,
    prevHunk,
    nextLine,
    prevLine,
    goToLine,
    currentHunk,
    currentLine,
    lineCount,
    hunkCount,
  };
}

export interface UseLineSelectionResult {
  selectedLines: Set<string>;
  toggleLine: (hunkIndex: number, lineIndex: number) => void;
  selectRange: (startHunk: number, startLine: number, endHunk: number, endLine: number) => void;
  clearSelection: () => void;
  isSelected: (hunkIndex: number, lineIndex: number) => boolean;
  selectionCount: number;
}

/**
 * Hook for selecting lines in a diff (for line comments)
 */
export function useLineSelection(): UseLineSelectionResult {
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  const lineKey = (hunkIndex: number, lineIndex: number): string => {
    return `${hunkIndex}:${lineIndex}`;
  };

  const toggleLine = useCallback((hunkIndex: number, lineIndex: number) => {
    setSelectedLines((prev) => {
      const newSet = new Set(prev);
      const key = lineKey(hunkIndex, lineIndex);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const selectRange = useCallback((startHunk: number, startLine: number, endHunk: number, endLine: number) => {
    setSelectedLines((prev) => {
      const newSet = new Set(prev);

      // Simple case: same hunk
      if (startHunk === endHunk) {
        const minLine = Math.min(startLine, endLine);
        const maxLine = Math.max(startLine, endLine);
        for (let i = minLine; i <= maxLine; i++) {
          newSet.add(lineKey(startHunk, i));
        }
      }

      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const isSelected = useCallback((hunkIndex: number, lineIndex: number): boolean => {
    return selectedLines.has(lineKey(hunkIndex, lineIndex));
  }, [selectedLines]);

  return {
    selectedLines,
    toggleLine,
    selectRange,
    clearSelection,
    isSelected,
    selectionCount: selectedLines.size,
  };
}

/**
 * Parse unified diff string into FileDiff
 */
export function parseDiff(diffString: string, path: string): FileDiff {
  const lines = diffString.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let additions = 0;
  let deletions = 0;
  let status: FileDiff['status'] = 'modified';

  for (const line of lines) {
    // Detect file status from diff header
    if (line.startsWith('new file')) {
      status = 'added';
    } else if (line.startsWith('deleted file')) {
      status = 'deleted';
    } else if (line.startsWith('rename from')) {
      status = 'renamed';
    }

    // Parse hunk header
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1] ?? '0', 10);
      newLineNum = parseInt(hunkMatch[3] ?? '0', 10);

      currentHunk = {
        oldStart: oldLineNum,
        oldCount: parseInt(hunkMatch[2] ?? '1', 10),
        newStart: newLineNum,
        newCount: parseInt(hunkMatch[4] ?? '1', 10),
        header: hunkMatch[5]?.trim() ?? '',
        lines: [],
      };

      currentHunk.lines.push({
        type: 'header',
        content: line,
      });

      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({
        type: 'add',
        content: line.slice(1),
        newLineNumber: newLineNum++,
      });
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({
        type: 'remove',
        content: line.slice(1),
        oldLineNumber: oldLineNum++,
      });
      deletions++;
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    path,
    status,
    hunks,
    additions,
    deletions,
  };
}

/**
 * Generate unified diff stats line
 */
export function formatDiffStats(additions: number, deletions: number): string {
  const total = additions + deletions;

  if (total === 0) {
    return '0 changes';
  }

  const parts: string[] = [];

  if (additions > 0) {
    parts.push(`+${additions}`);
  }

  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }

  return parts.join(' ');
}

/**
 * Get color for diff line type
 */
export function getDiffLineColor(type: DiffLine['type']): string {
  return match(type)
    .with('add', () => '#9ece6a')      // green
    .with('remove', () => '#f7768e')   // red
    .with('header', () => '#7aa2f7')   // blue
    .with('context', () => '#a9b1d6')  // default text
    .exhaustive();
}
