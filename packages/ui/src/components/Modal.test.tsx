import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  Modal,
  ModalActions,
  ModalButton,
  AlertModal,
  ConfirmModal,
  PromptModal,
} from './Modal';
import { Text } from 'ink';

describe('Modal', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      <Modal>
        <Text>Modal content</Text>
      </Modal>
    );
    const output = lastFrame();

    expect(output).toContain('Modal content');
  });

  it('renders title', () => {
    const { lastFrame } = render(
      <Modal title="Test Title">
        <Text>Content</Text>
      </Modal>
    );
    const output = lastFrame();

    expect(output).toContain('Test Title');
  });

  it('returns null when not open', () => {
    const { lastFrame } = render(
      <Modal isOpen={false}>
        <Text>Hidden content</Text>
      </Modal>
    );
    const output = lastFrame();

    expect(output).toBe('');
  });

  it('renders border by default', () => {
    const { lastFrame } = render(
      <Modal>
        <Text>Content</Text>
      </Modal>
    );
    const output = lastFrame();

    // Round border characters
    expect(output).toContain('╭');
  });

  it('hides border when showBorder is false', () => {
    const { lastFrame } = render(
      <Modal showBorder={false}>
        <Text>Content</Text>
      </Modal>
    );
    const output = lastFrame();

    expect(output).not.toContain('╭');
  });
});

describe('ModalActions', () => {
  it('renders children', () => {
    const { lastFrame } = render(
      <ModalActions>
        <Text>Action buttons</Text>
      </ModalActions>
    );
    const output = lastFrame();

    expect(output).toContain('Action buttons');
  });
});

describe('ModalButton', () => {
  it('renders label', () => {
    const { lastFrame } = render(<ModalButton label="Click me" />);
    const output = lastFrame();

    expect(output).toContain('Click me');
  });

  it('renders shortcut', () => {
    const { lastFrame } = render(
      <ModalButton label="Save" shortcut="Enter" />
    );
    const output = lastFrame();

    expect(output).toContain('[Enter]');
    expect(output).toContain('Save');
  });

  it('renders without shortcut', () => {
    const { lastFrame } = render(<ModalButton label="Save" />);
    const output = lastFrame();

    expect(output).toContain('Save');
    expect(output).not.toContain('[');
  });
});

describe('AlertModal', () => {
  it('renders title and message', () => {
    const { lastFrame } = render(
      <AlertModal title="Alert" message="Something happened" />
    );
    const output = lastFrame();

    expect(output).toContain('Alert');
    expect(output).toContain('Something happened');
  });

  it('renders info icon by default', () => {
    const { lastFrame } = render(
      <AlertModal title="Info" message="Information" />
    );
    const output = lastFrame();

    expect(output).toContain('ℹ');
  });

  it('renders warning icon', () => {
    const { lastFrame } = render(
      <AlertModal title="Warning" message="Be careful" type="warning" />
    );
    const output = lastFrame();

    expect(output).toContain('⚠');
  });

  it('renders error icon', () => {
    const { lastFrame } = render(
      <AlertModal title="Error" message="Failed" type="error" />
    );
    const output = lastFrame();

    expect(output).toContain('✗');
  });

  it('renders success icon', () => {
    const { lastFrame } = render(
      <AlertModal title="Success" message="Done" type="success" />
    );
    const output = lastFrame();

    expect(output).toContain('✓');
  });

  it('renders confirm button', () => {
    const { lastFrame } = render(
      <AlertModal title="Alert" message="Message" confirmLabel="Got it" />
    );
    const output = lastFrame();

    expect(output).toContain('Got it');
  });
});

describe('ConfirmModal', () => {
  it('renders title and message', () => {
    const { lastFrame } = render(
      <ConfirmModal title="Confirm" message="Are you sure?" />
    );
    const output = lastFrame();

    expect(output).toContain('Confirm');
    expect(output).toContain('Are you sure?');
  });

  it('renders confirm and cancel buttons', () => {
    const { lastFrame } = render(
      <ConfirmModal title="Confirm" message="Continue?" />
    );
    const output = lastFrame();

    expect(output).toContain('Confirm');
    expect(output).toContain('Cancel');
  });

  it('renders custom button labels', () => {
    const { lastFrame } = render(
      <ConfirmModal
        title="Delete"
        message="Delete this item?"
        confirmLabel="Delete"
        cancelLabel="Keep"
      />
    );
    const output = lastFrame();

    expect(output).toContain('Delete');
    expect(output).toContain('Keep');
  });

  it('renders shortcuts', () => {
    const { lastFrame } = render(
      <ConfirmModal
        title="Confirm"
        message="Continue?"
        confirmShortcut="y"
        cancelShortcut="n"
      />
    );
    const output = lastFrame();

    expect(output).toContain('[y]');
    expect(output).toContain('[n]');
  });
});

describe('PromptModal', () => {
  it('renders title', () => {
    const { lastFrame } = render(
      <PromptModal title="Enter name" value="" />
    );
    const output = lastFrame();

    expect(output).toContain('Enter name');
  });

  it('renders message', () => {
    const { lastFrame } = render(
      <PromptModal
        title="Input"
        message="Please enter a value"
        value=""
      />
    );
    const output = lastFrame();

    expect(output).toContain('Please enter a value');
  });

  it('renders placeholder when value is empty', () => {
    const { lastFrame } = render(
      <PromptModal
        title="Input"
        value=""
        placeholder="Type here..."
      />
    );
    const output = lastFrame();

    expect(output).toContain('Type here...');
  });

  it('renders value when provided', () => {
    const { lastFrame } = render(
      <PromptModal title="Input" value="User input" />
    );
    const output = lastFrame();

    expect(output).toContain('User input');
  });

  it('renders cursor indicator', () => {
    const { lastFrame } = render(
      <PromptModal title="Input" value="test" />
    );
    const output = lastFrame();

    expect(output).toContain('▏');
  });

  it('renders submit and cancel buttons', () => {
    const { lastFrame } = render(
      <PromptModal title="Input" value="" />
    );
    const output = lastFrame();

    expect(output).toContain('Submit');
    expect(output).toContain('Cancel');
  });

  it('renders custom button labels', () => {
    const { lastFrame } = render(
      <PromptModal
        title="Input"
        value=""
        submitLabel="Save"
        cancelLabel="Discard"
      />
    );
    const output = lastFrame();

    expect(output).toContain('Save');
    expect(output).toContain('Discard');
  });
});
