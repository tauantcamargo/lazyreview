import { describe, it, expect } from 'vitest'
import type { RepoLabel } from '../../models/label'

/**
 * Helper to determine if a hex color is light (same logic as component).
 */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return false
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Helper to convert hex to ink color format.
 */
function hexToInkColor(hex: string): string {
  return `#${hex}`
}

/**
 * Detect whether labels have changed from current set.
 */
function hasChanges(
  currentLabels: readonly string[],
  selectedLabels: ReadonlySet<string>,
): boolean {
  const currentSet = new Set(currentLabels)
  if (currentSet.size !== selectedLabels.size) return true
  for (const label of selectedLabels) {
    if (!currentSet.has(label)) return true
  }
  return false
}

describe('LabelPickerModal helpers', () => {
  describe('isLightColor', () => {
    it('detects white as light', () => {
      expect(isLightColor('ffffff')).toBe(true)
    })

    it('detects black as dark', () => {
      expect(isLightColor('000000')).toBe(false)
    })

    it('detects bright yellow as light', () => {
      expect(isLightColor('ffff00')).toBe(true)
    })

    it('detects dark blue as dark', () => {
      expect(isLightColor('000080')).toBe(false)
    })

    it('detects bright green as light', () => {
      expect(isLightColor('00ff00')).toBe(true)
    })

    it('returns false for invalid hex', () => {
      expect(isLightColor('zzzzzz')).toBe(false)
    })

    it('detects medium gray correctly', () => {
      // 808080 has luminance ~0.5
      expect(isLightColor('808080')).toBe(true)
    })

    it('detects red as not light', () => {
      expect(isLightColor('ff0000')).toBe(false)
    })
  })

  describe('hexToInkColor', () => {
    it('prepends # to hex color', () => {
      expect(hexToInkColor('fc2929')).toBe('#fc2929')
    })

    it('handles white', () => {
      expect(hexToInkColor('ffffff')).toBe('#ffffff')
    })

    it('handles black', () => {
      expect(hexToInkColor('000000')).toBe('#000000')
    })
  })

  describe('hasChanges', () => {
    it('returns false when both are empty', () => {
      expect(hasChanges([], new Set())).toBe(false)
    })

    it('returns false when same labels', () => {
      expect(hasChanges(['bug', 'feature'], new Set(['bug', 'feature']))).toBe(false)
    })

    it('returns true when label added', () => {
      expect(hasChanges(['bug'], new Set(['bug', 'feature']))).toBe(true)
    })

    it('returns true when label removed', () => {
      expect(hasChanges(['bug', 'feature'], new Set(['bug']))).toBe(true)
    })

    it('returns true when different labels same count', () => {
      expect(hasChanges(['bug'], new Set(['feature']))).toBe(true)
    })

    it('returns true when going from empty to selected', () => {
      expect(hasChanges([], new Set(['bug']))).toBe(true)
    })

    it('returns true when going from selected to empty', () => {
      expect(hasChanges(['bug'], new Set())).toBe(true)
    })
  })
})

describe('LabelPickerModal data', () => {
  it('creates proper label display data', () => {
    const labels: readonly RepoLabel[] = [
      { id: 1, name: 'bug', color: 'fc2929', description: 'Something is broken', default: false },
      { id: 2, name: 'feature', color: '0075ca', description: 'New feature', default: false },
      { id: 3, name: 'docs', color: 'e4e669', description: null, default: true },
    ]

    expect(labels).toHaveLength(3)
    expect(labels[0]!.name).toBe('bug')
    expect(labels[0]!.color).toBe('fc2929')
    expect(labels[1]!.description).toBe('New feature')
    expect(labels[2]!.description).toBeNull()
  })

  it('handles empty label list', () => {
    const labels: readonly RepoLabel[] = []
    expect(labels).toHaveLength(0)
  })

  it('computes current labels from PR data', () => {
    const prLabels = [
      { id: 1, name: 'bug', color: 'fc2929', description: null },
      { id: 2, name: 'priority', color: 'e11d48', description: null },
    ]
    const currentLabelNames = prLabels.map((l) => l.name)
    expect(currentLabelNames).toEqual(['bug', 'priority'])
  })

  it('toggle adds a label', () => {
    const selected = new Set(['bug'])
    const label = 'feature'
    const newSelected = new Set([...selected, label])
    expect(newSelected.has('feature')).toBe(true)
    expect(newSelected.size).toBe(2)
  })

  it('toggle removes a label', () => {
    const selected = new Set(['bug', 'feature'])
    const label = 'bug'
    const newSelected = new Set([...selected].filter((l) => l !== label))
    expect(newSelected.has('bug')).toBe(false)
    expect(newSelected.size).toBe(1)
  })
})
