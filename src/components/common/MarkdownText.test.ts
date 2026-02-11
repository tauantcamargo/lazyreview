import { describe, it, expect } from 'vitest'
import { parseBlocks, parseInline } from './MarkdownText'

describe('parseBlocks', () => {
  it('parses headings', () => {
    const blocks = parseBlocks('# Title')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('heading')
    expect(blocks[0]!.level).toBe(1)
    expect(blocks[0]!.lines).toEqual(['Title'])
  })

  it('parses h2 and h3 headings', () => {
    const blocks = parseBlocks('## Subtitle\n### Section')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.level).toBe(2)
    expect(blocks[1]!.level).toBe(3)
  })

  it('parses fenced code blocks', () => {
    const blocks = parseBlocks('```typescript\nconst x = 1\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('code')
    expect(blocks[0]!.language).toBe('typescript')
    expect(blocks[0]!.lines).toEqual(['const x = 1'])
  })

  it('parses code blocks without language', () => {
    const blocks = parseBlocks('```\nhello\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('code')
    expect(blocks[0]!.language).toBe('')
  })

  it('parses blockquotes', () => {
    const blocks = parseBlocks('> quote line 1\n> quote line 2')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('blockquote')
    expect(blocks[0]!.lines).toEqual(['quote line 1', 'quote line 2'])
  })

  it('parses unordered lists', () => {
    const blocks = parseBlocks('- item 1\n- item 2')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    expect(blocks[0]!.ordered).toBe(false)
    expect(blocks[0]!.lines).toEqual(['item 1', 'item 2'])
  })

  it('parses ordered lists', () => {
    const blocks = parseBlocks('1. first\n2. second')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    expect(blocks[0]!.ordered).toBe(true)
    expect(blocks[0]!.lines).toEqual(['first', 'second'])
  })

  it('parses horizontal rules', () => {
    const blocks = parseBlocks('---')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('hr')
  })

  it('parses paragraphs', () => {
    const blocks = parseBlocks('Hello world\nMore text')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('paragraph')
    expect(blocks[0]!.lines).toEqual(['Hello world', 'More text'])
  })

  it('skips empty lines', () => {
    const blocks = parseBlocks('# Title\n\nParagraph')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.type).toBe('heading')
    expect(blocks[1]!.type).toBe('paragraph')
  })

  it('handles mixed content', () => {
    const text = '# Title\n\nSome text\n\n```js\ncode\n```\n\n- list item'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(4)
    expect(blocks[0]!.type).toBe('heading')
    expect(blocks[1]!.type).toBe('paragraph')
    expect(blocks[2]!.type).toBe('code')
    expect(blocks[3]!.type).toBe('list')
  })

  it('recognizes asterisk and plus list markers', () => {
    const blocks = parseBlocks('* item a\n+ item b')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    expect(blocks[0]!.lines).toEqual(['item a', 'item b'])
  })
})

describe('parseInline', () => {
  it('parses plain text', () => {
    const segments = parseInline('hello world')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('text')
    expect(segments[0]!.text).toBe('hello world')
  })

  it('parses inline code', () => {
    const segments = parseInline('use `npm install`')
    expect(segments).toHaveLength(2)
    expect(segments[0]!.type).toBe('text')
    expect(segments[0]!.text).toBe('use ')
    expect(segments[1]!.type).toBe('code')
    expect(segments[1]!.text).toBe('npm install')
  })

  it('parses bold text with **', () => {
    const segments = parseInline('**bold text**')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('bold')
    expect(segments[0]!.text).toBe('bold text')
  })

  it('parses bold text with __', () => {
    const segments = parseInline('__bold__')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('bold')
    expect(segments[0]!.text).toBe('bold')
  })

  it('parses italic text with *', () => {
    const segments = parseInline('*italic*')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('italic')
    expect(segments[0]!.text).toBe('italic')
  })

  it('parses italic text with _', () => {
    const segments = parseInline('_emphasis_')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('italic')
    expect(segments[0]!.text).toBe('emphasis')
  })

  it('parses links', () => {
    const segments = parseInline('[click here](https://example.com)')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('link')
    expect(segments[0]!.text).toBe('click here')
    expect(segments[0]!.url).toBe('https://example.com')
  })

  it('parses mixed inline content', () => {
    const segments = parseInline('Hello **world** and `code`')
    expect(segments.length).toBeGreaterThanOrEqual(4)
    const types = segments.map((s) => s.type)
    expect(types).toContain('text')
    expect(types).toContain('bold')
    expect(types).toContain('code')
  })

  it('handles unmatched special chars as text', () => {
    const segments = parseInline('price is $5 * tax')
    expect(segments.length).toBeGreaterThanOrEqual(1)
    const fullText = segments.map((s) => s.text).join('')
    expect(fullText).toContain('price is $5')
  })
})
