# Lexer - Implementation Progress

> Tracks what's built, what's in progress, and what's remaining.
> Updated as implementation proceeds.

## Legend

- [x] Complete
- [~] Partial / in progress
- [ ] Not started

---

## Phase 1: Core MVP

### 1.1 Project Scaffold
- [x] Tauri v2 project structure (`src-tauri/`, `src/`)
- [x] `Cargo.toml` with all core dependencies
- [x] `tauri.conf.json` with window config, CSP, `withGlobalTauri`
- [x] `capabilities/default.json` with IPC permissions
- [x] `build.rs` for Tauri
- [x] Placeholder icon (`icons/icon.png`)
- [x] `.gitignore`

### 1.2 Markdown Parsing (`src-tauri/src/markdown/`)
- [x] `pulldown-cmark` integration with GFM extensions (tables, strikethrough, task lists, footnotes)
- [x] HTML generation pipeline
- [x] Fenced code block interception (routes to tree-sitter)
- [x] Heading extraction with slug IDs
- [x] Table of contents (`TocEntry`) generation
- [x] `escape_html` / `escape_attr` / `slugify` helpers
- [ ] Math/LaTeX support (future)

### 1.3 Tree-sitter Syntax Highlighting (`src-tauri/src/highlight/`)
- [x] `LanguageRegistry` with HashMap + alias normalization
- [x] 12 language grammars registered (Rust, JS, TS, Python, JSON, Bash, C, C++, Go, TOML, HTML, CSS)
- [ ] Markdown grammar (tree-sitter-md registered but not wired for highlight)
- [x] `highlight_code()` producing `<span class="hl-*">` HTML
- [x] 23 highlight token names mapped to CSS classes
- [x] Graceful fallback (plain `<pre><code>` when grammar unavailable)

### 1.4 File System (`src-tauri/src/fs/`)
- [x] `load_file()` — read file, resolve to canonical path
- [x] `resolve_path()` — relative/absolute path resolution
- [x] `FileWatcher` struct with `notify` crate
- [ ] File watcher integration in `main.rs` (spawn thread, emit `file-changed` events)
- [ ] Re-render on file change in frontend

### 1.5 Tauri Commands (`src-tauri/src/commands.rs`)
- [x] `open_file` — parse + render + return HTML/title/TOC
- [x] `get_toc` — return TOC for current file
- [x] `get_current_file` — return current file path
- [ ] `open_file_dialog` (currently handled via `plugin:dialog|open` in JS)

### 1.6 App State (`src-tauri/src/state.rs`)
- [x] `AppState` with `current_file: Option<PathBuf>`
- [ ] Recent files list (LRU)
- [ ] Per-window state

### 1.7 Frontend — HTML (`src/index.html`)
- [x] HTML shell with content panel, status bar, empty state
- [x] Script and stylesheet links

### 1.8 Frontend — Styling (`src/style.css`)
- [x] CSS custom properties for full dark theme
- [x] Typography (headings, paragraphs, links, bold/italic)
- [x] Code blocks with syntax highlight classes (23 token types)
- [x] Language badge (`pre[data-lang]::after`)
- [x] Blockquotes with left border + tinted background
- [x] Tables with header styling, alternating rows
- [x] Lists (ordered, unordered, task lists)
- [x] Horizontal rules
- [x] Images (responsive, rounded)
- [x] Scrollbar styling
- [x] Status bar
- [x] Empty state

### 1.9 Frontend — JavaScript (`src/app.js`)
- [x] IPC: `invoke('open_file')` renders markdown
- [x] File dialog via `invoke('plugin:dialog|open')`
- [x] Keyboard shortcut `Cmd+O` / `Ctrl+O`
- [x] Drag-and-drop file opening
- [x] CLI argument handling (`open-file-arg` event listener)
- [x] `file-changed` event listener (scroll-preserving reload)
- [x] Link click handling: external (shell open), anchor (scroll), relative `.md` (navigate)
- [ ] Drag-and-drop: verify Tauri v2 file path access works

---

## Phase 2: File Watching & Live Reload

- [ ] Wire `FileWatcher` into `main.rs` setup
- [ ] Spawn watcher thread, emit `file-changed` event with re-rendered HTML
- [ ] Swap watcher when user opens a different file
- [ ] Frontend: verify scroll position preservation on reload
- [ ] Handle watcher errors gracefully

---

## Phase 3: Helix-Style Keyboard Navigation

### 3.1 Keyboard Engine (`src/keyboard.js`)
- [ ] Mode state machine (Normal, Goto, Space, Search, View)
- [ ] Pending key buffer with 1s timeout
- [ ] Key normalization
- [ ] Overlay detection (skip when palette/lightbox open)

