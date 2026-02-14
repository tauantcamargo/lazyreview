import { describe, it, expect } from 'vitest'
import {
  parseBlocks,
  parseInline,
  parseTaskList,
  parseTable,
} from './MarkdownText'

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

  it('parses strikethrough text with ~~', () => {
    const segments = parseInline('~~deleted text~~')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('strikethrough')
    expect(segments[0]!.text).toBe('deleted text')
  })

  it('parses strikethrough mixed with other inline elements', () => {
    const segments = parseInline('keep this ~~remove this~~ and this')
    expect(segments).toHaveLength(3)
    expect(segments[0]!.type).toBe('text')
    expect(segments[0]!.text).toBe('keep this ')
    expect(segments[1]!.type).toBe('strikethrough')
    expect(segments[1]!.text).toBe('remove this')
    expect(segments[2]!.type).toBe('text')
    expect(segments[2]!.text).toBe(' and this')
  })

  it('parses image references', () => {
    const segments = parseInline('![screenshot](https://example.com/img.png)')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('image')
    expect(segments[0]!.text).toBe('screenshot')
    expect(segments[0]!.url).toBe('https://example.com/img.png')
  })

  it('parses image with empty alt text', () => {
    const segments = parseInline('![](https://example.com/img.png)')
    expect(segments).toHaveLength(1)
    expect(segments[0]!.type).toBe('image')
    expect(segments[0]!.text).toBe('')
    expect(segments[0]!.url).toBe('https://example.com/img.png')
  })

  it('parses image mixed with text', () => {
    const segments = parseInline('See ![logo](https://x.com/logo.png) here')
    expect(segments).toHaveLength(3)
    expect(segments[0]!.type).toBe('text')
    expect(segments[0]!.text).toBe('See ')
    expect(segments[1]!.type).toBe('image')
    expect(segments[1]!.text).toBe('logo')
    expect(segments[2]!.type).toBe('text')
    expect(segments[2]!.text).toBe(' here')
  })
})

describe('parseBlocks - task lists', () => {
  it('parses a task list with checked and unchecked items', () => {
    const blocks = parseBlocks('- [x] Done task\n- [ ] Pending task')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('tasklist')
    expect(blocks[0]!.lines).toEqual(['[x] Done task', '[ ] Pending task'])
  })

  it('parses task list with mixed checked states', () => {
    const blocks = parseBlocks(
      '- [x] First done\n- [ ] Second pending\n- [x] Third done\n- [ ] Fourth pending\n- [ ] Fifth pending',
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('tasklist')
    expect(blocks[0]!.lines).toHaveLength(5)
  })

  it('does not confuse regular list items with task list items', () => {
    const blocks = parseBlocks('- regular item\n- another item')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
  })

  it('separates task list from regular list', () => {
    const blocks = parseBlocks(
      '- [x] Task item\n\n- regular item',
    )
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.type).toBe('tasklist')
    expect(blocks[1]!.type).toBe('list')
  })
})

describe('parseTaskList', () => {
  it('counts completed and total tasks', () => {
    const result = parseTaskList([
      '[x] Done task',
      '[ ] Pending task',
      '[x] Another done',
    ])
    expect(result.completed).toBe(2)
    expect(result.total).toBe(3)
    expect(result.items).toEqual([
      { checked: true, text: 'Done task' },
      { checked: false, text: 'Pending task' },
      { checked: true, text: 'Another done' },
    ])
  })

  it('handles all unchecked tasks', () => {
    const result = parseTaskList(['[ ] A', '[ ] B'])
    expect(result.completed).toBe(0)
    expect(result.total).toBe(2)
  })

  it('handles all checked tasks', () => {
    const result = parseTaskList(['[x] A', '[x] B'])
    expect(result.completed).toBe(2)
    expect(result.total).toBe(2)
  })

  it('handles empty task list', () => {
    const result = parseTaskList([])
    expect(result.completed).toBe(0)
    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
  })
})

describe('parseBlocks - tables', () => {
  it('parses a simple table', () => {
    const text = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('table')
    expect(blocks[0]!.lines).toEqual([
      '| Name | Age |',
      '| --- | --- |',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ])
  })

  it('parses a table with alignment markers', () => {
    const text =
      '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('table')
  })

  it('does not parse lines without separator row as table', () => {
    const text = '| Not a table |\n| Also not |'
    const blocks = parseBlocks(text)
    expect(blocks[0]!.type).not.toBe('table')
  })
})

describe('parseTable', () => {
  it('returns formatted table rows with aligned columns', () => {
    const lines = [
      '| Name | Age |',
      '| --- | --- |',
      '| Alice | 30 |',
      '| Bob | 25 |',
    ]
    const result = parseTable(lines)
    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ])
    expect(result.columnWidths).toEqual([5, 3])
  })

  it('computes column widths from longest content', () => {
    const lines = [
      '| Name | Description |',
      '| --- | --- |',
      '| Alice | A longer description |',
    ]
    const result = parseTable(lines)
    expect(result.columnWidths[0]).toBe(5) // "Name" and "Alice" both 5
    expect(result.columnWidths[1]).toBe(20) // "A longer description"
  })

  it('handles empty table', () => {
    const result = parseTable([])
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.columnWidths).toEqual([])
  })
})

describe('parseBlocks - nested lists', () => {
  it('parses nested unordered list with indentation levels', () => {
    const text = '- Top item\n  - Nested item\n  - Another nested\n- Back to top'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    expect(blocks[0]!.lines).toHaveLength(4)
  })

  it('preserves indentation info for nested list items', () => {
    const text = '- Top\n  - Level 1\n    - Level 2'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    // The indentLevels array tracks nesting depth per item
    expect(blocks[0]!.indentLevels).toEqual([0, 1, 2])
  })

  it('preserves indentation for ordered nested lists', () => {
    const text = '1. First\n  1. Nested first\n  2. Nested second\n2. Second'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('list')
    expect(blocks[0]!.indentLevels).toEqual([0, 1, 1, 0])
  })

  it('handles 4-space indentation', () => {
    const text = '- Top\n    - Deep nested'
    const blocks = parseBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.indentLevels).toEqual([0, 2])
  })
})
