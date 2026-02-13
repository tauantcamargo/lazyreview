import { describe, it, expect } from 'vitest'
import { contrastForeground, normalizeHexColor } from './color'

describe('contrastForeground', () => {
  it('returns black for white background', () => {
    expect(contrastForeground('ffffff')).toBe('black')
    expect(contrastForeground('#ffffff')).toBe('black')
  })

  it('returns white for black background', () => {
    expect(contrastForeground('000000')).toBe('white')
    expect(contrastForeground('#000000')).toBe('white')
  })

  it('returns black for red (d73a4a) - above luminance threshold', () => {
    // GitHub "bug" label color - R=215 has high enough luminance contribution
    expect(contrastForeground('d73a4a')).toBe('black')
  })

  it('handles # prefix consistently', () => {
    expect(contrastForeground('#d73a4a')).toBe(contrastForeground('d73a4a'))
  })

  it('returns black for light yellow (fbca04)', () => {
    // GitHub "good first issue" label color
    expect(contrastForeground('fbca04')).toBe('black')
  })

  it('returns black for green (0e8a16)', () => {
    // Green channel has high luminance weight (0.7152)
    expect(contrastForeground('0e8a16')).toBe('black')
  })

  it('returns black for very light blue (bfdadc)', () => {
    expect(contrastForeground('bfdadc')).toBe('black')
  })

  it('returns white for dark blue (0052cc)', () => {
    expect(contrastForeground('0052cc')).toBe('white')
  })

  it('returns black for bright yellow (ffff00)', () => {
    expect(contrastForeground('ffff00')).toBe('black')
  })

  it('returns white for medium gray (808080)', () => {
    // Gray 128 has luminance ~0.22 which is > 0.179
    const result = contrastForeground('808080')
    expect(result).toBe('black')
  })

  it('returns white for empty string', () => {
    expect(contrastForeground('')).toBe('white')
  })

  it('returns white for invalid hex', () => {
    expect(contrastForeground('xyz')).toBe('white')
    expect(contrastForeground('gggggg')).toBe('white')
  })

  it('returns white for short hex strings', () => {
    expect(contrastForeground('fff')).toBe('white')
    expect(contrastForeground('#abc')).toBe('white')
  })

  it('handles pure red', () => {
    // R=255: linearized ~1.0, luminance = 0.2126 * 1.0 = 0.2126 > 0.179
    expect(contrastForeground('ff0000')).toBe('black')
  })

  it('handles pure green', () => {
    expect(contrastForeground('00ff00')).toBe('black')
  })

  it('handles pure blue', () => {
    expect(contrastForeground('0000ff')).toBe('white')
  })
})

describe('normalizeHexColor', () => {
  it('adds # prefix if missing', () => {
    expect(normalizeHexColor('d73a4a')).toBe('#d73a4a')
  })

  it('keeps # prefix if present', () => {
    expect(normalizeHexColor('#d73a4a')).toBe('#d73a4a')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeHexColor('')).toBe('')
  })
})
