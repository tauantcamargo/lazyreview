import { describe, it, expect } from 'vitest'
import {
  getContextualHints,
  filterHintsByPRState,
  filterHintsByTimelineItem,
  filterHintsByDiffRow,
} from './useContextualHints'
import type { SelectionContext } from './useContextualHints'

describe('filterHintsByPRState', () => {
  const baseEntries = [
    { ctx: 'prList', action: 'filterPRs', label: 'filter' },
    { ctx: 'prList', action: 'sortPRs', label: 'sort' },
    { ctx: 'prDetail', action: 'mergePR', label: 'merge' },
    { ctx: 'prDetail', action: 'closePR', label: 'close' },
    { ctx: 'prDetail', action: 'submitReview', label: 'review' },
    { ctx: 'prDetail', action: 'checkoutBranch', label: 'checkout' },
    { ctx: 'prDetail', action: 'toggleDraft', label: 'draft' },
  ] as const

  it('keeps merge/close/review/checkout/draft hints for open PRs', () => {
    const result = filterHintsByPRState([...baseEntries], {
      state: 'open',
      merged: false,
      draft: false,
    })
    expect(result.some((e) => e.action === 'mergePR')).toBe(true)
    expect(result.some((e) => e.action === 'closePR')).toBe(true)
    expect(result.some((e) => e.action === 'submitReview')).toBe(true)
    expect(result.some((e) => e.action === 'checkoutBranch')).toBe(true)
    expect(result.some((e) => e.action === 'toggleDraft')).toBe(true)
  })

  it('removes merge/review/checkout/draft hints for merged PRs', () => {
    const result = filterHintsByPRState([...baseEntries], {
      state: 'closed',
      merged: true,
      draft: false,
    })
    expect(result.some((e) => e.action === 'mergePR')).toBe(false)
    expect(result.some((e) => e.action === 'submitReview')).toBe(false)
    expect(result.some((e) => e.action === 'checkoutBranch')).toBe(false)
    expect(result.some((e) => e.action === 'toggleDraft')).toBe(false)
    // close should be removed too (already closed)
    expect(result.some((e) => e.action === 'closePR')).toBe(false)
  })

  it('removes merge/review/draft hints for closed (unmerged) PRs', () => {
    const result = filterHintsByPRState([...baseEntries], {
      state: 'closed',
      merged: false,
      draft: false,
    })
    expect(result.some((e) => e.action === 'mergePR')).toBe(false)
    expect(result.some((e) => e.action === 'submitReview')).toBe(false)
    expect(result.some((e) => e.action === 'toggleDraft')).toBe(false)
    // close should be removed (already closed)
    expect(result.some((e) => e.action === 'closePR')).toBe(false)
  })

  it('keeps non-PR-state actions unchanged', () => {
    const result = filterHintsByPRState([...baseEntries], {
      state: 'closed',
      merged: true,
      draft: false,
    })
    expect(result.some((e) => e.action === 'filterPRs')).toBe(true)
    expect(result.some((e) => e.action === 'sortPRs')).toBe(true)
  })

  it('shows merge hint for draft open PRs', () => {
    const result = filterHintsByPRState([...baseEntries], {
      state: 'open',
      merged: false,
      draft: true,
    })
    // Draft PRs can still be merged (after marking ready)
    expect(result.some((e) => e.action === 'mergePR')).toBe(true)
    expect(result.some((e) => e.action === 'toggleDraft')).toBe(true)
  })
})

