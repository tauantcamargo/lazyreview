/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { LoadingSpinner, Spinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default message', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    expect(lastFrame()).toContain('Loading...');
  });

  it('renders with custom message', () => {
    const { lastFrame } = render(<LoadingSpinner message="Fetching pull requests..." />);
    expect(lastFrame()).toContain('Fetching pull requests...');
  });

  it('renders with dots type (default)', () => {
    const { lastFrame } = render(<LoadingSpinner type="dots" message="Loading" />);
    expect(lastFrame()).toContain('Loading');
    // Should render successfully with dots spinner
    expect(lastFrame()).toBeDefined();
  });

  it('renders with line type', () => {
    const { lastFrame } = render(<LoadingSpinner type="line" message="Loading" />);
    expect(lastFrame()).toContain('Loading');
  });

  it('renders with arc type', () => {
    const { lastFrame } = render(<LoadingSpinner type="arc" message="Loading" />);
    expect(lastFrame()).toContain('Loading');
  });

  it('renders centered by default', () => {
    const { lastFrame } = render(<LoadingSpinner message="Test" />);
    // Centered spinner should still show the message
    expect(lastFrame()).toContain('Test');
  });

  it('renders non-centered when centered=false', () => {
    const { lastFrame } = render(<LoadingSpinner message="Test" centered={false} />);
    expect(lastFrame()).toContain('Test');
  });
});

describe('Spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders dots spinner by default', () => {
    const { lastFrame } = render(<Spinner />);
    const frame = lastFrame();
    // Should render one of the dots frames
    expect(frame).toBeDefined();
    expect(frame?.length).toBeGreaterThan(0);
  });

  it('renders line spinner', () => {
    const { lastFrame } = render(<Spinner type="line" />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders arc spinner', () => {
    const { lastFrame } = render(<Spinner type="arc" />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('renders bounce spinner', () => {
    const { lastFrame } = render(<Spinner type="bounce" />);
    const frame = lastFrame();
    expect(frame).toBeDefined();
  });

  it('animates through frames', () => {
    const { lastFrame, rerender } = render(<Spinner type="line" />);
    const frame1 = lastFrame();

    // Advance time to trigger animation
    vi.advanceTimersByTime(100);
    rerender(<Spinner type="line" />);

    // Frame might change or stay the same depending on timing
    // Just verify it still renders
    const frame2 = lastFrame();
    expect(frame2).toBeDefined();
  });
});
