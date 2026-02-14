import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { ThemeColors } from './types'

/**
 * A user-defined theme loaded from a YAML file.
 */
export interface CustomThemeFile {
  readonly name: string
  readonly extends?: string
  readonly colors: Partial<ThemeColors>
}

/**
 * Result of validating theme color values.
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

/**
 * Result of parsing a single YAML theme file.
 */
export interface ParseResult {
  readonly valid: boolean
  readonly theme?: CustomThemeFile
  readonly errors: readonly string[]
}

/**
 * Result of loading all custom themes from a directory.
 */
export interface LoadResult {
  readonly themes: readonly CustomThemeFile[]
  readonly errors: readonly string[]
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const VALID_COLOR_KEYS: ReadonlySet<string> = new Set<keyof ThemeColors>([
  'bg',
  'text',
  'accent',
  'muted',
  'border',
  'primary',
  'secondary',
  'success',
  'error',
  'warning',
  'info',
  'diffAdd',
  'diffDel',
  'diffAddHighlight',
  'diffDelHighlight',
  'selection',
  'listSelectedFg',
  'listSelectedBg',
])

/**
 * Validate that an unknown value is a valid partial ThemeColors object.
 * Each key must be a known ThemeColors property and each value must be a valid hex color.
 */
export function validateThemeColors(colors: unknown): ValidationResult {
  if (colors === null || colors === undefined || typeof colors !== 'object') {
    return { valid: false, errors: ['colors must be an object'] }
  }

  const errors: string[] = []
  const entries = Object.entries(colors as Record<string, unknown>)

  for (const [key, value] of entries) {
    if (!VALID_COLOR_KEYS.has(key)) {
      errors.push(`Unknown color key "${key}". Valid keys: ${[...VALID_COLOR_KEYS].join(', ')}`)
      continue
    }

    if (typeof value !== 'string' || !HEX_COLOR_REGEX.test(value)) {
      errors.push(
        `Invalid color for "${key}": "${String(value)}". Must be a hex color (e.g. #ff0000 or #f00)`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Parse the raw YAML content of a theme file into a CustomThemeFile.
 * Returns validation errors if the content is invalid.
 */
export function parseCustomThemeFile(content: string, filename: string): ParseResult {
  let parsed: unknown
  try {
    parsed = parse(content, { maxAliasCount: 10 })
  } catch {
    return {
      valid: false,
      errors: [`Failed to parse YAML in "${filename}": invalid syntax`],
    }
  }

  if (parsed === null || parsed === undefined || typeof parsed !== 'object') {
    return {
      valid: false,
      errors: [`"${filename}" must contain a YAML object with name and colors`],
    }
  }

  const record = parsed as Record<string, unknown>
  const errors: string[] = []

  // Validate name
  if (typeof record['name'] !== 'string' || record['name'].trim() === '') {
    errors.push(`"${filename}" is missing required "name" field (must be a non-empty string)`)
  }

  // Validate extends (optional, but must be string if present)
  if (record['extends'] !== undefined && typeof record['extends'] !== 'string') {
    errors.push(`"${filename}" has invalid "extends" field (must be a string theme name)`)
  }

  // Validate colors
  if (record['colors'] === undefined || record['colors'] === null) {
    errors.push(`"${filename}" is missing required "colors" field`)
  } else {
    const colorValidation = validateThemeColors(record['colors'])
    if (!colorValidation.valid) {
      errors.push(...colorValidation.errors.map((e) => `${filename}: ${e}`))
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const theme: CustomThemeFile = {
    name: (record['name'] as string).trim(),
    ...(typeof record['extends'] === 'string' ? { extends: record['extends'] } : {}),
    colors: record['colors'] as Partial<ThemeColors>,
  }

  return { valid: true, theme, errors: [] }
}

/**
 * Resolve a custom theme's final ThemeColors by merging with the base theme.
 *
 * Resolution order:
 * 1. If `extends` is set, use the named built-in theme as base
 * 2. If the base is unknown, fall back to tokyo-night
 * 3. If no `extends`, use tokyo-night as the base for any missing colors
 * 4. Override base colors with custom colors
 */
export function resolveTheme(
  custom: CustomThemeFile,
  builtInThemes: Record<string, ThemeColors>,
): ThemeColors {
  const fallback = builtInThemes['tokyo-night']!

  const base: ThemeColors = custom.extends
    ? builtInThemes[custom.extends] ?? fallback
    : fallback

  return { ...base, ...custom.colors } as ThemeColors
}

/**
 * Load all custom theme files from a directory.
 * Only reads `.yaml` and `.yml` files. Invalid files are reported as errors
 * but do not prevent valid themes from loading.
 *
 * If the directory does not exist, returns an empty result.
 */
export async function loadCustomThemes(themesDir: string): Promise<LoadResult> {
  let entries: readonly { name: string; isFile: () => boolean }[]
  try {
    entries = await readdir(themesDir, { withFileTypes: true })
  } catch {
    return { themes: [], errors: [] }
  }

  const yamlFiles = entries.filter(
    (entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name),
  )

  const themes: CustomThemeFile[] = []
  const errors: string[] = []
  const seenNames = new Map<string, number>()

  for (const file of yamlFiles) {
    const filePath = join(themesDir, file.name)
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch (err) {
      errors.push(`Failed to read "${file.name}": ${String(err)}`)
      continue
    }

    const result = parseCustomThemeFile(content, file.name)
    if (!result.valid || !result.theme) {
      errors.push(...result.errors)
      continue
    }

    // Deduplicate by name (last one wins)
    const existingIndex = seenNames.get(result.theme.name)
    if (existingIndex !== undefined) {
      themes[existingIndex] = result.theme
    } else {
      seenNames.set(result.theme.name, themes.length)
      themes.push(result.theme)
    }
  }

  return { themes, errors }
}
