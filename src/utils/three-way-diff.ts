/**
 * Pure utility for three-way merge conflict parsing and visualization.
 *
 * Parses git conflict markers (<<<<<<<, |||||||, =======, >>>>>>>) into
 * structured conflict regions and builds a view model for three-pane display.
 */

/**
 * A parsed conflict region from git conflict markers.
 *
 * Two-way conflicts have empty base; three-way conflicts (diff3 style)
 * include the common ancestor content in base.
 */
export interface ConflictRegion {
  readonly ours: readonly string[]
  readonly base: readonly string[]
  readonly theirs: readonly string[]
  readonly startLine: number
  readonly endLine: number
}

/**
 * A chunk in the three-way view. Either common (non-conflict) content
 * shared across all three panes, or a conflict region with separate
 * ours/base/theirs content.
 */
export type ThreeWayChunk =
  | { readonly type: 'common'; readonly lines: readonly string[] }
  | { readonly type: 'conflict'; readonly region: ConflictRegion }

// Marker detection patterns
const OURS_MARKER = /^<{7}\s/
const BASE_MARKER = /^\|{7}\s/
const SEPARATOR_MARKER = /^={7}$/
const THEIRS_MARKER = /^>{7}\s/

type ConflictSection = 'ours' | 'base' | 'theirs'

/**
 * Parse git conflict markers from file content into structured regions.
 *
 * Supports both two-way conflicts (<<<<<<< / ======= / >>>>>>>) and
 * three-way diff3 conflicts (<<<<<<< / ||||||| / ======= / >>>>>>>).
 *
 * @param content - The raw file content that may contain conflict markers
 * @returns Array of parsed conflict regions
 */
export function parseConflictMarkers(
  content: string,
): readonly ConflictRegion[] {
  if (!content) return []

  const lines = content.split('\n')
  const regions: ConflictRegion[] = []

  let inConflict = false
  let section: ConflictSection = 'ours'
  let oursLines: string[] = []
  let baseLines: string[] = []
  let theirsLines: string[] = []
  let startLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    if (OURS_MARKER.test(line)) {
      inConflict = true
      section = 'ours'
      oursLines = []
      baseLines = []
      theirsLines = []
      startLine = i
      continue
    }

    if (!inConflict) continue

    if (BASE_MARKER.test(line)) {
      section = 'base'
      continue
    }

    if (SEPARATOR_MARKER.test(line)) {
      section = 'theirs'
      continue
    }

    if (THEIRS_MARKER.test(line)) {
      regions.push({
        ours: oursLines,
        base: baseLines,
        theirs: theirsLines,
        startLine,
        endLine: i,
      })
      inConflict = false
      continue
    }

    switch (section) {
      case 'ours':
        oursLines.push(line)
        break
      case 'base':
        baseLines.push(line)
        break
      case 'theirs':
        theirsLines.push(line)
        break
    }
  }

  return regions
}

/**
 * Build a three-way view from file content by splitting it into
 * common (non-conflict) and conflict chunks.
 *
 * The result is an ordered array of chunks that, when combined,
 * represent the entire file content.
 *
 * @param content - The raw file content
 * @returns Array of common and conflict chunks
 */
export function buildThreeWayView(
  content: string,
): readonly ThreeWayChunk[] {
  const lines = content.split('\n')
  const regions = parseConflictMarkers(content)

  if (regions.length === 0) {
    return [{ type: 'common', lines }]
  }

  const chunks: ThreeWayChunk[] = []
  let currentLine = 0

  for (const region of regions) {
    // Add common lines before this conflict
    if (currentLine < region.startLine) {
      const commonLines = lines.slice(currentLine, region.startLine)
      chunks.push({ type: 'common', lines: commonLines })
    }

    // Add the conflict chunk
    chunks.push({ type: 'conflict', region })

    // Move past the conflict end marker
    currentLine = region.endLine + 1
  }

  // Add any trailing common lines
  if (currentLine < lines.length) {
    const trailingLines = lines.slice(currentLine)
    chunks.push({ type: 'common', lines: trailingLines })
  }

  return chunks
}

/**
 * Count the number of conflict chunks in a three-way view.
 *
 * @param chunks - Array of three-way chunks
 * @returns The number of conflict chunks
 */
export function countConflicts(
  chunks: readonly ThreeWayChunk[],
): number {
  return chunks.filter((chunk) => chunk.type === 'conflict').length
}
