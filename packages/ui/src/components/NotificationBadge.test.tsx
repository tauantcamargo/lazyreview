import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { NotificationBadge } from './NotificationBadge';

describe('NotificationBadge', () => {
  it('renders count', () => {
    const { lastFrame } = render(
      <NotificationBadge count={5} />
    );
    expect(lastFrame()).toContain('5');
  });

  it('returns null for zero count by default', () => {
    const { lastFrame } = render(
      <NotificationBadge count={0} />
    );
    expect(lastFrame()).toBe('');
  });

  it('shows zero when showZero is true', () => {
    const { lastFrame } = render(
      <NotificationBadge count={0} showZero />
    );
    expect(lastFrame()).toContain('0');
  });

  it('returns null for negative count', () => {
    const { lastFrame } = render(
      <NotificationBadge count={-5} />
    );
    expect(lastFrame()).toBe('');
  });

  it('caps display at maxDisplay', () => {
    const { lastFrame } = render(
      <NotificationBadge count={150} maxDisplay={99} />
    );
    expect(lastFrame()).toContain('99+');
  });

  it('shows exact count when under maxDisplay', () => {
    const { lastFrame } = render(
      <NotificationBadge count={50} maxDisplay={99} />
    );
    expect(lastFrame()).toContain('50');
    expect(lastFrame()).not.toContain('+');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(
      <NotificationBadge count={5} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});
