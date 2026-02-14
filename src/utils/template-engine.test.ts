import { describe, it, expect } from 'vitest'
import { resolveTemplate, type TemplateVariables } from './template-engine'
import type { CommentTemplate } from '../models/comment-template'

describe('template-engine', () => {
  describe('resolveTemplate', () => {
    it('should return prefix + body with cursor removed for simple template', () => {
      const template: CommentTemplate = {
        name: 'Nit',
        prefix: 'nit:',
        body: '{{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('nit: ')
      expect(result.cursorOffset).toBe(5) // 'nit: '.length
    })

    it('should return body only when prefix is undefined', () => {
      const template: CommentTemplate = {
        name: 'Praise',
        body: 'Nice! {{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('Nice! ')
      expect(result.cursorOffset).toBe(6) // 'Nice! '.length
    })

    it('should return body only when prefix is empty string', () => {
      const template: CommentTemplate = {
        name: 'Praise',
        prefix: '',
        body: 'Nice! {{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('Nice! ')
      expect(result.cursorOffset).toBe(6)
    })

    it('should substitute {{file}} variable', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: 'In {{file}}: {{cursor}}',
      }
      const variables: TemplateVariables = { file: 'src/app.tsx' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('In src/app.tsx: ')
      expect(result.cursorOffset).toBe('In src/app.tsx: '.length)
    })

    it('should substitute {{line}} variable', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: 'Line {{line}}: {{cursor}}',
      }
      const variables: TemplateVariables = { line: '42' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('Line 42: ')
      expect(result.cursorOffset).toBe('Line 42: '.length)
    })

    it('should substitute {{author}} variable', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: '@{{author}} {{cursor}}',
      }
      const variables: TemplateVariables = { author: 'octocat' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('@octocat ')
      expect(result.cursorOffset).toBe('@octocat '.length)
    })

    it('should substitute multiple variables', () => {
      const template: CommentTemplate = {
        name: 'Test',
        prefix: 'review:',
        body: '{{file}}:{{line}} - {{cursor}}',
      }
      const variables: TemplateVariables = {
        file: 'index.ts',
        line: '10',
        author: 'user',
      }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('review: index.ts:10 - ')
      expect(result.cursorOffset).toBe('review: index.ts:10 - '.length)
    })

    it('should leave unresolved variables as empty string', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: 'File: {{file}} {{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('File:  ')
    })

    it('should handle cursor in the middle of text', () => {
      const template: CommentTemplate = {
        name: 'Suggestion',
        prefix: 'suggestion:',
        body: 'Consider {{cursor}} instead',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('suggestion: Consider  instead')
      expect(result.cursorOffset).toBe('suggestion: Consider '.length)
    })

    it('should handle cursor at the beginning of body', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: '{{cursor}} is the issue',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe(' is the issue')
      expect(result.cursorOffset).toBe(0)
    })

    it('should handle cursor at the end of body', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: 'The issue is {{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('The issue is ')
      expect(result.cursorOffset).toBe('The issue is '.length)
    })

    it('should handle body with no cursor placeholder', () => {
      const template: CommentTemplate = {
        name: 'Test',
        body: 'Fixed text with no cursor',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('Fixed text with no cursor')
      expect(result.cursorOffset).toBe('Fixed text with no cursor'.length)
    })

    it('should handle only cursor in body with prefix', () => {
      const template: CommentTemplate = {
        name: 'Blocking',
        prefix: 'blocking:',
        body: '{{cursor}}',
      }
      const result = resolveTemplate(template, {})
      expect(result.text).toBe('blocking: ')
      expect(result.cursorOffset).toBe('blocking: '.length)
    })

    it('should handle prefix with trailing space', () => {
      const template: CommentTemplate = {
        name: 'Test',
        prefix: 'nit: ',
        body: '{{cursor}}',
      }
      const result = resolveTemplate(template, {})
      // Should not double-space
      expect(result.text).toBe('nit: ')
      expect(result.cursorOffset).toBe('nit: '.length)
    })

    it('should handle variables in prefix-less template', () => {
      const template: CommentTemplate = {
        name: 'Missing Tests',
        prefix: '',
        body: 'Missing test coverage for {{file}}:{{line}} {{cursor}}',
      }
      const variables: TemplateVariables = { file: 'utils.ts', line: '25' }
      const result = resolveTemplate(template, variables)
      expect(result.text).toBe('Missing test coverage for utils.ts:25 ')
      expect(result.cursorOffset).toBe('Missing test coverage for utils.ts:25 '.length)
    })
  })
})
