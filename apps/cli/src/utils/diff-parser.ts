/**
 * Parse a unified diff string into individual file diffs
 */
export interface ParsedFileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff: string;
}

export function parseMultiFileDiff(diffContent: string): ParsedFileDiff[] {
  const files: ParsedFileDiff[] = [];
  const lines = diffContent.split('\n');

  let currentFile: ParsedFileDiff | null = null;
  let currentDiff: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Start of a new file diff
    if (line.startsWith('diff --git')) {
      // Save previous file if exists
      if (currentFile && currentDiff.length > 0) {
        files.push({
          ...currentFile,
          diff: currentDiff.join('\n'),
        });
      }

      // Parse file paths from "diff --git a/path b/path"
      const match = line.match(/diff --git a\/(.+?) b\/(.+?)$/);
      if (match) {
        const oldPath = match[1];
        const newPath = match[2];

        currentFile = {
          path: newPath ?? '',
          oldPath: oldPath !== newPath ? oldPath : undefined,
          status: 'modified',
          diff: '',
        };
        currentDiff = [line];
      }
    }
    // Detect file status
    else if (line.startsWith('new file mode')) {
      if (currentFile) {
        currentFile.status = 'added';
      }
      currentDiff.push(line);
    }
    else if (line.startsWith('deleted file mode')) {
      if (currentFile) {
        currentFile.status = 'deleted';
      }
      currentDiff.push(line);
    }
    else if (line.startsWith('rename from')) {
      if (currentFile) {
        currentFile.status = 'renamed';
      }
      currentDiff.push(line);
    }
    // Add line to current file's diff
    else {
      currentDiff.push(line);
    }
  }

  // Don't forget the last file
  if (currentFile && currentDiff.length > 0) {
    files.push({
      ...currentFile,
      diff: currentDiff.join('\n'),
    });
  }

  return files;
}

/**
 * Find a file diff by path
 */
export function findFileDiff(parsedDiffs: ParsedFileDiff[], path: string): ParsedFileDiff | undefined {
  return parsedDiffs.find(f => f.path === path);
}
