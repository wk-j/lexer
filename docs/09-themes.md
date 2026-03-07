# Custom Theme System

Lexer ships with 5 built-in themes and supports fully user-defined themes. Themes control colors, typography, syntax highlighting, and visual effects from a single TOML file.

## Quick Start

Create `~/.config/lexer/themes/my-theme.toml`:

```toml
[meta]
name = "My Theme"
base = "dark"

[colors]
accent = "#ff6b6b"
link = "#ff6b6b"
```

That's it. Every field is optional -- missing values inherit from the base theme (`lexer-dark` or `lexer-light`). Select the theme with `Space t` in the app or `lexer --theme my-theme`.

The file is hot-reloaded: save the TOML and the app updates instantly.

## Built-in Themes

| Theme Name        | Base  | Description                                   |
|-------------------|-------|-----------------------------------------------|
| `lexer-dark`      | dark  | Default. Deep navy, frosted glass, blue accent |
| `lexer-light`     | light | Clean white, soft shadows, GitHub-style        |
| `lexer-mono`      | dark  | Monochrome grayscale, no color accents         |
| `lexer-solarized` | dark  | Solarized palette                              |
| `lexer-nord`      | dark  | Nord color palette                             |

## Theme Architecture

```
Theme Resolution:
  CLI --theme  >  config.toml theme  >  "lexer-dark" (default)

Theme Loading:
  TOML file  -->  Rust ThemeEngine  -->  CSS :root block  -->  Webview <style>
                      |
                      +--> merge with base theme defaults

File Lookup Order:
  1. ~/.config/lexer/themes/{name}.toml      (user themes)
  2. $LEXER_THEMES_DIR/{name}.toml           (env override)
  3. Built-in themes (embedded in binary)
```

A theme is a TOML file that maps to CSS custom properties. The Rust backend parses the TOML, fills missing values from the base theme, and generates a `:root {}` CSS block injected into the webview. The frontend CSS references only custom properties -- never hardcoded colors -- so theme switching is instantaneous.

## Complete Theme File Format

Below is every field the theme engine currently supports. Copy this as a starting point and remove what you don't need.

```toml
[meta]
name = "My Custom Theme"       # Display name in theme picker
author = "Your Name"            # Optional
base = "dark"                   # "dark" or "light" -- inherit missing values from this
version = "1.0.0"               # Optional

[colors]
# App chrome
bg_base = "transparent"                     # Outermost background (use transparent for vibrancy)
bg_base_opaque = "#0d1117"                  # Opaque fallback (used for text-on-accent contexts)
bg_panel = "rgba(22, 27, 34, 0.55)"        # Content panel (supports alpha for glass effect)
bg_panel_border = "rgba(255, 255, 255, 0.10)"
text_primary = "#e6edf3"
text_secondary = "#8b949e"
text_muted = "#484f58"
accent = "#58a6ff"                          # Primary accent (buttons, active states)
link = "#58a6ff"
link_hover = "#79c0ff"

# Gradient mesh backdrop (3 radial gradient layers behind content)
gradient_a = "rgba(88, 166, 255, 0.08)"
gradient_b = "rgba(210, 168, 255, 0.06)"
gradient_c = "rgba(126, 231, 135, 0.05)"

# Code blocks
code_bg = "rgba(22, 27, 34, 0.45)"
code_border = "rgba(255, 255, 255, 0.08)"
glow_color = "rgba(88, 166, 255, 0.25)"    # Ambient glow around code blocks on hover
glow_radius = "20px"

# Content elements
blockquote_border = "#58a6ff"
blockquote_bg = "rgba(56, 139, 253, 0.08)"
hr_color = "rgba(48, 54, 61, 0.6)"
table_header_bg = "rgba(110, 118, 129, 0.12)"
table_border = "rgba(110, 118, 129, 0.15)"
table_row_alt = "rgba(110, 118, 129, 0.04)"

# Cursor spotlight (radial glow following mouse)
spotlight_color = "rgba(255, 255, 255, 0.02)"

# Heading gradient text fill (used when heading_gradient_text = true)
heading_gradient = "linear-gradient(135deg, var(--accent), var(--text-primary))"

# Block select mode indicator
select_bar = "var(--accent)"                # Left bar color for selected blocks
select_bg = "rgba(88, 166, 255, 0.08)"     # Background tint for selected blocks
select_cursor_bar = "var(--text-primary)"   # Left bar color for cursor block
select_cursor_bg = "rgba(88, 166, 255, 0.15)"  # Background for cursor block
select_bar_width = "3px"                    # Width of selection indicator bar
select_bar_offset = "-16px"                 # Horizontal offset (negative = in gutter)

# GX-style border decoration (Opera GX-inspired neon border)
gx_border_color_start = "var(--accent)"     # Border gradient start color
gx_border_color_mid = "var(--accent)"       # Border gradient mid color
gx_border_color_end = "rgba(88, 166, 255, 0.2)"  # Border gradient end color
gx_border_width = "1.5px"                   # Border stroke width
gx_corner_size = "10px"                     # Diagonal cut corner size
gx_glow_opacity = "0.6"                     # Neon glow intensity (0.0 - 1.0)
gx_glow_spread = "8px"                      # Neon glow blur radius

[syntax]
# Tree-sitter highlight token colors
# These map to .hl-{token} CSS classes in code blocks
keyword = "#ff7b72"
string = "#a5d6ff"
comment = "#8b949e"
function = "#d2a8ff"
type = "#79c0ff"
number = "#79c0ff"
operator = "#79c0ff"
variable = "#ffa657"
punctuation = "#8b949e"
constant = "#79c0ff"
tag = "#7ee787"
attribute = "#79c0ff"
property = "#79c0ff"
constructor = "#ffa657"
embedded = "#e6edf3"
# Any extra keys are passed through as --hl-{key} CSS variables

[typography]
# All fields optional -- only emitted if set
font_family = "system-ui, -apple-system, 'Segoe UI', sans-serif"
font_family_mono = "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace"
font_size = 16          # px
line_height = 1.7
code_font_size = 14     # px

[effects]
# Boolean toggles
frosted_glass = true            # Backdrop blur on panels
gradient_backdrop = true        # Gradient mesh background
noise_texture = true            # Noise overlay
heading_gradient_text = true    # Gradient fill on h1-h3
scroll_animations = true        # Fade-in on scroll (read by JS, not emitted as CSS)
gx_border = true                # Opera GX-style neon border (left + top edges with cut corner)

# Tuning
frosted_blur = "20px"           # Blur radius for frosted glass
frosted_saturate = "180%"       # Saturation boost for frosted glass
noise_opacity = 0.035           # Noise texture opacity (0.0 - 1.0)
```

