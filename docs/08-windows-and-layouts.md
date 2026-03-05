# Multi-Window & Focus Layouts

Lexer runs as a single process that manages multiple native windows. Each window is an independent webview with its own file, scroll position, layout, and ToC state -- but all windows share themes, config, the language registry, and the file watcher pool.

## Multi-Window Architecture

### Single-Process Model

All windows live in one OS process. Tauri's `WebviewWindowBuilder` creates additional windows on demand. The Rust backend holds a `WindowManager` that tracks every open window.

```
+-----------------------------------------------------------------+
|                    Rust Process (Single)                         |
|                                                                 |
|  WindowManager                                                  |
|  +-----------------------------------------------------------+ |
|  | id: "main"     | id: "win-2"    | id: "win-3"             | |
|  | file: spec.md  | file: readme.md| file: (empty)           | |
|  | layout: focus  | layout: split  | layout: zen             | |
|  +-----------------------------------------------------------+ |
|                                                                 |
|  Shared: ThemeEngine, LanguageRegistry, FileWatcherPool, Config |
+-----------------------------------------------------------------+
```

### Window State

Each window has its own isolated state managed on the Rust side. A window contains multiple **buffers** (open files), only one of which is active at a time:

```rust
#[derive(Debug, Clone, Serialize)]
struct WindowState {
    id: String,
    buffers: Vec<BufferState>,
    active_buffer: usize,        // index into buffers vec
    layout: LayoutMode,
    zoom_level: f32,
}

#[derive(Debug, Clone, Serialize)]
struct BufferState {
    id: u64,                     // unique buffer ID
    file_path: Option<PathBuf>,
    title: String,               // filename or "Untitled"
    html: String,                // cached rendered HTML
    toc: Vec<TocEntry>,          // cached TOC
    scroll_position: f64,
    toc_visible: bool,
    modified: bool,              // dirty flag (file changed on disk)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum LayoutMode {
    Default,
    Focus,
    Zen,
    Split,
}

struct WindowManager {
    windows: HashMap<String, WindowState>,
    active_window: String,
    next_buffer_id: u64,
}
```

### Window Lifecycle

```
User action (Space+w+n, Ctrl+N, CLI --new-window, open-in-new-window)
    |
    v
Rust: WindowManager::create_window()
    |
    v
Tauri: WebviewWindowBuilder::new()
    -> set title, size, position (cascade from last window)
    -> load frontend HTML
    |
    v
Frontend boots -> requests initial state from Rust
    -> applies theme CSS, layout class, opens file if provided
    |
    v
Window is tracked in WindowManager.windows
    |
    ... (user works) ...
    |
Window closed (user or programmatic)
    |
    v
Rust: WindowManager::remove_window()
    -> unwatch file if no other window uses it
    -> if last window closed: quit app (macOS: keep process alive)
```

### Tauri Commands

