import { describe, it, expect } from 'vitest'
import { themes, defaultTheme } from './themes'
import type { ThemeName, ThemeColors } from './types'

describe('themes', () => {
  const allThemeNames: readonly ThemeName[] = [
    'tokyo-night',
    'dracula',
    'catppuccin-mocha',
    'gruvbox',
    'high-contrast',
    'github-light',
  ]

  it('exports all expected themes', () => {
    for (const name of allThemeNames) {
      expect(themes[name]).toBeDefined()
      expect(themes[name].name).toBe(name)
    }
  })

  it('has exactly 6 themes', () => {
    expect(Object.keys(themes)).toHaveLength(6)
  })

  it('sets tokyo-night as default theme', () => {
    expect(defaultTheme.name).toBe('tokyo-night')
  })

  it('every theme has all required color properties', () => {
    const requiredKeys: readonly (keyof ThemeColors)[] = [
      'bg', 'text', 'accent', 'muted', 'border', 'primary', 'secondary',
      'success', 'error', 'warning', 'info',
      'diffAdd', 'diffDel',
      'selection', 'listSelectedFg', 'listSelectedBg',
    ]

    for (const name of allThemeNames) {
      const theme = themes[name]
      for (const key of requiredKeys) {
        expect(theme.colors[key], `${name} missing ${key}`).toBeDefined()
        expect(typeof theme.colors[key], `${name}.${key} should be string`).toBe('string')
      }
    }
  })

  describe('high-contrast theme accessibility', () => {
    it('uses blue for diff additions (not green)', () => {
      expect(themes['high-contrast'].colors.diffAdd).toBe('#58a6ff')
    })

    it('uses orange for diff deletions (not red)', () => {
      expect(themes['high-contrast'].colors.diffDel).toBe('#d29922')
    })

    it('does not use pure green (#00ff00) for diff additions', () => {
      expect(themes['high-contrast'].colors.diffAdd).not.toBe('#00ff00')
    })

    it('does not use pure red (#ff0000) for diff deletions', () => {
      expect(themes['high-contrast'].colors.diffDel).not.toBe('#ff0000')
    })
  })

  describe('github-light theme', () => {
    it('has a light background', () => {
      expect(themes['github-light'].colors.bg).toBe('#ffffff')
    })

    it('has dark text', () => {
      expect(themes['github-light'].colors.text).toBe('#1f2328')
    })

    it('has correct accent color', () => {
      expect(themes['github-light'].colors.accent).toBe('#0969da')
    })

    it('has appropriate diff colors', () => {
      expect(themes['github-light'].colors.diffAdd).toBe('#1a7f37')
      expect(themes['github-light'].colors.diffDel).toBe('#cf222e')
    })

    it('has light selection background', () => {
      expect(themes['github-light'].colors.selection).toBe('#ddf4ff')
      expect(themes['github-light'].colors.listSelectedBg).toBe('#ddf4ff')
    })
  })
})
