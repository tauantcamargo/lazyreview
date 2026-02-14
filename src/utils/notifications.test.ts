import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escapeForAppleScript, buildAppleScript, sendNotification, type NotificationOptions } from './notifications'

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

describe('escapeForAppleScript', () => {
  it('returns plain text unchanged', () => {
    expect(escapeForAppleScript('hello world')).toBe('hello world')
  })

  it('escapes double quotes', () => {
    expect(escapeForAppleScript('say "hello"')).toBe('say \\"hello\\"')
  })

  it('escapes backslashes', () => {
    expect(escapeForAppleScript('path\\to\\file')).toBe('path\\\\to\\\\file')
  })

  it('escapes both quotes and backslashes', () => {
    expect(escapeForAppleScript('"hello\\world"')).toBe('\\"hello\\\\world\\"')
  })

  it('handles empty string', () => {
    expect(escapeForAppleScript('')).toBe('')
  })
})

describe('buildAppleScript', () => {
  it('builds script without subtitle', () => {
    const result = buildAppleScript({ title: 'New PR', body: '#42: Fix bug' })
    expect(result).toBe('display notification "#42: Fix bug" with title "New PR"')
  })

  it('builds script with subtitle', () => {
    const result = buildAppleScript({
      title: 'New PR',
      body: '#42: Fix bug',
      subtitle: 'user123',
    })
    expect(result).toBe(
      'display notification "#42: Fix bug" with title "New PR" subtitle "user123"',
    )
  })

  it('escapes special characters in all fields', () => {
    const result = buildAppleScript({
      title: 'Title "quoted"',
      body: 'Body "quoted"',
      subtitle: 'Sub "quoted"',
    })
    expect(result).toContain('Title \\"quoted\\"')
    expect(result).toContain('Body \\"quoted\\"')
    expect(result).toContain('Sub \\"quoted\\"')
  })
})

describe('sendNotification', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('calls osascript on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { execFile } = await import('node:child_process')

    sendNotification({ title: 'Test', body: 'Hello' })

    expect(execFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', 'display notification "Hello" with title "Test"'],
      expect.any(Function),
    )
  })

  it('calls osascript with subtitle on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { execFile } = await import('node:child_process')

    sendNotification({ title: 'Test', body: 'Hello', subtitle: 'Sub' })

    expect(execFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', 'display notification "Hello" with title "Test" subtitle "Sub"'],
      expect.any(Function),
    )
  })

  it('calls notify-send on Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { execFile } = await import('node:child_process')

    sendNotification({ title: 'Test', body: 'Hello' })

    expect(execFile).toHaveBeenCalledWith(
      'notify-send',
      ['Test', 'Hello'],
      expect.any(Function),
    )
  })

  it('calls notify-send with subtitle on Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { execFile } = await import('node:child_process')

    sendNotification({ title: 'Test', body: 'Hello', subtitle: 'Sub' })

    expect(execFile).toHaveBeenCalledWith(
      'notify-send',
      ['Test', 'Sub: Hello'],
      expect.any(Function),
    )
  })

  it('does nothing on unsupported platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const { execFile } = await import('node:child_process')

    sendNotification({ title: 'Test', body: 'Hello' })

    expect(execFile).not.toHaveBeenCalled()
  })
})
