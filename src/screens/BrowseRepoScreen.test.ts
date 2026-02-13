import { describe, it, expect } from 'vitest'
import { validateRepoInput } from './BrowseRepoScreen'

describe('validateRepoInput', () => {
  describe('basic owner/repo format', () => {
    it('accepts valid owner/repo format', () => {
      const result = validateRepoInput('facebook/react')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('facebook')
      expect(result.repo).toBe('react')
      expect(result.error).toBeNull()
    })

    it('trims whitespace', () => {
      const result = validateRepoInput('  facebook / react  ')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('facebook')
      expect(result.repo).toBe('react')
    })

    it('rejects input without slash', () => {
      const result = validateRepoInput('facebook-react')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Format: owner/repo or full URL')
    })

    it('rejects empty owner', () => {
      const result = validateRepoInput('/react')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Owner cannot be empty')
    })

    it('rejects empty repo', () => {
      const result = validateRepoInput('facebook/')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Repo cannot be empty')
    })

    it('rejects empty string', () => {
      const result = validateRepoInput('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Format: owner/repo or full URL')
    })

    it('rejects whitespace-only string', () => {
      const result = validateRepoInput('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Format: owner/repo or full URL')
    })
  })

  describe('GitLab nested group format', () => {
    it('accepts group/subgroup/project format', () => {
      const result = validateRepoInput('mygroup/mysubgroup/myproject')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('mygroup/mysubgroup')
      expect(result.repo).toBe('myproject')
      expect(result.error).toBeNull()
    })

    it('accepts deeply nested group format', () => {
      const result = validateRepoInput('org/team/subteam/project')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('org/team/subteam')
      expect(result.repo).toBe('project')
      expect(result.error).toBeNull()
    })

    it('trims whitespace in nested format', () => {
      const result = validateRepoInput('  group / subgroup / project  ')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('group/subgroup')
      expect(result.repo).toBe('project')
    })

    it('rejects nested format with empty repo', () => {
      const result = validateRepoInput('group/subgroup/')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Repo cannot be empty')
    })
  })

  describe('URL parsing', () => {
    it('accepts GitHub HTTPS URL', () => {
      const result = validateRepoInput('https://github.com/facebook/react')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('facebook')
      expect(result.repo).toBe('react')
    })

    it('accepts GitHub HTTPS URL with .git suffix', () => {
      const result = validateRepoInput('https://github.com/facebook/react.git')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('facebook')
      expect(result.repo).toBe('react')
    })

    it('accepts GitLab HTTPS URL', () => {
      const result = validateRepoInput('https://gitlab.com/mygroup/myproject')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('mygroup')
      expect(result.repo).toBe('myproject')
    })

    it('accepts GitLab nested group HTTPS URL', () => {
      const result = validateRepoInput('https://gitlab.com/group/subgroup/project')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('group/subgroup')
      expect(result.repo).toBe('project')
    })

    it('accepts GitHub SSH URL', () => {
      const result = validateRepoInput('git@github.com:facebook/react.git')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('facebook')
      expect(result.repo).toBe('react')
    })

    it('accepts GitLab SSH URL', () => {
      const result = validateRepoInput('git@gitlab.com:mygroup/myproject.git')
      expect(result.valid).toBe(true)
      expect(result.owner).toBe('mygroup')
      expect(result.repo).toBe('myproject')
    })

    it('rejects invalid URL', () => {
      const result = validateRepoInput('https://example.com')
      expect(result.valid).toBe(false)
    })
  })
})
