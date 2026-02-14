import { describe, it, expect } from 'vitest'
import {
  parseConflictMarkers,
  buildThreeWayView,
  countConflicts,
  type ConflictRegion,
  type ThreeWayChunk,
} from './three-way-diff'

describe('parseConflictMarkers', () => {
  it('parses a simple two-way conflict', () => {
    const content = [
      'line before',
      '<<<<<<< HEAD',
      'our change',
      '=======',
      'their change',
      '>>>>>>> feature-branch',
      'line after',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.ours).toEqual(['our change'])
    expect(regions[0]!.theirs).toEqual(['their change'])
    expect(regions[0]!.base).toEqual([])
    expect(regions[0]!.startLine).toBe(1)
    expect(regions[0]!.endLine).toBe(5)
  })

  it('parses a three-way conflict with base marker', () => {
    const content = [
      'line before',
      '<<<<<<< HEAD',
      'our change',
      '||||||| merged common ancestors',
      'original line',
      '=======',
      'their change',
      '>>>>>>> feature-branch',
      'line after',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.ours).toEqual(['our change'])
    expect(regions[0]!.base).toEqual(['original line'])
    expect(regions[0]!.theirs).toEqual(['their change'])
    expect(regions[0]!.startLine).toBe(1)
    expect(regions[0]!.endLine).toBe(7)
  })

  it('parses multiple conflicts in one file', () => {
    const content = [
      'first line',
      '<<<<<<< HEAD',
      'ours 1',
      '=======',
      'theirs 1',
      '>>>>>>> branch',
      'middle line',
      '<<<<<<< HEAD',
      'ours 2',
      '=======',
      'theirs 2',
      '>>>>>>> branch',
      'last line',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(2)
    expect(regions[0]!.ours).toEqual(['ours 1'])
    expect(regions[0]!.theirs).toEqual(['theirs 1'])
    expect(regions[1]!.ours).toEqual(['ours 2'])
    expect(regions[1]!.theirs).toEqual(['theirs 2'])
  })

  it('handles adjacent conflicts (no lines between them)', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours A',
      '=======',
      'theirs A',
      '>>>>>>> branch',
      '<<<<<<< HEAD',
      'ours B',
      '=======',
      'theirs B',
      '>>>>>>> branch',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(2)
    expect(regions[0]!.ours).toEqual(['ours A'])
    expect(regions[0]!.theirs).toEqual(['theirs A'])
    expect(regions[1]!.ours).toEqual(['ours B'])
    expect(regions[1]!.theirs).toEqual(['theirs B'])
  })

  it('returns empty array for a file with no conflicts', () => {
    const content = 'just a regular\nfile with\nno conflicts\n'
    const regions = parseConflictMarkers(content)
    expect(regions).toEqual([])
  })

  it('handles empty file', () => {
    const regions = parseConflictMarkers('')
    expect(regions).toEqual([])
  })

  it('handles multi-line conflict sections', () => {
    const content = [
      '<<<<<<< HEAD',
      'our line 1',
      'our line 2',
      'our line 3',
      '||||||| base',
      'base line 1',
      'base line 2',
      '=======',
      'their line 1',
      'their line 2',
      '>>>>>>> branch',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.ours).toEqual(['our line 1', 'our line 2', 'our line 3'])
    expect(regions[0]!.base).toEqual(['base line 1', 'base line 2'])
    expect(regions[0]!.theirs).toEqual(['their line 1', 'their line 2'])
  })

  it('handles conflict at start of file', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'rest of file',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.startLine).toBe(0)
  })

  it('handles conflict at end of file', () => {
    const content = [
      'start of file',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.endLine).toBe(5)
  })

  it('handles empty ours section', () => {
    const content = [
      '<<<<<<< HEAD',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.ours).toEqual([])
    expect(regions[0]!.theirs).toEqual(['theirs'])
  })

  it('handles empty theirs section', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours',
      '=======',
      '>>>>>>> branch',
    ].join('\n')

    const regions = parseConflictMarkers(content)
    expect(regions).toHaveLength(1)
    expect(regions[0]!.ours).toEqual(['ours'])
    expect(regions[0]!.theirs).toEqual([])
  })
})

