# Project Structure

```
lexer/
  src-tauri/
    Cargo.toml              # Rust crate dependencies (includes clap for CLI)
    Cargo.lock              # Locked dependency versions
    build.rs                # Tauri build script
    tauri.conf.json         # Tauri app config (window, bundle, vibrancy, etc.)
    capabilities/
      default.json          # Permissions for IPC commands
    src/
      main.rs               # Tauri entry point, clap CLI, config loading, command registration
      commands.rs            # #[tauri::command] handlers (open_file, get_recent_files, etc.)
      state.rs              # Managed app state (buffers, theme, recent files, etc.)
      config.rs             # CLI args + ~/.config/lexer/config.toml loading & merging
      markdown/
        mod.rs              # Markdown module
        parser.rs           # pulldown-cmark parsing + HTML generation
      highlight/
        mod.rs              # Highlight module
        registry.rs         # Language registry (12 langs -> HighlightConfiguration)
      theme/
        mod.rs              # Theme module
        engine.rs           # TOML -> CSS compiler, validation, built-in themes
      fs/
        mod.rs              # File system module
        loader.rs           # File reading, path resolution
        watcher.rs          # File watching with notify + 300ms debounce
    themes/                 # Built-in themes (embedded in binary via include_str!)
      lexer-dark.toml
      lexer-light.toml
      lexer-mono.toml
      lexer-solarized.toml
      lexer-nord.toml
  src/                      # Frontend source (served by Tauri dev server)
    index.html              # HTML shell
    style.css               # Base styles (all CSS custom properties, hint labels, which-key)
    layout.css              # Layout mode styles (default, focus, zen, split)
    effects.css             # Visual effect styles (glass, glow, animations)
    app.js                  # Tauri IPC calls, DOM manipulation, startup-config listener
    keyboard.js             # Helix-style keyboard engine (6 modes, which-key, link hints)
    palette.js              # Command palette logic + fuzzy matching (7 modes)
    layout.js               # Layout switching logic + ToC sidebar
    effects.js              # Visual effects manager (frosted glass, spotlight, etc.)
    particles.js            # Particle canvas animation
  docs/
    SPEC.md                 # Spec index
    PROGRESS.md             # Implementation checklist
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
```

**User directories:**

| Path                          | Purpose                    | Status      |
| ----------------------------- | -------------------------- | ----------- |
| `~/.config/lexer/config.toml` | User configuration         | Implemented |
| `~/.config/lexer/themes/`     | User-defined theme files   | Implemented |
| `~/.config/lexer/session.toml`| Window session persistence | Future      |
