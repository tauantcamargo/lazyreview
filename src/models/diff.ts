export interface DiffLine {
  readonly type: 'add' | 'del' | 'context' | 'header'
  readonly content: string
  readonly oldLineNumber?: number
  readonly newLineNumber?: number
}

export interface Hunk {
  readonly header: string
  readonly oldStart: number
  readonly oldCount: number
  readonly newStart: number
  readonly newCount: number
  readonly lines: readonly DiffLine[]
}

export interface FileDiff {
  readonly filename: string
  readonly status: 'added' | 'removed' | 'modified' | 'renamed'
  readonly additions: number
  readonly deletions: number
  readonly hunks: readonly Hunk[]
  readonly previousFilename?: string
}

export interface Diff {
  readonly files: readonly FileDiff[]
  readonly totalAdditions: number
  readonly totalDeletions: number
}

export function parseDiffPatch(patch: string): readonly Hunk[] {
  const hunks: Hunk[] = []
  const lines = patch.split('\n')
  let currentHunk: Hunk | null = null
  let currentLines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    const hunkMatch = line.match(
      /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/,
    )

    if (hunkMatch) {
      if (currentHunk) {
        hunks.push({ ...currentHunk, lines: currentLines })
      }

      oldLine = parseInt(hunkMatch[1]!, 10)
      newLine = parseInt(hunkMatch[3]!, 10)
      currentLines = [{ type: 'header', content: line }]
      currentHunk = {
        header: line,
        oldStart: oldLine,
        oldCount: parseInt(hunkMatch[2] ?? '1', 10),
        newStart: newLine,
        newCount: parseInt(hunkMatch[4] ?? '1', 10),
        lines: [],
      }
      continue
    }

    if (!currentHunk) continue

    if (line.startsWith('+')) {
      currentLines.push({
        type: 'add',
        content: line.slice(1),
        newLineNumber: newLine++,
      })
    } else if (line.startsWith('-')) {
      currentLines.push({
        type: 'del',
        content: line.slice(1),
        oldLineNumber: oldLine++,
      })
    } else if (line.startsWith(' ') || line === '') {
      currentLines.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      })
    }
  }

  if (currentHunk) {
    hunks.push({ ...currentHunk, lines: currentLines })
  }

  return hunks
}
