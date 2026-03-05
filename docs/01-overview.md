# Overview & Architecture

> A high-performance Markdown viewer built in Rust with web-based rendering and Tree-sitter syntax highlighting.

## Project Overview

**Lexer** is a desktop Markdown viewer application written in Rust. It uses web technology (via a webview) for rendering the UI and leverages Tree-sitter for accurate, incremental syntax highlighting of fenced code blocks. The application is read-only -- it views and renders Markdown files, it does not edit them.

### Goals

- Fast, native-feeling Markdown viewer with minimal resource usage
- Accurate syntax highlighting powered by Tree-sitter grammars
- Clean, readable rendered output using web-based UI
- Support for CommonMark and GitHub Flavored Markdown (GFM)
- File-system aware: open files via CLI args, file dialog, or drag-and-drop
- Live-reload when the viewed file changes on disk
- Multi-window support within a single process
- Customizable focus layouts for different reading contexts

### Non-Goals

- Full-featured Markdown editor (this is a viewer only)
- Collaborative editing or cloud sync
- Plugin/extension system (initial release)

---

## Architecture

```
+---------------------------------------------------------------------+
|                      Lexer Application (Single Process)              |
|                                                                     |
|  +-------------------+                                              |
|  |    Rust Core       |                                              |
|  |                   |     +-------------------+                    |
|  | - Window Manager  |---->| Webview Window 1  |  (file-a.md)      |
|  | - File I/O        |     | - Layout engine   |                    |
|  | - MD parse        |     | - HTML/CSS render |                    |
|  | - Tree-sitter     |     +-------------------+                    |
|  | - FS watch        |                                              |
|  | - Theme engine    |     +-------------------+                    |
|  | - Shared state    |---->| Webview Window 2  |  (file-b.md)      |
|  |                   |     | - Layout engine   |                    |
|  |                   |<----| - IPC bridge      |                    |
|  +-------------------+     +-------------------+                    |
|                                    ...N windows                     |
+---------------------------------------------------------------------+
```

### Component Breakdown

| Component          | Crate / Technology          | Role                                       |
| ------------------ | --------------------------- | ------------------------------------------ |
| Webview shell      | `tauri` (v2)                | Native windows hosting webviews            |
| Window manager     | Tauri `WebviewWindowBuilder` | Create, track, focus, close multiple windows |
| Layout engine      | Frontend JS + CSS            | Focus layouts within each window           |
| Markdown parser    | `pulldown-cmark`            | Parse Markdown to AST / HTML               |
| Tree-sitter core   | `tree-sitter` (Rust crate)  | Incremental parsing of fenced code blocks  |
| Tree-sitter langs  | `tree-sitter-{lang}` crates| Language grammars (Rust, JS, Python, etc.) |
| File watcher       | `notify`                    | Watch file for changes, trigger re-render  |
| IPC / bridge       | Tauri commands + events     | Rust <-> JS communication                  |
| Frontend           | HTML + CSS + vanilla JS     | Render parsed Markdown in the webview      |

### Data Flow

1. User opens a Markdown file (CLI arg, file dialog, or drag-and-drop).
2. Rust core reads the file contents.
3. `pulldown-cmark` parses Markdown into events/AST.
4. For each fenced code block, Rust core invokes Tree-sitter with the appropriate language grammar to produce syntax-highlighted HTML spans.
5. The complete HTML document is assembled and sent to the webview.
6. The webview renders the HTML with CSS styling.
7. `notify` watches the file; on change, steps 2-6 repeat.
