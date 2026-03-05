# Custom Theme System

Lexer ships with built-in themes and supports fully user-defined themes. Themes control colors, typography, syntax highlighting, and visual effects from a single TOML file.

## Theme Architecture

```
Theme Resolution Order:
1. User-selected theme (from config or CLI --theme)
2. System preference (auto: light/dark based on OS setting)
3. Default built-in theme ("lexer-dark")

Theme Loading:
  TOML file  -->  Rust ThemeEngine  -->  CSS custom properties  -->  Webview
                      |
                      +--> validate & merge with defaults
```

A theme is a TOML file that maps to CSS custom properties. The Rust backend parses the TOML, validates it, fills in any missing values from the default theme, and generates a CSS `:root` block that is injected into the webview.

## Built-in Themes

| Theme Name       | Style      | Description                                    |
| ---------------- | ---------- | ---------------------------------------------- |
| `lexer-dark`     | Dark       | Default. Deep navy backdrop, frosted panels    |
| `lexer-light`    | Light      | Clean white, subtle gray panels, soft shadows  |
| `lexer-mono`     | Dark       | Monochrome grayscale, no color accents         |
| `lexer-solarized`| Dark/Light | Solarized palette, both variants               |
| `lexer-nord`     | Dark       | Nord color palette                              |

## Theme File Format

Themes are defined in TOML. Every field is optional -- missing values inherit from the base theme (`lexer-dark` or `lexer-light` depending on `base`).

```toml
# ~/.config/lexer/themes/my-theme.toml

[meta]
name = "My Custom Theme"
author = "Your Name"
base = "dark"                    # "dark" or "light" -- inherit missing values from this base
version = "1.0.0"

[colors]
# App chrome
bg_base = "#0d1117"              # Outermost background
bg_panel = "rgba(22, 27, 34, 0.85)"  # Content panel (supports alpha for glass effect)
bg_panel_border = "rgba(255, 255, 255, 0.08)"
text_primary = "#e6edf3"
text_secondary = "#8b949e"
text_muted = "#484f58"
accent = "#58a6ff"
link = "#58a6ff"
link_hover = "#79c0ff"

# Gradient mesh backdrop (up to 3 gradient stops)
gradient_a = "rgba(88, 166, 255, 0.15)"
gradient_b = "rgba(136, 87, 229, 0.12)"
gradient_c = "rgba(63, 185, 80, 0.10)"

# Element-specific
blockquote_border = "linear-gradient(180deg, #58a6ff, #8957e5)"
blockquote_bg = "rgba(56, 139, 253, 0.06)"
hr_color = "linear-gradient(90deg, transparent, #30363d, transparent)"
table_header_bg = "rgba(110, 118, 129, 0.12)"
table_row_alt_bg = "rgba(110, 118, 129, 0.04)"

[colors.code_block]
bg = "#161b22"
border = "rgba(255, 255, 255, 0.06)"
glow_color = "rgba(88, 166, 255, 0.08)"  # Ambient glow around code blocks
glow_radius = "40px"

[syntax]
# Tree-sitter highlight token -> color mapping
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
# Any unrecognized keys are passed through as .highlight-{key} CSS classes

[typography]
font_family = "system-ui, -apple-system, 'Segoe UI', sans-serif"
font_family_mono = "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace"
font_size = 16                   # px, base body font size
line_height = 1.6
code_font_size = 14              # px, code block font size
code_line_height = 1.5
heading_weight = 700
heading_letter_spacing = "-0.02em"

# Optional: per-heading size scale (rem relative to font_size)
h1_size = "2.0"
h2_size = "1.5"
h3_size = "1.25"
h4_size = "1.1"
h5_size = "1.0"
h6_size = "0.9"

[effects]
frosted_glass = true
frosted_blur = "20px"
frosted_saturate = "180%"
gradient_backdrop = true
noise_texture = true
noise_opacity = 0.03
ambient_glow = true
scroll_animations = true
transition_duration = 300        # ms
heading_gradient_text = false    # gradient fill on headings
image_hover_zoom = 1.02          # scale factor on hover (1.0 = disabled)
```

