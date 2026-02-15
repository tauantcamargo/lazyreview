import { z } from 'zod'

/**
 * Schema for a single blame entry representing one line's authorship info.
 */
export const BlameInfoSchema = z.object({
  line: z.number().int().positive(),
  author: z.string().min(1),
  date: z.string().min(1),
  commitSha: z.string().min(1),
  commitMessage: z.string(),
})

export type BlameInfo = z.infer<typeof BlameInfoSchema>

/**
 * Schema for validating an array of blame entries.
 */
export const BlameInfoArraySchema = z.array(BlameInfoSchema)

/**
 * Abbreviate an author name to fit within the gutter width.
 * Truncates to maxLen characters, appending no ellipsis to save space.
 */
export function abbreviateAuthor(author: string, maxLen: number = 8): string {
  if (author.length <= maxLen) return author
  return author.slice(0, maxLen)
}

/**
 * Format a date string into a compact relative time for the blame gutter.
 * Examples: "3d", "2mo", "1y", "5h", "now"
 */
export function formatBlameDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '?'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()

    if (diffMs < 0) return 'now'

    const seconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) return `${years}y`
    if (months > 0) return `${months}mo`
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return 'now'
  } catch {
    return '?'
  }
}
