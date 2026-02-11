import { execFile } from 'node:child_process'
import { platform } from 'node:os'

export function openInBrowser(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false
    }
  } catch {
    return false
  }

  const os = platform()
  if (os === 'darwin') {
    execFile('open', [url])
  } else if (os === 'win32') {
    execFile('cmd', ['/c', 'start', '', url])
  } else {
    execFile('xdg-open', [url])
  }

  return true
}

export function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text
  if (maxWidth <= 3) return text.slice(0, maxWidth)
  return text.slice(0, maxWidth - 1) + '\u2026'
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) return text
  return text + ' '.repeat(width - text.length)
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}
