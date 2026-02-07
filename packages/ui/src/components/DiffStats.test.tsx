import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { DiffStats, FileStats } from './DiffStats';

describe('DiffStats', () => {
  it('renders additions and deletions', () => {
    const { lastFrame } = render(<DiffStats additions={10} deletions={5} />);
    const output = lastFrame();

    expect(output).toContain('+10');
    expect(output).toContain('-5');
  });

  it('renders file count when provided', () => {
    const { lastFrame } = render(
      <DiffStats additions={10} deletions={5} files={3} />
    );
    const output = lastFrame();

    expect(output).toContain('3 files');
  });

  it('renders compact mode', () => {
    const { lastFrame } = render(
      <DiffStats additions={10} deletions={5} compact />
    );
    const output = lastFrame();

    expect(output).toContain('+10');
    expect(output).toContain('-5');
    // Compact mode uses / separator
    expect(output).toContain('/');
  });

  it('renders progress bar by default', () => {
    const { lastFrame } = render(<DiffStats additions={10} deletions={5} />);
    const output = lastFrame();

    // Should contain filled blocks
    expect(output).toContain('█');
  });

  it('hides progress bar when showBar is false', () => {
    const { lastFrame } = render(
      <DiffStats additions={10} deletions={5} showBar={false} />
    );
    const output = lastFrame();

    // Should not contain filled blocks
    expect(output).not.toContain('█');
  });

  it('handles zero values', () => {
    const { lastFrame } = render(<DiffStats additions={0} deletions={0} />);
    const output = lastFrame();

    expect(output).toContain('+0');
    expect(output).toContain('-0');
  });

  it('handles only additions', () => {
    const { lastFrame } = render(<DiffStats additions={10} deletions={0} />);
    const output = lastFrame();

    expect(output).toContain('+10');
    expect(output).toContain('-0');
  });

  it('handles only deletions', () => {
    const { lastFrame } = render(<DiffStats additions={0} deletions={10} />);
    const output = lastFrame();

    expect(output).toContain('+0');
    expect(output).toContain('-10');
  });

  it('applies custom theme', () => {
    const customTheme = {
      primary: '#ff0000',
      secondary: '#00ff00',
      success: '#00ff00',
      error: '#ff0000',
      warning: '#ffff00',
      info: '#0000ff',
      muted: '#888888',
      text: '#ffffff',
      border: '#333333',
      selection: '#444444',
      accent: '#ff00ff',
    };

    const { lastFrame } = render(
      <DiffStats additions={5} deletions={3} theme={customTheme} />
    );

    expect(lastFrame()).toBeTruthy();
  });
});

describe('FileStats', () => {
  it('renders file path', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/index.ts"
        additions={10}
        deletions={5}
        status="modified"
      />
    );
    const output = lastFrame();

    expect(output).toContain('src/index.ts');
  });

  it('renders added file status', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/new.ts"
        additions={50}
        deletions={0}
        status="added"
      />
    );
    const output = lastFrame();

    expect(output).toContain('+');
    expect(output).toContain('src/new.ts');
  });

  it('renders modified file status', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/index.ts"
        additions={10}
        deletions={5}
        status="modified"
      />
    );
    const output = lastFrame();

    expect(output).toContain('~');
  });

  it('renders deleted file status', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/old.ts"
        additions={0}
        deletions={100}
        status="deleted"
      />
    );
    const output = lastFrame();

    expect(output).toContain('-');
  });

  it('renders renamed file status', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/renamed.ts"
        additions={0}
        deletions={0}
        status="renamed"
      />
    );
    const output = lastFrame();

    expect(output).toContain('→');
  });

  it('shows stats in compact format', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/index.ts"
        additions={10}
        deletions={5}
        status="modified"
      />
    );
    const output = lastFrame();

    expect(output).toContain('+10');
    expect(output).toContain('-5');
  });

  it('highlights selected file', () => {
    const { lastFrame } = render(
      <FileStats
        path="src/index.ts"
        additions={10}
        deletions={5}
        status="modified"
        isSelected
      />
    );

    expect(lastFrame()).toBeTruthy();
  });
});