## CSS Custom Property Reference

Every field above maps to a CSS custom property. The table below shows the exact mapping, TOML field name, and the hardcoded default used when neither the theme nor its base defines a value.

### Colors

| TOML Field | CSS Variable | Default (dark) |
|---|---|---|
| `bg_base` | `--bg-base` | `transparent` |
| `bg_base_opaque` | `--bg-base-opaque` | `#0d1117` |
| `bg_panel` | `--panel-bg` | `rgba(22, 27, 34, 0.55)` |
| `bg_panel_border` | `--panel-border` | `rgba(255, 255, 255, 0.10)` |
| `text_primary` | `--text-primary` | `#e6edf3` |
| `text_secondary` | `--text-secondary` | `#8b949e` |
| `text_muted` | `--text-muted` | `#484f58` |
| `accent` | `--accent` | `#58a6ff` |
| `link` | `--link` | `#58a6ff` |
| `link_hover` | `--link-hover` | `#79c0ff` |
| `gradient_a` | `--gradient-a` | `rgba(88, 166, 255, 0.08)` |
| `gradient_b` | `--gradient-b` | `rgba(210, 168, 255, 0.06)` |
| `gradient_c` | `--gradient-c` | `rgba(126, 231, 135, 0.05)` |
| `code_bg` | `--code-bg` | `rgba(22, 27, 34, 0.45)` |
| `code_border` | `--code-border` | `rgba(255, 255, 255, 0.08)` |
| `glow_color` | `--glow-color` | `rgba(88, 166, 255, 0.25)` |
| `glow_radius` | `--glow-radius` | `20px` |
| `blockquote_border` | `--blockquote-border` | `#58a6ff` |
| `blockquote_bg` | `--blockquote-bg` | `rgba(56, 139, 253, 0.08)` |
| `hr_color` | `--hr-color` | `rgba(48, 54, 61, 0.6)` |
| `table_header_bg` | `--table-header-bg` | `rgba(110, 118, 129, 0.12)` |
| `table_border` | `--table-border` | `rgba(110, 118, 129, 0.15)` |
| `table_row_alt` | `--table-row-alt` | `rgba(110, 118, 129, 0.04)` |
| `spotlight_color` | `--spotlight-color` | `rgba(255, 255, 255, 0.02)` |
| `heading_gradient` | `--heading-gradient` | `linear-gradient(135deg, var(--accent), var(--text-primary))` |
| `select_bar` | `--select-bar` | `var(--accent)` |
| `select_bg` | `--select-bg` | `rgba(88, 166, 255, 0.08)` |
| `select_cursor_bar` | `--select-cursor-bar` | `var(--text-primary)` |
| `select_cursor_bg` | `--select-cursor-bg` | `rgba(88, 166, 255, 0.15)` |
| `select_bar_width` | `--select-bar-width` | `3px` |
| `select_bar_offset` | `--select-bar-offset` | `-16px` |
| `gx_border_color_start` | `--gx-border-color-start` | `var(--accent)` |
| `gx_border_color_mid` | `--gx-border-color-mid` | `var(--accent)` |
| `gx_border_color_end` | `--gx-border-color-end` | `rgba(88, 166, 255, 0.2)` |
| `gx_border_width` | `--gx-border-width` | `1.5px` |
| `gx_corner_size` | `--gx-corner-size` | `10px` |
| `gx_glow_opacity` | `--gx-glow-opacity` | `0.6` |
| `gx_glow_spread` | `--gx-glow-spread` | `8px` |

