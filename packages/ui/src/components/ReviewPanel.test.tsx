import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ReviewPanel, type Review } from './ReviewPanel';

describe('ReviewPanel', () => {
  const createReview = (overrides: Partial<Review> = {}): Review => ({
    id: 'review-1',
    author: 'reviewer',
    state: 'COMMENT',
    submittedAt: new Date().toISOString(),
    comments: [],
    ...overrides,
  });

  it('renders empty state when no reviews', () => {
    const { lastFrame } = render(
      <ReviewPanel reviews={[]} width={80} height={20} />
    );
    expect(lastFrame()).toContain('No reviews yet');
  });

  it('renders review count', () => {
    const reviews = [createReview({ id: '1' }), createReview({ id: '2' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Reviews (2)');
  });

  it('renders approved review state', () => {
    const reviews = [createReview({ state: 'APPROVE' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Approved');
  });

  it('renders changes requested state', () => {
    const reviews = [createReview({ state: 'REQUEST_CHANGES' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Changes Requested');
  });

  it('renders comment state', () => {
    const reviews = [createReview({ state: 'COMMENT' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Commented');
  });

  it('renders author name', () => {
    const reviews = [createReview({ author: 'john_doe' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('john_doe');
  });

  it('renders review body', () => {
    const reviews = [createReview({ body: 'Great work on this PR!' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('Great work on this PR!');
  });

  it('renders comment count', () => {
    const reviews = [
      createReview({
        comments: [
          { id: '1', author: 'a', body: 'b', createdAt: new Date().toISOString() },
          { id: '2', author: 'a', body: 'b', createdAt: new Date().toISOString() },
        ],
      }),
    ];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} />
    );
    expect(lastFrame()).toContain('2 comments');
  });

  it('highlights selected review', () => {
    const reviews = [createReview({ id: '1' }), createReview({ id: '2' })];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} selectedIndex={1} width={80} height={20} />
    );
    expect(lastFrame()).toContain('▸');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const reviews = [createReview()];
    const { lastFrame } = render(
      <ReviewPanel reviews={reviews} width={80} height={20} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});
