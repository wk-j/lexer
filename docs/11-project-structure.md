# Project Structure

```
lexer/
  Cargo.toml               # Workspace Cargo.toml
  src-tauri/
    Cargo.toml              # Rust crate dependencies
    build.rs                # Tauri build script
    tauri.conf.json         # Tauri app config (window, bundle, etc.)
    capabilities/
      default.json          # Permissions for IPC commands
    src/
      main.rs               # Tauri entry point, command registration
      commands.rs            # #[tauri::command] handlers
      state.rs              # Managed app state (current file, theme, etc.)
      window/
        mod.rs              # Window module
        manager.rs          # WindowManager: create, track, focus, close
        layout.rs           # LayoutMode enum, per-window layout state
      markdown/
        mod.rs              # Markdown module
        parser.rs           # pulldown-cmark parsing + HTML generation
        renderer.rs         # Assemble final HTML document
      highlight/
        mod.rs              # Highlight module
        registry.rs         # Language registry (lang -> HighlightConfiguration)
        highlighter.rs      # Tree-sitter highlighting logic
      theme/
        mod.rs              # Theme module
        engine.rs           # TOML -> CSS compiler, validation, merging
        registry.rs         # Discover & list built-in + user themes
        watcher.rs          # Hot-reload user theme files
      fs/
        mod.rs              # File system module
        watcher.rs          # File watching with notify
        loader.rs           # File reading, path resolution
    themes/                 # Built-in themes (embedded in binary via include_str!)
      lexer-dark.toml
      lexer-light.toml
      lexer-mono.toml
      lexer-solarized.toml
      lexer-nord.toml
    icons/                  # App icons for bundling
  src/                      # Frontend source (served by Tauri dev server)
    index.html              # HTML shell
    style.css               # Base styles (all CSS custom properties)
    layout.css              # Layout mode styles (default, focus, zen, split)
    effects.css             # Visual effect styles (glass, glow, animations)
    app.js                  # Tauri IPC calls, DOM manipulation, effect toggles
    keyboard.js             # Helix-style keyboard engine
    palette.js              # Command palette logic + fuzzy matching
    layout.js               # Layout switching logic
  docs/
    SPEC.md                 # Spec index
    01-overview.md
    02-markdown.md
    03-tree-sitter.md
    04-ui.md
    05-visual-effects.md
    06-command-palette.md
    07-keyboard.md
    08-windows-and-layouts.md
    09-themes.md
    10-filesystem.md
    11-project-structure.md
    12-config.md
    13-dependencies.md
    14-build.md
    15-future.md
  tests/
    integration/            # Integration tests
    fixtures/               # Test Markdown files
```

**User directories:**

| Path                          | Purpose                    |
| ----------------------------- | -------------------------- |
| `~/.config/lexer/config.toml` | User configuration         |
| `~/.config/lexer/themes/`     | User-defined theme files   |
| `~/.config/lexer/session.toml`| Window session persistence |
