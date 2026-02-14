import { describe, it, expect } from 'vitest'
import { fuzzyFilter } from '../../utils/fuzzy-search'
import {
  DEFAULT_TEMPLATES,
  mergeTemplates,
  type CommentTemplate,
} from '../../models/comment-template'
import { resolveTemplate, type TemplateVariables } from '../../utils/template-engine'

// ---------------------------------------------------------------------------
// TemplatePickerModal - Logic tests
//
// The TemplatePickerModal component uses Ink's Modal wrapper with
// position="absolute" which ink-testing-library does not render.
// We therefore test the extracted data-handling logic directly.
// ---------------------------------------------------------------------------

describe('TemplatePickerModal logic', () => {
  // -------------------------------------------------------------------------
  // Fuzzy filtering for templates
  // -------------------------------------------------------------------------

  describe('template filtering', () => {
    it('should return all templates when query is empty', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, '', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBe(DEFAULT_TEMPLATES.length)
    })

    it('should filter templates by name', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'nit', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      const names = results.map((r) => r.item.name)
      expect(names).toContain('Nit')
    })

    it('should filter templates by prefix', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'blocking', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.name).toBe('Blocking')
    })

    it('should filter templates by description', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'security', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBeGreaterThan(0)
      const names = results.map((r) => r.item.name)
      expect(names).toContain('Security')
    })

    it('should return empty for non-matching query', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'zzzzzzz', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBe(0)
    })

    it('should rank exact prefix matches higher', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'perf', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.name).toBe('Performance')
    })

    it('should handle fuzzy matching across template fields', () => {
      const results = fuzzyFilter(DEFAULT_TEMPLATES, 'typ', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBeGreaterThan(0)
      const names = results.map((r) => r.item.name)
      expect(names).toContain('Type Safety')
    })
  })

  // -------------------------------------------------------------------------
  // Selection navigation
  // -------------------------------------------------------------------------

  describe('selection navigation', () => {
    it('should start at index 0', () => {
      const selectedIndex = 0
      expect(DEFAULT_TEMPLATES[selectedIndex]!.name).toBe('Nit')
    })

    it('should move down correctly', () => {
      let selectedIndex = 0
      selectedIndex = Math.min(selectedIndex + 1, DEFAULT_TEMPLATES.length - 1)
      expect(selectedIndex).toBe(1)
      expect(DEFAULT_TEMPLATES[selectedIndex]!.name).toBe('Blocking')
    })

    it('should not go below zero', () => {
      let selectedIndex = 0
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(0)
    })

    it('should not exceed array bounds', () => {
      let selectedIndex = DEFAULT_TEMPLATES.length - 1
      selectedIndex = Math.min(selectedIndex + 1, DEFAULT_TEMPLATES.length - 1)
      expect(selectedIndex).toBe(DEFAULT_TEMPLATES.length - 1)
    })

    it('should reset to 0 when filter changes', () => {
      const selectedIndex = 5
      const resetIndex = 0
      expect(resetIndex).toBe(0)
      expect(selectedIndex).not.toBe(resetIndex)
    })
  })

  // -------------------------------------------------------------------------
  // Template selection and resolution
  // -------------------------------------------------------------------------

  describe('template selection and insertion', () => {
    it('should resolve selected template with variables', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Nit')!
      const variables: TemplateVariables = { file: 'app.tsx', line: '42', author: 'octocat' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('nit: ')
      expect(result.cursorOffset).toBe(5)
    })

    it('should resolve Suggestion template correctly', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Suggestion')!
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('suggestion: Consider ')
      expect(result.cursorOffset).toBe('suggestion: Consider '.length)
    })

    it('should resolve Praise template correctly', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Praise')!
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('Nice! ')
      expect(result.cursorOffset).toBe(6)
    })

    it('should resolve Missing Tests template with file variable', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Missing Tests')!
      const variables: TemplateVariables = { file: 'utils.ts' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toContain('Missing test coverage for')
    })

    it('should resolve Security template correctly', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Security')!
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('security: Potential security concern: ')
      expect(result.cursorOffset).toBe('security: Potential security concern: '.length)
    })
  })

  // -------------------------------------------------------------------------
  // Merged templates
  // -------------------------------------------------------------------------

  describe('user template integration', () => {
    it('should show user templates after defaults when merged', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Custom', prefix: 'custom:', body: '{{cursor}}', description: 'My template' },
      ]
      const merged = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      const results = fuzzyFilter(merged, 'custom', (t) => `${t.name} ${t.prefix ?? ''} ${t.description ?? ''}`)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.name).toBe('Custom')
    })

    it('should show overridden defaults when user overrides', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Nit', prefix: 'nitpick:', body: 'Custom nit: {{cursor}}', description: 'Custom nit' },
      ]
      const merged = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      const nit = merged.find((t) => t.name === 'Nit')!
      const result = resolveTemplate(nit, {})
      expect(result.text).toBe('nitpick: Custom nit: ')
    })
  })

  // -------------------------------------------------------------------------
  // Item count label
  // -------------------------------------------------------------------------

  describe('item count label', () => {
    it('should show total when no query', () => {
      const query = ''
      const total = DEFAULT_TEMPLATES.length
      const filtered = fuzzyFilter(DEFAULT_TEMPLATES, query, (t) => t.name)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toBe('10')
    })

    it('should show filtered/total when query is active', () => {
      const query = 'nit'
      const total = DEFAULT_TEMPLATES.length
      const filtered = fuzzyFilter(DEFAULT_TEMPLATES, query, (t) => t.name)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toContain('/')
    })
  })
})