```rust
#[tauri::command]
fn new_window(app: AppHandle, path: Option<String>) -> Result<String, String> {
    let id = generate_window_id();
    let window = WebviewWindowBuilder::new(&app, &id, WindowUrl::default())
        .title(path.as_deref().unwrap_or("Lexer"))
        .inner_size(900.0, 700.0)
        .build()
        .map_err(|e| e.to_string())?;

    let state = WindowState {
        id: id.clone(),
        file_path: path.map(PathBuf::from),
        layout: LayoutMode::Default,
        scroll_position: 0.0,
        toc_visible: false,
        zoom_level: 1.0,
    };

    app.state::<Mutex<WindowManager>>()
        .lock().unwrap()
        .windows.insert(id.clone(), state);

    Ok(id)
}

#[tauri::command]
fn close_window(app: AppHandle, window_id: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_id) {
        window.close().map_err(|e| e.to_string())?;
    }
    app.state::<Mutex<WindowManager>>()
        .lock().unwrap()
        .windows.remove(&window_id);
    Ok(())
}

#[tauri::command]
fn list_windows(app: AppHandle) -> Vec<WindowInfo> {
    let mgr = app.state::<Mutex<WindowManager>>().lock().unwrap();
    mgr.windows.values().map(|w| WindowInfo {
        id: w.id.clone(),
        title: w.file_path.as_ref()
            .map(|p| p.file_name().unwrap_or_default().to_string_lossy().into())
            .unwrap_or_else(|| "Untitled".into()),
        layout: w.layout.clone(),
    }).collect()
}

#[tauri::command]
fn focus_window(app: AppHandle, window_id: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_id) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

### Window Cascade Positioning

New windows open slightly offset from the last active window to avoid stacking:

```rust
fn cascade_position(last: &WindowState, screen: &ScreenSize) -> (f64, f64) {
    let offset = 30.0;
    let x = (last.x + offset).min(screen.width - 900.0);
    let y = (last.y + offset).min(screen.height - 700.0);
    (x, y)
}
```

### Shared vs Per-Window State

| State             | Scope       | Notes                                   |
| ----------------- | ----------- | --------------------------------------- |
| Theme (CSS)       | Global      | All windows use the same active theme   |
| Config            | Global      | Single config file                      |
| Language registry | Global      | Tree-sitter grammars loaded once        |
| File watcher pool | Global      | One watcher per unique file path        |
| File path         | Per-window  | Each window views its own file          |
| Scroll position   | Per-window  |                                         |
| Layout mode       | Per-window  | Each window can have a different layout |
| Zoom level        | Per-window  |                                         |
| ToC sidebar       | Per-window  |                                         |
| Search state      | Per-window  | Active query, match index               |
| Buffer list       | Per-window  | Each window has its own set of open buffers |
| Active buffer     | Per-window  | Index into buffer list                  |

---

## Buffers (Tabs)

Lexer supports multiple open files (buffers) within a single window, inspired by Helix's buffer model. Each buffer holds a file's rendered content, scroll position, and TOC. A tab bar at the top of the window shows all open buffers.

### Buffer Model

A **buffer** is an open file (or an empty document). Each window maintains an ordered list of buffers. One buffer is **active** at any time — its content is displayed in the content panel.

```
+-------------------------------------------------------------------+
| [tab: spec.md] [tab: readme.md*] [tab: notes.md]                  |
+-------------------------------------------------------------------+
|                                                                   |
|  # Readme                                                         |
|  Content of the active buffer (readme.md)                         |
|                                                                   |
+-------------------------------------------------------------------+
| NOR | readme.md | 2 min ago                              | Ln 42 |
+-------------------------------------------------------------------+
```

The `*` on a tab indicates the buffer's file has been modified on disk since last viewed.

### Buffer Lifecycle

```
Open file (Space f, Cmd+O, drag-drop, CLI, link navigation)
    |
    v
Check: is file already open in a buffer?
    |
    +-- YES: switch to that buffer (no duplicate buffers for same file)
    |
    +-- NO: create new BufferState, push to window's buffer list
            render markdown, cache HTML + TOC
            set as active buffer
    |
    v
Buffer is displayed in content panel
Tab bar updated to show new tab
    |
    ... (user works, switches buffers) ...
    |
Close buffer (Space b d, click tab X)
    |
    v
Remove from buffer list
    -> if active: switch to adjacent buffer (prefer left, then right)
    -> if last buffer: show empty state
    -> drop file watcher if no other buffer uses same file
```

### Buffer Switching

When switching buffers:
1. Save current scroll position to outgoing buffer's `scroll_position`
2. Swap content panel HTML to incoming buffer's cached `html`
3. Restore incoming buffer's `scroll_position`
4. Update status bar (filename, mode)
5. Update tab bar active indicator
6. Update window title

### Tab Bar UI

The tab bar sits between the titlebar drag region and the content panel:

```html
<div class="tab-bar" id="tab-bar">
  <div class="tab active" data-buffer-id="1">
    <span class="tab-title">spec.md</span>
    <button class="tab-close">&times;</button>
  </div>
  <div class="tab" data-buffer-id="2">
    <span class="tab-modified">●</span>
    <span class="tab-title">readme.md</span>
    <button class="tab-close">&times;</button>
  </div>
</div>
```

```css
.tab-bar {
    display: flex;
    align-items: center;
    height: 32px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--panel-border);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: 0 8px;
    gap: 2px;
    -webkit-app-region: no-drag; /* allow clicking tabs in titlebar area */
}

.tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 6px 6px 0 0;
    font-size: 12px;
    font-family: var(--font-family-mono);
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    max-width: 160px;
    transition: background var(--transition-ms) ease, color var(--transition-ms) ease;
}

.tab:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.tab.active {
    background: var(--bg-base);
    color: var(--text-primary);
    border-bottom: 2px solid var(--accent);
}

.tab-modified {
    color: var(--accent);
    font-size: 8px;
}

