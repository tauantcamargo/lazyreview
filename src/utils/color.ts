/**
 * Determine whether black or white text provides better contrast against
 * the given background color, using the WCAG relative luminance formula.
 *
 * Accepts hex colors with or without # prefix (e.g., "d73a4a" or "#d73a4a").
 * Returns 'black' for light backgrounds, 'white' for dark backgrounds.
 * Returns 'white' for invalid/empty color strings.
 */
export function contrastForeground(hexColor: string): 'black' | 'white' {
  const raw = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor
  if (raw.length !== 6) return 'white'

  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)

  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'white'

  // Linearize sRGB channels
  const linearize = (channel: number): number => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }

  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

  return luminance > 0.179 ? 'black' : 'white'
}

/**
 * Normalize a hex color to include the # prefix.
 */
export function normalizeHexColor(color: string): string {
  if (!color) return ''
  return color.startsWith('#') ? color : `#${color}`
}
