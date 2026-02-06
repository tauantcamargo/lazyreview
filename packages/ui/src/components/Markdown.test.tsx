import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Markdown, MarkdownPreview, PRDescription, CommentBody } from './Markdown';

describe('Markdown', () => {
  it('renders plain text', () => {
    const { lastFrame } = render(<Markdown content="Hello world" />);

    expect(lastFrame()).toContain('Hello world');
  });

  it('renders headings', () => {
    const { lastFrame } = render(
      <Markdown content="# Heading 1\n## Heading 2" />
    );

    expect(lastFrame()).toContain('# Heading 1');
    expect(lastFrame()).toContain('## Heading 2');
  });

  it('renders bold text', () => {
    const { lastFrame } = render(
      <Markdown content="This is **bold** text" />
    );

    expect(lastFrame()).toContain('bold');
  });

  it('renders italic text', () => {
    const { lastFrame } = render(
      <Markdown content="This is *italic* text" />
    );

    expect(lastFrame()).toContain('italic');
  });

  it('renders inline code', () => {
    const { lastFrame } = render(
      <Markdown content="Use `code` here" />
    );

    expect(lastFrame()).toContain('code');
  });

  it('renders code blocks', () => {
    const code = '```typescript\nconst x = 1;\n```';
    const { lastFrame } = render(<Markdown content={code} />);

    expect(lastFrame()).toContain('typescript');
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('renders unordered lists', () => {
    const list = '- Item 1\n- Item 2\n- Item 3';
    const { lastFrame } = render(<Markdown content={list} />);

    expect(lastFrame()).toContain('•');
    expect(lastFrame()).toContain('Item 1');
    expect(lastFrame()).toContain('Item 2');
    expect(lastFrame()).toContain('Item 3');
  });

  it('renders numbered lists', () => {
    const list = '1. First\n2. Second\n3. Third';
    const { lastFrame } = render(<Markdown content={list} />);

    expect(lastFrame()).toContain('First');
    expect(lastFrame()).toContain('Second');
    expect(lastFrame()).toContain('Third');
  });

  it('renders checkboxes', () => {
    const list = '- [x] Done task\n- [ ] Pending task';
    const { lastFrame } = render(<Markdown content={list} />);

    expect(lastFrame()).toContain('☑');
    expect(lastFrame()).toContain('☐');
    expect(lastFrame()).toContain('Done task');
    expect(lastFrame()).toContain('Pending task');
  });

  it('renders blockquotes', () => {
    const { lastFrame } = render(
      <Markdown content="> This is a quote" />
    );

    expect(lastFrame()).toContain('│');
    expect(lastFrame()).toContain('This is a quote');
  });

  it('renders horizontal rules', () => {
    const content = `Before

---

After`;
    const { lastFrame } = render(
      <Markdown content={content} />
    );

    expect(lastFrame()).toContain('─');
    expect(lastFrame()).toContain('Before');
    expect(lastFrame()).toContain('After');
  });

  it('renders links', () => {
    const { lastFrame } = render(
      <Markdown content="Check [this link](https://example.com)" />
    );

    expect(lastFrame()).toContain('this link');
  });

  it('handles empty content', () => {
    const { lastFrame } = render(<Markdown content="" />);

    expect(lastFrame()).toBeDefined();
  });

  it('handles mixed content', () => {
    const content = `# Title

This is **bold** and *italic* with \`code\`.

- List item 1
- List item 2

> A quote

\`\`\`
code block
\`\`\`
`;
    const { lastFrame } = render(<Markdown content={content} />);

    expect(lastFrame()).toContain('# Title');
    expect(lastFrame()).toContain('bold');
    expect(lastFrame()).toContain('italic');
    expect(lastFrame()).toContain('•');
    expect(lastFrame()).toContain('│');
  });

  it('handles nested formatting', () => {
    const { lastFrame } = render(
      <Markdown content="This has **bold with *italic* inside**" />
    );

    expect(lastFrame()).toContain('bold');
    expect(lastFrame()).toContain('italic');
  });
});

describe('MarkdownPreview', () => {
  it('renders with title', () => {
    const { lastFrame } = render(
      <MarkdownPreview content="Hello" title="Preview" />
    );

    expect(lastFrame()).toContain('Preview');
    expect(lastFrame()).toContain('Hello');
  });

  it('truncates when maxHeight exceeded', () => {
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    const { lastFrame } = render(
      <MarkdownPreview content={content} maxHeight={2} />
    );

    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('3 more lines');
  });

  it('shows all content when within maxHeight', () => {
    const content = 'Line 1\nLine 2';
    const { lastFrame } = render(
      <MarkdownPreview content={content} maxHeight={5} />
    );

    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
    expect(lastFrame()).not.toContain('more lines');
  });
});

describe('PRDescription', () => {
  it('renders description', () => {
    const { lastFrame } = render(
      <PRDescription description="This is the PR description" />
    );

    expect(lastFrame()).toContain('Description');
    expect(lastFrame()).toContain('This is the PR description');
  });

  it('shows placeholder for empty description', () => {
    const { lastFrame } = render(
      <PRDescription description="" />
    );

    expect(lastFrame()).toContain('No description provided');
  });

  it('shows placeholder for whitespace-only description', () => {
    const { lastFrame } = render(
      <PRDescription description="   " />
    );

    expect(lastFrame()).toContain('No description provided');
  });

  it('renders markdown in description', () => {
    const description = `# Summary

- Item 1
- Item 2`;
    const { lastFrame } = render(
      <PRDescription description={description} />
    );

    expect(lastFrame()).toContain('# Summary');
    expect(lastFrame()).toContain('•');
  });
});

describe('CommentBody', () => {
  it('renders comment body', () => {
    const { lastFrame } = render(
      <CommentBody body="This is a comment" />
    );

    expect(lastFrame()).toContain('This is a comment');
  });

  it('shows author when provided', () => {
    const { lastFrame } = render(
      <CommentBody body="Comment text" author="johndoe" />
    );

    expect(lastFrame()).toContain('@johndoe');
    expect(lastFrame()).toContain('Comment text');
  });

  it('shows timestamp when provided', () => {
    const { lastFrame } = render(
      <CommentBody body="Comment" timestamp="2 hours ago" />
    );

    expect(lastFrame()).toContain('2 hours ago');
  });

  it('shows author and timestamp together', () => {
    const { lastFrame } = render(
      <CommentBody
        body="Comment"
        author="alice"
        timestamp="1 day ago"
      />
    );

    expect(lastFrame()).toContain('@alice');
    expect(lastFrame()).toContain('1 day ago');
  });

  it('renders markdown in body', () => {
    const { lastFrame } = render(
      <CommentBody body="This has **bold** and `code`" />
    );

    expect(lastFrame()).toContain('bold');
    expect(lastFrame()).toContain('code');
  });
});