### 3.2 Normal Mode
- [ ] Scroll: `j`/`k` (line), `d`/`u` (half page), `f`/`b` (full page)
- [ ] Jump: `G` (bottom), `gg` (top)
- [ ] Heading nav: `]`/`[` (next/prev), `]]`/`[[` (next/prev h2+), `1`-`6` (level)
- [ ] Link nav: `Tab`/`S-Tab` (focus), `Enter` (open)
- [ ] Actions: `y` (copy anchor), `p` (open from clipboard), `r` (reload), `q` (quit), `?` (help)

### 3.3 Goto Mode (`g`)
- [ ] `gg` (top), `ge` (end), `gh` (first heading), `gl` (last heading)
- [ ] `gt` (ToC sidebar), `gn`/`gp` (next/prev file)

### 3.4 Space Mode (leader key)
- [ ] `f` (file search), `r` (recent), `h` (heading jump), `c` (commands)
- [ ] `t` (themes), `/` (text search), `s` (sidebar), `e` (effects)
- [ ] `l` (line numbers), `p` (print), `q` (quit), `?` (help)

### 3.5 View Mode (`z`)
- [ ] `zz` (center), `zt` (top), `zb` (bottom)
- [ ] `z+`/`z-` (zoom), `z=` (reset zoom)

### 3.6 Search Mode (`/`)
- [ ] Incremental highlight
- [ ] `Enter` (confirm + jump), `n`/`N` (next/prev), `Escape` (cancel)

### 3.7 Which-Key Popup
- [ ] Floating popup after 200ms in multi-key modes
- [ ] Shows available keys + descriptions

### 3.8 Status Bar Mode Indicator
- [ ] Colored badge showing current mode
- [ ] Pending key sequence display

---

## Phase 4: Command Palette

### 4.1 Palette UI (`src/palette.js`)
- [ ] Modal overlay with frosted glass backdrop
- [ ] Auto-focus input, scrollable results list
- [ ] Highlighted fuzzy-match characters
- [ ] Result count, footer hint bar
- [ ] Keyboard navigation (up/down/enter/escape)

### 4.2 Fuzzy Matching
- [ ] Scoring algorithm (consecutive match bonus, path boundary bonus)

### 4.3 Palette Modes
- [ ] File search (default, no prefix) — fuzzy `.md` files
- [ ] Command mode (`:` prefix)
- [ ] Heading jump (`#` prefix)
- [ ] Theme picker (`@` prefix)
- [ ] Recent files (`>` prefix)
- [ ] Text search (`/` prefix)

### 4.4 Backend Support
- [ ] `scan_directory` command — recursive `.md` file listing
- [ ] `get_recent_files` command
- [ ] `palette_search` / `palette_execute` commands
- [ ] File entry caching, re-scan on focus

---

## Phase 5: Visual Effects

### 5.1 Background & Atmosphere (`src/effects.css`)
- [ ] Frosted glass panels (`backdrop-filter`)
- [ ] Gradient mesh backdrop
- [ ] Noise texture overlay (SVG data URI)
- [ ] Ambient glow on code blocks and blockquotes

### 5.2 Element Effects
- [ ] Code blocks: inner shadow, ambient glow
- [ ] Blockquotes: left border gradient, frosted bg
- [ ] Headings: text gradient fill
- [ ] Links: underline slide-in hover animation
- [ ] Tables: header blur backdrop
- [ ] Horizontal rules: gradient fade with glow pulse
- [ ] Images: drop shadow, zoom-on-hover

### 5.3 Transitions & Animations
- [ ] Theme switch cross-fade (300ms)
- [ ] Content reload fade-out/fade-in (200ms)
- [ ] Scroll-into-view fade-up (`IntersectionObserver`)
- [ ] Code block hover glow/scale
- [ ] ToC sidebar slide-in/out
- [ ] Image progressive fade-in

### 5.4 Canvas Particle Effects
- [ ] Canvas layer behind content (GPU-composited)
- [ ] Presets: `floating_dots`, `constellation`, `aurora`, `fireflies`, `rain`, `none`
- [ ] Capped at 30fps, auto-pause after 30s idle

### 5.5 Parallax & Depth
- [ ] 5 scroll-rate layers (canvas 0.1x -> content 1.0x -> UI sticky)

### 5.6 Cursor-Reactive Effects
- [ ] Spotlight glow following cursor
- [ ] Code block proximity brightening
- [ ] Ripple on click

### 5.7 Advanced Code Block Effects
- [ ] Line highlight on hover
- [ ] Optional line numbers gutter
- [ ] Copy button with glow feedback
- [ ] Scroll shadow at edges
- [ ] Focus dim (dim rest of page on hover)

