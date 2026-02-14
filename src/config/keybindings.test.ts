import { describe, it, expect } from 'vitest'
import {
  DEFAULT_KEYBINDINGS,
  KeybindingOverrideSchema,
  mergeKeybindings,
  parseBinding,
  matchesKey,
  matchesAction,
  formatBinding,
  formatActionBindings,
  getContextBindingsForDisplay,
} from './keybindings'
import type { InkKey } from './keybindings'

// Helper to create a default InkKey (all false)
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

describe('DEFAULT_KEYBINDINGS', () => {
  it('has all expected contexts', () => {
    const contexts = Object.keys(DEFAULT_KEYBINDINGS)
    expect(contexts).toContain('global')
    expect(contexts).toContain('prList')
    expect(contexts).toContain('prDetail')
    expect(contexts).toContain('conversations')
    expect(contexts).toContain('filesTab')
    expect(contexts).toContain('checksTab')
    expect(contexts).toContain('commitsTab')
    expect(contexts).toContain('input')
  })

  it('global context has navigation keys', () => {
    const global = DEFAULT_KEYBINDINGS['global']!
    expect(global['moveDown']).toEqual(['j', 'down'])
    expect(global['moveUp']).toEqual(['k', 'up'])
    expect(global['select']).toBe('return')
    expect(global['back']).toEqual(['q', 'escape'])
    expect(global['quit']).toBe('ctrl+c')
    expect(global['toggleSidebar']).toBe('ctrl+b')
    expect(global['toggleHelp']).toBe('?')
    expect(global['refresh']).toBe('R')
  })

  it('prList context has expected actions', () => {
    const prList = DEFAULT_KEYBINDINGS['prList']!
    expect(prList['filterPRs']).toBe('/')
    expect(prList['sortPRs']).toBe('s')
    expect(prList['nextPage']).toBe('n')
    expect(prList['prevPage']).toBe('p')
    expect(prList['openInBrowser']).toBe('o')
    expect(prList['copyUrl']).toBe('y')
    expect(prList['toggleUnread']).toBe('u')
    expect(prList['toggleState']).toBe('t')
  })

  it('prDetail context has expected actions', () => {
    const prDetail = DEFAULT_KEYBINDINGS['prDetail']!
    expect(prDetail['submitReview']).toBe('R')
    expect(prDetail['batchReview']).toBe('S')
    expect(prDetail['nextPR']).toBe(']')
    expect(prDetail['prevPR']).toBe('[')
    expect(prDetail['editTitle']).toBe('T')
    expect(prDetail['toggleDraft']).toBe('W')
  })
})