.tab-close {
    opacity: 0;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    border-radius: 3px;
    transition: opacity 100ms ease;
}
.tab:hover .tab-close {
    opacity: 0.6;
}
.tab-close:hover {
    opacity: 1 !important;
    background: var(--bg-hover);
    color: var(--error);
}
```

### Buffer Tauri Commands

```rust
#[tauri::command]
fn open_file(path: String, ...) -> Result<OpenFileResult, String> {
    // Check if file already open in a buffer — if so, return buffer_id to switch to
    // Otherwise create new buffer, render, return buffer_id + content
}

#[tauri::command]
fn close_buffer(buffer_id: u64, ...) -> Result<BufferSwitchResult, String> {
    // Remove buffer, return the new active buffer's info (or None if last)
}

#[tauri::command]
fn switch_buffer(buffer_id: u64, ...) -> Result<BufferContent, String> {
    // Save current scroll, set active_buffer, return cached content
}

#[tauri::command]
fn next_buffer(...) -> Result<BufferContent, String> {
    // Cycle to next buffer in list
}

#[tauri::command]
fn prev_buffer(...) -> Result<BufferContent, String> {
    // Cycle to previous buffer in list
}

#[tauri::command]
fn list_buffers(...) -> Vec<BufferInfo> {
    // Return all buffer summaries for tab bar / buffer picker
}
```

```rust
#[derive(Debug, Clone, Serialize)]
struct BufferInfo {
    id: u64,
    title: String,
    file_path: Option<String>,
    modified: bool,
    active: bool,
}

#[derive(Debug, Clone, Serialize)]
struct BufferContent {
    buffer_id: u64,
    html: String,
    title: String,
    toc: Vec<TocEntry>,
    scroll_position: f64,
}

#[derive(Debug, Clone, Serialize)]
struct OpenFileResult {
    buffer_id: u64,
    html: String,
    title: String,
    toc: Vec<TocEntry>,
    already_open: bool,  // true if switched to existing buffer
}

