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
- [x] `FileWatcher` struct with `notify` crate + 300ms debounce
- [x] File watcher integration in `commands::open_file` (auto-starts watcher, emits `file-changed`)
- [x] Re-render on file change in frontend (scroll position preserved)

### 1.5 Tauri Commands (`src-tauri/src/commands.rs`)
- [x] `open_file` — parse + render + return HTML/title/TOC + start watcher
- [x] `get_toc` — return TOC for current file
- [x] `get_current_file` — return current file path
- [x] `scan_directory` — recursive `.md` file listing with metadata
- [x] File dialog handled via `plugin:dialog|open` in JS

### 1.6 App State (`src-tauri/src/state.rs`)
- [x] `AppState` with `current_file: Option<PathBuf>`, `watcher: Option<FileWatcher>`
- [ ] Recent files list (LRU)
- [ ] Per-window state

### 1.7 Frontend — HTML (`src/index.html`)
- [x] HTML shell with content panel, status bar, empty state
- [x] Script and stylesheet links (app.js, keyboard.js, palette.js)
- [x] Mode badge, pending keys, search bar, which-key popup, palette overlay

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

- [x] Wire `FileWatcher` into `commands::open_file`
- [x] Debounced watcher (300ms) emits `file-changed` event with re-rendered HTML
- [x] Watcher swaps when user opens a different file (old watcher dropped)
- [x] Frontend preserves scroll position on reload
- [x] Watcher errors handled gracefully (logged, watcher set to None)

---

## Phase 3: Helix-Style Keyboard Navigation

### 3.1 Keyboard Engine (`src/keyboard.js`)
- [x] Mode state machine (Normal, Goto, Space, Search, View)
- [x] Pending key buffer with 1s timeout
- [x] Key normalization (Shift, Space, arrows, etc.)
- [x] Overlay detection (skip when palette/lightbox open)
- [x] Ctrl/Cmd keys ignored (passed through to browser/Tauri)

### 3.2 Normal Mode
- [x] Scroll: `j`/`k` (line), `d`/`u` (half page), `f`/`b` (full page)
- [x] Jump: `G` (bottom), `gg` (top via Goto mode)
- [x] Heading nav: `]`/`[` (next/prev), `]]`/`[[` (next/prev h2+), `1`-`6` (level)
- [x] Link nav: `Tab`/`S-Tab` (focus with visual highlight), `Enter` (open)
- [x] Actions: `y` (copy anchor), `r` (reload), `n`/`N` (search next/prev), `?` (help overlay)
- [ ] `p` (open from clipboard) — not yet implemented
- [ ] `q` (quit) — not yet implemented

### 3.3 Goto Mode (`g`)
- [x] `gg` (top), `ge` (end), `gh` (first heading), `gl` (last heading)
- [x] `gt` (ToC sidebar toggle)
- [ ] `gn`/`gp` (next/prev file) — needs file list

### 3.4 Space Mode (leader key)
- [x] `f` (file search), `r` (recent), `h` (heading jump), `c` (commands)
- [x] `t` (themes), `/` (text search), `s` (sidebar), `e` (effects)
- [x] `l` (line numbers)
- [ ] `p` (print), `q` (quit), `?` (help) — not yet wired

### 3.5 View Mode (`z`)
- [x] `zz` (center viewport)
- [x] `zt` (top), `zb` (bottom)
- [x] `z+`/`z-` (zoom in/out), `z=` (reset zoom)

### 3.6 Search Mode (`/`)
- [x] Incremental highlight (text node walking, `<mark>` wrapping)
- [x] `Enter` (confirm + jump to first), `n`/`N` (next/prev), `Escape` (cancel + clear)
- [x] Search bar UI with `/` label

### 3.7 Which-Key Popup
- [x] Floating popup on mode entry (Goto, Space, View)
- [x] Shows available keys + descriptions
- [x] Styled with panel bg, accent colors, monospace

### 3.8 Status Bar Mode Indicator
- [x] Colored badge (NOR/GOT/SPC/SCH/VIW) with per-mode colors
- [x] Pending key sequence display

---

## Phase 4: Command Palette

### 4.1 Palette UI (`src/palette.js`)
- [x] Modal overlay with semi-transparent backdrop
- [x] Auto-focus input, scrollable results list
- [x] Highlighted fuzzy-match characters
- [x] Result count, footer hint bar with contextual hints
- [x] Keyboard navigation (up/down/enter/escape)
- [x] Mouse hover/click support
- [x] `Cmd+P` / `Ctrl+P` toggle

