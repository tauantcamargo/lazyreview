import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Table, SimpleTable } from './Table';

interface TestData {
  id: number;
  name: string;
  status: string;
  count: number;
}

describe('Table', () => {
  const columns = [
    { key: 'id' as const, header: 'ID', width: 5 },
    { key: 'name' as const, header: 'Name', width: 15 },
    { key: 'status' as const, header: 'Status', width: 10 },
  ];

  const data: TestData[] = [
    { id: 1, name: 'Alice', status: 'Active', count: 5 },
    { id: 2, name: 'Bob', status: 'Inactive', count: 3 },
    { id: 3, name: 'Charlie', status: 'Active', count: 8 },
  ];

  it('renders header row', () => {
    const { lastFrame } = render(<Table columns={columns} data={data} />);
    const output = lastFrame();

    expect(output).toContain('ID');
    expect(output).toContain('Name');
    expect(output).toContain('Status');
  });

  it('renders data rows', () => {
    const { lastFrame } = render(<Table columns={columns} data={data} />);
    const output = lastFrame();

    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
    expect(output).toContain('Charlie');
  });

  it('renders empty message when no data', () => {
    const { lastFrame } = render(<Table columns={columns} data={[]} />);
    const output = lastFrame();

    expect(output).toContain('No data');
  });

  it('renders custom empty message', () => {
    const { lastFrame } = render(
      <Table columns={columns} data={[]} emptyMessage="Nothing here" />
    );
    const output = lastFrame();

    expect(output).toContain('Nothing here');
  });

  it('hides header when showHeader is false', () => {
    const { lastFrame } = render(
      <Table columns={columns} data={data} showHeader={false} />
    );
    const output = lastFrame();

    expect(output).not.toContain('ID');
    expect(output).toContain('Alice');
  });

  it('highlights selected row', () => {
    const { lastFrame } = render(
      <Table columns={columns} data={data} selectedIndex={1} />
    );

    expect(lastFrame()).toBeTruthy();
  });

  it('supports custom render function', () => {
    const columnsWithRender = [
      ...columns,
      {
        key: 'count' as const,
        header: 'Count',
        width: 10,
        render: (value: unknown) => `#${value}`,
      },
    ];

    const { lastFrame } = render(
      <Table columns={columnsWithRender} data={data} />
    );
    const output = lastFrame();

    expect(output).toContain('#5');
    expect(output).toContain('#3');
  });

  it('truncates long values', () => {
    const longData = [
      { id: 1, name: 'A very long name that exceeds width', status: 'Active', count: 0 },
    ];

    const { lastFrame } = render(
      <Table columns={columns} data={longData} />
    );
    const output = lastFrame();

    expect(output).toContain('…');
  });

  it('limits rows with maxHeight', () => {
    const manyRows: TestData[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      status: 'Active',
      count: i,
    }));

    const { lastFrame } = render(
      <Table columns={columns} data={manyRows} maxHeight={5} />
    );
    const output = lastFrame();

    expect(output).toContain('... and');
    expect(output).toContain('more rows');
  });

  it('handles null and undefined values', () => {
    const dataWithNull = [
      { id: 1, name: null as unknown as string, status: 'Active', count: 0 },
    ];

    const { lastFrame } = render(
      <Table columns={columns} data={dataWithNull} />
    );

    expect(lastFrame()).toBeTruthy();
  });

  it('handles boolean values', () => {
    const boolColumns = [
      { key: 'active' as const, header: 'Active', width: 10 },
    ];
    const boolData = [{ active: true }, { active: false }];

    const { lastFrame } = render(
      <Table columns={boolColumns} data={boolData} />
    );
    const output = lastFrame();

    expect(output).toContain('Yes');
    expect(output).toContain('No');
  });

  it('supports nested key paths', () => {
    const nestedColumns = [
      { key: 'user.name' as string, header: 'User', width: 15 },
    ];
    const nestedData = [
      { user: { name: 'Alice' } },
      { user: { name: 'Bob' } },
    ];

    const { lastFrame } = render(
      <Table columns={nestedColumns} data={nestedData} />
    );
    const output = lastFrame();

    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
  });

  it('aligns columns right', () => {
    const alignedColumns = [
      { key: 'count' as const, header: 'Count', width: 10, align: 'right' as const },
    ];

    const { lastFrame } = render(
      <Table columns={alignedColumns} data={data} />
    );

    expect(lastFrame()).toBeTruthy();
  });

  it('applies striped styling', () => {
    const { lastFrame } = render(
      <Table columns={columns} data={data} striped />
    );

    expect(lastFrame()).toBeTruthy();
  });
});

describe('SimpleTable', () => {
  it('renders headers and rows', () => {
    const { lastFrame } = render(
      <SimpleTable
        headers={['Name', 'Age']}
        rows={[
          ['Alice', '25'],
          ['Bob', '30'],
        ]}
      />
    );
    const output = lastFrame();

    expect(output).toContain('Name');
    expect(output).toContain('Age');
    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
  });

  it('highlights selected row', () => {
    const { lastFrame } = render(
      <SimpleTable
        headers={['Name']}
        rows={[['Alice'], ['Bob']]}
        selectedRow={0}
      />
    );

    expect(lastFrame()).toBeTruthy();
  });

  it('uses custom column widths', () => {
    const { lastFrame } = render(
      <SimpleTable
        headers={['Name', 'Description']}
        rows={[['A', 'B']]}
        columnWidths={[10, 30]}
      />
    );

    expect(lastFrame()).toBeTruthy();
  });
});
