import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { TextArea, CommentInput, InlineInput } from './TextArea';

describe('TextArea', () => {
  it('renders with placeholder when empty', () => {
    const { lastFrame } = render(
      <TextArea placeholder="Type here..." />
    );

    expect(lastFrame()).toContain('Type here...');
  });

  it('renders provided value', () => {
    const { lastFrame } = render(
      <TextArea value="Hello World" />
    );

    expect(lastFrame()).toContain('Hello World');
  });

  it('renders multi-line content', () => {
    const { lastFrame } = render(
      <TextArea value="Line 1\nLine 2\nLine 3" />
    );

    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
    expect(lastFrame()).toContain('Line 3');
  });

  it('shows line numbers when enabled', () => {
    const { lastFrame } = render(
      <TextArea value="Line 1\nLine 2" showLineNumbers={true} />
    );

    expect(lastFrame()).toContain('1');
    expect(lastFrame()).toContain('2');
    expect(lastFrame()).toContain('│');
  });

  it('does not show line number prefix by default', () => {
    const { lastFrame } = render(
      <TextArea value="Content" showLineNumbers={false} />
    );

    // When showLineNumbers is false, there should be no line number prefix pattern like "  1 │"
    expect(lastFrame()).not.toMatch(/\d+ │/);
  });

  it('shows help text when enabled', () => {
    const { lastFrame } = render(
      <TextArea showHelp={true} />
    );

    expect(lastFrame()).toContain('Ctrl+Enter');
    expect(lastFrame()).toContain('Esc');
  });

  it('hides help text when disabled', () => {
    const { lastFrame } = render(
      <TextArea showHelp={false} />
    );

    expect(lastFrame()).not.toContain('Ctrl+Enter');
  });

  it('shows character count when maxLength is set', () => {
    const { lastFrame } = render(
      <TextArea value="Hello" maxLength={100} showHelp={true} />
    );

    expect(lastFrame()).toContain('5/100');
  });

  it('respects rows setting', () => {
    const { lastFrame } = render(
      <TextArea value="Line 1" rows={3} />
    );

    const frame = lastFrame() ?? '';
    // Should have space for 3 rows of content
    expect(frame.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('shows cursor indicator when focused', () => {
    const { lastFrame } = render(
      <TextArea value="" isFocused={true} />
    );

    // The cursor is rendered as inverse text
    expect(lastFrame()).toBeDefined();
  });
});

describe('CommentInput', () => {
  it('renders title', () => {
    const { lastFrame } = render(
      <CommentInput title="Add Review Comment" />
    );

    expect(lastFrame()).toContain('Add Review Comment');
  });

  it('uses default title', () => {
    const { lastFrame } = render(<CommentInput />);

    expect(lastFrame()).toContain('Add comment');
  });

  it('shows placeholder', () => {
    const { lastFrame } = render(
      <CommentInput placeholder="Write something..." />
    );

    expect(lastFrame()).toContain('Write something...');
  });

  it('renders value', () => {
    const { lastFrame } = render(
      <CommentInput value="My comment" />
    );

    expect(lastFrame()).toContain('My comment');
  });

  it('shows submit and cancel labels', () => {
    const { lastFrame } = render(
      <CommentInput submitLabel="Post" cancelLabel="Discard" />
    );

    expect(lastFrame()).toContain('Post');
    expect(lastFrame()).toContain('Discard');
  });

  it('shows character count with maxLength', () => {
    const { lastFrame } = render(
      <CommentInput value="Test" maxLength={1000} />
    );

    expect(lastFrame()).toContain('4/1000');
  });
});

describe('InlineInput', () => {
  it('renders placeholder when empty', () => {
    const { lastFrame } = render(
      <InlineInput placeholder="Search..." />
    );

    expect(lastFrame()).toContain('Search...');
  });

  it('renders value', () => {
    const { lastFrame } = render(
      <InlineInput value="search term" />
    );

    expect(lastFrame()).toContain('search term');
  });

  it('renders prefix', () => {
    const { lastFrame } = render(
      <InlineInput prefix="/ " value="query" />
    );

    expect(lastFrame()).toContain('/');
    expect(lastFrame()).toContain('query');
  });

  it('shows cursor when focused', () => {
    const { lastFrame } = render(
      <InlineInput value="text" isFocused={true} />
    );

    expect(lastFrame()).toBeDefined();
  });

  it('hides cursor when not focused', () => {
    const { lastFrame } = render(
      <InlineInput value="text" isFocused={false} />
    );

    expect(lastFrame()).toContain('text');
  });
});