describe('buildThreeWayView', () => {
  it('returns a single common chunk for content with no conflicts', () => {
    const content = 'line 1\nline 2\nline 3'
    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.type).toBe('common')
    if (chunks[0]!.type === 'common') {
      expect(chunks[0]!.lines).toEqual(['line 1', 'line 2', 'line 3'])
    }
  })

  it('builds common + conflict + common chunks for a single conflict', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'after',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(3)

    expect(chunks[0]!.type).toBe('common')
    if (chunks[0]!.type === 'common') {
      expect(chunks[0]!.lines).toEqual(['before'])
    }

    expect(chunks[1]!.type).toBe('conflict')
    if (chunks[1]!.type === 'conflict') {
      expect(chunks[1]!.region.ours).toEqual(['ours'])
      expect(chunks[1]!.region.theirs).toEqual(['theirs'])
    }

    expect(chunks[2]!.type).toBe('common')
    if (chunks[2]!.type === 'common') {
      expect(chunks[2]!.lines).toEqual(['after'])
    }
  })

  it('handles multiple conflicts with content between them', () => {
    const content = [
      'top',
      '<<<<<<< HEAD',
      'ours 1',
      '=======',
      'theirs 1',
      '>>>>>>> branch',
      'middle',
      '<<<<<<< HEAD',
      'ours 2',
      '=======',
      'theirs 2',
      '>>>>>>> branch',
      'bottom',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(5)
    expect(chunks[0]!.type).toBe('common')
    expect(chunks[1]!.type).toBe('conflict')
    expect(chunks[2]!.type).toBe('common')
    expect(chunks[3]!.type).toBe('conflict')
    expect(chunks[4]!.type).toBe('common')
  })

  it('handles conflict at start of file (no leading common chunk)', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
      'after',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.type).toBe('conflict')
    expect(chunks[1]!.type).toBe('common')
  })

  it('handles conflict at end of file (no trailing common chunk)', () => {
    const content = [
      'before',
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.type).toBe('common')
    expect(chunks[1]!.type).toBe('conflict')
  })

  it('handles entire file being one conflict', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.type).toBe('conflict')
  })

  it('handles empty file', () => {
    const chunks = buildThreeWayView('')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.type).toBe('common')
    if (chunks[0]!.type === 'common') {
      expect(chunks[0]!.lines).toEqual([''])
    }
  })

  it('includes three-way base info in conflict chunks', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours',
      '||||||| base',
      'original',
      '=======',
      'theirs',
      '>>>>>>> branch',
    ].join('\n')

    const chunks = buildThreeWayView(content)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.type).toBe('conflict')
    if (chunks[0]!.type === 'conflict') {
      expect(chunks[0]!.region.base).toEqual(['original'])
    }
  })
})

describe('countConflicts', () => {
  it('returns 0 for empty chunks array', () => {
    expect(countConflicts([])).toBe(0)
  })

  it('returns 0 when no conflict chunks exist', () => {
    const chunks: ThreeWayChunk[] = [
      { type: 'common', lines: ['line 1', 'line 2'] },
    ]
    expect(countConflicts(chunks)).toBe(0)
  })

  it('returns 1 for a single conflict', () => {
    const chunks: ThreeWayChunk[] = [
      { type: 'common', lines: ['before'] },
      {
        type: 'conflict',
        region: { ours: ['a'], base: [], theirs: ['b'], startLine: 1, endLine: 5 },
      },
      { type: 'common', lines: ['after'] },
    ]
    expect(countConflicts(chunks)).toBe(1)
  })

  it('returns correct count for multiple conflicts', () => {
    const chunks: ThreeWayChunk[] = [
      { type: 'common', lines: ['before'] },
      {
        type: 'conflict',
        region: { ours: ['a'], base: [], theirs: ['b'], startLine: 1, endLine: 5 },
      },
      { type: 'common', lines: ['mid'] },
      {
        type: 'conflict',
        region: { ours: ['c'], base: [], theirs: ['d'], startLine: 7, endLine: 11 },
      },
      {
        type: 'conflict',
        region: { ours: ['e'], base: [], theirs: ['f'], startLine: 12, endLine: 16 },
      },
    ]
    expect(countConflicts(chunks)).toBe(3)
  })
})
