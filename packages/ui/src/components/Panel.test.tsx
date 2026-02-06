import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  Panel,
  CollapsiblePanel,
  Section,
  Card,
  InfoPanel,
  StatsRow,
  HeaderBar,
  FooterBar,
  Divider,
} from './Panel';
import { Text } from 'ink';

describe('Panel', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      <Panel>
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('Content');
  });

  it('renders title', () => {
    const { lastFrame } = render(
      <Panel title="My Panel">
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('My Panel');
  });

  it('renders subtitle', () => {
    const { lastFrame } = render(
      <Panel title="Title" subtitle="(3 items)">
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('Title');
    expect(lastFrame()).toContain('(3 items)');
  });

  it('renders header right content', () => {
    const { lastFrame } = render(
      <Panel title="Title" headerRight={<Text>Right</Text>}>
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('Right');
  });

  it('renders footer', () => {
    const { lastFrame } = render(
      <Panel footer={<Text>Footer content</Text>}>
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('Footer content');
  });

  it('applies focused styling', () => {
    const { lastFrame } = render(
      <Panel title="Focused" focused={true}>
        <Text>Content</Text>
      </Panel>
    );

    expect(lastFrame()).toContain('Focused');
  });
});

describe('CollapsiblePanel', () => {
  it('shows content when expanded', () => {
    const { lastFrame } = render(
      <CollapsiblePanel title="Expandable" collapsed={false}>
        <Text>Hidden content</Text>
      </CollapsiblePanel>
    );

    expect(lastFrame()).toContain('Hidden content');
    expect(lastFrame()).toContain('▾');
  });

  it('hides content when collapsed', () => {
    const { lastFrame } = render(
      <CollapsiblePanel title="Expandable" collapsed={true}>
        <Text>Hidden content</Text>
      </CollapsiblePanel>
    );

    expect(lastFrame()).not.toContain('Hidden content');
    expect(lastFrame()).toContain('▸');
  });

  it('shows title with collapse indicator', () => {
    const { lastFrame } = render(
      <CollapsiblePanel title="Panel Title" collapsed={false}>
        <Text>Content</Text>
      </CollapsiblePanel>
    );

    expect(lastFrame()).toContain('▾ Panel Title');
  });
});

describe('Section', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      <Section>
        <Text>Section content</Text>
      </Section>
    );

    expect(lastFrame()).toContain('Section content');
  });

  it('renders title', () => {
    const { lastFrame } = render(
      <Section title="Section Title">
        <Text>Content</Text>
      </Section>
    );

    expect(lastFrame()).toContain('Section Title');
  });
});

describe('Card', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      <Card>
        <Text>Card content</Text>
      </Card>
    );

    expect(lastFrame()).toContain('Card content');
  });

  it('renders title', () => {
    const { lastFrame } = render(
      <Card title="Card Title">
        <Text>Content</Text>
      </Card>
    );

    expect(lastFrame()).toContain('Card Title');
  });

  it('renders with variant', () => {
    const { lastFrame } = render(
      <Card title="Success" variant="success">
        <Text>Content</Text>
      </Card>
    );

    expect(lastFrame()).toContain('Success');
  });

  it('renders compact', () => {
    const { lastFrame } = render(
      <Card compact={true}>
        <Text>Compact content</Text>
      </Card>
    );

    expect(lastFrame()).toContain('Compact content');
  });
});

describe('InfoPanel', () => {
  const items = [
    { label: 'Name', value: 'John' },
    { label: 'Age', value: '30' },
    { label: 'City', value: 'NYC' },
  ];

  it('renders items in single column', () => {
    const { lastFrame } = render(<InfoPanel items={items} columns={1} />);

    expect(lastFrame()).toContain('Name:');
    expect(lastFrame()).toContain('John');
    expect(lastFrame()).toContain('Age:');
    expect(lastFrame()).toContain('30');
  });

  it('renders items in two columns', () => {
    const { lastFrame } = render(<InfoPanel items={items} columns={2} />);

    expect(lastFrame()).toContain('Name:');
    expect(lastFrame()).toContain('Age:');
    expect(lastFrame()).toContain('City:');
  });

  it('renders ReactNode values', () => {
    const { lastFrame } = render(
      <InfoPanel
        items={[
          { label: 'Status', value: <Text color="green">Active</Text> },
        ]}
      />
    );

    expect(lastFrame()).toContain('Status:');
    expect(lastFrame()).toContain('Active');
  });
});

