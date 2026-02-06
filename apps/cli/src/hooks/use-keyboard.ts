import { useCallback } from 'react';
import type { Key } from 'ink';

export type KeyAction = () => void;

export interface KeyBindingMap {
  [key: string]: KeyAction | undefined;
}

export interface KeyHandlerOptions {
  bindings: KeyBindingMap;
  onUnhandled?: (input: string, key: Key) => void;
}

export interface UseKeyboardResult {
  handleInput: (input: string, key: Key) => boolean;
}

function getKeyString(input: string, key: Key): string {
  const parts: string[] = [];

  if (key.ctrl) parts.push('ctrl');
  if (key.meta) parts.push('meta');
  if (key.shift && input.length === 1) parts.push('shift');

  if (key.escape) parts.push('escape');
  else if (key.return) parts.push('enter');
  else if (key.tab) parts.push('tab');
  else if (key.backspace) parts.push('backspace');
  else if (key.delete) parts.push('delete');
  else if (key.upArrow) parts.push('up');
  else if (key.downArrow) parts.push('down');
  else if (key.leftArrow) parts.push('left');
  else if (key.rightArrow) parts.push('right');
  else if (key.pageUp) parts.push('pageup');
  else if (key.pageDown) parts.push('pagedown');
  else if (input) parts.push(input.toLowerCase());

  return parts.join('+');
}

export function useKeyboard({
  bindings,
  onUnhandled,
}: KeyHandlerOptions): UseKeyboardResult {
  const handleInput = useCallback(
    (input: string, key: Key): boolean => {
      const keyString = getKeyString(input, key);
      const action = bindings[keyString];

      if (action) {
        action();
        return true;
      }

      // Try without modifiers for single character bindings
      if (input && bindings[input]) {
        bindings[input]!();
        return true;
      }

      if (onUnhandled) {
        onUnhandled(input, key);
      }

      return false;
    },
    [bindings, onUnhandled]
  );

  return { handleInput };
}

// Common key binding helpers
export const vimBindings = {
  up: ['k', 'up'],
  down: ['j', 'down'],
  left: ['h', 'left'],
  right: ['l', 'right'],
  pageUp: ['ctrl+u', 'pageup'],
  pageDown: ['ctrl+d', 'pagedown'],
  top: ['g', 'home'],
  bottom: ['G', 'end'],
  select: ['enter', 'l'],
  back: ['q', 'escape', 'h'],
  help: ['?'],
  quit: ['q', 'ctrl+c'],
};

export function createVimBindings(actions: {
  moveUp?: KeyAction;
  moveDown?: KeyAction;
  moveLeft?: KeyAction;
  moveRight?: KeyAction;
  pageUp?: KeyAction;
  pageDown?: KeyAction;
  goToTop?: KeyAction;
  goToBottom?: KeyAction;
  select?: KeyAction;
  back?: KeyAction;
  help?: KeyAction;
  quit?: KeyAction;
}): KeyBindingMap {
  const bindings: KeyBindingMap = {};

  if (actions.moveUp) {
    bindings['k'] = actions.moveUp;
    bindings['up'] = actions.moveUp;
  }

  if (actions.moveDown) {
    bindings['j'] = actions.moveDown;
    bindings['down'] = actions.moveDown;
  }

  if (actions.moveLeft) {
    bindings['h'] = actions.moveLeft;
    bindings['left'] = actions.moveLeft;
  }

  if (actions.moveRight) {
    bindings['l'] = actions.moveRight;
    bindings['right'] = actions.moveRight;
  }

  if (actions.pageUp) {
    bindings['ctrl+u'] = actions.pageUp;
    bindings['pageup'] = actions.pageUp;
  }

  if (actions.pageDown) {
    bindings['ctrl+d'] = actions.pageDown;
    bindings['pagedown'] = actions.pageDown;
  }

  if (actions.goToTop) {
    bindings['home'] = actions.goToTop;
  }

  if (actions.goToBottom) {
    bindings['G'] = actions.goToBottom;
    bindings['end'] = actions.goToBottom;
  }

  if (actions.select) {
    bindings['enter'] = actions.select;
  }

  if (actions.back) {
    bindings['escape'] = actions.back;
  }

  if (actions.help) {
    bindings['?'] = actions.help;
  }

  if (actions.quit) {
    bindings['q'] = actions.quit;
  }

  return bindings;
}
