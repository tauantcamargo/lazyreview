import { formatDistanceToNow, parseISO, format } from 'date-fns'

export function timeAgo(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return dateString
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'MMM d, yyyy')
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'MMM d, yyyy h:mm a')
  } catch {
    return dateString
  }
}
