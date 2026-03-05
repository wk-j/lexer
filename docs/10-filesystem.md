# File System

## File Opening

Files can be opened via:

1. **CLI argument**: `lexer path/to/file.md`
2. **File dialog**: Menu -> Open or Ctrl+O
3. **Drag-and-drop**: Drop file onto the window
4. **Relative links**: Clicking a relative `.md` link in the rendered view opens that file

## File Watching

Use the `notify` crate to watch the currently viewed file for changes:

```rust
use notify::{Watcher, RecursiveMode, watcher};

fn watch_file(path: &Path, tx: Sender<()>) -> notify::Result<impl Watcher> {
    let mut watcher = notify::recommended_watcher(move |res| {
        if let Ok(event) = res {
            if event.kind.is_modify() {
                let _ = tx.send(());
            }
        }
    })?;
    watcher.watch(path, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}
```

## Image Handling

- **Local images**: Resolve relative paths against the Markdown file's directory. Serve via a local protocol handler or inline as base64 data URIs.
- **Remote images**: Allow loading via `https://` URLs (with optional content security policy).
