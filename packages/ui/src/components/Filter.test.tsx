import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import {
  FilterBar,
  FilterChips,
  QuickFilter,
  FilterGroup,
  ActiveFilters,
  SortSelect,
  FilterSummary,
  SearchFilter,
  PresetFilter,
} from './Filter';
import { Text } from 'ink';

describe('FilterBar', () => {
  const options = [
    { value: 'open', label: 'Open', count: 5 },
    { value: 'closed', label: 'Closed', count: 10 },
    { value: 'merged', label: 'Merged', count: 3 },
  ];

  it('renders all options', () => {
    const { lastFrame } = render(
      <FilterBar options={options} selected={null} onSelect={() => {}} />
    );

    expect(lastFrame()).toContain('Open');
    expect(lastFrame()).toContain('Closed');
    expect(lastFrame()).toContain('Merged');
  });

  it('shows counts', () => {
    const { lastFrame } = render(
      <FilterBar options={options} selected={null} onSelect={() => {}} />
    );

    expect(lastFrame()).toContain('(5)');
    expect(lastFrame()).toContain('(10)');
    expect(lastFrame()).toContain('(3)');
  });

  it('renders label', () => {
    const { lastFrame } = render(
      <FilterBar
        options={options}
        selected={null}
        onSelect={() => {}}
        label="Status"
      />
    );

    expect(lastFrame()).toContain('Status:');
  });

  it('shows icons when provided', () => {
    const optionsWithIcons = [
      { value: 'open', label: 'Open', icon: '🟢' },
    ];

    const { lastFrame } = render(
      <FilterBar options={optionsWithIcons} selected={null} onSelect={() => {}} />
    );

    expect(lastFrame()).toContain('🟢');
  });
});

describe('FilterChips', () => {
  const filters = [
    { value: 'bug', label: 'Bug', color: 'red' },
    { value: 'feature', label: 'Feature', color: 'green' },
    { value: 'docs', label: 'Docs', color: 'blue' },
  ];

  it('renders all filter chips', () => {
    const { lastFrame } = render(
      <FilterChips filters={filters} active={[]} onToggle={() => {}} />
    );

    expect(lastFrame()).toContain('Bug');
    expect(lastFrame()).toContain('Feature');
    expect(lastFrame()).toContain('Docs');
  });

  it('shows clear button when filters active', () => {
    const { lastFrame } = render(
      <FilterChips
        filters={filters}
        active={['bug']}
        onToggle={() => {}}
        onClear={() => {}}
      />
    );

    expect(lastFrame()).toContain('×');
  });

  it('hides clear button when no filters active', () => {
    const { lastFrame } = render(
      <FilterChips
        filters={filters}
        active={[]}
        onToggle={() => {}}
        onClear={() => {}}
      />
    );

    // × should only appear if active.length > 0
  });
});

describe('QuickFilter', () => {
  it('shows checkbox unchecked when inactive', () => {
    const { lastFrame } = render(
      <QuickFilter label="My PRs" active={false} onToggle={() => {}} />
    );

    expect(lastFrame()).toContain('☐');
    expect(lastFrame()).toContain('My PRs');
  });

  it('shows checkbox checked when active', () => {
    const { lastFrame } = render(
      <QuickFilter label="My PRs" active={true} onToggle={() => {}} />
    );

    expect(lastFrame()).toContain('☑');
  });

  it('shows hotkey when provided', () => {
    const { lastFrame } = render(
      <QuickFilter label="My PRs" active={false} hotkey="m" onToggle={() => {}} />
    );

    expect(lastFrame()).toContain('[m]');
  });
});

describe('FilterGroup', () => {
  it('renders title and children', () => {
    const { lastFrame } = render(
      <FilterGroup title="Labels">
        <Text>Child content</Text>
      </FilterGroup>
    );

    expect(lastFrame()).toContain('Labels');
    expect(lastFrame()).toContain('Child content');
  });

  it('shows collapse indicator when collapsible', () => {
    const { lastFrame } = render(
      <FilterGroup title="Labels" collapsed={false} onToggle={() => {}}>
        <Text>Content</Text>
      </FilterGroup>
    );

    expect(lastFrame()).toContain('▾');
  });

  it('shows expand indicator when collapsed', () => {
    const { lastFrame } = render(
      <FilterGroup title="Labels" collapsed={true} onToggle={() => {}}>
        <Text>Content</Text>
      </FilterGroup>
    );

    expect(lastFrame()).toContain('▸');
  });

  it('hides children when collapsed', () => {
    const { lastFrame } = render(
      <FilterGroup title="Labels" collapsed={true} onToggle={() => {}}>
        <Text>Hidden content</Text>
      </FilterGroup>
    );

    expect(lastFrame()).not.toContain('Hidden content');
  });
});

