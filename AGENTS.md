# AGENTS.md — Lexer Codebase Guide

## Project Overview

Lexer is a macOS Markdown viewer built with **Tauri v2** (Rust backend) and **vanilla HTML/CSS/JS** (no framework, no bundler, no npm). It features Helix-style modal keyboard navigation, syntax highlighting via tree-sitter, and a theme engine that compiles TOML to CSS custom properties at runtime.

## Build & Run Commands

```bash
# Development (hot-reload)
cargo tauri dev -- -- path/to/file.md

# Release build (creates .app bundle)
cargo tauri build

# Install binary to ~/.cargo/bin
cargo install --path src-tauri

# Run Rust tests (none exist yet — add them!)
cargo test --manifest-path src-tauri/Cargo.toml

# Run a single Rust test
cargo test --manifest-path src-tauri/Cargo.toml test_name

# Format Rust code (uses default rustfmt settings — no .rustfmt.toml)
cargo fmt --manifest-path src-tauri/Cargo.toml

# Lint Rust code (uses default clippy settings — no clippy.toml)
cargo clippy --manifest-path src-tauri/Cargo.toml
```

There is no JavaScript build step, linter, or test runner. Frontend files in `src/` are served directly (`frontendDist: "../src"` in `tauri.conf.json`).

## Project Structure

```
src-tauri/                  # Rust backend (Tauri v2)
  src/
    main.rs                 # Entry: CLI (clap), Tauri setup, state init, event wiring
    commands.rs             # All #[tauri::command] handlers (~21 commands)
    state.rs                # AppState, BufferState, LayoutMode
    config.rs               # LexerConfig from ~/.config/lexer/config.toml
    fs/                     # File I/O: loader.rs (read), watcher.rs (notify debounce)
    highlight/              # tree-sitter: mod.rs (highlight_code), registry.rs (13 langs)
    markdown/               # pulldown-cmark: parser.rs (HTML, TOC, block source maps)
    theme/                  # engine.rs (TOML→CSS compiler, theme listing)
  themes/                   # 5 built-in .toml theme files
src/                        # Frontend (vanilla JS, no build step)
  index.html                # HTML shell, <script> loading order matters
  style.css                 # Base styles + CSS custom properties (:root)
  effects.css               # Visual effects (glass, glow, particles, animations)
  layout.css                # Layout modes via [data-layout="..."] selectors
  app.js                    # Core: Tauri IPC, file open, tab/buffer management
  keyboard.js               # Modal keyboard engine (normal/goto/select/search/etc.)
  palette.js                # Command palette + fuzzy matching
  layout.js                 # ToC sidebar + scroll-spy
  effects.js                # Effects engine (spotlight, ripple, lightbox, copy buttons)
  particles.js              # Canvas particle animations
docs/                       # 19 spec/design documents (numbered, authoritative)
```

## Rust Code Style

### Imports
1. Standard library (`std::*`)
2. External crates (`serde`, `tauri`, `pulldown_cmark`, etc.)
3. Internal modules (`crate::*`, `super::*`)

### Error Handling
- Commands return `Result<T, String>` (Tauri requirement).
- Mutex locks: `.lock().map_err(|e| e.to_string())?`
- Descriptive errors: `.map_err(|e| format!("Failed to load: {}", e))?`
- Non-fatal logging: `tracing::warn!("message")`
- `anyhow`/`thiserror` are in Cargo.toml but not yet used in source.

### Naming
- Structs/Enums: `PascalCase` (`AppState`, `BufferState`, `LayoutMode`)
- Functions: `snake_case` (`render_markdown`, `load_file`)
- Constants: `SCREAMING_SNAKE_CASE` (`HIGHLIGHT_NAMES`, `CSS_CLASSES`)

### Derives & Serde
- IPC structs: `#[derive(Debug, Clone, Serialize)]`
- Config/TOML structs: `#[derive(Debug, Clone, Deserialize)]` with `#[serde(default)]`
- Enum serialization: `#[serde(rename = "...")]` on variants
- Skip non-IPC fields: `#[serde(skip)]`

### Module Pattern
- Each module directory has `mod.rs` that re-exports: `pub use loader::load_file;`
- `main.rs` declares modules and registers Tauri commands.

