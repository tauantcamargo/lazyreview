import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { CommentsPanel, type Comment } from './CommentsPanel';

describe('CommentsPanel', () => {
  const createComment = (overrides: Partial<Comment> = {}): Comment => ({
    id: 'comment-1',
    author: 'commenter',
    body: 'This is a comment',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it('renders empty state when no comments', () => {
    const { lastFrame } = render(
      <CommentsPanel comments={[]} width={80} height={20} />
    );
    expect(lastFrame()).toContain('No comments');
  });

  it('renders comments header', () => {
    const comments = [createComment()];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Comments');
  });

  it('renders unresolved count', () => {
    const comments = [
      createComment({ id: '1', isResolved: false }),
      createComment({ id: '2', isResolved: false }),
    ];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('2 unresolved');
  });

  it('hides resolved comments by default', () => {
    const comments = [
      createComment({ id: '1', isResolved: true, body: 'Resolved comment' }),
      createComment({ id: '2', isResolved: false, body: 'Open comment' }),
    ];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Open comment');
    expect(lastFrame()).not.toContain('Resolved comment');
  });

  it('shows resolved comments when showResolved is true', () => {
    const comments = [
      createComment({ id: '1', isResolved: true, body: 'Resolved comment' }),
    ];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} showResolved width={80} height={20} />
    );
    expect(lastFrame()).toContain('Resolved comment');
  });

  it('renders author name', () => {
    const comments = [createComment({ author: 'jane_doe' })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('jane_doe');
  });

  it('renders file path and line number', () => {
    const comments = [createComment({ path: 'src/app.ts', line: 42 })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('src/app.ts:42');
  });

  it('renders reply count', () => {
    const comments = [createComment({ replyCount: 3 })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('3 replies');
  });

  it('renders single reply correctly', () => {
    const comments = [createComment({ replyCount: 1 })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('1 reply');
  });

  it('shows resolved indicator', () => {
    const comments = [createComment({ isResolved: true })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} showResolved width={80} height={20} />
    );
    expect(lastFrame()).toContain('✓');
  });

  it('highlights selected comment', () => {
    const comments = [createComment({ id: '1' }), createComment({ id: '2' })];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} selectedIndex={1} width={80} height={20} />
    );
    expect(lastFrame()).toContain('▸');
  });

  it('shows message when all resolved', () => {
    const comments = [
      createComment({ id: '1', isResolved: true }),
      createComment({ id: '2', isResolved: true }),
    ];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} />
    );
    expect(lastFrame()).toContain('All 2 comments resolved');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const comments = [createComment()];
    const { lastFrame } = render(
      <CommentsPanel comments={comments} width={80} height={20} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});
