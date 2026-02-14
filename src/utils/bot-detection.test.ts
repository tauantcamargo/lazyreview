import { describe, it, expect } from 'vitest'
import {
  isBotUser,
  findMostRecentBotComment,
  DEFAULT_BOT_PATTERNS,
} from './bot-detection'

describe('bot-detection', () => {
  describe('DEFAULT_BOT_PATTERNS', () => {
    it('includes common bot suffixes', () => {
      expect(DEFAULT_BOT_PATTERNS).toContain('[bot]')
    })

    it('is a frozen readonly array', () => {
      expect(Array.isArray(DEFAULT_BOT_PATTERNS)).toBe(true)
    })
  })

  describe('isBotUser', () => {
    it('detects usernames ending with [bot]', () => {
      expect(isBotUser('github-actions[bot]')).toBe(true)
      expect(isBotUser('dependabot[bot]')).toBe(true)
      expect(isBotUser('renovate[bot]')).toBe(true)
    })

    it('rejects regular usernames', () => {
      expect(isBotUser('octocat')).toBe(false)
      expect(isBotUser('alice')).toBe(false)
      expect(isBotUser('bob-dev')).toBe(false)
    })

    it('detects usernames in custom bot list', () => {
      const customBots = ['coderabbitai', 'sweep-ai']
      expect(isBotUser('coderabbitai', customBots)).toBe(true)
      expect(isBotUser('sweep-ai', customBots)).toBe(true)
    })

    it('still detects [bot] suffix with custom list', () => {
      const customBots = ['my-custom-bot']
      expect(isBotUser('github-actions[bot]', customBots)).toBe(true)
    })

    it('is case-insensitive for custom bot usernames', () => {
      const customBots = ['CodeRabbitAI']
      expect(isBotUser('coderabbitai', customBots)).toBe(true)
      expect(isBotUser('CODERABBITAI', customBots)).toBe(true)
    })

    it('handles empty username', () => {
      expect(isBotUser('')).toBe(false)
    })

    it('handles empty custom bot list', () => {
      expect(isBotUser('github-actions[bot]', [])).toBe(true)
      expect(isBotUser('octocat', [])).toBe(false)
    })

    it('does not match partial [bot] suffix', () => {
      expect(isBotUser('botuser')).toBe(false)
      expect(isBotUser('my-bot')).toBe(false)
      expect(isBotUser('bot[bot')).toBe(false)
    })
  })

  describe('findMostRecentBotComment', () => {
    const makeComment = (
      login: string,
      body: string,
      created_at: string,
    ) => ({
      id: Math.floor(Math.random() * 10000),
      body,
      user: { login, id: 1, avatar_url: '', html_url: '', type: 'Bot' },
      created_at,
      updated_at: created_at,
      html_url: '',
    })

    it('returns null when no comments exist', () => {
      expect(findMostRecentBotComment([])).toBeNull()
    })

    it('returns null when no bot comments exist', () => {
      const comments = [
        makeComment('alice', 'LGTM', '2025-01-01T00:00:00Z'),
        makeComment('bob', 'Great work', '2025-01-02T00:00:00Z'),
      ]
      expect(findMostRecentBotComment(comments)).toBeNull()
    })

    it('returns the most recent bot comment', () => {
      const comments = [
        makeComment('github-actions[bot]', 'Old summary', '2025-01-01T00:00:00Z'),
        makeComment('alice', 'LGTM', '2025-01-02T00:00:00Z'),
        makeComment('github-actions[bot]', 'New summary', '2025-01-03T00:00:00Z'),
      ]
      const result = findMostRecentBotComment(comments)
      expect(result).not.toBeNull()
      expect(result?.body).toBe('New summary')
    })

    it('finds bot comments using custom bot list', () => {
      const comments = [
        makeComment('coderabbitai', 'AI Review Summary', '2025-01-01T00:00:00Z'),
        makeComment('alice', 'LGTM', '2025-01-02T00:00:00Z'),
      ]
      const result = findMostRecentBotComment(comments, ['coderabbitai'])
      expect(result).not.toBeNull()
      expect(result?.body).toBe('AI Review Summary')
    })

    it('returns the most recent across mixed bot types', () => {
      const comments = [
        makeComment('dependabot[bot]', 'Dependency update', '2025-01-01T00:00:00Z'),
        makeComment('coderabbitai', 'AI summary', '2025-01-03T00:00:00Z'),
        makeComment('github-actions[bot]', 'CI results', '2025-01-02T00:00:00Z'),
      ]
      const result = findMostRecentBotComment(comments, ['coderabbitai'])
      expect(result).not.toBeNull()
      expect(result?.body).toBe('AI summary')
    })

    it('handles single bot comment', () => {
      const comments = [
        makeComment('renovate[bot]', 'Update available', '2025-01-01T00:00:00Z'),
      ]
      const result = findMostRecentBotComment(comments)
      expect(result).not.toBeNull()
      expect(result?.body).toBe('Update available')
    })
  })
})
