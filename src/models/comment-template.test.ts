import { describe, it, expect } from 'vitest'
import {
  CommentTemplateSchema,
  DEFAULT_TEMPLATES,
  mergeTemplates,
  type CommentTemplate,
} from './comment-template'

describe('CommentTemplate model', () => {
  describe('CommentTemplateSchema', () => {
    it('should validate a minimal template', () => {
      const result = CommentTemplateSchema.safeParse({
        name: 'Test',
        body: '{{cursor}}',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test')
        expect(result.data.body).toBe('{{cursor}}')
        expect(result.data.prefix).toBeUndefined()
        expect(result.data.description).toBeUndefined()
      }
    })

    it('should validate a full template with all fields', () => {
      const result = CommentTemplateSchema.safeParse({
        name: 'Nit',
        prefix: 'nit:',
        body: '{{cursor}}',
        description: 'Minor style issue',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Nit')
        expect(result.data.prefix).toBe('nit:')
        expect(result.data.body).toBe('{{cursor}}')
        expect(result.data.description).toBe('Minor style issue')
      }
    })

    it('should reject a template without a name', () => {
      const result = CommentTemplateSchema.safeParse({
        body: '{{cursor}}',
      })
      expect(result.success).toBe(false)
    })

    it('should reject a template without a body', () => {
      const result = CommentTemplateSchema.safeParse({
        name: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const result = CommentTemplateSchema.safeParse({
        name: '',
        body: '{{cursor}}',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty body', () => {
      const result = CommentTemplateSchema.safeParse({
        name: 'Test',
        body: '',
      })
      expect(result.success).toBe(false)
    })

    it('should allow prefix to be empty string', () => {
      const result = CommentTemplateSchema.safeParse({
        name: 'Praise',
        prefix: '',
        body: 'Nice! {{cursor}}',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.prefix).toBe('')
      }
    })
  })

  describe('DEFAULT_TEMPLATES', () => {
    it('should have exactly 10 default templates', () => {
      expect(DEFAULT_TEMPLATES).toHaveLength(10)
    })

    it('should have unique names', () => {
      const names = DEFAULT_TEMPLATES.map((t) => t.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should all have non-empty name and body', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.name.length).toBeGreaterThan(0)
        expect(template.body.length).toBeGreaterThan(0)
      }
    })

    it('should all contain {{cursor}} in body', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.body).toContain('{{cursor}}')
      }
    })

    it('should all have descriptions', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.description).toBeDefined()
        expect(template.description!.length).toBeGreaterThan(0)
      }
    })

    it('should all validate against the schema', () => {
      for (const template of DEFAULT_TEMPLATES) {
        const result = CommentTemplateSchema.safeParse(template)
        expect(result.success).toBe(true)
      }
    })

    it('should include expected template names', () => {
      const names = DEFAULT_TEMPLATES.map((t) => t.name)
      expect(names).toContain('Nit')
      expect(names).toContain('Blocking')
      expect(names).toContain('Question')
      expect(names).toContain('Suggestion')
      expect(names).toContain('Praise')
      expect(names).toContain('TODO')
      expect(names).toContain('Security')
      expect(names).toContain('Performance')
      expect(names).toContain('Missing Tests')
      expect(names).toContain('Type Safety')
    })
  })

  describe('mergeTemplates', () => {
    it('should return defaults when no user templates provided', () => {
      const result = mergeTemplates(DEFAULT_TEMPLATES, undefined)
      expect(result).toEqual(DEFAULT_TEMPLATES)
    })

    it('should return defaults when user templates is empty array', () => {
      const result = mergeTemplates(DEFAULT_TEMPLATES, [])
      expect(result).toEqual(DEFAULT_TEMPLATES)
    })

    it('should append user templates that have new names', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Custom', prefix: 'custom:', body: '{{cursor}}', description: 'My custom template' },
      ]
      const result = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      expect(result).toHaveLength(11)
      expect(result[result.length - 1]!.name).toBe('Custom')
    })

    it('should override defaults when user template has same name', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Nit', prefix: 'nitpick:', body: 'Custom nit: {{cursor}}', description: 'Custom nit' },
      ]
      const result = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      expect(result).toHaveLength(10) // Same count, overridden
      const nit = result.find((t) => t.name === 'Nit')
      expect(nit?.prefix).toBe('nitpick:')
      expect(nit?.body).toBe('Custom nit: {{cursor}}')
    })

    it('should handle both overrides and additions', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Nit', prefix: 'nitpick:', body: 'Custom: {{cursor}}' },
        { name: 'Custom', body: 'New template: {{cursor}}' },
      ]
      const result = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      expect(result).toHaveLength(11) // 10 defaults (1 overridden) + 1 new
      const nit = result.find((t) => t.name === 'Nit')
      expect(nit?.prefix).toBe('nitpick:')
      const custom = result.find((t) => t.name === 'Custom')
      expect(custom?.body).toBe('New template: {{cursor}}')
    })

    it('should preserve order: defaults first, then additions', () => {
      const userTemplates: readonly CommentTemplate[] = [
        { name: 'Alpha', body: '{{cursor}}' },
        { name: 'Beta', body: '{{cursor}}' },
      ]
      const result = mergeTemplates(DEFAULT_TEMPLATES, userTemplates)
      const lastTwo = result.slice(-2)
      expect(lastTwo[0]!.name).toBe('Alpha')
      expect(lastTwo[1]!.name).toBe('Beta')
    })
  })
})
