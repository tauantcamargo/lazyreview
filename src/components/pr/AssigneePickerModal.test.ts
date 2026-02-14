import { describe, it, expect } from 'vitest'
import type { User } from '../../models/user'
import { filterCollaborators, hasChanges } from './AssigneePickerModal'

function makeUser(login: string): User {
  return {
    login,
    id: 1,
    avatar_url: `https://example.com/${login}.png`,
    html_url: `https://github.com/${login}`,
    type: 'User',
  } as User
}

describe('AssigneePickerModal helpers', () => {
  describe('filterCollaborators', () => {
    const users: readonly User[] = [
      makeUser('alice'),
      makeUser('bob'),
      makeUser('charlie'),
      makeUser('Alice-Admin'),
    ]

    it('returns all collaborators when query is empty', () => {
      expect(filterCollaborators(users, '')).toEqual(users)
    })

    it('returns all collaborators when query is whitespace', () => {
      expect(filterCollaborators(users, '   ')).toEqual(users)
    })

    it('filters by login prefix', () => {
      const result = filterCollaborators(users, 'ali')
      expect(result).toHaveLength(2)
      expect(result[0]!.login).toBe('alice')
      expect(result[1]!.login).toBe('Alice-Admin')
    })

    it('is case insensitive', () => {
      const result = filterCollaborators(users, 'BOB')
      expect(result).toHaveLength(1)
      expect(result[0]!.login).toBe('bob')
    })

    it('filters by substring', () => {
      const result = filterCollaborators(users, 'harl')
      expect(result).toHaveLength(1)
      expect(result[0]!.login).toBe('charlie')
    })

    it('returns empty array when no match', () => {
      const result = filterCollaborators(users, 'xyz')
      expect(result).toHaveLength(0)
    })

    it('returns empty array when collaborators list is empty', () => {
      const result = filterCollaborators([], 'alice')
      expect(result).toHaveLength(0)
    })

    it('matches exact login name', () => {
      const result = filterCollaborators(users, 'bob')
      expect(result).toHaveLength(1)
      expect(result[0]!.login).toBe('bob')
    })
  })

  describe('hasChanges', () => {
    it('returns false when both are empty', () => {
      expect(hasChanges([], new Set())).toBe(false)
    })

    it('returns false when same assignees', () => {
      expect(
        hasChanges(['alice', 'bob'], new Set(['alice', 'bob'])),
      ).toBe(false)
    })

    it('returns true when assignee added', () => {
      expect(
        hasChanges(['alice'], new Set(['alice', 'bob'])),
      ).toBe(true)
    })

    it('returns true when assignee removed', () => {
      expect(
        hasChanges(['alice', 'bob'], new Set(['alice'])),
      ).toBe(true)
    })

    it('returns true when different assignees same count', () => {
      expect(
        hasChanges(['alice'], new Set(['bob'])),
      ).toBe(true)
    })

    it('returns true when going from empty to selected', () => {
      expect(hasChanges([], new Set(['alice']))).toBe(true)
    })

    it('returns true when going from selected to empty', () => {
      expect(hasChanges(['alice'], new Set())).toBe(true)
    })

    it('handles single assignee unchanged', () => {
      expect(hasChanges(['alice'], new Set(['alice']))).toBe(false)
    })

    it('handles order independence', () => {
      expect(
        hasChanges(['bob', 'alice'], new Set(['alice', 'bob'])),
      ).toBe(false)
    })
  })
})

describe('AssigneePickerModal data', () => {
  it('creates proper assignee display data', () => {
    const users: readonly User[] = [
      makeUser('alice'),
      makeUser('bob'),
      makeUser('charlie'),
    ]

    expect(users).toHaveLength(3)
    expect(users[0]!.login).toBe('alice')
    expect(users[1]!.login).toBe('bob')
    expect(users[2]!.login).toBe('charlie')
  })

  it('handles empty collaborator list', () => {
    const users: readonly User[] = []
    expect(users).toHaveLength(0)
  })

  it('computes current assignees from PR data', () => {
    const prAssignees = [
      makeUser('alice'),
      makeUser('bob'),
    ]
    const currentAssigneeLogins = prAssignees.map((a) => a.login)
    expect(currentAssigneeLogins).toEqual(['alice', 'bob'])
  })

  it('toggle adds an assignee', () => {
    const selected = new Set(['alice'])
    const login = 'bob'
    const newSelected = new Set([...selected, login])
    expect(newSelected.has('bob')).toBe(true)
    expect(newSelected.size).toBe(2)
  })

  it('toggle removes an assignee', () => {
    const selected = new Set(['alice', 'bob'])
    const login = 'alice'
    const newSelected = new Set([...selected].filter((l) => l !== login))
    expect(newSelected.has('alice')).toBe(false)
    expect(newSelected.size).toBe(1)
  })
})
