import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDiff,
  useLineSelection,
  parseDiff,
  formatDiffStats,
  getDiffLineColor,
  type FileDiff,
} from './use-diff';

const createMockFileDiff = (): FileDiff => ({
  path: 'src/example.ts',
  status: 'modified',
  additions: 5,
  deletions: 3,
  hunks: [
    {
      oldStart: 1,
      oldCount: 5,
      newStart: 1,
      newCount: 7,
      header: 'function example()',
      lines: [
        { type: 'header', content: '@@ -1,5 +1,7 @@ function example()' },
        { type: 'context', content: 'const a = 1;', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'remove', content: 'const b = 2;', oldLineNumber: 2 },
        { type: 'add', content: 'const b = 3;', newLineNumber: 2 },
        { type: 'add', content: 'const c = 4;', newLineNumber: 3 },
        { type: 'context', content: 'return a + b;', oldLineNumber: 3, newLineNumber: 4 },
      ],
    },
    {
      oldStart: 10,
      oldCount: 3,
      newStart: 12,
      newCount: 4,
      header: 'function other()',
      lines: [
        { type: 'header', content: '@@ -10,3 +12,4 @@ function other()' },
        { type: 'context', content: 'const x = 1;', oldLineNumber: 10, newLineNumber: 12 },
        { type: 'add', content: 'const y = 2;', newLineNumber: 13 },
        { type: 'context', content: 'return x;', oldLineNumber: 11, newLineNumber: 14 },
      ],
    },
  ],
});

describe('useDiff', () => {
  it('initializes with null current file', () => {
    const { result } = renderHook(() => useDiff());

    expect(result.current.currentFile).toBeNull();
    expect(result.current.currentHunk).toBeNull();
    expect(result.current.currentLine).toBeNull();
  });

  it('sets current file', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    expect(result.current.currentFile).toBe(mockFile);
    expect(result.current.currentHunkIndex).toBe(0);
    expect(result.current.currentLineIndex).toBe(0);
  });

  it('navigates to next hunk', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextHunk();
    });

    expect(result.current.currentHunkIndex).toBe(1);
    expect(result.current.currentLineIndex).toBe(0);
  });

  it('navigates to previous hunk', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextHunk();
    });

    act(() => {
      result.current.prevHunk();
    });

    expect(result.current.currentHunkIndex).toBe(0);
  });

  it('navigates to next line', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextLine();
    });

    expect(result.current.currentLineIndex).toBe(1);
  });

  it('navigates to previous line', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextLine();
    });

    act(() => {
      result.current.nextLine();
    });

    act(() => {
      result.current.prevLine();
    });

    expect(result.current.currentLineIndex).toBe(1);
  });

  it('moves to next hunk when reaching end of lines', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    // Navigate to end of first hunk
    for (let i = 0; i < 6; i++) {
      act(() => {
        result.current.nextLine();
      });
    }

    expect(result.current.currentHunkIndex).toBe(1);
    expect(result.current.currentLineIndex).toBe(0);
  });

  it('moves to previous hunk when at start of lines', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextHunk();
    });

    act(() => {
      result.current.prevLine();
    });

    expect(result.current.currentHunkIndex).toBe(0);
    expect(result.current.currentLineIndex).toBe(5); // Last line of first hunk
  });

  it('goes to specific line', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.goToLine(1, 2);
    });

    expect(result.current.currentHunkIndex).toBe(1);
    expect(result.current.currentLineIndex).toBe(2);
  });

  it('returns current hunk and line', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    expect(result.current.currentHunk).toBe(mockFile.hunks[0]);
    expect(result.current.currentLine).toBe(mockFile.hunks[0]?.lines[0]);
  });

  it('returns hunk and line counts', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    expect(result.current.hunkCount).toBe(2);
    expect(result.current.lineCount).toBe(6);
  });

  it('does not go past last hunk', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextHunk();
    });

    act(() => {
      result.current.nextHunk();
    });

    expect(result.current.currentHunkIndex).toBe(1);
  });

  it('does not go before first hunk', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.prevHunk();
    });

    expect(result.current.currentHunkIndex).toBe(0);
  });

  it('resets position when file changes', () => {
    const { result } = renderHook(() => useDiff());
    const mockFile = createMockFileDiff();

    act(() => {
      result.current.setCurrentFile(mockFile);
    });

    act(() => {
      result.current.nextHunk();
    });

    act(() => {
      result.current.nextLine();
    });

    const newFile = { ...mockFile, path: 'other.ts' };

    act(() => {
      result.current.setCurrentFile(newFile);
    });

    expect(result.current.currentHunkIndex).toBe(0);
    expect(result.current.currentLineIndex).toBe(0);
  });
});