describe('StatsRow', () => {
  const stats = [
    { label: 'PRs', value: 10 },
    { label: 'Reviews', value: 5 },
    { label: 'Comments', value: 20 },
  ];

  it('renders all stats', () => {
    const { lastFrame } = render(<StatsRow stats={stats} />);

    expect(lastFrame()).toContain('PRs:');
    expect(lastFrame()).toContain('10');
    expect(lastFrame()).toContain('Reviews:');
    expect(lastFrame()).toContain('5');
    expect(lastFrame()).toContain('Comments:');
    expect(lastFrame()).toContain('20');
  });

  it('shows separators', () => {
    const { lastFrame } = render(<StatsRow stats={stats} />);

    expect(lastFrame()).toContain('│');
  });

  it('uses custom separator', () => {
    const { lastFrame } = render(<StatsRow stats={stats} separator=" | " />);

    expect(lastFrame()).toContain('|');
  });

  it('applies color to stats', () => {
    const { lastFrame } = render(
      <StatsRow stats={[{ label: 'Added', value: '+10', color: 'green' }]} />
    );

    expect(lastFrame()).toContain('+10');
  });
});

describe('HeaderBar', () => {
  it('renders title', () => {
    const { lastFrame } = render(<HeaderBar title="Header Title" />);

    expect(lastFrame()).toContain('Header Title');
  });

  it('renders subtitle', () => {
    const { lastFrame } = render(
      <HeaderBar title="Title" subtitle="Subtitle" />
    );

    expect(lastFrame()).toContain('Title');
    expect(lastFrame()).toContain('Subtitle');
  });

  it('renders right content', () => {
    const { lastFrame } = render(
      <HeaderBar title="Title" right={<Text>Right</Text>} />
    );

    expect(lastFrame()).toContain('Right');
  });
});

describe('FooterBar', () => {
  it('renders left content', () => {
    const { lastFrame } = render(
      <FooterBar left={<Text>Left</Text>} />
    );

    expect(lastFrame()).toContain('Left');
  });

  it('renders center content', () => {
    const { lastFrame } = render(
      <FooterBar center={<Text>Center</Text>} />
    );

    expect(lastFrame()).toContain('Center');
  });

  it('renders right content', () => {
    const { lastFrame } = render(
      <FooterBar right={<Text>Right</Text>} />
    );

    expect(lastFrame()).toContain('Right');
  });

  it('renders all sections', () => {
    const { lastFrame } = render(
      <FooterBar
        left={<Text>L</Text>}
        center={<Text>C</Text>}
        right={<Text>R</Text>}
      />
    );

    expect(lastFrame()).toContain('L');
    expect(lastFrame()).toContain('C');
    expect(lastFrame()).toContain('R');
  });
});

describe('Divider', () => {
  it('renders solid line', () => {
    const { lastFrame } = render(<Divider style="solid" />);

    expect(lastFrame()).toContain('─');
  });

  it('renders dashed line', () => {
    const { lastFrame } = render(<Divider style="dashed" />);

    expect(lastFrame()).toContain('╌');
  });

  it('renders dotted line', () => {
    const { lastFrame } = render(<Divider style="dotted" />);

    expect(lastFrame()).toContain('┄');
  });

  it('renders with label', () => {
    const { lastFrame } = render(<Divider label="Section" />);

    expect(lastFrame()).toContain('Section');
    expect(lastFrame()).toContain('─');
  });
});