### 5.8 Image & Media Effects
- [ ] Lazy fade-in on load
- [ ] 3D tilt on hover
- [ ] Lightbox (click to expand)
- [ ] Caption slide-up from alt text

### 5.9 Performance & Accessibility
- [ ] `prefers-reduced-motion: reduce` support
- [ ] Max 80 particles, auto-reduce on low-end
- [ ] All scroll handlers in `requestAnimationFrame`
- [ ] Effect toggles (per-effect on/off)

---

## Phase 6: Custom Theme System

### 6.1 Theme Engine (`src-tauri/src/theme/`)
- [ ] `Theme` struct parsed from TOML
- [ ] `to_css()` method generating `:root` custom properties
- [ ] Theme file discovery (user dir, env var, built-in)
- [ ] Merge with base defaults, validation

### 6.2 Built-in Themes (`src-tauri/themes/`)
- [ ] `lexer-dark.toml`
- [ ] `lexer-light.toml`
- [ ] `lexer-mono.toml`
- [ ] `lexer-solarized.toml`
- [ ] `lexer-nord.toml`

### 6.3 Tauri Commands
- [ ] `list_themes`
- [ ] `load_theme` (resolve, parse, return CSS)
- [ ] `get_theme` / `set_theme`
- [ ] `get_theme_config` (full parsed theme for preview)

### 6.4 Theme Hot-Reload
- [ ] Watch `~/.config/lexer/themes/` directory
- [ ] Auto-recompile + emit `theme-updated` event on change

---

## Phase 7: Multi-Window Support

### 7.1 Window Manager (`src-tauri/src/window/`)
- [ ] `WindowManager` struct tracking all windows
- [ ] `WindowState` per window (id, file, layout, scroll, zoom, ToC)
- [ ] Window cascade positioning (30px offset)

### 7.2 Tauri Commands
- [ ] `new_window` / `close_window`
- [ ] `list_windows` / `focus_window`

### 7.3 Window Lifecycle
- [ ] Create -> boot frontend -> apply state -> track
- [ ] On close: unwatch file, quit if last (macOS: keep alive)

### 7.4 Shared vs Per-Window State
- [ ] Global: theme, config, language registry, watcher pool
- [ ] Per-window: file, scroll, layout, zoom, ToC, search

### 7.5 Keyboard (`Space w`)
- [ ] `n` (new), `N` (clone), `c` (close), `w`/`W` (cycle)
- [ ] `l` (window list), `d`/`f`/`z`/`s` (layouts)

---

## Phase 8: Focus Layouts

### 8.1 Layout CSS (`src/layout.css`)
- [ ] Default layout (full chrome, optional ToC sidebar)
- [ ] Focus layout (centered 700px column, no sidebar)
- [ ] Zen layout (fullscreen, no chrome, Escape to exit)
- [ ] Split layout (pinned ToC 280px, resizable drag handle)

### 8.2 Layout JS (`src/layout.js`)
- [ ] `set_layout` / `get_layout` commands
- [ ] Data attribute switching on root element
- [ ] Smooth transitions between layouts
- [ ] Zen: mouse-near-top reveals controls

---

## Phase 9: Configuration & CLI

### 9.1 CLI Arguments (via `clap`)
- [ ] `[FILE]...` multiple files
- [ ] `-t, --theme` theme selection
- [ ] `--layout` initial layout
- [ ] `--no-effects` disable effects
- [ ] `--new-window` force new window
- [ ] `-h, --help` / `-V, --version`

### 9.2 Config File (`~/.config/lexer/config.toml`)
- [ ] `[appearance]`: theme, default layout
- [ ] `[behavior]`: live_reload, preserve_scroll, restore_session
- [ ] `[effects]`: per-effect overrides
- [ ] `[keymap]`: custom key remapping

---

## Phase 10: Future Enhancements

- [ ] Export to PDF / HTML
- [ ] Math rendering (KaTeX/MathJax)
- [ ] Mermaid diagram rendering
- [ ] Theme editor GUI
- [ ] Theme marketplace
- [ ] Plugin system
- [ ] Session persistence
- [ ] Tabs within windows
- [ ] Custom keymap file

---

## Commit History

| Hash | Description |
|------|-------------|
| `169c0b4` | Add Lexer spec (15 doc files + index) |
| `d2b17f9` | Add README |
| `cb4acf3` | Implement working MVP (Tauri v2, markdown, tree-sitter, dark theme, file open) |
| `5408dd5` | Fix Tauri v2 IPC: enable `withGlobalTauri`, plugin invoke syntax |
