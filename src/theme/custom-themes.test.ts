import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveTheme, validateThemeColors, parseCustomThemeFile, loadCustomThemes } from './custom-themes'
import type { CustomThemeFile, ValidationResult } from './custom-themes'
import type { ThemeColors } from './types'
import { themes } from './themes'

describe('validateThemeColors', () => {
  it('accepts valid hex color values', () => {
    const result = validateThemeColors({ bg: '#1a1a2e', text: '#ffffff' })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts valid 3-digit hex color values', () => {
    const result = validateThemeColors({ bg: '#fff', accent: '#abc' })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects invalid hex color values', () => {
    const result = validateThemeColors({ bg: 'not-a-color' })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('bg')
  })

  it('rejects colors missing # prefix', () => {
    const result = validateThemeColors({ bg: 'ffffff' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('bg')
  })

  it('rejects unknown color keys', () => {
    const result = validateThemeColors({ unknownKey: '#ffffff' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('unknownKey')
  })

  it('reports multiple errors', () => {
    const result = validateThemeColors({
      bg: 'invalid',
      text: 'also-invalid',
      unknownProp: '#aaa',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(3)
  })

  it('accepts empty object', () => {
    const result = validateThemeColors({})
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects non-object input', () => {
    const result = validateThemeColors('not-an-object')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('object')
  })

  it('rejects null input', () => {
    const result = validateThemeColors(null)
    expect(result.valid).toBe(false)
  })

  it('accepts all valid ThemeColors keys', () => {
    const allKeys: Record<string, string> = {
      bg: '#000000',
      text: '#111111',
      accent: '#222222',
      muted: '#333333',
      border: '#444444',
      primary: '#555555',
      secondary: '#666666',
      success: '#777777',
      error: '#888888',
      warning: '#999999',
      info: '#aaaaaa',
      diffAdd: '#bbbbbb',
      diffDel: '#cccccc',
      diffAddHighlight: '#dddddd',
      diffDelHighlight: '#eeeeee',
      selection: '#ffffff',
      listSelectedFg: '#112233',
      listSelectedBg: '#445566',
    }
    const result = validateThemeColors(allKeys)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('parseCustomThemeFile', () => {
  it('parses valid YAML theme content', () => {
    const yaml = `
name: my-theme
extends: tokyo-night
colors:
  bg: "#1a1a2e"
  accent: "#ff6b6b"
`
    const result = parseCustomThemeFile(yaml, 'my-theme.yaml')
    expect(result.valid).toBe(true)
    expect(result.theme).toBeDefined()
    expect(result.theme!.name).toBe('my-theme')
    expect(result.theme!.extends).toBe('tokyo-night')
    expect(result.theme!.colors.bg).toBe('#1a1a2e')
    expect(result.theme!.colors.accent).toBe('#ff6b6b')
  })

  it('parses theme without extends', () => {
    const yaml = `
name: standalone-theme
colors:
  bg: "#000000"
  text: "#ffffff"
  accent: "#ff0000"
  muted: "#888888"
  border: "#333333"
  primary: "#ff0000"
  secondary: "#00ff00"
  success: "#00ff00"
  error: "#ff0000"
  warning: "#ffff00"
  info: "#0000ff"
  diffAdd: "#00ff00"
  diffDel: "#ff0000"
  diffAddHighlight: "#003300"
  diffDelHighlight: "#330000"
  selection: "#444444"
  listSelectedFg: "#ffffff"
  listSelectedBg: "#444444"
`
    const result = parseCustomThemeFile(yaml, 'standalone.yaml')
    expect(result.valid).toBe(true)
    expect(result.theme!.extends).toBeUndefined()
  })

  it('rejects theme without name', () => {
    const yaml = `
colors:
  bg: "#1a1a2e"
`
    const result = parseCustomThemeFile(yaml, 'no-name.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('name')
  })

  it('rejects theme without colors', () => {
    const yaml = `
name: no-colors
`
    const result = parseCustomThemeFile(yaml, 'no-colors.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('colors')
  })

  it('rejects invalid YAML syntax', () => {
    const yaml = `
name: broken
colors:
  bg: [invalid yaml
`
    const result = parseCustomThemeFile(yaml, 'broken.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('broken.yaml')
  })

  it('rejects invalid color values in colors', () => {
    const yaml = `
name: bad-colors
extends: tokyo-night
colors:
  bg: "not-a-color"
`
    const result = parseCustomThemeFile(yaml, 'bad-colors.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('bg')
  })

  it('includes filename in parse error messages', () => {
    const yaml = 'not yaml at all: ['
    const result = parseCustomThemeFile(yaml, 'myfile.yml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('myfile.yml')
  })

  it('rejects empty content', () => {
    const result = parseCustomThemeFile('', 'empty.yaml')
    expect(result.valid).toBe(false)
  })

  it('rejects extends referencing non-string value', () => {
    const yaml = `
name: bad-extends
extends: 123
colors:
  bg: "#000"
`
    const result = parseCustomThemeFile(yaml, 'bad-extends.yaml')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('extends')
  })
})

describe('resolveTheme', () => {
  const builtInThemes: Record<string, ThemeColors> = {
    'tokyo-night': themes['tokyo-night'].colors,
    dracula: themes.dracula.colors,
  }

  it('resolves a custom theme that extends a built-in theme', () => {
    const custom: CustomThemeFile = {
      name: 'my-night',
      extends: 'tokyo-night',
      colors: {
        bg: '#1a1a2e',
        accent: '#ff6b6b',
      },
    }

    const resolved = resolveTheme(custom, builtInThemes)
    expect(resolved.bg).toBe('#1a1a2e')
    expect(resolved.accent).toBe('#ff6b6b')
    // Inherited from tokyo-night
    expect(resolved.text).toBe(themes['tokyo-night'].colors.text)
    expect(resolved.muted).toBe(themes['tokyo-night'].colors.muted)
    expect(resolved.success).toBe(themes['tokyo-night'].colors.success)
  })

  it('resolves a standalone theme with all colors provided', () => {
    const fullColors: ThemeColors = {
      bg: '#000000',
      text: '#ffffff',
      accent: '#ff0000',
      muted: '#888888',
      border: '#333333',
      primary: '#ff0000',
      secondary: '#00ff00',
      success: '#00ff00',
      error: '#ff0000',
      warning: '#ffff00',
      info: '#0000ff',
      diffAdd: '#00ff00',
      diffDel: '#ff0000',
      diffAddHighlight: '#003300',
      diffDelHighlight: '#330000',
      selection: '#444444',
      listSelectedFg: '#ffffff',
      listSelectedBg: '#444444',
    }

    const custom: CustomThemeFile = {
      name: 'full-custom',
      colors: fullColors,
    }

    const resolved = resolveTheme(custom, builtInThemes)
    expect(resolved).toEqual(fullColors)
  })

  it('falls back to tokyo-night when extends references unknown theme', () => {
    const custom: CustomThemeFile = {
      name: 'unknown-base',
      extends: 'nonexistent',
      colors: {
        bg: '#111111',
      },
    }

    const resolved = resolveTheme(custom, builtInThemes)
    expect(resolved.bg).toBe('#111111')
    // Should fall back to tokyo-night for the rest
    expect(resolved.text).toBe(themes['tokyo-night'].colors.text)
  })

  it('falls back to tokyo-night for standalone theme with missing colors', () => {
    const custom: CustomThemeFile = {
      name: 'partial',
      colors: {
        bg: '#111111',
        text: '#eeeeee',
      },
    }

    const resolved = resolveTheme(custom, builtInThemes)
    expect(resolved.bg).toBe('#111111')
    expect(resolved.text).toBe('#eeeeee')
    // Remaining colors fall back to tokyo-night
    expect(resolved.accent).toBe(themes['tokyo-night'].colors.accent)
  })

  it('custom colors override all inherited colors', () => {
    const custom: CustomThemeFile = {
      name: 'override-all',
      extends: 'dracula',
      colors: {
        bg: '#000001',
        text: '#000002',
        accent: '#000003',
        muted: '#000004',
        border: '#000005',
        primary: '#000006',
        secondary: '#000007',
        success: '#000008',
        error: '#000009',
        warning: '#00000a',
        info: '#00000b',
        diffAdd: '#00000c',
        diffDel: '#00000d',
        diffAddHighlight: '#00000e',
        diffDelHighlight: '#00000f',
        selection: '#000010',
        listSelectedFg: '#000011',
        listSelectedBg: '#000012',
      },
    }

    const resolved = resolveTheme(custom, builtInThemes)
    expect(resolved.bg).toBe('#000001')
    expect(resolved.text).toBe('#000002')
    expect(resolved.listSelectedBg).toBe('#000012')
  })
})

describe('loadCustomThemes', () => {
  const mockFs = vi.hoisted(() => ({
    readdir: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
  }))

  vi.mock('node:fs/promises', () => mockFs)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when themes directory does not exist', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'))

    const result = await loadCustomThemes('/nonexistent/themes')
    expect(result.themes).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('loads valid YAML files from themes directory', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'my-theme.yaml', isFile: () => true },
      { name: 'other.yml', isFile: () => true },
    ])
    mockFs.readFile.mockImplementation((path: string) => {
      if (path.includes('my-theme.yaml')) {
        return Promise.resolve(`
name: my-theme
extends: tokyo-night
colors:
  bg: "#1a1a2e"
`)
      }
      if (path.includes('other.yml')) {
        return Promise.resolve(`
name: other
extends: dracula
colors:
  accent: "#ff00ff"
`)
      }
      return Promise.reject(new Error('Not found'))
    })

    const result = await loadCustomThemes('/home/user/.config/lazyreview/themes')
    expect(result.themes).toHaveLength(2)
    expect(result.themes[0]!.name).toBe('my-theme')
    expect(result.themes[1]!.name).toBe('other')
    expect(result.errors).toEqual([])
  })

  it('skips non-yaml files', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'readme.md', isFile: () => true },
      { name: 'theme.yaml', isFile: () => true },
      { name: 'backup.bak', isFile: () => true },
    ])
    mockFs.readFile.mockResolvedValue(`
name: theme
extends: tokyo-night
colors:
  bg: "#111111"
`)

    const result = await loadCustomThemes('/themes')
    expect(result.themes).toHaveLength(1)
    expect(result.themes[0]!.name).toBe('theme')
  })

  it('skips directories', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'subdir', isFile: () => false },
      { name: 'valid.yaml', isFile: () => true },
    ])
    mockFs.readFile.mockResolvedValue(`
name: valid
extends: tokyo-night
colors:
  bg: "#222222"
`)

    const result = await loadCustomThemes('/themes')
    expect(result.themes).toHaveLength(1)
  })

  it('collects errors for invalid theme files', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'bad.yaml', isFile: () => true },
      { name: 'good.yaml', isFile: () => true },
    ])
    mockFs.readFile.mockImplementation((path: string) => {
      if (path.includes('bad.yaml')) {
        return Promise.resolve(`
name: bad
colors:
  bg: "not-a-color"
`)
      }
      return Promise.resolve(`
name: good
extends: tokyo-night
colors:
  bg: "#333333"
`)
    })

    const result = await loadCustomThemes('/themes')
    expect(result.themes).toHaveLength(1)
    expect(result.themes[0]!.name).toBe('good')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('bad.yaml')
  })

  it('collects errors for unreadable files', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'unreadable.yaml', isFile: () => true },
    ])
    mockFs.readFile.mockRejectedValue(new Error('Permission denied'))

    const result = await loadCustomThemes('/themes')
    expect(result.themes).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('unreadable.yaml')
  })

  it('deduplicates themes by name (last one wins)', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'theme-a.yaml', isFile: () => true },
      { name: 'theme-b.yaml', isFile: () => true },
    ])
    mockFs.readFile.mockImplementation((path: string) => {
      if (path.includes('theme-a.yaml')) {
        return Promise.resolve(`
name: duplicate
extends: tokyo-night
colors:
  bg: "#aaaaaa"
`)
      }
      return Promise.resolve(`
name: duplicate
extends: dracula
colors:
  bg: "#bbbbbb"
`)
    })

    const result = await loadCustomThemes('/themes')
    expect(result.themes).toHaveLength(1)
    expect(result.themes[0]!.colors.bg).toBe('#bbbbbb')
  })
})