describe('filterHintsByTimelineItem', () => {
  const baseEntries = [
    { ctx: 'conversations', action: 'newComment', label: 'comment' },
    { ctx: 'conversations', action: 'reply', label: 'reply' },
    { ctx: 'conversations', action: 'editComment', label: 'edit' },
    { ctx: 'conversations', action: 'resolveThread', label: 'resolve' },
    { ctx: 'conversations', action: 'toggleResolved', label: 'filter' },
    { ctx: 'conversations', action: 'goToFile', label: 'file' },
    { ctx: 'conversations', action: 'addReaction', label: 'react' },
  ] as const

  it('shows reply/edit/resolve/react/goToFile for review comments with thread', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'comment',
      hasThread: true,
      isResolved: false,
      isOwnComment: true,
      hasPath: true,
    })
    expect(result.some((e) => e.action === 'reply')).toBe(true)
    expect(result.some((e) => e.action === 'editComment')).toBe(true)
    expect(result.some((e) => e.action === 'resolveThread')).toBe(true)
    expect(result.some((e) => e.action === 'goToFile')).toBe(true)
    expect(result.some((e) => e.action === 'addReaction')).toBe(true)
    // newComment and toggleResolved always stay
    expect(result.some((e) => e.action === 'newComment')).toBe(true)
    expect(result.some((e) => e.action === 'toggleResolved')).toBe(true)
  })

  it('hides resolve for review comments without thread', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'comment',
      hasThread: false,
      isResolved: false,
      isOwnComment: true,
      hasPath: true,
    })
    expect(result.some((e) => e.action === 'resolveThread')).toBe(false)
    expect(result.some((e) => e.action === 'reply')).toBe(true)
  })

  it('hides edit for comments not owned by current user', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'comment',
      hasThread: true,
      isResolved: false,
      isOwnComment: false,
      hasPath: true,
    })
    expect(result.some((e) => e.action === 'editComment')).toBe(false)
    expect(result.some((e) => e.action === 'reply')).toBe(true)
  })

  it('hides goToFile for comments without path', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'comment',
      hasThread: false,
      isResolved: false,
      isOwnComment: true,
      hasPath: false,
    })
    expect(result.some((e) => e.action === 'goToFile')).toBe(false)
  })

  it('shows reply/edit/react for issue_comments', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'issue_comment',
      hasThread: false,
      isResolved: false,
      isOwnComment: true,
      hasPath: false,
    })
    expect(result.some((e) => e.action === 'reply')).toBe(true)
    expect(result.some((e) => e.action === 'editComment')).toBe(true)
    expect(result.some((e) => e.action === 'addReaction')).toBe(true)
    // No resolve/goToFile for issue comments
    expect(result.some((e) => e.action === 'resolveThread')).toBe(false)
    expect(result.some((e) => e.action === 'goToFile')).toBe(false)
  })

  it('hides reply/edit/resolve/goToFile/react for review items', () => {
    const result = filterHintsByTimelineItem([...baseEntries], {
      type: 'review',
      hasThread: false,
      isResolved: false,
      isOwnComment: false,
      hasPath: false,
    })
    expect(result.some((e) => e.action === 'reply')).toBe(false)
    expect(result.some((e) => e.action === 'editComment')).toBe(false)
    expect(result.some((e) => e.action === 'resolveThread')).toBe(false)
    expect(result.some((e) => e.action === 'goToFile')).toBe(false)
    expect(result.some((e) => e.action === 'addReaction')).toBe(false)
    // newComment and toggleResolved always stay
    expect(result.some((e) => e.action === 'newComment')).toBe(true)
    expect(result.some((e) => e.action === 'toggleResolved')).toBe(true)
  })
})

describe('filterHintsByDiffRow', () => {
  const baseEntries = [
    { ctx: 'filesTab', action: 'inlineComment', label: 'comment' },
    { ctx: 'filesTab', action: 'visualSelect', label: 'visual' },
    { ctx: 'filesTab', action: 'toggleSideBySide', label: 'split' },
    { ctx: 'filesTab', action: 'filterFiles', label: 'search' },
    { ctx: 'filesTab', action: 'switchPanel', label: 'tree' },
    { ctx: 'filesTab', action: 'reply', label: 'reply' },
    { ctx: 'filesTab', action: 'editComment', label: 'edit' },
    { ctx: 'filesTab', action: 'resolveThread', label: 'resolve' },
    { ctx: 'filesTab', action: 'addReaction', label: 'react' },
  ] as const

  it('shows reply/edit/resolve/react when cursor is on a comment row', () => {
    const result = filterHintsByDiffRow([...baseEntries], {
      isCommentRow: true,
      hasThread: true,
      isOwnComment: true,
    })
    expect(result.some((e) => e.action === 'reply')).toBe(true)
    expect(result.some((e) => e.action === 'editComment')).toBe(true)
    expect(result.some((e) => e.action === 'resolveThread')).toBe(true)
    expect(result.some((e) => e.action === 'addReaction')).toBe(true)
  })

  it('hides reply/edit/resolve/react when cursor is on a code line', () => {
    const result = filterHintsByDiffRow([...baseEntries], {
      isCommentRow: false,
      hasThread: false,
      isOwnComment: false,
    })
    expect(result.some((e) => e.action === 'reply')).toBe(false)
    expect(result.some((e) => e.action === 'editComment')).toBe(false)
    expect(result.some((e) => e.action === 'resolveThread')).toBe(false)
    expect(result.some((e) => e.action === 'addReaction')).toBe(false)
    // Code line actions remain
    expect(result.some((e) => e.action === 'inlineComment')).toBe(true)
    expect(result.some((e) => e.action === 'visualSelect')).toBe(true)
  })

  it('hides edit when not own comment', () => {
    const result = filterHintsByDiffRow([...baseEntries], {
      isCommentRow: true,
      hasThread: true,
      isOwnComment: false,
    })
    expect(result.some((e) => e.action === 'editComment')).toBe(false)
    expect(result.some((e) => e.action === 'reply')).toBe(true)
  })

  it('hides resolve when no thread', () => {
    const result = filterHintsByDiffRow([...baseEntries], {
      isCommentRow: true,
      hasThread: false,
      isOwnComment: true,
    })
    expect(result.some((e) => e.action === 'resolveThread')).toBe(false)
    expect(result.some((e) => e.action === 'reply')).toBe(true)
  })
})

