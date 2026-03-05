# Command Palette

A VS Code / Helix-style command palette provides fast fuzzy-search access to files, actions, themes, and document headings. Opened with `Space` (in normal mode) or `Ctrl+P`.

## Palette Modes

The palette operates in different modes depending on how it is invoked or by typing a prefix character:

| Prefix   | Mode             | Description                                     | Keybind (Normal mode) |
| -------- | ---------------- | ----------------------------------------------- | --------------------- |
| *(none)* | File search      | Fuzzy-match `.md` files in the working directory | `Space f`             |
| `:`      | Command          | Run named actions (theme switch, toggle, etc.)  | `Space c` or `:`      |
| `#`      | Heading jump     | Jump to a heading in the current document        | `Space h`             |
| `@`      | Theme picker     | Preview and select themes                        | `Space t`             |
| `>`      | Recent files     | Recently opened files, most recent first         | `Space r`             |
| `/`      | Text search      | Search within the rendered document content      | `/`                   |

## UI Layout

```
+---------------------------------------------------------------+
|  [icon]  Search files...                               Ctrl+P |
|---------------------------------------------------------------|
|  > src/README.md                                   2m ago     |
|    docs/SPEC.md                                    5m ago     |
|    notes/ideas.md                                  1h ago     |
|    changelog.md                                    3d ago     |
|                                                               |
|  ─────────────────────────────────────────────────────────     |
|  4 results  ·  ↑↓ navigate  ·  Enter open  ·  Esc close      |
+---------------------------------------------------------------+
```

- Centered modal overlay with frosted glass backdrop (uses theme `--panel-bg`)
- Input field at the top with auto-focus
- Results list below, scrollable, with highlighted fuzzy-match characters
- Footer hint bar showing keybinds contextual to the current mode
- Result count on the left

## Fuzzy Matching

Fuzzy matching runs on the frontend for responsiveness. The Rust backend provides the candidate list; the JS frontend scores and ranks them.

```javascript
// Simple fuzzy match scoring
function fuzzyScore(query, target) {
    let qi = 0, ti = 0, score = 0;
    const lq = query.toLowerCase();
    const lt = target.toLowerCase();
    let consecutive = 0;

    while (qi < lq.length && ti < lt.length) {
        if (lq[qi] === lt[ti]) {
            score += 1 + consecutive * 2;     // reward consecutive matches
            if (ti === 0 || target[ti - 1] === '/') score += 5; // path boundary bonus
            consecutive++;
            qi++;
        } else {
            consecutive = 0;
        }
        ti++;
    }
    return qi === lq.length ? score : -1; // -1 = no match
}
```

## File Search Backend

The Rust backend recursively scans a directory for `.md` files and caches the result. Re-scans on focus or when the file watcher detects changes.

```rust
#[derive(Debug, Serialize)]
struct FileEntry {
    path: String,           // relative path from root
    name: String,           // filename only
    modified: u64,          // unix timestamp
    size: u64,              // bytes
}

#[tauri::command]
fn scan_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().map_or(false, |ext| ext == "md") {
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            entries.push(FileEntry {
                path: entry.path().strip_prefix(&path)
                    .unwrap_or(entry.path())
                    .to_string_lossy().into(),
                name: entry.file_name().to_string_lossy().into(),
                modified: meta.modified().ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map_or(0, |d| d.as_secs()),
                size: meta.len(),
            });
        }
    }
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

#[tauri::command]
fn get_recent_files() -> Vec<FileEntry> {
    // Return from an in-memory LRU list (persisted to config on exit)
}
```

## Command Actions

Available actions in `:` command mode:

| Action                | Description                              |
| --------------------- | ---------------------------------------- |
| `theme {name}`        | Switch to a theme                        |
| `toggle sidebar`      | Show/hide ToC sidebar                    |
| `toggle effects`      | Enable/disable all visual effects        |
| `toggle line-numbers` | Show/hide code block line numbers        |
| `zoom in`             | Increase font size                       |
| `zoom out`            | Decrease font size                       |
| `zoom reset`          | Reset to default font size               |
| `open`                | Open file dialog                         |
| `reload`              | Force re-render current file             |
| `copy path`           | Copy current file path to clipboard      |
| `print`               | Print / export to PDF                    |
| `quit`                | Close the application                    |

## Palette Styling

```css
.palette-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(6px);
    display: flex;
    justify-content: center;
    padding-top: 15vh;
}

.palette-modal {
    width: min(560px, 90vw);
    max-height: 60vh;
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    backdrop-filter: blur(var(--blur)) saturate(var(--saturate));
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.palette-input {
    padding: 14px 16px;
    font-size: 15px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--panel-border);
    color: var(--text-primary);
    font-family: var(--font-family);
    outline: none;
}

.palette-results {
    overflow-y: auto;
    flex: 1;
}

.palette-item {
    padding: 8px 16px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 80ms ease;
}
.palette-item.selected {
    background: var(--accent);
    color: var(--bg-base);
}

/* Highlight matched characters */
.palette-item .match {
    color: var(--accent);
    font-weight: 600;
}
.palette-item.selected .match {
    color: inherit;
    text-decoration: underline;
}
```