#[derive(Debug, Clone, Serialize)]
struct BufferSwitchResult {
    new_active: Option<BufferContent>,  // None if no buffers remain
}
```

### Buffer Picker (Palette Mode)

Accessed via `Space b b` or `Space b` then `b`. Opens the command palette in **buffer picker** mode, listing all open buffers with fuzzy search.

```
+----------------------------------------------+
|  > readme.md                                  |
|----------------------------------------------+
|  ● readme.md         ~/docs/readme.md         |  <- active, modified
|    spec.md           ~/docs/spec.md            |
|    notes.md          ~/projects/notes.md       |
+----------------------------------------------+
|  3 buffers                    ↑↓ select  ⏎ go |
+----------------------------------------------+
```

The buffer picker palette mode prefix is `%` (internal, not user-typed — triggered by `Space b b`).

### File Watcher Pool

With multiple buffers, file watchers are managed as a pool. Each unique file path gets one watcher. When a file changes:

1. Re-render markdown for the affected buffer(s)
2. Update the buffer's cached `html` and `toc`
3. If that buffer is active: emit `file-changed` event to update the content panel
4. If that buffer is inactive: set `modified = true` (shows `●` on tab)
5. When the user switches to a modified buffer, the fresh content is already cached

```rust
struct FileWatcherPool {
    watchers: HashMap<PathBuf, (FileWatcher, Vec<u64>)>,  // path -> (watcher, buffer_ids)
}
```

---

## Focus Layouts

Each window can switch between layout modes that rearrange the content area, sidebar, and chrome. Layouts are applied by toggling CSS classes on the root element and optionally hiding/showing DOM regions.

### Layout Modes

| Layout      | Description                                                              | Keybind         |
| ----------- | ------------------------------------------------------------------------ | --------------- |
| `default`   | Full chrome: status bar, optional ToC sidebar, content panel              | `Space w d`     |
| `focus`     | Narrow centered column (~700px), no sidebar, minimal status bar           | `Space w f`     |
| `zen`       | Fullscreen, no chrome at all. Content only. Esc to exit.                  | `Space w z`     |
| `split`     | Side-by-side: ToC pinned on left, content on right                        | `Space w s`     |

### Default Layout

```
+-------------------------------------------------------------------+
| [menu bar]                                                         |
+--------+----------------------------------------------------------+
| ToC    |                                                          |
| (opt)  |  # Heading                                               |
|        |                                                          |
| > Intro|  Paragraph text with **bold** and `code`.               |
|   Setup|                                                          |
|   Usage|  ```rust                                                 |
|        |  fn main() { ... }                                       |
|        |  ```                                                     |
|        |                                                          |
+--------+----------------------------------------------------------+
| NOR | file.md | 2 min ago                              | Ln 42   |
+-------------------------------------------------------------------+
```

- ToC sidebar: toggleable, 220px wide, scrollable independently
- Content panel: fills remaining width, max-width optional
- Status bar: fixed bottom

### Focus Layout

```
+-------------------------------------------------------------------+
|                                                                   |
|              +-------------------------------+                    |
|              |                               |                    |
|              |  # Heading                    |                    |
|              |                               |                    |
|              |  Paragraph text...            |                    |
|              |                               |                    |
|              |  ```rust                      |                    |
|              |  fn main() { ... }            |                    |
|              |  ```                          |                    |
|              |                               |                    |
|              +-------------------------------+                    |
|                                                                   |
+-------------------------------------------------------------------+
|                    NOR | file.md                                   |
+-------------------------------------------------------------------+
```

- Content constrained to a centered column (max-width: 700px)
- No ToC sidebar
- Minimal status bar (can be hidden with `Space w b`)
- Full visual effects still active on the backdrop
- Ideal for focused reading

### Zen Layout

```
+-------------------------------------------------------------------+
|                                                                   |
|                                                                   |
|              # Heading                                            |
|                                                                   |
|              Paragraph text...                                    |
|                                                                   |
|              ```rust                                              |
|              fn main() { ... }                                    |
|              ```                                                  |
|                                                                   |
|                                                                   |
+-------------------------------------------------------------------+
```

- Window goes fullscreen (native fullscreen on macOS)
- All chrome hidden: no status bar, no sidebar, no window titlebar
- Content centered, generous padding
- Mouse movement near the top edge briefly reveals a thin control bar
- `Escape` exits back to previous layout
- Reduced visual effects (no particles, no cursor spotlight) to minimize distraction

### Split Layout

```
+-------------------------------------------------------------------+
| ToC (pinned)           | Content                                   |
|                        |                                           |
| # Overview             | # Overview                                |
|   ## Goals             |                                           |
|   ## Non-Goals         | **Lexer** is a desktop Markdown viewer... |
| # Architecture         |                                           |
|   ## Components        | ## Goals                                  |
|   ## Data Flow         |                                           |
| # Parsing              | - Fast, native-feeling viewer             |
|   ## Parser            | - Accurate syntax highlighting            |
|   ## Features          |                                           |
|                        |                                           |
+-------------------------------------------------------------------+
| NOR | file.md | 2 min ago                              | Ln 42   |
+-------------------------------------------------------------------+
```

- ToC permanently visible on the left (280px, resizable via drag handle)
- Content fills the right side
- Clicking a ToC entry smooth-scrolls the content
- Active heading highlighted in the ToC as user scrolls

### Layout CSS Implementation

```css
/* Layout mode applied as data attribute on root */
[data-layout="default"] {
    --sidebar-width: 220px;
    --content-max-width: none;
    --statusbar-display: flex;
}

[data-layout="focus"] {
    --sidebar-width: 0px;
    --content-max-width: 700px;
    --statusbar-display: flex;
}
[data-layout="focus"] .toc-sidebar {
    display: none;
}
[data-layout="focus"] .content-panel {
    margin: 0 auto;
    max-width: var(--content-max-width);
}

[data-layout="zen"] {
    --sidebar-width: 0px;
    --content-max-width: 800px;
    --statusbar-display: none;
}
[data-layout="zen"] .toc-sidebar,
[data-layout="zen"] .status-bar {
    display: none;
}
[data-layout="zen"] .content-panel {
    margin: 0 auto;
    max-width: var(--content-max-width);
    padding: 10vh 2rem;
}

[data-layout="split"] {
    --sidebar-width: 280px;
    --content-max-width: none;
    --statusbar-display: flex;
}
[data-layout="split"] .toc-sidebar {
    display: block;
    width: var(--sidebar-width);
    min-width: 200px;
    max-width: 400px;
    resize: horizontal;
    overflow: auto;
    border-right: 1px solid var(--panel-border);
}
```

```javascript
// Layout switching
function setLayout(mode) {
    document.documentElement.dataset.layout = mode;
    window.__TAURI__.core.invoke('set_layout', { layout: mode });

    if (mode === 'zen') {
        document.documentElement.requestFullscreen?.();
    } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
    }
}