### Syntax Tokens

| TOML Field | CSS Variable | Default (dark) |
|---|---|---|
| `keyword` | `--hl-keyword` | `#ff7b72` |
| `string` | `--hl-string` | `#a5d6ff` |
| `comment` | `--hl-comment` | `#8b949e` |
| `function` | `--hl-function` | `#d2a8ff` |
| `type` | `--hl-type` | `#79c0ff` |
| `number` | `--hl-number` | `#79c0ff` |
| `operator` | `--hl-operator` | `#79c0ff` |
| `variable` | `--hl-variable` | `#ffa657` |
| `punctuation` | `--hl-punctuation` | `#8b949e` |
| `constant` | `--hl-constant` | `#79c0ff` |
| `tag` | `--hl-tag` | `#7ee787` |
| `attribute` | `--hl-attribute` | `#79c0ff` |
| `property` | `--hl-property` | `#79c0ff` |
| `constructor` | `--hl-constructor` | `#ffa657` |
| `embedded` | `--hl-embedded` | `#e6edf3` |
| `unknown` | `--hl-unknown` | `#e6edf3` |
| *any key* | `--hl-{key}` | *(passed through)* |

### Typography

Only emitted when explicitly set (no hardcoded defaults).

| TOML Field | CSS Variable | Type |
|---|---|---|
| `font_family` | `--font-family` | string |
| `font_family_mono` | `--font-family-mono` | string |
| `font_size` | `--font-size` | integer → `{N}px` |
| `line_height` | `--line-height` | float |
| `code_font_size` | `--code-font-size` | integer → `{N}px` |

### Effects

| TOML Field | CSS Variable / Rule | Type | Default |
|---|---|---|---|
| `frosted_blur` | `--blur` | string | *(from base)* |
| `frosted_saturate` | `--saturate` | string | *(from base)* |
| `frosted_glass` | body rule: `--blur: 0px; --saturate: 100%` when false | bool | `true` |
| `gradient_backdrop` | hides `.app-backdrop` when false | bool | `true` |
| `noise_texture` | hides `.noise-overlay` when false | bool | `true` |
| `noise_opacity` | `.noise-overlay { opacity }` | float | *(from base)* |
| `heading_gradient_text` | removes gradient text from h1-h3 when false | bool | `true` |
| `scroll_animations` | read by JS, not emitted as CSS | bool | *(from base)* |
| `gx_border` | hides `.gx-border` canvas when false | bool | `true` |

## Value Precedence

For every field, the engine resolves values in this order:

1. **Theme file value** — the field in your TOML
2. **Base theme value** — the same field from `lexer-dark.toml` or `lexer-light.toml` (based on `meta.base`)
3. **Hardcoded default** — compiled into the engine (shown in the tables above)

This means you only need to override what you want to change.

## Tips

- **Start minimal.** Set `base = "dark"` or `base = "light"`, then override just `accent` and `link` for a quick custom look.
- **Use `var()` references.** Fields like `select_bar` can reference other variables: `select_bar = "var(--accent)"`.
- **Alpha values work everywhere.** Use `rgba()` for glass-like panels: `bg_panel = "rgba(30, 40, 60, 0.5)"`.
- **Extra syntax tokens.** Any key in `[syntax]` not in the default list is emitted as `--hl-{key}` -- useful if you add custom tree-sitter highlights.
- **Disable effects.** Set `gradient_backdrop = false` and `frosted_glass = false` for a flat look with no blur.
- **Hot-reload.** Save your TOML and the app picks up changes immediately (only for the active theme).

## Theme Engine (Rust)

Source: `src-tauri/src/theme/engine.rs`

Key types:
- `ThemeFile` — deserialized TOML structure (all fields `Option<T>`)
- `ThemeMeta` — name, author, base, version
- `ThemeColors` — 37 color fields (including 7 GX border fields)
- `ThemeTypography` — 5 typography fields
- `ThemeEffects` — 9 effect fields (including `gx_border` toggle)
- `ThemeEngine` — file discovery, loading, compilation
- `compile_css()` — merges theme + base + defaults → CSS string

Tauri commands:
- `list_themes` — scan built-in + user directories, return `ThemeInfo`
- `load_theme(name)` — resolve, parse, merge, compile, return CSS + meta
- `get_active_theme` — return current active theme name

## Hot-Reload

User themes in `~/.config/lexer/themes/` are watched with `notify`. When a `.toml` file is modified and it is the currently active theme, the engine recompiles and emits a `theme-updated` event. The frontend swaps the `<style>` block — no restart needed.
