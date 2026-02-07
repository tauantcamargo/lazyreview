import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders progress bar', () => {
    const { lastFrame } = render(<ProgressBar value={50} />);
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain('█');
    expect(lastFrame()).toContain('░');
  });

  it('shows percentage by default', () => {
    const { lastFrame } = render(<ProgressBar value={75} />);
    expect(lastFrame()).toContain('75%');
  });

  it('hides percentage when showPercentage is false', () => {
    const { lastFrame } = render(<ProgressBar value={50} showPercentage={false} />);
    expect(lastFrame()).not.toContain('%');
  });

  it('shows value when showValue is true', () => {
    const { lastFrame } = render(<ProgressBar value={30} max={100} showValue />);
    expect(lastFrame()).toContain('(30/100)');
  });

  it('renders label', () => {
    const { lastFrame } = render(<ProgressBar value={50} label="Loading" />);
    expect(lastFrame()).toContain('Loading');
  });

  it('clamps value to max', () => {
    const { lastFrame } = render(<ProgressBar value={150} max={100} />);
    expect(lastFrame()).toContain('100%');
  });

  it('clamps value to min', () => {
    const { lastFrame } = render(<ProgressBar value={-50} max={100} />);
    expect(lastFrame()).toContain('0%');
  });

  it('uses custom max value', () => {
    const { lastFrame } = render(<ProgressBar value={5} max={10} />);
    expect(lastFrame()).toContain('50%');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(<ProgressBar value={50} theme={theme} />);
    expect(lastFrame()).toBeDefined();
  });
});
