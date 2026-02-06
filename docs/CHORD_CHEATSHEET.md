# Keyboard Chord Cheatsheet

Keyboard chords are multi-key sequences that trigger actions, similar to vim's command mode.

## What are Chords?

Chords are sequences of keys pressed in quick succession (default: 500ms timeout). When you press the first key of a chord, you'll see a visual indicator in the footer showing the pending sequence, like `[g...]`.

## Available Chords (Vim Mode Only)

| Chord | Action | Description | Context |
|-------|--------|-------------|---------|
| `gg` | Go to Top | Jump to the top of the current list | Any list view |
| `gc` | General Comment | Open general comment input | PR detail view |
| `gr` | Refresh | Refresh the current view | Any view |

## Visual Feedback

When you press the first key of a chord sequence, a visual indicator appears in the footer:

```
[g...]
```

This shows you're in the middle of a chord sequence. Complete the chord within the timeout (default 500ms) or it will be reset.

## Configuration

Chords can be configured in `~/.config/lazyreview/config.yaml`:

```yaml
keybindings:
  chords:
    # Enable/disable chord support (default: true in vim mode)
    enabled: true

    # Timeout in milliseconds to wait for next key (default: 500)
    timeout: 500

    # Define custom chord sequences
    sequences:
      - keys: ["g", "g"]
        action: "goto_top"
        description: "Go to top"

      - keys: ["g", "c"]
        action: "general_comment"
        description: "Add general comment"

      - keys: ["g", "r"]
        action: "refresh"
        description: "Refresh current view"
```

### Adding Custom Chords

You can add your own chord sequences by editing the `sequences` list in the config:

```yaml
sequences:
  - keys: ["g", "t"]
    action: "goto_top"      # Built-in action
    description: "Go to top"

  - keys: ["g", "b"]
    action: "goto_bottom"   # Built-in action (if available)
    description: "Go to bottom"
```

### Adjusting Timeout

If you find the default timeout too fast or too slow, adjust it in milliseconds:

```yaml
keybindings:
  chords:
    timeout: 300  # Faster (300ms)
    # or
    timeout: 1000 # Slower (1 second)
```

### Disabling Chords

To disable chord support entirely:

```yaml
keybindings:
  chords:
    enabled: false
```

## Conflict Resolution

If a single key is also part of a longer chord (e.g., `g` is both a standalone key and part of `gg`), the chord handler will:

1. Wait for the timeout period to see if you're completing a chord
2. If another key is pressed, complete the chord
3. If the timeout expires, treat it as a single key press

This means single-key bindings that are prefixes of chords will have a slight delay.

## Tips

- **Practice the timing**: Get comfortable with the default 500ms timeout
- **Watch the indicator**: The `[...]` indicator tells you when you're in a chord
- **Vim mode only**: Chords only work when vim mode is enabled (`ui.vim_mode: true`)
- **Case sensitive**: Chords are case-sensitive (`g` ≠ `G`)

## Built-in Actions

These actions can be used in custom chords:

- `goto_top` - Jump to top of list
- `general_comment` - Open general comment input (PR detail only)
- `refresh` - Refresh current view

More actions can be added by extending the `handleChordAction` method in the GUI code.