describe('useLineSelection', () => {
  it('initializes with empty selection', () => {
    const { result } = renderHook(() => useLineSelection());

    expect(result.current.selectionCount).toBe(0);
    expect(result.current.isSelected(0, 0)).toBe(false);
  });

  it('toggles line selection', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.toggleLine(0, 1);
    });

    expect(result.current.isSelected(0, 1)).toBe(true);
    expect(result.current.selectionCount).toBe(1);

    act(() => {
      result.current.toggleLine(0, 1);
    });

    expect(result.current.isSelected(0, 1)).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it('selects multiple lines', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.toggleLine(0, 1);
    });

    act(() => {
      result.current.toggleLine(0, 2);
    });

    act(() => {
      result.current.toggleLine(1, 0);
    });

    expect(result.current.selectionCount).toBe(3);
    expect(result.current.isSelected(0, 1)).toBe(true);
    expect(result.current.isSelected(0, 2)).toBe(true);
    expect(result.current.isSelected(1, 0)).toBe(true);
  });

  it('selects range of lines', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.selectRange(0, 1, 0, 4);
    });

    expect(result.current.isSelected(0, 1)).toBe(true);
    expect(result.current.isSelected(0, 2)).toBe(true);
    expect(result.current.isSelected(0, 3)).toBe(true);
    expect(result.current.isSelected(0, 4)).toBe(true);
    expect(result.current.selectionCount).toBe(4);
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.toggleLine(0, 1);
    });

    act(() => {
      result.current.toggleLine(0, 2);
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectionCount).toBe(0);
  });
});

describe('parseDiff', () => {
  it('parses simple diff', () => {
    const diffString = `@@ -1,3 +1,4 @@ function test()
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 return a + b;`;

    const result = parseDiff(diffString, 'test.ts');

    expect(result.path).toBe('test.ts');
    expect(result.hunks.length).toBe(1);
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });

  it('parses multiple hunks', () => {
    const diffString = `@@ -1,2 +1,2 @@ first
 line1
-line2
+line2modified
@@ -10,2 +10,3 @@ second
 line10
+newline
 line11`;

    const result = parseDiff(diffString, 'test.ts');

    expect(result.hunks.length).toBe(2);
    expect(result.hunks[0]?.oldStart).toBe(1);
    expect(result.hunks[1]?.oldStart).toBe(10);
  });

  it('detects added file status', () => {
    const diffString = `new file mode 100644
@@ -0,0 +1,3 @@
+line1
+line2
+line3`;

    const result = parseDiff(diffString, 'new.ts');

    expect(result.status).toBe('added');
  });

  it('detects deleted file status', () => {
    const diffString = `deleted file mode 100644
@@ -1,3 +0,0 @@
-line1
-line2
-line3`;

    const result = parseDiff(diffString, 'deleted.ts');

    expect(result.status).toBe('deleted');
  });

  it('detects renamed file status', () => {
    const diffString = `rename from old.ts
rename to new.ts
@@ -1,1 +1,1 @@
 unchanged`;

    const result = parseDiff(diffString, 'new.ts');

    expect(result.status).toBe('renamed');
  });

  it('handles empty diff', () => {
    const result = parseDiff('', 'empty.ts');

    expect(result.hunks.length).toBe(0);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });
});

describe('formatDiffStats', () => {
  it('formats additions and deletions', () => {
    expect(formatDiffStats(5, 3)).toBe('+5 -3');
  });

  it('formats additions only', () => {
    expect(formatDiffStats(5, 0)).toBe('+5');
  });

  it('formats deletions only', () => {
    expect(formatDiffStats(0, 3)).toBe('-3');
  });

  it('formats zero changes', () => {
    expect(formatDiffStats(0, 0)).toBe('0 changes');
  });
});

describe('getDiffLineColor', () => {
  it('returns green for additions', () => {
    expect(getDiffLineColor('add')).toBe('#9ece6a');
  });

  it('returns red for deletions', () => {
    expect(getDiffLineColor('remove')).toBe('#f7768e');
  });

  it('returns blue for headers', () => {
    expect(getDiffLineColor('header')).toBe('#7aa2f7');
  });

  it('returns default for context', () => {
    expect(getDiffLineColor('context')).toBe('#a9b1d6');
  });
});