### 4.2 Fuzzy Matching
- [x] Scoring algorithm (consecutive match bonus, path boundary bonus)
- [x] Match character highlighting in results

### 4.3 Palette Modes
- [x] File search (default, no prefix) — fuzzy `.md` files via `scan_directory`
- [x] Command mode (`:` prefix) — toggle sidebar/effects/line-numbers, zoom, open, reload, copy path
- [x] Heading jump (`#` prefix) — from `get_toc`, indented by level
- [x] Theme picker (`@` prefix) — placeholder (2 themes)
- [x] Recent files (`>` prefix) — placeholder (empty)
- [ ] Text search (`/` prefix) — redirects to search mode, not in palette yet

### 4.4 Backend Support
- [x] `scan_directory` command — recursive `.md` file listing with metadata
- [ ] `get_recent_files` command — needs LRU in state
- [x] File entry caching in JS (per-directory)
- [ ] `palette_search` / `palette_execute` commands — not needed, handled in JS

---

## Phase 5: Visual Effects

### 5.1 Background & Atmosphere (`src/effects.css`)
- [x] Frosted glass panels (`backdrop-filter: blur() saturate()`)
- [x] Gradient mesh backdrop (3 radial gradients, themed colors)
- [x] Noise texture overlay (SVG data URI, `mix-blend-mode: overlay`)
- [x] Ambient glow on code blocks (`box-shadow` with `--glow-color`)

### 5.2 Element Effects
- [x] Code blocks: inner shadow, ambient glow, hover glow/scale
- [x] Blockquotes: left border gradient, frosted bg
- [x] Headings: gradient text fill (`background-clip: text`), h2 section divider glow
- [x] Links: underline slide-in hover animation (pseudo-element)
- [x] Tables: header blur backdrop
- [x] Horizontal rules: gradient fade with glow pulse animation
- [x] Images: drop shadow, zoom-on-hover, rounded corners

### 5.3 Transitions & Animations
- [x] Theme switch cross-fade (300ms on CSS variables)
- [x] Content reload fade-out/fade-in (`.reloading` class)
- [x] Scroll-into-view fade-up (`IntersectionObserver` + `.fade-up.visible`)
- [x] Code block hover glow/scale (150ms)
- [ ] ToC sidebar slide-in/out — deferred to Phase 8 (layouts)
- [x] Image zoom-on-hover transition

### 5.4 Canvas Particle Effects (`src/particles.js`)
- [x] Canvas layer behind content (GPU-composited, DPR-aware)
- [x] 6 presets: `floating_dots`, `constellation`, `aurora`, `fireflies`, `rain`, `none`
- [x] 30fps cap via `requestAnimationFrame` + interval gating
- [x] Auto-pause after 30s idle, resume on scroll/mouse
- [x] Pause when tab hidden (`visibilitychange`)
- [x] Auto-reduce particle count based on viewport size

### 5.5 Parallax & Depth
- [x] Background layers at z-index 0-1 (canvas, gradient, noise, spotlight)
- [x] Content at z-index 2, UI overlays above
- [ ] Scroll-driven parallax transforms (deferred — needs scroll variable piping)

### 5.6 Cursor-Reactive Effects
- [x] Spotlight glow following cursor (`--cursor-x/--cursor-y` + radial gradient)
- [x] Ripple on click (expanding CSS ring, auto-removes)
- [ ] Code block proximity brightening — deferred
- [ ] Magnetic headings — deferred

### 5.7 Advanced Code Block Effects
- [x] Copy button with glow feedback (injected on render, `.copied` state)
- [x] Scroll shadow at edges (CSS `background-attachment: local`)
- [x] Focus dim (`:has(pre:hover)` dims siblings)
- [ ] Line highlight on hover — needs per-line `<span>` wrapping in parser
- [ ] Optional line numbers gutter — needs parser changes

### 5.8 Image & Media Effects
- [x] 3D tilt on hover (perspective + rotateX/Y following cursor)
- [x] Lightbox (click to expand, blurred backdrop, Escape closes)
- [ ] Caption slide-up from alt text — needs `<img>` wrapper in parser
- [ ] Lazy fade-in on load — deferred

