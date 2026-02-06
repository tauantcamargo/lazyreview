import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { SyntaxHighlight, CodeBlock, InlineCode, DiffCode, detectLanguage } from './SyntaxHighlight';

describe('SyntaxHighlight', () => {
  it('renders code with line numbers', () => {
    const code = `const x = 1;
const y = 2;`;
    const { lastFrame } = render(
      <SyntaxHighlight code={code} language="typescript" />
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('1 │');
    expect(frame).toContain('2 │');
    expect(frame).toContain('const');
  });

  it('hides line numbers when disabled', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="const x = 1;" language="typescript" showLineNumbers={false} />
    );

    expect(lastFrame()).not.toContain('│');
  });

  it('starts from custom line number', () => {
    const code = `const x = 1;
const y = 2;`;
    const { lastFrame } = render(
      <SyntaxHighlight code={code} language="typescript" startLine={10} />
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('10 │');
    expect(frame).toContain('11 │');
  });

  it('renders plain text', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="plain text here" language="text" />
    );

    expect(lastFrame()).toContain('plain text here');
  });

  it('tokenizes TypeScript keywords', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="const foo = async () => {}" language="typescript" />
    );

    expect(lastFrame()).toContain('const');
    expect(lastFrame()).toContain('async');
  });

  it('tokenizes strings', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code='const msg = "hello";' language="typescript" />
    );

    expect(lastFrame()).toContain('"hello"');
  });

  it('tokenizes numbers', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="const x = 42.5;" language="typescript" />
    );

    expect(lastFrame()).toContain('42.5');
  });

  it('tokenizes comments', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="// this is a comment" language="typescript" />
    );

    expect(lastFrame()).toContain('// this is a comment');
  });

  it('handles Go syntax', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="func main() {}" language="go" />
    );

    expect(lastFrame()).toContain('func');
    expect(lastFrame()).toContain('main');
  });

  it('handles Python syntax', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="def hello(): pass" language="python" />
    );

    expect(lastFrame()).toContain('def');
    expect(lastFrame()).toContain('pass');
  });

  it('handles Rust syntax', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="fn main() -> i32 {}" language="rust" />
    );

    expect(lastFrame()).toContain('fn');
  });

  it('handles empty code', () => {
    const { lastFrame } = render(
      <SyntaxHighlight code="" language="typescript" />
    );

    expect(lastFrame()).toBeDefined();
  });
});

describe('CodeBlock', () => {
  it('renders code in a block', () => {
    const { lastFrame } = render(
      <CodeBlock code="const x = 1;" language="typescript" />
    );

    expect(lastFrame()).toContain('const');
  });

  it('shows title when provided', () => {
    const { lastFrame } = render(
      <CodeBlock code="const x = 1;" title="Example" language="typescript" />
    );

    expect(lastFrame()).toContain('Example');
    expect(lastFrame()).toContain('typescript');
  });

  it('truncates when maxHeight exceeded', () => {
    const code = 'line1\nline2\nline3\nline4\nline5';
    const { lastFrame } = render(
      <CodeBlock code={code} maxHeight={2} />
    );

    expect(lastFrame()).toContain('line1');
    expect(lastFrame()).toContain('line2');
    expect(lastFrame()).toContain('3 more lines');
    expect(lastFrame()).not.toContain('line5');
  });

  it('shows all lines when within maxHeight', () => {
    const code = 'line1\nline2';
    const { lastFrame } = render(
      <CodeBlock code={code} maxHeight={5} />
    );

    expect(lastFrame()).toContain('line1');
    expect(lastFrame()).toContain('line2');
    expect(lastFrame()).not.toContain('more lines');
  });
});

describe('InlineCode', () => {
  it('renders inline code', () => {
    const { lastFrame } = render(
      <InlineCode>console.log</InlineCode>
    );

    expect(lastFrame()).toContain('console.log');
  });
});

describe('DiffCode', () => {
  it('renders side-by-side diff', () => {
    const { lastFrame } = render(
      <DiffCode
        oldCode="const x = 1;"
        newCode="const x = 2;"
        language="typescript"
      />
    );

    expect(lastFrame()).toContain('Old');
    expect(lastFrame()).toContain('New');
  });

  it('shows both code versions', () => {
    const { lastFrame } = render(
      <DiffCode
        oldCode="foo"
        newCode="bar"
        language="text"
      />
    );

    expect(lastFrame()).toContain('foo');
    expect(lastFrame()).toContain('bar');
  });
});

describe('detectLanguage', () => {
  it('detects TypeScript', () => {
    expect(detectLanguage('file.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
  });

  it('detects JavaScript', () => {
    expect(detectLanguage('file.js')).toBe('javascript');
    expect(detectLanguage('component.jsx')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
    expect(detectLanguage('module.cjs')).toBe('javascript');
  });

  it('detects Go', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });

  it('detects Python', () => {
    expect(detectLanguage('script.py')).toBe('python');
  });

  it('detects Rust', () => {
    expect(detectLanguage('main.rs')).toBe('rust');
  });

  it('detects JSON', () => {
    expect(detectLanguage('package.json')).toBe('json');
  });

  it('detects YAML', () => {
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('config.yml')).toBe('yaml');
  });

  it('detects Markdown', () => {
    expect(detectLanguage('README.md')).toBe('markdown');
  });

  it('detects Shell', () => {
    expect(detectLanguage('script.sh')).toBe('bash');
    expect(detectLanguage('script.bash')).toBe('bash');
  });

  it('returns text for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('text');
    expect(detectLanguage('noextension')).toBe('text');
  });

  it('detects CSS variants', () => {
    expect(detectLanguage('style.css')).toBe('css');
    expect(detectLanguage('style.scss')).toBe('css');
    expect(detectLanguage('style.sass')).toBe('css');
  });

  it('detects HTML', () => {
    expect(detectLanguage('index.html')).toBe('html');
    expect(detectLanguage('page.htm')).toBe('html');
  });

  it('detects C/C++', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('header.h')).toBe('c');
  });

  it('detects Java', () => {
    expect(detectLanguage('Main.java')).toBe('java');
  });

  it('detects Ruby', () => {
    expect(detectLanguage('script.rb')).toBe('ruby');
  });

  it('detects SQL', () => {
    expect(detectLanguage('query.sql')).toBe('sql');
  });
});
