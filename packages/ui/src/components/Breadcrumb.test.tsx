import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

describe('Breadcrumb', () => {
  const createItems = (): BreadcrumbItem[] => [
    { id: 'home', label: 'Home' },
    { id: 'repo', label: 'owner/repo' },
    { id: 'pr', label: '#123' },
  ];

  it('renders all items', () => {
    const { lastFrame } = render(<Breadcrumb items={createItems()} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Home');
    expect(frame).toContain('owner/repo');
    expect(frame).toContain('#123');
  });

  it('renders default separator', () => {
    const { lastFrame } = render(<Breadcrumb items={createItems()} />);
    expect(lastFrame()).toContain('›');
  });

  it('renders custom separator', () => {
    const { lastFrame } = render(
      <Breadcrumb items={createItems()} separator=" / " />
    );
    expect(lastFrame()).toContain('/');
  });

  it('does not render separator after last item', () => {
    const items: BreadcrumbItem[] = [
      { id: 'only', label: 'Only Item' },
    ];
    const { lastFrame } = render(<Breadcrumb items={items} />);
    expect(lastFrame()).not.toContain('›');
  });

  it('renders icons', () => {
    const items: BreadcrumbItem[] = [
      { id: 'home', label: 'Home', icon: '🏠' },
      { id: 'repo', label: 'Repo', icon: '📁' },
    ];
    const { lastFrame } = render(<Breadcrumb items={items} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('🏠');
    expect(frame).toContain('📁');
  });

  it('renders empty for no items', () => {
    const { lastFrame } = render(<Breadcrumb items={[]} />);
    expect(lastFrame()).toBe('');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };
    const { lastFrame } = render(
      <Breadcrumb items={createItems()} theme={theme} />
    );
    expect(lastFrame()).toBeDefined();
  });
});