describe('ActiveFilters', () => {
  const filters = [
    { key: 'status', value: 'open', label: 'Status: Open' },
    { key: 'author', value: 'me', label: 'Author: me' },
  ];

  it('renders active filters', () => {
    const { lastFrame } = render(
      <ActiveFilters filters={filters} onRemove={() => {}} />
    );

    expect(lastFrame()).toContain('Status: Open');
    expect(lastFrame()).toContain('Author: me');
  });

  it('shows filters label', () => {
    const { lastFrame } = render(
      <ActiveFilters filters={filters} onRemove={() => {}} />
    );

    expect(lastFrame()).toContain('Filters:');
  });

  it('shows clear all when multiple filters and onClearAll provided', () => {
    const { lastFrame } = render(
      <ActiveFilters filters={filters} onRemove={() => {}} onClearAll={() => {}} />
    );

    expect(lastFrame()).toContain('Clear all');
  });

  it('returns null when no filters', () => {
    const { lastFrame } = render(
      <ActiveFilters filters={[]} onRemove={() => {}} />
    );

    expect(lastFrame()).toBe('');
  });
});

describe('SortSelect', () => {
  const options = [
    { value: 'updated', label: 'Updated' },
    { value: 'created', label: 'Created' },
    { value: 'comments', label: 'Comments' },
  ];

  it('shows selected option', () => {
    const { lastFrame } = render(
      <SortSelect
        options={options}
        selected="updated"
        direction="desc"
        onSelect={() => {}}
        onToggleDirection={() => {}}
      />
    );

    expect(lastFrame()).toContain('Updated');
  });

  it('shows ascending indicator', () => {
    const { lastFrame } = render(
      <SortSelect
        options={options}
        selected="updated"
        direction="asc"
        onSelect={() => {}}
        onToggleDirection={() => {}}
      />
    );

    expect(lastFrame()).toContain('↑');
  });

  it('shows descending indicator', () => {
    const { lastFrame } = render(
      <SortSelect
        options={options}
        selected="updated"
        direction="desc"
        onSelect={() => {}}
        onToggleDirection={() => {}}
      />
    );

    expect(lastFrame()).toContain('↓');
  });

  it('shows sort label', () => {
    const { lastFrame } = render(
      <SortSelect
        options={options}
        selected="updated"
        direction="desc"
        onSelect={() => {}}
        onToggleDirection={() => {}}
      />
    );

    expect(lastFrame()).toContain('Sort:');
  });
});

describe('FilterSummary', () => {
  it('shows total when not filtered', () => {
    const { lastFrame } = render(
      <FilterSummary total={100} filtered={100} />
    );

    expect(lastFrame()).toContain('100 items');
  });

  it('shows filtered count when filtered', () => {
    const { lastFrame } = render(
      <FilterSummary total={100} filtered={25} />
    );

    expect(lastFrame()).toContain('25');
    expect(lastFrame()).toContain('100');
  });

  it('uses custom label', () => {
    const { lastFrame } = render(
      <FilterSummary total={10} filtered={10} label="PRs" />
    );

    expect(lastFrame()).toContain('PRs');
  });
});

describe('SearchFilter', () => {
  it('shows placeholder when no query', () => {
    const { lastFrame } = render(
      <SearchFilter query="" onClear={() => {}} />
    );

    expect(lastFrame()).toContain('Search...');
  });

  it('shows custom placeholder', () => {
    const { lastFrame } = render(
      <SearchFilter query="" placeholder="Filter" onClear={() => {}} />
    );

    expect(lastFrame()).toContain('Filter...');
  });

  it('shows query when present', () => {
    const { lastFrame } = render(
      <SearchFilter query="test query" onClear={() => {}} />
    );

    expect(lastFrame()).toContain('test query');
    expect(lastFrame()).toContain('🔍');
  });

  it('shows clear button when query present', () => {
    const { lastFrame } = render(
      <SearchFilter query="test" onClear={() => {}} />
    );

    expect(lastFrame()).toContain('×');
  });
});

describe('PresetFilter', () => {
  const presets = [
    { id: 'my-prs', label: 'My PRs', filters: { author: 'me' }, icon: '👤' },
    { id: 'needs-review', label: 'Needs Review', filters: { status: 'open' }, icon: '👁' },
  ];

  it('renders all presets', () => {
    const { lastFrame } = render(
      <PresetFilter presets={presets} onApply={() => {}} />
    );

    expect(lastFrame()).toContain('My PRs');
    expect(lastFrame()).toContain('Needs Review');
  });

  it('shows icons', () => {
    const { lastFrame } = render(
      <PresetFilter presets={presets} onApply={() => {}} />
    );

    expect(lastFrame()).toContain('👤');
    expect(lastFrame()).toContain('👁');
  });

  it('highlights active preset', () => {
    const { lastFrame } = render(
      <PresetFilter presets={presets} activePreset="my-prs" onApply={() => {}} />
    );

    expect(lastFrame()).toContain('My PRs');
  });
});