## Theme Engine (Rust)

```rust
/// Parsed and validated theme
#[derive(Debug, Deserialize)]
struct Theme {
    meta: ThemeMeta,
    colors: ThemeColors,
    syntax: HashMap<String, String>,
    typography: ThemeTypography,
    effects: ThemeEffects,
}

/// Compile theme to a CSS string of custom properties
impl Theme {
    fn to_css(&self) -> String {
        let mut css = String::from(":root {\n");
        // colors
        css.push_str(&format!("  --bg-base: {};\n", self.colors.bg_base));
        css.push_str(&format!("  --panel-bg: {};\n", self.colors.bg_panel));
        // ... all color tokens ...

        // syntax highlight colors
        for (token, color) in &self.syntax {
            css.push_str(&format!("  --hl-{}: {};\n", token, color));
        }

        // typography
        css.push_str(&format!("  --font-family: {};\n", self.typography.font_family));
        css.push_str(&format!("  --font-size: {}px;\n", self.typography.font_size));
        // ... all typography tokens ...

        // effects
        css.push_str(&format!("  --blur: {};\n", self.effects.frosted_blur));
        css.push_str(&format!("  --transition-ms: {}ms;\n", self.effects.transition_duration));
        // ...

        css.push_str("}\n");
        css
    }
}
```

## Theme Resolution & Loading

```
Lookup order for theme files:
1. ~/.config/lexer/themes/{name}.toml      (user themes)
2. $LEXER_THEMES_DIR/{name}.toml           (env override)
3. Built-in themes (embedded in binary)
```

```rust
#[tauri::command]
fn list_themes() -> Vec<ThemeInfo> {
    // Scan built-in + user theme directories
    // Return name, author, base (dark/light), path
}

#[tauri::command]
fn load_theme(name: String) -> Result<String, String> {
    // 1. Resolve theme file
    // 2. Parse TOML
    // 3. Merge with base defaults
    // 4. Validate
    // 5. Return compiled CSS string
}

#[tauri::command]
fn get_theme_config(name: String) -> Result<Theme, String> {
    // Return the full parsed theme for a theme editor/preview UI
}
```

## Theme Hot-Reload

User theme files in `~/.config/lexer/themes/` are watched with `notify`. When a `.toml` theme file is modified and it is the currently active theme, the app automatically recompiles and re-injects the CSS -- no restart needed.

```rust
// Watch themes directory for changes
fn watch_themes(themes_dir: &Path, app_handle: AppHandle) {
    let mut watcher = notify::recommended_watcher(move |event| {
        if is_toml_modify(&event) {
            if let Ok(css) = recompile_active_theme() {
                app_handle.emit("theme-updated", css).ok();
            }
        }
    });
    watcher.watch(themes_dir, RecursiveMode::NonRecursive);
}
```

## CSS Custom Property Mapping

The frontend CSS references **only** custom properties -- never hard-coded colors. This makes theme switching instantaneous (swap the `:root` variables).

```css
/* All styles reference variables */
body {
    font-family: var(--font-family);
    font-size: var(--font-size);
    line-height: var(--line-height);
    color: var(--text-primary);
}

.app-backdrop {
    background:
        radial-gradient(ellipse at 20% 50%, var(--gradient-a) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, var(--gradient-b) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, var(--gradient-c) 0%, transparent 50%),
        var(--bg-base);
}

.content-panel {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    backdrop-filter: blur(var(--blur)) saturate(var(--saturate));
}

pre code .highlight-keyword    { color: var(--hl-keyword); }
pre code .highlight-string     { color: var(--hl-string); }
pre code .highlight-comment    { color: var(--hl-comment); font-style: italic; }
pre code .highlight-function   { color: var(--hl-function); }
/* ... all syntax tokens ... */
```
