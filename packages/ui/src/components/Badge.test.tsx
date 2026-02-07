import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Badge, StatusBadge, LabelBadge, CountBadge, TagList } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    const { lastFrame } = render(<Badge>Test Badge</Badge>);
    const output = lastFrame();

    expect(output).toContain('Test Badge');
  });

  it('renders with icon', () => {
    const { lastFrame } = render(<Badge icon="★">Starred</Badge>);
    const output = lastFrame();

    expect(output).toContain('★');
    expect(output).toContain('Starred');
  });

  it('renders outlined style', () => {
    const { lastFrame } = render(<Badge outlined>Outlined</Badge>);
    const output = lastFrame();

    expect(output).toContain('[');
    expect(output).toContain('Outlined');
    expect(output).toContain(']');
  });

  it('renders with different variants', () => {
    const variants = ['success', 'warning', 'error', 'info', 'muted', 'default'] as const;

    for (const variant of variants) {
      const { lastFrame } = render(<Badge variant={variant}>Test</Badge>);
      expect(lastFrame()).toContain('Test');
    }
  });
});

describe('StatusBadge', () => {
  it('renders open status', () => {
    const { lastFrame } = render(<StatusBadge status="open" />);
    const output = lastFrame();

    expect(output).toContain('●');
    expect(output).toContain('Open');
  });

  it('renders closed status', () => {
    const { lastFrame } = render(<StatusBadge status="closed" />);
    const output = lastFrame();

    expect(output).toContain('○');
    expect(output).toContain('Closed');
  });

  it('renders merged status', () => {
    const { lastFrame } = render(<StatusBadge status="merged" />);
    const output = lastFrame();

    expect(output).toContain('◆');
    expect(output).toContain('Merged');
  });

  it('renders draft status', () => {
    const { lastFrame } = render(<StatusBadge status="draft" />);
    const output = lastFrame();

    expect(output).toContain('◐');
    expect(output).toContain('Draft');
  });

  it('renders approved status', () => {
    const { lastFrame } = render(<StatusBadge status="approved" />);
    const output = lastFrame();

    expect(output).toContain('✓');
    expect(output).toContain('Approved');
  });

  it('renders rejected status', () => {
    const { lastFrame } = render(<StatusBadge status="rejected" />);
    const output = lastFrame();

    expect(output).toContain('✗');
    expect(output).toContain('Rejected');
  });

  it('hides icon when showIcon is false', () => {
    const { lastFrame } = render(<StatusBadge status="open" showIcon={false} />);
    const output = lastFrame();

    expect(output).not.toContain('●');
    expect(output).toContain('Open');
  });
});

describe('LabelBadge', () => {
  it('renders label name', () => {
    const { lastFrame } = render(<LabelBadge name="bug" />);
    const output = lastFrame();

    expect(output).toContain('bug');
  });

  it('renders with dot indicator', () => {
    const { lastFrame } = render(<LabelBadge name="feature" />);
    const output = lastFrame();

    expect(output).toContain('◉');
  });
});

describe('CountBadge', () => {
  it('renders count', () => {
    const { lastFrame } = render(<CountBadge count={5} />);
    const output = lastFrame();

    expect(output).toContain('5');
  });

  it('renders with label', () => {
    const { lastFrame } = render(<CountBadge count={3} label="items" />);
    const output = lastFrame();

    expect(output).toContain('3');
    expect(output).toContain('items');
  });

  it('returns null for zero by default', () => {
    const { lastFrame } = render(<CountBadge count={0} />);
    const output = lastFrame();

    expect(output).toBe('');
  });

  it('shows zero when showZero is true', () => {
    const { lastFrame } = render(<CountBadge count={0} showZero />);
    const output = lastFrame();

    expect(output).toContain('0');
  });

  it('caps at maxDisplay', () => {
    const { lastFrame } = render(<CountBadge count={150} maxDisplay={99} />);
    const output = lastFrame();

    expect(output).toContain('99+');
  });

  it('shows exact count when under maxDisplay', () => {
    const { lastFrame } = render(<CountBadge count={50} maxDisplay={99} />);
    const output = lastFrame();

    expect(output).toContain('50');
    expect(output).not.toContain('+');
  });
});

describe('TagList', () => {
  it('renders all tags', () => {
    const tags = [
      { name: 'bug' },
      { name: 'feature' },
      { name: 'urgent' },
    ];

    const { lastFrame } = render(<TagList tags={tags} />);
    const output = lastFrame();

    expect(output).toContain('bug');
    expect(output).toContain('feature');
    expect(output).toContain('urgent');
  });

  it('limits visible tags with maxVisible', () => {
    const tags = [
      { name: 'tag1' },
      { name: 'tag2' },
      { name: 'tag3' },
      { name: 'tag4' },
      { name: 'tag5' },
    ];

    const { lastFrame } = render(<TagList tags={tags} maxVisible={2} />);
    const output = lastFrame();

    expect(output).toContain('tag1');
    expect(output).toContain('tag2');
    expect(output).not.toContain('tag3');
    expect(output).toContain('+3 more');
  });

  it('renders empty for no tags', () => {
    const { lastFrame } = render(<TagList tags={[]} />);

    expect(lastFrame()).toBe('');
  });

  it('renders custom separator', () => {
    const tags = [
      { name: 'tag1' },
      { name: 'tag2' },
    ];

    const { lastFrame } = render(<TagList tags={tags} separator=" | " />);
    const output = lastFrame();

    expect(output).toContain('|');
  });
});
