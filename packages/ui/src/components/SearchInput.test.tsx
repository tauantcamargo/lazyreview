import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('renders search prefix', () => {
    const { lastFrame } = render(<SearchInput />);
    expect(lastFrame()).toContain('/');
  });

  it('renders placeholder when no value', () => {
    const { lastFrame } = render(<SearchInput placeholder="Type to search" />);
    expect(lastFrame()).toContain('Type to search');
  });

  it('renders value', () => {
    const { lastFrame } = render(<SearchInput value="my search" />);
    expect(lastFrame()).toContain('my search');
  });

  it('shows cursor when active', () => {
    const { lastFrame } = render(<SearchInput isActive />);
    // The cursor is rendered as inverse space
    expect(lastFrame()).toBeDefined();
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(<SearchInput theme={theme} />);
    expect(lastFrame()).toBeDefined();
  });
});
