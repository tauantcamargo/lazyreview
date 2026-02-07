/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { SkeletonPRList, Skeleton } from './SkeletonPRList';

describe('SkeletonPRList', () => {
  it('renders default number of skeleton items (5)', () => {
    const { lastFrame } = render(<SkeletonPRList />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
    // Should render some content (skeleton bars)
    expect(frame?.length).toBeGreaterThan(0);
  });

  it('renders custom number of skeleton items', () => {
    const { lastFrame } = render(<SkeletonPRList count={3} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame?.length).toBeGreaterThan(0);
  });

  it('renders with custom width', () => {
    const { lastFrame } = render(<SkeletonPRList width={100} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with count of 0 (empty)', () => {
    const { lastFrame } = render(<SkeletonPRList count={0} />);
    const frame = lastFrame();
    // Should render but with minimal content
    expect(frame).toBeDefined();
  });

  it('renders with count of 1', () => {
    const { lastFrame } = render(<SkeletonPRList count={1} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with large count', () => {
    const { lastFrame } = render(<SkeletonPRList count={20} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });
});

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { lastFrame } = render(<Skeleton />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with custom width as number', () => {
    const { lastFrame } = render(<Skeleton width={50} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with custom width as string', () => {
    const { lastFrame } = render(<Skeleton width="50%" />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with custom height', () => {
    const { lastFrame } = render(<Skeleton height={3} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with height of 0 (no lines)', () => {
    const { lastFrame } = render(<Skeleton height={0} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders with combination of custom width and height', () => {
    const { lastFrame } = render(<Skeleton width={100} height={5} />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });
});
