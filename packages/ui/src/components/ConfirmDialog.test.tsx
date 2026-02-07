import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure you want to proceed?"
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Confirm Action');
    expect(frame).toContain('Are you sure you want to proceed?');
  });

  it('renders default confirm and cancel labels', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Test"
        message="Test message"
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('[y] Confirm');
    expect(frame).toContain('[n] Cancel');
  });

  it('renders custom labels and keys', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete"
        message="Delete this item?"
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
        confirmKey="d"
        cancelKey="c"
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('[d] Yes, delete');
    expect(frame).toContain('[c] No, keep it');
  });

  it('applies destructive styling', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete Forever"
        message="This cannot be undone"
        destructive
      />
    );
    // Destructive dialog should render without errors
    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain('Delete Forever');
  });

  it('applies custom theme', () => {
    const theme = {
      accent: 'blue',
      muted: 'gray',
      added: 'green',
      removed: 'red',
    };

    const { lastFrame } = render(
      <ConfirmDialog
        title="Themed"
        message="Themed dialog"
        theme={theme}
      />
    );
    expect(lastFrame()).toBeDefined();
  });
});
