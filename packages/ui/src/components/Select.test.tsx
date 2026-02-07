import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Select, MultiSelect, RadioGroup, Toggle, Dropdown } from './Select';

const testOptions = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select', () => {
  it('renders all options', () => {
    const { lastFrame } = render(<Select options={testOptions} />);

    expect(lastFrame()).toContain('Option A');
    expect(lastFrame()).toContain('Option B');
    expect(lastFrame()).toContain('Option C');
  });

  it('shows selection indicator on selected option', () => {
    const { lastFrame } = render(
      <Select options={testOptions} value="b" />
    );

    expect(lastFrame()).toContain('●');
  });

  it('shows pointer indicator for highlight', () => {
    const { lastFrame } = render(
      <Select options={testOptions} />
    );

    expect(lastFrame()).toContain('▸');
  });

  it('renders option descriptions', () => {
    const optionsWithDesc = [
      { value: 'a', label: 'Option A', description: 'First option' },
    ];

    const { lastFrame } = render(<Select options={optionsWithDesc} />);

    expect(lastFrame()).toContain('First option');
  });

  it('dims disabled options', () => {
    const optionsWithDisabled = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B', disabled: true },
    ];

    const { lastFrame } = render(<Select options={optionsWithDisabled} />);

    // Both options should be rendered
    expect(lastFrame()).toContain('Option A');
    expect(lastFrame()).toContain('Option B');
  });

  it('can hide indicator', () => {
    const { lastFrame } = render(
      <Select options={testOptions} showIndicator={false} />
    );

    expect(lastFrame()).not.toContain('▸');
    expect(lastFrame()).not.toContain('●');
  });
});

describe('MultiSelect', () => {
  it('renders all options with unchecked checkboxes', () => {
    const { lastFrame } = render(<MultiSelect options={testOptions} />);

    expect(lastFrame()).toContain('☐');
    expect(lastFrame()).toContain('Option A');
    expect(lastFrame()).toContain('Option B');
  });

  it('shows checked state for selected values', () => {
    const { lastFrame } = render(
      <MultiSelect options={testOptions} values={['a', 'c']} />
    );

    expect(lastFrame()).toContain('☑');
  });

  it('shows mix of checked and unchecked', () => {
    const { lastFrame } = render(
      <MultiSelect options={testOptions} values={['b']} />
    );

    // Should have both checked and unchecked boxes
    expect(lastFrame()).toContain('☑');
    expect(lastFrame()).toContain('☐');
  });

  it('renders empty selection', () => {
    const { lastFrame } = render(
      <MultiSelect options={testOptions} values={[]} />
    );

    // All unchecked
    const checkboxCount = (lastFrame() ?? '').match(/☐/g)?.length ?? 0;
    expect(checkboxCount).toBe(3);
  });

  it('dims disabled options', () => {
    const optionsWithDisabled = [
      { value: 'a', label: 'Enabled' },
      { value: 'b', label: 'Disabled', disabled: true },
    ];

    const { lastFrame } = render(<MultiSelect options={optionsWithDisabled} />);

    expect(lastFrame()).toContain('Enabled');
    expect(lastFrame()).toContain('Disabled');
  });
});

describe('RadioGroup', () => {
  it('renders all options with empty radio buttons', () => {
    const { lastFrame } = render(<RadioGroup options={testOptions} />);

    expect(lastFrame()).toContain('○');
    expect(lastFrame()).toContain('Option A');
  });

  it('shows filled radio for selected value', () => {
    const { lastFrame } = render(
      <RadioGroup options={testOptions} value="b" />
    );

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('Option B');
  });

  it('shows only one filled radio', () => {
    const { lastFrame } = render(
      <RadioGroup options={testOptions} value="a" />
    );

    // Should have exactly one filled radio
    const filledCount = (lastFrame() ?? '').match(/●/g)?.length ?? 0;
    const emptyCount = (lastFrame() ?? '').match(/○/g)?.length ?? 0;
    expect(filledCount).toBe(1);
    expect(emptyCount).toBe(2);
  });

  it('shows all empty radios when no value', () => {
    const { lastFrame } = render(<RadioGroup options={testOptions} />);

    const emptyCount = (lastFrame() ?? '').match(/○/g)?.length ?? 0;
    expect(emptyCount).toBe(3);
  });
});

describe('Toggle', () => {
  it('renders off state', () => {
    const { lastFrame } = render(<Toggle value={false} />);

    expect(lastFrame()).toContain('Off');
    expect(lastFrame()).toContain('○');
  });

  it('renders on state', () => {
    const { lastFrame } = render(<Toggle value={true} />);

    expect(lastFrame()).toContain('On');
    expect(lastFrame()).toContain('◉');
  });

  it('renders label when provided', () => {
    const { lastFrame } = render(
      <Toggle value={false} label="Enable feature" />
    );

    expect(lastFrame()).toContain('Enable feature');
  });

  it('renders without label', () => {
    const { lastFrame } = render(<Toggle value={true} />);

    expect(lastFrame()).toContain('On');
  });
});

describe('Dropdown', () => {
  it('renders selected value', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} value="b" />
    );

    expect(lastFrame()).toContain('Option B');
  });

  it('renders placeholder when no value', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} placeholder="Choose one" />
    );

    expect(lastFrame()).toContain('Choose one');
  });

  it('uses default placeholder', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} />
    );

    expect(lastFrame()).toContain('Select...');
  });

  it('shows closed indicator when closed', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} isOpen={false} />
    );

    expect(lastFrame()).toContain('▼');
  });

  it('shows open indicator when open', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} isOpen={true} />
    );

    expect(lastFrame()).toContain('▲');
  });

  it('shows options when open', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} isOpen={true} />
    );

    expect(lastFrame()).toContain('Option A');
    expect(lastFrame()).toContain('Option B');
    expect(lastFrame()).toContain('Option C');
  });

  it('hides options when closed', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} isOpen={false} />
    );

    // The selected value or placeholder should be visible
    expect(lastFrame()).toContain('Select...');

    // Options should not be in a separate list below (checking for border)
    const frame = lastFrame() ?? '';
    const lines = frame.split('\n');
    // Closed dropdown should only have the header, not the expanded list
    expect(lines.length).toBeLessThan(6);
  });

  it('displays selected option when open', () => {
    const { lastFrame } = render(
      <Dropdown options={testOptions} value="b" isOpen={true} />
    );

    // Selected value should appear in header
    expect(lastFrame()).toContain('Option B');
  });
});
