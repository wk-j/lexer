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

Each window has its own isolated state managed on the Rust side:

```rust
#[derive(Debug, Clone, Serialize)]
struct WindowState {
    id: String,
    file_path: Option<PathBuf>,
    layout: LayoutMode,
    scroll_position: f64,
    toc_visible: bool,
    zoom_level: f32,
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
    <FILE>...    One or more Markdown files (each opens in its own window)

OPTIONS:
    --new-window           Force open in a new window (even if already running)
    --layout <LAYOUT>      Initial layout: default | focus | zen | split
```

Opening multiple files from the CLI:

```bash
# Opens two windows
lexer docs/overview.md docs/api.md

# Opens in zen mode
lexer --layout zen notes/draft.md
```

---

## Session Persistence (Future)

On quit, Lexer saves the window arrangement to restore on next launch:

```toml
# ~/.config/lexer/session.toml (auto-generated)
[[windows]]
file = "~/docs/spec.md"
layout = "focus"
x = 100
y = 100
width = 900
height = 700
scroll = 1240.0

[[windows]]
file = "~/docs/readme.md"
layout = "split"
x = 130
y = 130
width = 1000
height = 750
scroll = 0.0
```