### 5.9 Performance & Accessibility
- [x] `prefers-reduced-motion: reduce` (disables all animations, hides canvas/spotlight)
- [x] Max 80 particles, auto-reduce based on viewport
- [x] Scroll/mouse handlers with `{ passive: true }`
- [x] `.effects-off` body class kills all visual effects
- [x] MutationObserver re-applies effects on content change

---

## Phase 6: Buffer / Tab Support

### 6.1 Buffer State (`src-tauri/src/state.rs`)
- [x] `BufferState` struct (id, file_path, title, html, toc, scroll_position, modified)
- [x] `AppState` refactored: `buffers: Vec<BufferState>`, `active_buffer: usize`, `next_buffer_id: u64`
- [x] Dedup: opening an already-open file switches to existing buffer

### 6.2 Buffer Tauri Commands (`src-tauri/src/commands.rs`)
- [x] `open_file` updated: creates buffer, returns `OpenFileResult` with `buffer_id`
- [x] `close_buffer(buffer_id)` — remove buffer, return new active
- [x] `switch_buffer(buffer_id)` — save scroll, switch, return content
- [x] `next_buffer` / `prev_buffer` — cycle through buffer list
- [x] `list_buffers` — return all buffer summaries
- [x] `save_scroll(scroll)` — persist scroll position for active buffer
- [x] `close_other_buffers` — close all except active

### 6.3 File Watcher Updates
- [x] Watcher per unique file (not per buffer)
- [x] On file change: update buffer's cached html/toc, emit to frontend if active, set modified if inactive
- [x] `buffer-modified` event for inactive buffer changes
- [x] Drop watcher when last buffer using that file is closed

### 6.4 Tab Bar UI (`src/index.html`, `src/style.css`)
- [x] Tab bar HTML structure (between titlebar and content)
- [x] Tab styling: active indicator, modified dot, close button, overflow scroll
- [x] Click to switch, click X to close
- [x] Tab context: middle-click to close

### 6.5 Buffer Keyboard Navigation (`src/keyboard.js`)
- [x] `Space b` sub-mode: b (picker), n (next), p (prev), d (close), N (new), o (close others)
- [x] `H` / `L` in Normal mode: prev/next buffer
- [x] Which-key labels for buffer sub-mode
- [x] Buffer picker palette mode (`%` prefix, triggered by `Space b b`)

### 6.6 Frontend Buffer Switching (`src/app.js`)
- [x] `switchBuffer()`: save scroll, swap HTML, restore scroll, update tab bar
- [x] Tab bar rendering from `list_buffers` result
- [ ] `buffers-changed` event listener to re-render tab bar (deferred — tab bar updates inline)
- [x] `buffer-modified` event listener to show modified indicator on tab
- [x] Update `openFile()` to handle `OpenFileResult.already_open`

### 6.7 Transparent Window with Vibrancy
- [x] `"transparent": true` in `tauri.conf.json` window config
- [x] `"macOSPrivateApi": true` in `tauri.conf.json` app config
- [x] `window-vibrancy = "0.6"` in Cargo.toml
- [x] `apply_vibrancy(NSVisualEffectMaterial::UnderWindowBackground)` in setup hook
- [x] `html`, `body`, `.app` backgrounds set to `transparent`
- [x] `--bg-base` changed from opaque `#0d1117` to `transparent`, added `--bg-base-opaque` for text-on-accent use
- [x] `--code-bg` changed to `rgba(22, 27, 34, 0.45)` with backdrop-filter blur
- [x] `--panel-bg` reduced to `rgba(22, 27, 34, 0.55)`
- [x] Tab bar, search bar, status bar: semi-transparent with backdrop-filter blur
- [x] Which-key popup, command palette modal: backdrop-filter frosted glass
- [x] `.app-backdrop` gradient: removed opaque `var(--bg-base)` fallback layer, reduced gradient intensities
- [x] Blockquotes, pre blocks: added backdrop-filter blur
- [x] Mode badge, palette selected item: use `--bg-base-opaque` for text color
- [x] Full-window dragging: mousedown on non-interactive areas triggers `startDragging()`
- [x] Non-drag zones: content panel, tab bar, status bar, search bar, palette, buttons, inputs, links

---

## Phase 7: Custom Theme System

### 7.1 Theme Engine (`src-tauri/src/theme/`)
- [ ] `Theme` struct parsed from TOML
- [ ] `to_css()` method generating `:root` custom properties
- [ ] Theme file discovery (user dir, env var, built-in)
- [ ] Merge with base defaults, validation