// Zen mode: show controls on mouse near top
document.addEventListener('mousemove', (e) => {
    if (document.documentElement.dataset.layout === 'zen') {
        const controls = document.querySelector('.zen-controls');
        controls.classList.toggle('visible', e.clientY < 40);
    }
});
```

### Layout Transitions

Switching between layouts uses a smooth cross-fade:

```css
.toc-sidebar,
.content-panel,
.status-bar {
    transition:
        width var(--transition-ms) ease,
        max-width var(--transition-ms) ease,
        opacity var(--transition-ms) ease,
        padding var(--transition-ms) ease;
}
```

---

## Buffer Keyboard Navigation

Buffer management is accessed via `Space b` in Normal mode (Helix-style, matches Helix's buffer commands):

| Key          | Action                                  |
| ------------ | --------------------------------------- |
| `Space b b`  | Open buffer picker (palette mode)        |
| `Space b n`  | Switch to next buffer                    |
| `Space b p`  | Switch to previous buffer                |
| `Space b d`  | Close current buffer                     |
| `Space b N`  | New empty buffer                         |
| `Space b o`  | Close all buffers except current          |

The which-key popup for `Space b` shows:

```
+------------------------------------+
|  b - Buffer                        |
|                                    |
|  b  buffer picker                  |
|  n  next buffer                    |
|  p  previous buffer                |
|  d  close buffer                   |
|  N  new empty buffer               |
|  o  close others                   |
+------------------------------------+
```

Quick buffer switching (Normal mode, no Space prefix):

| Key          | Action                                  |
| ------------ | --------------------------------------- |
| `H`          | Switch to previous buffer (like Helix)   |
| `L`          | Switch to next buffer (like Helix)       |

---

## Window Keyboard Navigation

Window management is accessed via `Space w` in Normal mode (Helix-style):

| Key          | Action                                  |
| ------------ | --------------------------------------- |
| `Space w n`  | New window (empty)                       |
| `Space w N`  | New window with current file             |
| `Space w c`  | Close current window                     |
| `Space w w`  | Cycle focus to next window               |
| `Space w W`  | Cycle focus to previous window           |
| `Space w l`  | Open palette: window list (pick by name) |
| `Space w d`  | Switch to Default layout                 |
| `Space w f`  | Switch to Focus layout                   |
| `Space w z`  | Switch to Zen layout                     |
| `Space w s`  | Switch to Split layout                   |
| `Space w b`  | Toggle status bar visibility             |

The which-key popup for `Space w` shows:

```
+------------------------------------+
|  w - Window                        |
|                                    |
|  n  new window                     |
|  N  new (same file)                |
|  c  close window                   |
|  w  next window                    |
|  W  previous window                |
|  l  window list                    |
|  d  layout: default                |
|  f  layout: focus                  |
|  z  layout: zen                    |
|  s  layout: split                  |
|  b  toggle status bar              |
+------------------------------------+
```

---

## CLI Multi-Window Support

```
USAGE:
    lexer [OPTIONS] [FILE]...

ARGS:
    <FILE>...    One or more Markdown files (open as buffers in one window)

OPTIONS:
    --new-window           Force open in a new window (even if already running)
    --split-windows        Open each file in its own window instead of as buffers
    --layout <LAYOUT>      Initial layout: default | focus | zen | split
```

Opening multiple files from the CLI:

```bash
# Opens two buffers (tabs) in one window
lexer docs/overview.md docs/api.md

# Opens each in its own window
lexer --split-windows docs/overview.md docs/api.md

# Opens in zen mode
lexer --layout zen notes/draft.md
```

---

## Session Persistence (Future)

On quit, Lexer saves the window arrangement to restore on next launch:

```toml
# ~/.config/lexer/session.toml (auto-generated)
[[windows]]
layout = "focus"
active_buffer = 0
x = 100
y = 100
width = 900
height = 700

[[windows.buffers]]
file = "~/docs/spec.md"
scroll = 1240.0

[[windows.buffers]]
file = "~/docs/api.md"
scroll = 0.0

[[windows]]
layout = "split"
active_buffer = 0
x = 130
y = 130
width = 1000
height = 750

[[windows.buffers]]
file = "~/docs/readme.md"
scroll = 0.0
```
