import { execFile } from 'node:child_process'

export interface NotificationOptions {
  readonly title: string
  readonly body: string
  readonly subtitle?: string
}

/**
 * Escape double quotes and backslashes for safe embedding in AppleScript strings.
 */
export function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Build the AppleScript command string for a macOS notification.
 */
export function buildAppleScript(options: NotificationOptions): string {
  const { title, body, subtitle } = options
  const escapedTitle = escapeForAppleScript(title)
  const escapedBody = escapeForAppleScript(body)

  if (subtitle) {
    const escapedSubtitle = escapeForAppleScript(subtitle)
    return `display notification "${escapedBody}" with title "${escapedTitle}" subtitle "${escapedSubtitle}"`
  }

  return `display notification "${escapedBody}" with title "${escapedTitle}"`
}

/**
 * Send a desktop notification. Non-blocking, fire-and-forget.
 * macOS: osascript, Linux: notify-send.
 */
export function sendNotification(options: NotificationOptions): void {
  if (process.platform === 'darwin') {
    const script = buildAppleScript(options)
    execFile('osascript', ['-e', script], () => {})
  } else if (process.platform === 'linux') {
    const args = options.subtitle
      ? [options.title, `${options.subtitle}: ${options.body}`]
      : [options.title, options.body]
    execFile('notify-send', args, () => {})
  }
  // Windows: skip for now
}