describe('getContextualHints', () => {
  it('returns pr-list hints filtered by PR state when selection is pr-list-item', () => {
    const context: SelectionContext = {
      type: 'pr-list-item',
      prState: 'closed',
      prMerged: true,
      prDraft: false,
    }
    const hints = getContextualHints('list', 'pr-list', context)
    // Should not contain merge since the PR is merged
    expect(hints).not.toContain('m:merge')
    // Should still contain filter/sort
    expect(hints).toContain('/:filter')
    expect(hints).toContain('s:sort')
  })

  it('returns pr-list hints with merge for open PRs', () => {
    const context: SelectionContext = {
      type: 'pr-list-item',
      prState: 'open',
      prMerged: false,
      prDraft: false,
    }
    const hints = getContextualHints('list', 'pr-list', context)
    expect(hints).toContain('/:filter')
  })

  it('returns conversations hints filtered by timeline item type', () => {
    const context: SelectionContext = {
      type: 'timeline-item',
      itemType: 'review',
      hasThread: false,
      isResolved: false,
      isOwnComment: false,
      hasPath: false,
    }
    const hints = getContextualHints('detail', 'pr-detail-conversations', context)
    // Review items don't support reply/edit/resolve
    expect(hints).not.toContain('r:reply')
    expect(hints).not.toContain('e:edit')
    expect(hints).not.toContain('x:resolve')
    // Comment and filter always remain
    expect(hints).toContain('c:comment')
    expect(hints).toContain('f:filter')
  })

  it('returns conversations hints with reply/edit for own comment', () => {
    const context: SelectionContext = {
      type: 'timeline-item',
      itemType: 'comment',
      hasThread: true,
      isResolved: false,
      isOwnComment: true,
      hasPath: true,
    }
    const hints = getContextualHints('detail', 'pr-detail-conversations', context)
    expect(hints).toContain('r:reply')
    expect(hints).toContain('e:edit')
    expect(hints).toContain('x:resolve')
  })

  it('returns diff hints with comment actions when on a comment row', () => {
    const context: SelectionContext = {
      type: 'diff-row',
      isCommentRow: true,
      hasThread: true,
      isOwnComment: true,
    }
    const hints = getContextualHints('detail', 'pr-detail-files-diff', context)
    expect(hints).toContain('r:reply')
    expect(hints).toContain('e:edit')
    expect(hints).toContain('x:resolve')
  })

  it('returns diff hints without comment actions when on a code line', () => {
    const context: SelectionContext = {
      type: 'diff-row',
      isCommentRow: false,
      hasThread: false,
      isOwnComment: false,
    }
    const hints = getContextualHints('detail', 'pr-detail-files-diff', context)
    expect(hints).not.toContain('r:reply')
    expect(hints).not.toContain('e:edit')
    expect(hints).not.toContain('x:resolve')
    // Code actions remain
    expect(hints).toContain('c:comment')
    expect(hints).toContain('v:visual')
  })

  it('returns pr-detail-description hints filtered by PR state', () => {
    const context: SelectionContext = {
      type: 'pr-detail',
      prState: 'closed',
      prMerged: true,
      prDraft: false,
    }
    const hints = getContextualHints('detail', 'pr-detail-description', context)
    expect(hints).not.toContain('m:merge')
    expect(hints).not.toContain('R:review')
    // Tabs and help remain
    expect(hints).toContain('1-6:tabs')
    expect(hints).toContain('?:help')
  })

  it('returns pr-detail-commits hints filtered by PR state', () => {
    const context: SelectionContext = {
      type: 'pr-detail',
      prState: 'closed',
      prMerged: true,
      prDraft: false,
    }
    const hints = getContextualHints('detail', 'pr-detail-commits', context)
    expect(hints).not.toContain('m:merge')
    expect(hints).not.toContain('R:review')
    expect(hints).toContain('y:copy-sha')
  })

  it('falls back to static hints when no selection context', () => {
    const hints = getContextualHints('detail', 'pr-detail-description', undefined)
    // Should include all hints, same as before
    expect(hints).toContain('R:review')
    expect(hints).toContain('m:merge')
    expect(hints).toContain('1-6:tabs')
  })

  it('respects keybinding overrides', () => {
    const context: SelectionContext = {
      type: 'timeline-item',
      itemType: 'comment',
      hasThread: true,
      isResolved: false,
      isOwnComment: true,
      hasPath: true,
    }
    const overrides = { conversations: { reply: 'R' } }
    const hints = getContextualHints('detail', 'pr-detail-conversations', context, overrides)
    expect(hints).toContain('R:reply')
    expect(hints).not.toContain('r:reply')
  })
})