### 7.2 Built-in Themes (`src-tauri/themes/`)
- [ ] `lexer-dark.toml`
- [ ] `lexer-light.toml`
- [ ] `lexer-mono.toml`
- [ ] `lexer-solarized.toml`
- [ ] `lexer-nord.toml`

### 7.3 Tauri Commands
- [ ] `list_themes`
- [ ] `load_theme` (resolve, parse, return CSS)
- [ ] `get_theme` / `set_theme`
- [ ] `get_theme_config` (full parsed theme for preview)

### 7.4 Theme Hot-Reload
- [ ] Watch `~/.config/lexer/themes/` directory
- [ ] Auto-recompile + emit `theme-updated` event on change

---

## Phase 8: Multi-Window Support

### 8.1 Window Manager (`src-tauri/src/window/`)
- [ ] `WindowManager` struct tracking all windows
- [ ] `WindowState` per window (id, file, layout, scroll, zoom, ToC)
- [ ] Window cascade positioning (30px offset)

### 8.2 Tauri Commands
- [ ] `new_window` / `close_window`
- [ ] `list_windows` / `focus_window`

### 8.3 Window Lifecycle
- [ ] Create -> boot frontend -> apply state -> track
- [ ] On close: unwatch file, quit if last (macOS: keep alive)

### 8.4 Shared vs Per-Window State
- [ ] Global: theme, config, language registry, watcher pool
- [ ] Per-window: file, scroll, layout, zoom, ToC, search

### 8.5 Keyboard (`Space w`)
- [ ] `n` (new), `N` (clone), `c` (close), `w`/`W` (cycle)
- [ ] `l` (window list), `d`/`f`/`z`/`s` (layouts)

---

## Phase 9: Focus Layouts

### 9.1 Layout CSS (`src/layout.css`)
- [ ] Default layout (full chrome, optional ToC sidebar)
- [ ] Focus layout (centered 700px column, no sidebar)
- [ ] Zen layout (fullscreen, no chrome, Escape to exit)
- [ ] Split layout (pinned ToC 280px, resizable drag handle)

### 9.2 Layout JS (`src/layout.js`)
- [ ] `set_layout` / `get_layout` commands
- [ ] Data attribute switching on root element
- [ ] Smooth transitions between layouts
- [ ] Zen: mouse-near-top reveals controls

---

## Phase 10: Configuration & CLI

### 10.1 CLI Arguments (via `clap`)
- [ ] `[FILE]...` multiple files
- [ ] `-t, --theme` theme selection
- [ ] `--layout` initial layout
- [ ] `--no-effects` disable effects
- [ ] `--new-window` force new window
- [ ] `-h, --help` / `-V, --version`

### 10.2 Config File (`~/.config/lexer/config.toml`)
- [ ] `[appearance]`: theme, default layout
- [ ] `[behavior]`: live_reload, preserve_scroll, restore_session
- [ ] `[effects]`: per-effect overrides
- [ ] `[keymap]`: custom key remapping

---

## Phase 11: Future Enhancements

- [ ] Export to PDF / HTML
- [ ] Math rendering (KaTeX/MathJax)
- [ ] Mermaid diagram rendering
- [ ] Theme editor GUI
- [ ] Theme marketplace
- [ ] Plugin system
- [ ] Session persistence
- [ ] Custom keymap file

---

## Commit History

| Hash | Description |
|------|-------------|
| `169c0b4` | Add Lexer spec (15 doc files + index) |
| `d2b17f9` | Add README |
| `cb4acf3` | Implement working MVP (Tauri v2, markdown, tree-sitter, dark theme, file open) |
| `5408dd5` | Fix Tauri v2 IPC: enable `withGlobalTauri`, plugin invoke syntax |
| `4acbcbe` | Add implementation progress tracker |
| `7b3eaa6` | Add file watcher, Helix keyboard, command palette (Phases 2-4) |
| `9a5d85c` | Fix duplicate variable errors, palette Ctrl+N/P navigation |
| `59a1a16` | Add visual effects system (Phase 5) |
| `f41b988` | Transparent titlebar and remove h2 glow box |
| `4b879e3` | Improve scroll: custom eased animation for j/k navigation |
| | Phase 6: Buffer/tab support + transparent vibrancy window (pending commit) |
