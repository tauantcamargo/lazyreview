import { describe, it, expect, vi } from 'vitest'
import {
  mergeKeybindings,
  matchesAction,
  formatActionBindings,
  DEFAULT_KEYBINDINGS,
} from '../config/keybindings'
import type { InkKey } from '../config/keybindings'

/**
 * Tests for useKeybindings hook logic.
 *
 * Since the hook is a thin wrapper over the pure functions from
 * config/keybindings.ts (which are thoroughly tested there), we test
 * the integration scenarios here: how overrides from config affect
 * the behavior of the hook's outputs.
 */

function makeKey(overrides: Partial<InkKey> = {}): InkKey {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...overrides,
  }
}

describe('useKeybindings integration scenarios', () => {
  describe('default behavior without overrides', () => {
    it('global context matches j for moveDown', () => {
      const bindings = mergeKeybindings('global')
      expect(matchesAction('j', makeKey(), 'moveDown', bindings)).toBe(true)
    })

    it('global context matches down arrow for moveDown', () => {
      const bindings = mergeKeybindings('global')
      expect(
        matchesAction('', makeKey({ downArrow: true }), 'moveDown', bindings),
      ).toBe(true)
    })

    it('global context matches ? for toggleHelp', () => {
      const bindings = mergeKeybindings('global')
      expect(matchesAction('?', makeKey(), 'toggleHelp', bindings)).toBe(true)
    })

    it('prList context matches / for filterPRs', () => {
      const bindings = mergeKeybindings('prList')
      expect(matchesAction('/', makeKey(), 'filterPRs', bindings)).toBe(true)
    })

    it('prDetail context matches R for submitReview', () => {
      const bindings = mergeKeybindings('prDetail')
      expect(matchesAction('R', makeKey(), 'submitReview', bindings)).toBe(true)
    })

    it('prDetail context matches ] for nextPR', () => {
      const bindings = mergeKeybindings('prDetail')
      expect(matchesAction(']', makeKey(), 'nextPR', bindings)).toBe(true)
    })

    it('prDetail context matches [ for prevPR', () => {
      const bindings = mergeKeybindings('prDetail')
      expect(matchesAction('[', makeKey(), 'prevPR', bindings)).toBe(true)
    })
  })

  describe('behavior with user overrides', () => {
    it('overrides toggleHelp from ? to h', () => {
      const bindings = mergeKeybindings('global', {
        global: { toggleHelp: 'h' },
      })
      // Old binding should not match
      expect(matchesAction('?', makeKey(), 'toggleHelp', bindings)).toBe(false)
      // New binding should match
      expect(matchesAction('h', makeKey(), 'toggleHelp', bindings)).toBe(true)
    })

    it('overrides filterPRs to accept multiple keys', () => {
      const bindings = mergeKeybindings('prList', {
        prList: { filterPRs: ['/', 'f'] },
      })
      expect(matchesAction('/', makeKey(), 'filterPRs', bindings)).toBe(true)
      expect(matchesAction('f', makeKey(), 'filterPRs', bindings)).toBe(true)
    })

    it('preserves non-overridden actions', () => {
      const bindings = mergeKeybindings('prList', {
        prList: { filterPRs: 'f' },
      })
      // sortPRs should still use default 's'
      expect(matchesAction('s', makeKey(), 'sortPRs', bindings)).toBe(true)
    })

    it('override does not affect other contexts', () => {
      const overrides = { global: { toggleHelp: 'h' } }
      const globalBindings = mergeKeybindings('global', overrides)
      const prListBindings = mergeKeybindings('prList', overrides)

      // toggleHelp is overridden in global
      expect(matchesAction('h', makeKey(), 'toggleHelp', globalBindings)).toBe(
        true,
      )
      // prList should not have a toggleHelp action by default
      expect(
        matchesAction('h', makeKey(), 'toggleHelp', prListBindings),
      ).toBe(false)
    })
  })

  describe('display formatting with overrides', () => {
    it('shows default binding display', () => {
      const bindings = mergeKeybindings('global')
      const display = formatActionBindings(bindings['moveDown']!)
      expect(display).toBe('j / \u2193')
    })

    it('shows overridden binding display', () => {
      const bindings = mergeKeybindings('global', {
        global: { moveDown: 'ctrl+j' },
      })
      const display = formatActionBindings(bindings['moveDown']!)
      expect(display).toBe('Ctrl+j')
    })

    it('shows overridden array binding display', () => {
      const bindings = mergeKeybindings('prList', {
        prList: { filterPRs: ['/', 'f'] },
      })
      const display = formatActionBindings(bindings['filterPRs']!)
      expect(display).toBe('/ / f')
    })
  })

  describe('backward compatibility', () => {
    it('all default prList bindings match expected keys', () => {
      const bindings = mergeKeybindings('prList')
      expect(matchesAction('/', makeKey(), 'filterPRs', bindings)).toBe(true)
      expect(matchesAction('s', makeKey(), 'sortPRs', bindings)).toBe(true)
      expect(matchesAction('n', makeKey(), 'nextPage', bindings)).toBe(true)
      expect(matchesAction('p', makeKey(), 'prevPage', bindings)).toBe(true)
      expect(matchesAction('o', makeKey(), 'openInBrowser', bindings)).toBe(true)
      expect(matchesAction('y', makeKey(), 'copyUrl', bindings)).toBe(true)
      expect(matchesAction('u', makeKey(), 'toggleUnread', bindings)).toBe(true)
      expect(matchesAction('t', makeKey(), 'toggleState', bindings)).toBe(true)
    })

    it('all default prDetail bindings match expected keys', () => {
      const bindings = mergeKeybindings('prDetail')
      expect(matchesAction('R', makeKey(), 'submitReview', bindings)).toBe(true)
      expect(matchesAction('S', makeKey(), 'batchReview', bindings)).toBe(true)
      expect(matchesAction('E', makeKey(), 'reReview', bindings)).toBe(true)
      expect(matchesAction('m', makeKey(), 'mergePR', bindings)).toBe(true)
      expect(matchesAction('X', makeKey(), 'closePR', bindings)).toBe(true)
      expect(matchesAction('G', makeKey(), 'checkoutBranch', bindings)).toBe(true)
      expect(matchesAction(']', makeKey(), 'nextPR', bindings)).toBe(true)
      expect(matchesAction('[', makeKey(), 'prevPR', bindings)).toBe(true)
      expect(matchesAction('o', makeKey(), 'openInBrowser', bindings)).toBe(true)
      expect(matchesAction('y', makeKey(), 'copyUrl', bindings)).toBe(true)
      expect(matchesAction('T', makeKey(), 'editTitle', bindings)).toBe(true)
      expect(matchesAction('W', makeKey(), 'toggleDraft', bindings)).toBe(true)
    })

    it('all default conversations bindings match expected keys', () => {
      const bindings = mergeKeybindings('conversations')
      expect(matchesAction('c', makeKey(), 'newComment', bindings)).toBe(true)
      expect(matchesAction('r', makeKey(), 'reply', bindings)).toBe(true)
      expect(matchesAction('e', makeKey(), 'editComment', bindings)).toBe(true)
      expect(matchesAction('D', makeKey(), 'editDescription', bindings)).toBe(true)
      expect(matchesAction('x', makeKey(), 'resolveThread', bindings)).toBe(true)
      expect(matchesAction('f', makeKey(), 'toggleResolved', bindings)).toBe(true)
      expect(matchesAction('g', makeKey(), 'goToFile', bindings)).toBe(true)
    })

    it('all default filesTab bindings match expected keys', () => {
      const bindings = mergeKeybindings('filesTab')
      expect(matchesAction('h', makeKey(), 'focusTree', bindings)).toBe(true)
      expect(matchesAction('l', makeKey(), 'focusDiff', bindings)).toBe(true)
      expect(matchesAction('', makeKey({ tab: true }), 'switchPanel', bindings)).toBe(true)
      expect(matchesAction('/', makeKey(), 'filterFiles', bindings)).toBe(true)
      expect(matchesAction('d', makeKey(), 'toggleSideBySide', bindings)).toBe(true)
      expect(matchesAction('v', makeKey(), 'visualSelect', bindings)).toBe(true)
      expect(matchesAction('c', makeKey(), 'inlineComment', bindings)).toBe(true)
      expect(matchesAction('r', makeKey(), 'reply', bindings)).toBe(true)
      expect(matchesAction('e', makeKey(), 'editComment', bindings)).toBe(true)
      expect(matchesAction('x', makeKey(), 'resolveThread', bindings)).toBe(true)
    })

    it('all default input bindings match expected keys', () => {
      const bindings = mergeKeybindings('input')
      expect(matchesAction('s', makeKey({ ctrl: true }), 'submit', bindings)).toBe(true)
      expect(matchesAction('', makeKey({ return: true }), 'newLine', bindings)).toBe(true)
      expect(matchesAction('', makeKey({ tab: true }), 'indent', bindings)).toBe(true)
      expect(matchesAction('', makeKey({ escape: true }), 'back', bindings)).toBe(true)
    })
  })
})
