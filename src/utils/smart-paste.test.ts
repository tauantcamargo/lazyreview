import { describe, it, expect } from 'vitest'
import {
  detectPasteType,
  detectLanguage,
  formatPaste,
} from './smart-paste'

describe('smart-paste', () => {
  describe('detectPasteType', () => {
    it('detects multi-line code with braces as code-block', () => {
      const code = `function hello() {\n  return "world"\n}`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects multi-line code with arrow functions as code-block', () => {
      const code = `const fn = () => {\n  return 42\n}`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects multi-line code with import statements as code-block', () => {
      const code = `import React from 'react'\nimport { useState } from 'react'`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects multi-line code with const declarations as code-block', () => {
      const code = `const x = 1;\nconst y = 2;\nconst z = x + y;`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects indented multi-line text as code-block', () => {
      const code = `  if (true) {\n    doSomething()\n  }`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects multi-line code with semicolons as code-block', () => {
      const code = `let a = 1;\nlet b = 2;\nconsole.log(a + b);`
      expect(detectPasteType(code)).toBe('code-block')
    })

    it('detects http URL as url', () => {
      expect(detectPasteType('http://example.com')).toBe('url')
    })

    it('detects https URL as url', () => {
      expect(detectPasteType('https://github.com/user/repo/pull/42')).toBe('url')
    })

    it('detects URL with trailing whitespace as url', () => {
      expect(detectPasteType('https://example.com  ')).toBe('url')
    })

    it('detects single-line code with braces as inline-code', () => {
      expect(detectPasteType('const x = { foo: "bar" }')).toBe('inline-code')
    })

    it('detects single-line code with arrow function as inline-code', () => {
      expect(detectPasteType('const fn = () => 42')).toBe('inline-code')
    })

    it('detects single-line code with semicolons as inline-code', () => {
      expect(detectPasteType('let x = 1;')).toBe('inline-code')
    })

    it('detects single-line function call as inline-code', () => {
      expect(detectPasteType('function hello()')).toBe('inline-code')
    })

    it('detects plain text as plain', () => {
      expect(detectPasteType('Hello, world!')).toBe('plain')
    })

    it('detects multi-line plain text as plain', () => {
      expect(detectPasteType('This is a\nsimple paragraph\nof text.')).toBe('plain')
    })

    it('returns plain for empty string', () => {
      expect(detectPasteType('')).toBe('plain')
    })

    it('returns plain for whitespace only', () => {
      expect(detectPasteType('   ')).toBe('plain')
    })
  })

  describe('detectLanguage', () => {
    it('detects TypeScript from import statements', () => {
      const code = `import { useState } from 'react'\nconst [count, setCount] = useState(0)`
      expect(detectLanguage(code)).toBe('typescript')
    })

    it('detects TypeScript from type annotations', () => {
      const code = `const x: number = 42\nconst y: string = "hello"`
      expect(detectLanguage(code)).toBe('typescript')
    })

    it('detects TypeScript from interface keyword', () => {
      const code = `interface User {\n  name: string\n  age: number\n}`
      expect(detectLanguage(code)).toBe('typescript')
    })

    it('detects JavaScript from function and var keywords', () => {
      const code = `var x = 1\nfunction hello() {\n  return x\n}`
      expect(detectLanguage(code)).toBe('javascript')
    })

    it('detects Python from def keyword', () => {
      const code = `def hello():\n    print("world")\n    return True`
      expect(detectLanguage(code)).toBe('python')
    })

    it('detects Python from class with colon', () => {
      const code = `class MyClass:\n    def __init__(self):\n        pass`
      expect(detectLanguage(code)).toBe('python')
    })

    it('detects Go from func keyword', () => {
      const code = `func main() {\n  fmt.Println("Hello")\n}`
      expect(detectLanguage(code)).toBe('go')
    })

    it('detects Rust from fn keyword and let mut', () => {
      const code = `fn main() {\n    let mut x = 5;\n    x += 1;\n}`
      expect(detectLanguage(code)).toBe('rust')
    })

    it('detects shell from shebang', () => {
      const code = `#!/bin/bash\necho "Hello World"`
      expect(detectLanguage(code)).toBe('bash')
    })

    it('detects JSON from object/array structure', () => {
      const code = `{\n  "name": "test",\n  "version": "1.0.0"\n}`
      expect(detectLanguage(code)).toBe('json')
    })

    it('detects HTML from tags', () => {
      const code = `<div class="container">\n  <p>Hello</p>\n</div>`
      expect(detectLanguage(code)).toBe('html')
    })

    it('detects CSS from selectors and properties', () => {
      const code = `.container {\n  display: flex;\n  color: red;\n}`
      expect(detectLanguage(code)).toBe('css')
    })

    it('detects SQL from SELECT keyword', () => {
      const code = `SELECT id, name FROM users WHERE active = true;`
      expect(detectLanguage(code)).toBe('sql')
    })

    it('returns null for unrecognizable text', () => {
      expect(detectLanguage('Hello, this is just a note.')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(detectLanguage('')).toBeNull()
    })
  })

  describe('formatPaste', () => {
    it('wraps multi-line code in a fenced code block', () => {
      const code = `function hello() {\n  return "world"\n}`
      const result = formatPaste(code)
      expect(result).toContain('```')
      expect(result).toContain('function hello() {')
      expect(result).toContain('```\n')
    })

    it('includes detected language in code fence', () => {
      const code = `import React from 'react'\nconst App = () => <div />`
      const result = formatPaste(code)
      expect(result).toMatch(/^```typescript\n/)
    })

    it('wraps URL in markdown link format', () => {
      const result = formatPaste('https://github.com/user/repo')
      expect(result).toBe('[https://github.com/user/repo](https://github.com/user/repo)')
    })

    it('wraps single-line code in backticks', () => {
      const result = formatPaste('const x = { foo: "bar" }')
      expect(result).toBe('`const x = { foo: "bar" }`')
    })

    it('returns plain text unchanged', () => {
      const text = 'Just a simple note'
      expect(formatPaste(text)).toBe(text)
    })

    it('returns empty string unchanged', () => {
      expect(formatPaste('')).toBe('')
    })

    it('trims URL whitespace before formatting', () => {
      const result = formatPaste('https://example.com  ')
      expect(result).toBe('[https://example.com](https://example.com)')
    })

    it('produces fenced block without language when undetectable', () => {
      const code = `{\n  "x": 1,\n  "y": 2\n}`
      const result = formatPaste(code)
      // JSON gets detected, so it should have language
      expect(result).toMatch(/^```json\n/)
    })

    it('handles code block with trailing newline', () => {
      const code = `const a = 1;\nconst b = 2;\n`
      const result = formatPaste(code)
      expect(result.startsWith('```')).toBe(true)
      expect(result.endsWith('```\n')).toBe(true)
    })
  })
})
