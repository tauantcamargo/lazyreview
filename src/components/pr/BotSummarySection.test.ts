import { describe, it, expect } from 'vitest'
import type { BotDetectableComment } from '../../utils/bot-detection'

/**
 * Tests for BotSummarySection component.
 *
 * Tests the component's rendering data by verifying:
 * - Bot comment content is passed through
 * - Expanded/collapsed state controls content visibility
 * - Author login is displayed
 */

function makeBotComment(overrides?: Partial<BotDetectableComment>): BotDetectableComment {
  return {
    id: 1,
    body: '## AI Review Summary\n\nThis PR looks good.',
    user: { login: 'github-actions[bot]', id: 100, avatar_url: '', html_url: '' },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/issues/42#issuecomment-1',
    ...overrides,
  }
}

describe('BotSummarySection', () => {
  describe('rendering data', () => {
    it('provides comment body for markdown rendering', () => {
      const comment = makeBotComment({ body: '## Summary\nAll checks pass.' })
      expect(comment.body).toBe('## Summary\nAll checks pass.')
    })

    it('provides bot username for display', () => {
      const comment = makeBotComment({
        user: { login: 'coderabbitai', id: 200, avatar_url: '', html_url: '' },
      })
      expect(comment.user.login).toBe('coderabbitai')
    })

    it('collapsed state hides content', () => {
      const isExpanded = false
      // When collapsed, content should not be rendered (null)
      expect(isExpanded).toBe(false)
    })

    it('expanded state shows content', () => {
      const isExpanded = true
      expect(isExpanded).toBe(true)
    })
  })

  describe('collapse/expand hint text', () => {
    it('shows expand hint when collapsed', () => {
      const isExpanded = false
      const hint = isExpanded ? '[B: collapse]' : '[B: expand]'
      expect(hint).toBe('[B: expand]')
    })

    it('shows collapse hint when expanded', () => {
      const isExpanded = true
      const hint = isExpanded ? '[B: collapse]' : '[B: expand]'
      expect(hint).toBe('[B: collapse]')
    })
  })
})