describe('KeybindingOverrideSchema', () => {
  it('validates empty overrides', () => {
    const result = KeybindingOverrideSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates string bindings', () => {
    const result = KeybindingOverrideSchema.safeParse({
      global: { moveDown: 'j' },
    })
    expect(result.success).toBe(true)
  })

  it('validates array bindings', () => {
    const result = KeybindingOverrideSchema.safeParse({
      global: { moveDown: ['j', 'down'] },
    })
    expect(result.success).toBe(true)
  })

  it('validates mixed string and array bindings', () => {
    const result = KeybindingOverrideSchema.safeParse({
      global: {
        moveDown: ['j', 'down'],
        quit: 'ctrl+q',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid binding values', () => {
    const result = KeybindingOverrideSchema.safeParse({
      global: { moveDown: 42 },
    })
    expect(result.success).toBe(false)
  })
})

describe('mergeKeybindings', () => {
  it('returns defaults when no overrides given', () => {
    const result = mergeKeybindings('global')
    expect(result).toEqual(DEFAULT_KEYBINDINGS['global'])
  })

  it('returns defaults when overrides are undefined', () => {
    const result = mergeKeybindings('global', undefined)
    expect(result).toEqual(DEFAULT_KEYBINDINGS['global'])
  })

  it('returns defaults when context has no overrides', () => {
    const result = mergeKeybindings('global', { prList: { filterPRs: 'f' } })
    expect(result).toEqual(DEFAULT_KEYBINDINGS['global'])
  })

  it('overrides specific actions', () => {
    const result = mergeKeybindings('global', {
      global: { toggleHelp: 'h' },
    })
    expect(result['toggleHelp']).toBe('h')
    // Other defaults preserved
    expect(result['moveDown']).toEqual(['j', 'down'])
    expect(result['quit']).toBe('ctrl+c')
  })

  it('allows overriding with arrays', () => {
    const result = mergeKeybindings('prList', {
      prList: { filterPRs: ['/', 'f'] },
    })
    expect(result['filterPRs']).toEqual(['/', 'f'])
  })

  it('returns empty object for unknown context', () => {
    const result = mergeKeybindings('nonexistent')
    expect(result).toEqual({})
  })

  it('returns overrides for unknown context when provided', () => {
    const result = mergeKeybindings('custom', {
      custom: { myAction: 'x' },
    })
    expect(result['myAction']).toBe('x')
  })

  it('does not mutate defaults', () => {
    const before = { ...DEFAULT_KEYBINDINGS['global'] }
    mergeKeybindings('global', { global: { toggleHelp: 'h' } })
    expect(DEFAULT_KEYBINDINGS['global']).toEqual(before)
  })
})

describe('parseBinding', () => {
  it('parses simple character', () => {
    expect(parseBinding('j')).toEqual({
      ctrl: false,
      shift: false,
      meta: false,
      key: 'j',
    })
  })

  it('parses ctrl modifier', () => {
    expect(parseBinding('ctrl+b')).toEqual({
      ctrl: true,
      shift: false,
      meta: false,
      key: 'b',
    })
  })

  it('parses shift modifier', () => {
    expect(parseBinding('shift+r')).toEqual({
      ctrl: false,
      shift: true,
      meta: false,
      key: 'r',
    })
  })

  it('parses meta modifier', () => {
    expect(parseBinding('meta+k')).toEqual({
      ctrl: false,
      shift: false,
      meta: true,
      key: 'k',
    })
  })

  it('parses multiple modifiers', () => {
    expect(parseBinding('ctrl+shift+x')).toEqual({
      ctrl: true,
      shift: true,
      meta: false,
      key: 'x',
    })
  })

  it('parses special key names', () => {
    expect(parseBinding('return')).toEqual({
      ctrl: false,
      shift: false,
      meta: false,
      key: 'return',
    })
  })

  it('parses modifier with special key', () => {
    expect(parseBinding('ctrl+s')).toEqual({
      ctrl: true,
      shift: false,
      meta: false,
      key: 's',
    })
  })

  it('is case-insensitive for modifiers', () => {
    expect(parseBinding('Ctrl+B')).toEqual({
      ctrl: true,
      shift: false,
      meta: false,
      key: 'b',
    })
  })

  it('parses arrow key names', () => {
    expect(parseBinding('up')).toEqual({
      ctrl: false,
      shift: false,
      meta: false,
      key: 'up',
    })
    expect(parseBinding('down')).toEqual({
      ctrl: false,
      shift: false,
      meta: false,
      key: 'down',
    })
  })
})

describe('matchesKey', () => {
  it('matches simple character', () => {
    expect(matchesKey('j', makeKey(), 'j')).toBe(true)
  })

  it('does not match wrong character', () => {
    expect(matchesKey('k', makeKey(), 'j')).toBe(false)
  })

  it('matches ctrl+key', () => {
    expect(matchesKey('b', makeKey({ ctrl: true }), 'ctrl+b')).toBe(true)
  })

  it('does not match ctrl+key without ctrl pressed', () => {
    expect(matchesKey('b', makeKey(), 'ctrl+b')).toBe(false)
  })

  it('does not match ctrl+key with wrong key', () => {
    expect(matchesKey('a', makeKey({ ctrl: true }), 'ctrl+b')).toBe(false)
  })

  it('matches return key', () => {
    expect(matchesKey('', makeKey({ return: true }), 'return')).toBe(true)
  })

  it('matches enter alias', () => {
    expect(matchesKey('', makeKey({ return: true }), 'enter')).toBe(true)
  })

  it('matches escape key', () => {
    expect(matchesKey('', makeKey({ escape: true }), 'escape')).toBe(true)
  })

  it('matches esc alias', () => {
    expect(matchesKey('', makeKey({ escape: true }), 'esc')).toBe(true)
  })

  it('matches tab key', () => {
    expect(matchesKey('', makeKey({ tab: true }), 'tab')).toBe(true)
  })

  it('matches up arrow', () => {
    expect(matchesKey('', makeKey({ upArrow: true }), 'up')).toBe(true)
  })

  it('matches down arrow', () => {
    expect(matchesKey('', makeKey({ downArrow: true }), 'down')).toBe(true)
  })

  it('matches left arrow', () => {
    expect(matchesKey('', makeKey({ leftArrow: true }), 'left')).toBe(true)
  })

  it('matches right arrow', () => {
    expect(matchesKey('', makeKey({ rightArrow: true }), 'right')).toBe(true)
  })

  it('matches uppercase character binding', () => {
    expect(matchesKey('R', makeKey(), 'R')).toBe(true)
  })

  it('matches special characters', () => {
    expect(matchesKey('?', makeKey(), '?')).toBe(true)
    expect(matchesKey('/', makeKey(), '/')).toBe(true)
    expect(matchesKey(']', makeKey(), ']')).toBe(true)
    expect(matchesKey('[', makeKey(), '[')).toBe(true)
  })

  it('does not match when ctrl is pressed but not in binding', () => {
    expect(matchesKey('j', makeKey({ ctrl: true }), 'j')).toBe(false)
  })

  it('does not match when meta is pressed but not in binding', () => {
    expect(matchesKey('j', makeKey({ meta: true }), 'j')).toBe(false)
  })

  it('matches ctrl+c', () => {
    expect(matchesKey('c', makeKey({ ctrl: true }), 'ctrl+c')).toBe(true)
  })

  it('matches ctrl+s', () => {
    expect(matchesKey('s', makeKey({ ctrl: true }), 'ctrl+s')).toBe(true)
  })

  it('matches backspace', () => {
    expect(matchesKey('', makeKey({ backspace: true }), 'backspace')).toBe(true)
  })

  it('matches delete', () => {
    expect(matchesKey('', makeKey({ delete: true }), 'delete')).toBe(true)
  })
})

describe('matchesAction', () => {
  const bindings = {
    moveDown: ['j', 'down'],
    moveUp: ['k', 'up'],
    select: 'return',
    quit: 'ctrl+c',
    toggleHelp: '?',
  } as const

  it('matches action with single binding', () => {
    expect(
      matchesAction('?', makeKey(), 'toggleHelp', bindings),
    ).toBe(true)
  })

  it('matches action with first of array bindings', () => {
    expect(
      matchesAction('j', makeKey(), 'moveDown', bindings),
    ).toBe(true)
  })

  it('matches action with second of array bindings', () => {
    expect(
      matchesAction('', makeKey({ downArrow: true }), 'moveDown', bindings),
    ).toBe(true)
  })

  it('matches action with special key binding', () => {
    expect(
      matchesAction('', makeKey({ return: true }), 'select', bindings),
    ).toBe(true)
  })

  it('matches action with modifier binding', () => {
    expect(
      matchesAction('c', makeKey({ ctrl: true }), 'quit', bindings),
    ).toBe(true)
  })

  it('returns false for non-matching input', () => {
    expect(
      matchesAction('x', makeKey(), 'moveDown', bindings),
    ).toBe(false)
  })

  it('returns false for unknown action', () => {
    expect(
      matchesAction('j', makeKey(), 'unknown', bindings),
    ).toBe(false)
  })
})

describe('formatBinding', () => {
  it('formats simple character as-is', () => {
    expect(formatBinding('j')).toBe('j')
  })

  it('formats return as Enter', () => {
    expect(formatBinding('return')).toBe('Enter')
  })

  it('formats enter as Enter', () => {
    expect(formatBinding('enter')).toBe('Enter')
  })

  it('formats escape as Esc', () => {
    expect(formatBinding('escape')).toBe('Esc')
  })

  it('formats esc as Esc', () => {
    expect(formatBinding('esc')).toBe('Esc')
  })

  it('formats tab as Tab', () => {
    expect(formatBinding('tab')).toBe('Tab')
  })

  it('formats ctrl+b as Ctrl+b', () => {
    expect(formatBinding('ctrl+b')).toBe('Ctrl+b')
  })

  it('formats ctrl+s as Ctrl+s', () => {
    expect(formatBinding('ctrl+s')).toBe('Ctrl+s')
  })

  it('formats up as arrow symbol', () => {
    expect(formatBinding('up')).toBe('\u2191')
  })

  it('formats down as arrow symbol', () => {
    expect(formatBinding('down')).toBe('\u2193')
  })

  it('formats uppercase single char', () => {
    expect(formatBinding('R')).toBe('R')
  })
})

describe('formatActionBindings', () => {
  it('formats single binding', () => {
    expect(formatActionBindings('return')).toBe('Enter')
  })

  it('formats array of bindings with separator', () => {
    expect(formatActionBindings(['j', 'down'])).toBe('j / \u2193')
  })

  it('formats array with modifier', () => {
    expect(formatActionBindings(['q', 'escape'])).toBe('q / Esc')
  })

  it('formats single element array', () => {
    expect(formatActionBindings(['tab'])).toBe('Tab')
  })
})

describe('getContextBindingsForDisplay', () => {
  it('returns display entries for global context', () => {
    const entries = getContextBindingsForDisplay('global')
    expect(entries.length).toBeGreaterThan(0)

    const moveDown = entries.find((e) => e.action === 'moveDown')
    expect(moveDown).toBeDefined()
    expect(moveDown!.display).toBe('j / \u2193')

    const toggleHelp = entries.find((e) => e.action === 'toggleHelp')
    expect(toggleHelp).toBeDefined()
    expect(toggleHelp!.display).toBe('?')
  })

  it('applies overrides to display', () => {
    const entries = getContextBindingsForDisplay('global', {
      global: { toggleHelp: 'h' },
    })
    const toggleHelp = entries.find((e) => e.action === 'toggleHelp')
    expect(toggleHelp).toBeDefined()
    expect(toggleHelp!.display).toBe('h')
  })

  it('returns empty array for unknown context', () => {
    const entries = getContextBindingsForDisplay('nonexistent')
    expect(entries).toEqual([])
  })
})
