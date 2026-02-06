import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Tree, FileTreeView, TreeItem } from './Tree';

describe('Tree', () => {
  const simpleNodes = [
    { id: '1', label: 'Node 1' },
    { id: '2', label: 'Node 2' },
    { id: '3', label: 'Node 3' },
  ];

  const nestedNodes = [
    {
      id: 'folder1',
      label: 'Folder 1',
      children: [
        { id: 'file1', label: 'File 1' },
        { id: 'file2', label: 'File 2' },
      ],
    },
    { id: 'folder2', label: 'Folder 2' },
  ];

  it('renders all nodes', () => {
    const { lastFrame } = render(<Tree nodes={simpleNodes} />);

    expect(lastFrame()).toContain('Node 1');
    expect(lastFrame()).toContain('Node 2');
    expect(lastFrame()).toContain('Node 3');
  });

  it('shows expand arrow for parent nodes', () => {
    const { lastFrame } = render(<Tree nodes={nestedNodes} />);

    expect(lastFrame()).toContain('▸');
    expect(lastFrame()).toContain('Folder 1');
  });

  it('shows expanded arrow when expanded', () => {
    const { lastFrame } = render(
      <Tree nodes={nestedNodes} expandedIds={['folder1']} />
    );

    expect(lastFrame()).toContain('▾');
    expect(lastFrame()).toContain('File 1');
    expect(lastFrame()).toContain('File 2');
  });

  it('hides children when collapsed', () => {
    const { lastFrame } = render(
      <Tree nodes={nestedNodes} expandedIds={[]} />
    );

    expect(lastFrame()).not.toContain('File 1');
    expect(lastFrame()).not.toContain('File 2');
  });

  it('displays icons when enabled', () => {
    const nodesWithIcons = [{ id: '1', label: 'Item', icon: '📄' }];

    const { lastFrame } = render(
      <Tree nodes={nodesWithIcons} showIcons={true} />
    );

    expect(lastFrame()).toContain('📄');
  });

  it('indents nested nodes', () => {
    const { lastFrame } = render(
      <Tree nodes={nestedNodes} expandedIds={['folder1']} indentSize={2} />
    );

    // Children should be indented
    const frame = lastFrame() ?? '';
    const file1Line = frame.split('\n').find((line) => line.includes('File 1'));
    expect(file1Line?.startsWith(' ')).toBe(true);
  });
});

describe('FileTreeView', () => {
  const files = [
    {
      path: 'src',
      name: 'src',
      type: 'directory' as const,
      children: [
        { path: 'src/index.ts', name: 'index.ts', type: 'file' as const, status: 'modified' as const },
        { path: 'src/utils.ts', name: 'utils.ts', type: 'file' as const, status: 'added' as const },
      ],
    },
    {
      path: 'package.json',
      name: 'package.json',
      type: 'file' as const,
      status: 'modified' as const,
    },
  ];

  it('renders file tree', () => {
    const { lastFrame } = render(<FileTreeView files={files} />);

    expect(lastFrame()).toContain('src');
    expect(lastFrame()).toContain('package.json');
  });

  it('shows file icons', () => {
    const { lastFrame } = render(
      <FileTreeView files={files} expandedPaths={['src']} />
    );

    // Should show TypeScript icon for .ts files
    expect(lastFrame()).toContain('🔷');
  });

  it('shows directory icon', () => {
    const { lastFrame } = render(<FileTreeView files={files} />);

    expect(lastFrame()).toContain('📁');
  });

  it('expands directories in expandedPaths', () => {
    const { lastFrame } = render(
      <FileTreeView files={files} expandedPaths={['src']} />
    );

    expect(lastFrame()).toContain('index.ts');
    expect(lastFrame()).toContain('utils.ts');
  });
});

describe('TreeItem', () => {
  it('renders label', () => {
    const { lastFrame } = render(<TreeItem label="Item Name" />);

    expect(lastFrame()).toContain('Item Name');
  });

  it('renders icon when provided', () => {
    const { lastFrame } = render(<TreeItem label="File" icon="📄" />);

    expect(lastFrame()).toContain('📄');
  });

  it('shows expand arrow for parent nodes', () => {
    const { lastFrame } = render(
      <TreeItem label="Folder" hasChildren={true} isExpanded={false} />
    );

    expect(lastFrame()).toContain('▸');
  });

  it('shows collapse arrow when expanded', () => {
    const { lastFrame } = render(
      <TreeItem label="Folder" hasChildren={true} isExpanded={true} />
    );

    expect(lastFrame()).toContain('▾');
  });

  it('shows no arrow for leaf nodes', () => {
    const { lastFrame } = render(
      <TreeItem label="File" hasChildren={false} />
    );

    expect(lastFrame()).not.toContain('▸');
    expect(lastFrame()).not.toContain('▾');
  });

  it('renders suffix', () => {
    const { lastFrame } = render(
      <TreeItem label="Item" suffix="+10 -5" />
    );

    expect(lastFrame()).toContain('+10 -5');
  });

  it('indents based on depth', () => {
    const { lastFrame } = render(
      <TreeItem label="Nested" depth={2} />
    );

    const frame = lastFrame() ?? '';
    // Should have leading spaces
    expect(frame.startsWith(' ')).toBe(true);
  });
});
