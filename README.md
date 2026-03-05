# Lexer

A fast, keyboard-driven Markdown viewer built with Rust and Tauri v2.

## Features

- **Tree-sitter highlighting** -- grammar-based syntax coloring for 13+ languages
- **Helix-style navigation** -- modal keys (`g`, `Space`, `z`, `/`), which-key popup
- **Command palette** -- fuzzy file search, heading jump, theme picker, commands
- **Visual effects** -- frosted glass, particle canvas, parallax, cursor spotlight
- **Custom themes** -- TOML-based, hot-reloading, full CSS variable control
- **Multi-window** -- single process, independent windows, shared state
- **Focus layouts** -- Default, Focus (centered column), Zen (fullscreen), Split (pinned ToC)
- **Live reload** -- file watcher auto-refreshes on save
- **GFM support** -- tables, task lists, footnotes, strikethrough

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Shell     | Tauri v2 (wry/webview)              |
| Backend   | Rust                                |
| Parser    | pulldown-cmark                      |
| Highlight | tree-sitter + tree-sitter-highlight |
| Frontend  | HTML + CSS + vanilla JS             |

## Quick Start

```bash
cargo install tauri-cli
cargo tauri dev -- -- path/to/file.md
```

## Keyboard

| Key         | Action              |
|-------------|---------------------|
| `j` / `k`   | Scroll down / up   |
| `Space f`    | File search        |
| `Space t`    | Theme picker       |
| `Space w f`  | Focus layout       |
| `Space w z`  | Zen layout         |
| `g g`        | Go to top          |
| `/`          | Search in document |
| `?`          | Show keymap help   |

## Docs

Full specification in [`docs/`](docs/SPEC.md).

## License

TBD
