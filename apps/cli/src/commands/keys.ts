/**
 * Keys Command
 *
 * Shows all keybindings for the TUI.
 */

const VIM_KEYBINDINGS = `
LazyReview Keybindings (Vim Mode)
═════════════════════════════════

Navigation
  j / ↓         Move down
  k / ↑         Move up
  h / ←         Left panel / collapse
  l / →         Right panel / expand
  gg            Go to top
  G             Go to bottom
  Ctrl+u        Page up
  Ctrl+d        Page down
  Tab           Next panel
  Shift+Tab     Previous panel

Selection & Actions
  Enter         Select / open
  Space         Toggle selection
  /             Search / filter
  Esc           Cancel / close

PR Actions
  a             Approve PR
  r             Request changes
  c             Add inline comment
  gc            Add general comment
  m             Merge PR
  C             Checkout branch
  o             Open in browser

Review Actions
  ]             Next hunk
  [             Previous hunk
  n             Next file
  N             Previous file

Chords (Multi-key sequences)
  gg            Go to first item
  gc            General comment
  gr            Refresh

General
  ?             Toggle help
  t             Toggle theme
  q             Quit / back
  Ctrl+c        Force quit

`;

const STANDARD_KEYBINDINGS = `
LazyReview Keybindings (Standard Mode)
══════════════════════════════════════

Navigation
  ↓             Move down
  ↑             Move up
  ←             Left panel
  →             Right panel
  Home          Go to top
  End           Go to bottom
  Page Up       Page up
  Page Down     Page down
  Tab           Next panel
  Shift+Tab     Previous panel

Selection & Actions
  Enter         Select / open
  Space         Toggle selection
  Ctrl+f        Search / filter
  Esc           Cancel / close

PR Actions
  Ctrl+a        Approve PR
  Ctrl+r        Request changes
  Ctrl+Shift+c  Add comment
  Ctrl+m        Merge PR
  Ctrl+o        Open in browser

General
  F1            Toggle help
  Ctrl+t        Toggle theme
  q             Quit / back
  Ctrl+c        Force quit

`;

export interface KeysOptions {
  vim?: boolean;
  standard?: boolean;
}

export function showKeys(options: KeysOptions = {}): void {
  if (options.standard) {
    console.log(STANDARD_KEYBINDINGS);
  } else {
    console.log(VIM_KEYBINDINGS);
  }
}