### State & Concurrency
- Single `Arc<Mutex<AppState>>` managed by Tauri.
- Every command locks: `let mut st = state.lock().map_err(|e| e.to_string())?;`
- Background work uses `std::thread::spawn`, not async.
- No async commands yet (spec'd for OpenCode integration).

### Tauri Command Pattern
```rust
#[tauri::command]
pub fn command_name(
    param: Type,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<ReturnType, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    // ...
}
```

## JavaScript Code Style

### Module Pattern
- One class per file, instantiated at bottom: `window.lexerApp = { ... }` or `const kb = new KeyboardEngine()`.
- No ES modules — scripts loaded via `<script>` tags in order in `index.html`.
- Cross-module access: `window.lexerApp`, `window.lexerKeyboard`, `window.lexerLayout`, etc.

### Tauri IPC
```js
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
// Commands: invoke('snake_case_command', { camelCaseParams })
// Plugins: invoke('plugin:name|command', { ... })
```

### Naming
- Variables/functions: `camelCase` (`currentBufferId`, `openFile`)
- Private methods: underscore prefix (`_scroll()`, `_handleSearchKey()`)
- DOM refs: `El` suffix (`contentEl`, `tabBarEl`, `modeBadge`)
- Constants: `SCREAMING_SNAKE_CASE` (`BLOCK_SELECTORS`)

### Error Handling
- Wrap all `invoke()` in `try/catch` with `console.error`.
- Non-critical failures: `catch(() => {})` or `catch(console.error)`.

### DOM Patterns
- `document.getElementById()` for initial refs.
- `classList.toggle/add/remove()` for state changes.
- `innerHTML` for rendering (tabs, palette, ToC).
- `dataset` for data binding: `data-buffer-id`, `data-block-index`, `data-layout`.
- Layout driven by `document.documentElement.dataset.layout`.

### Event Communication
- Custom events: `window.dispatchEvent(new CustomEvent('open-palette', { detail }))`.
- Tauri events: `listen('file-changed', callback)`.
- Direct calls: `window.lexerApp.openFile(path)`.

## CSS Code Style

### Naming
- Hyphenated descriptive names: `.content-panel`, `.tab-bar`, `.status-bar`.
- State classes: `.visible`, `.active`, `.selected`, `.is-scrolling`, `.effects-off`.
- No BEM. No CSS modules.

### Custom Properties
- All theme values in `:root` (`style.css` top).
- Theme engine injects overrides via `<style>` element at runtime.
- Dynamic props updated by JS: `--cursor-x`, `--cursor-y`.

### File Organization
- `style.css`: Variables, reset, typography, all UI components.
- `effects.css`: Visual effects, animations, `@media (prefers-reduced-motion)`.
- `layout.css`: Layout modes via `[data-layout="..."]` attribute selectors.

### Patterns
- `backdrop-filter: blur() saturate()` on glass panels.
- Effects disabled via `body.effects-off .selector` overrides.
- All transitions declared explicitly.

## Key Architecture Patterns

### Theme System
TOML → `ThemeFile` struct → `compile_css()` with fallback chain (theme → base → default) → CSS string injected into frontend `<style>`. Hot-reload via file watcher emitting `theme-updated` event.

### Keyboard Engine
Modal with 7 modes: `normal`, `goto`, `space`, `view`, `search`, `hint`, `select`. Keymap objects map key sequences to `{ fn }` or `{ mode }`. Which-key popup shows available keys. Multi-key sequences with 1-second timeout.

### File Watching
Each opened file gets a `FileWatcher` with 300ms debounce on a dedicated thread. Active buffer changes emit `file-changed`; inactive buffers marked modified.

## Important Notes

- **No tests exist yet.** When adding features, consider adding `#[cfg(test)]` modules.
- **No CI pipeline.** Run `cargo fmt`, `cargo clippy`, and `cargo test` locally before committing.
- **Docs are authoritative.** The `docs/` directory contains numbered specs. Update the relevant spec when changing behavior.
- **Frontend has no build step.** Edit JS/CSS files directly — changes appear on reload.
- **Tauri v2 APIs.** Use `window.__TAURI__.core.invoke()`, not Tauri v1 patterns.
