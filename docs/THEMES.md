# LazyReview Theme System

LazyReview provides a powerful theming system with built-in themes, custom theme support, theme inheritance, and accessibility features.

## Table of Contents

- [Built-in Themes](#built-in-themes)
- [Custom Themes](#custom-themes)
- [Theme File Format](#theme-file-format)
- [Color Formats](#color-formats)
- [Theme Inheritance](#theme-inheritance)
- [Accessibility](#accessibility)
- [WCAG Contrast Validation](#wcag-contrast-validation)

## Built-in Themes

LazyReview includes several pre-configured themes:

| Theme | Description |
|-------|-------------|
| `auto` | Default theme (dark) |
| `lazygit` | Inspired by lazygit color scheme |
| `darcula` | IntelliJ Darcula-inspired theme |
| `tokyonight` | Tokyo Night color palette |
| `gruvbox` | Gruvbox color scheme |
| `catppuccin` | Catppuccin mocha variant |
| `high-contrast` | High-contrast accessibility theme |

### Using Built-in Themes

Edit your `~/.config/lazyreview/config.yaml`:

```yaml
ui:
  theme: "tokyonight"
```

## Custom Themes

You can create your own themes by placing YAML files in `~/.config/lazyreview/themes/`.

### Creating a Custom Theme

1. Create the themes directory:
   ```bash
   mkdir -p ~/.config/lazyreview/themes
   ```

2. Create a theme file (e.g., `my-theme.yaml`):
   ```yaml
   name: "My Custom Theme"
   base: "dark"
   colors:
     accent: "#ff6b6b"
     added: "#42ff42"
     deleted: "#ff4242"
   ```

3. Use your theme in `config.yaml`:
   ```yaml
   ui:
     theme: "My Custom Theme"
   ```

4. Restart LazyReview to see your theme.

### Example Theme

See [`examples/my-theme.yaml`](../examples/my-theme.yaml) for a complete example with all available color options.

## Theme File Format

A theme file consists of three main sections:

```yaml
# Required: Theme name
name: "My Theme"

# Required: Base theme (dark or light)
base: "dark"

# Optional: Color overrides
colors:
  # Any colors not specified here will inherit from the base theme
  accent: "#ff6b6b"
  added: "42"
  deleted: "196"
  # ... more colors
```

### Required Fields

- `name` - The display name of your theme
- `base` - Base theme to inherit from (`"dark"` or `"light"`)

### Available Colors

All color fields are optional. Unspecified colors will inherit from the base theme.

#### Diff Colors
- `added` - Added lines in diffs
- `deleted` - Deleted lines in diffs
- `context` - Context lines in diffs
- `hunk` - Hunk headers (@@ ... @@)
- `line_no` - Line numbers
- `file` - File names

#### UI Colors
- `accent` - Primary accent color (borders, highlights)
- `cursor_bg` - Background for cursor position
- `selection_bg` - Background for selected items
- `header_bg` - Header background
- `footer_bg` - Footer background
- `muted` - Muted text color

#### Border Colors
- `border_focused` - Border when panel is focused
- `border_unfocused` - Border when panel is not focused

#### File Tree Colors
- `tree_selected_bg` - Background for selected file
- `tree_added` - Added files (green)
- `tree_deleted` - Deleted files (red)
- `tree_modified` - Modified files (orange)
- `tree_renamed` - Renamed files (blue)
- `tree_dir` - Directory names
- `tree_comment` - Files with comments

## Color Formats

LazyReview supports three color formats:

### 1. ANSI 256 Color Codes

Use numeric codes from 0-255:

```yaml
colors:
  accent: "42"      # Green
  deleted: "196"    # Red
  context: "252"    # Light gray
```

**Reference:** [ANSI 256 Color Chart](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit)

### 2. Hex Colors (Full)

Use 6-digit hex codes:

```yaml
colors:
  accent: "#ff6b6b"    # Coral red
  added: "#42ff42"     # Bright green
  deleted: "#ff4242"   # Bright red
```

### 3. Short Hex Colors

Use 3-digit hex codes (expanded to 6 digits):

```yaml
colors:
  accent: "#f6b"    # Expands to #ff66bb
  added: "#4f4"     # Expands to #44ff44
```

## Theme Inheritance

Custom themes inherit all colors from their base theme. Only specify the colors you want to override.

### Minimal Theme Example

```yaml
name: "Red Accent"
base: "lazygit"
colors:
  accent: "#ff0000"
  border_focused: "#ff0000"
```

This theme uses all lazygit colors except the accent and focused border, which are red.

### Base Themes

- `dark` - Default dark theme colors
- `light` - Light theme colors (optimized for light backgrounds)

## Accessibility

### High-Contrast Theme

LazyReview includes a built-in high-contrast theme for users with visual impairments:

```yaml
ui:
  theme: "high-contrast"
```

Features:
- Maximum contrast ratios for all text/background pairs
- Bright colors on dark backgrounds
- WCAG AAA compliant (7:1 contrast ratio)
- Optimized for readability

### WCAG Contrast Validation

All themes are validated against WCAG (Web Content Accessibility Guidelines) standards:

- **WCAG AA**: 4.5:1 contrast ratio minimum (normal text)
- **WCAG AAA**: 7:1 contrast ratio minimum (enhanced)

The high-contrast theme passes WCAG AAA for all text elements.

### Creating Accessible Themes

When creating custom themes, consider:

1. **Contrast Ratio**: Ensure text has sufficient contrast against backgrounds
   - Minimum 4.5:1 for normal text (WCAG AA)
   - Minimum 7:1 for enhanced accessibility (WCAG AAA)

2. **Color Blindness**: Avoid relying solely on color to convey information
   - Use icons and symbols in addition to colors
   - Test with color blindness simulators

3. **High Contrast Mode**: Test your theme in different lighting conditions

### Checking Contrast Programmatically

```go
import "lazyreview/internal/gui"

checker := gui.NewContrastChecker()
result, _ := checker.CheckContrast("#000000", "#ffffff")

fmt.Printf("Contrast ratio: %.2f:1\n", result.Ratio)
fmt.Printf("Passes WCAG AA: %v\n", result.Passes)
fmt.Printf("Passes WCAG AAA: %v\n", result.PassesAAA)
```

## Tips and Best Practices

### 1. Start with a Base Theme

Use an existing theme as a starting point:

```yaml
name: "My Customized Lazygit"
base: "lazygit"
colors:
  accent: "#ff6b6b"  # Only override what you need
```

### 2. Use Consistent Color Palettes

Choose colors that work well together:

```yaml
colors:
  accent: "#ff6b6b"
  border_focused: "#ff6b6b"  # Match accent
  added: "#42ff42"
  tree_added: "#42ff42"      # Match diff added
```

### 3. Test in Different Contexts

View your theme in various scenarios:
- Large diffs with many files
- PRs with comments
- File tree with mixed statuses
- Different terminal emulators

### 4. Share Your Themes

If you create a great theme, consider sharing it:
- Submit a PR to add it as a built-in theme
- Share the YAML file with the community
- Post it in the discussions section

## Troubleshooting

### Theme Not Loading

1. Check the theme file location:
   ```bash
   ls ~/.config/lazyreview/themes/
   ```

2. Verify the theme name in config.yaml matches exactly:
   ```yaml
   ui:
     theme: "My Theme Name"  # Must match "name" field in YAML
   ```

3. Check for YAML syntax errors:
   ```bash
   # Use a YAML validator
   yamllint ~/.config/lazyreview/themes/my-theme.yaml
   ```

### Colors Not Displaying Correctly

1. Verify your terminal supports 256 colors:
   ```bash
   echo $TERM
   # Should be xterm-256color or similar
   ```

2. Test color support:
   ```bash
   curl -s https://gist.githubusercontent.com/HaleTom/89ffe32783f89f403bba96bd7bcd1263/raw/ | bash
   ```

3. Try using hex colors instead of ANSI codes

### Validation Errors

Common validation errors:

- **"theme name is required"**: Add `name` field
- **"base must be 'dark' or 'light'"**: Fix `base` field
- **"invalid hex color format"**: Check hex color syntax (#RRGGBB)
- **"ANSI color code must be between 0 and 255"**: Use valid ANSI code

## Examples

### Solarized Dark

```yaml
name: "Solarized Dark"
base: "dark"
colors:
  accent: "#268bd2"
  added: "#859900"
  deleted: "#dc322f"
  context: "#93a1a1"
  background: "#002b36"
```

### Nord

```yaml
name: "Nord"
base: "dark"
colors:
  accent: "#88c0d0"
  added: "#a3be8c"
  deleted: "#bf616a"
  context: "#d8dee9"
  hunk: "#81a1c1"
```

### Dracula

```yaml
name: "Dracula"
base: "dark"
colors:
  accent: "#ff79c6"
  added: "#50fa7b"
  deleted: "#ff5555"
  context: "#f8f8f2"
  hunk: "#8be9fd"
```

## Contributing

Want to contribute a theme? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

For more information, see:
- [Configuration Guide](CONFIGURATION.md)
- [Accessibility Features](ACCESSIBILITY.md)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
