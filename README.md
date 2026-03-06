# Lexer

A fast, keyboard-driven Markdown viewer built with Rust and Tauri v2.

## Features

- **Tree-sitter highlighting** -- grammar-based syntax coloring for 13+ languages
- **Helix-style navigation** -- modal keys (`g`, `Space`, `z`, `/`), which-key popup
- **Block Select** -- structural selection of Markdown blocks, copy as Markdown/plain text, send to AI agents
- **Command palette** -- fuzzy file search, heading jump, theme picker, commands
- **Visual effects** -- frosted glass, particle canvas, parallax, cursor spotlight
- **Custom themes** -- TOML-based, hot-reloading, full CSS variable control
- **Multi-window** -- single process, independent windows, shared state
- **Focus layouts** -- Default, Focus (centered column), Zen (fullscreen), Split (pinned ToC)
- **Live reload** -- file watcher auto-refreshes on save
- **GFM support** -- tables, task lists, footnotes, strikethrough

## Install

```bash
# Build and install to ~/.cargo/bin
cargo install --path src-tauri

# Or build the .app bundle
cargo install tauri-cli
cargo tauri build
```

The `lexer` command launches the GUI and returns the terminal immediately.

```bash
lexer README.md
lexer --theme lexer-nord --layout zen docs/*.md
```

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Shell     | Tauri v2 (wry/webview)              |
| Backend   | Rust                                |
| Parser    | pulldown-cmark                      |
| Highlight | tree-sitter + tree-sitter-highlight |
| Frontend  | HTML + CSS + vanilla JS             |

## Keyboard

### Navigation

| Key         | Action              |
|-------------|---------------------|
| `j` / `k`   | Scroll down / up   |
| `d` / `u`   | Half-page down / up |
| `]` / `[`   | Next / prev heading |
| `g g`        | Go to top          |
| `G`          | Go to end          |
| `/`          | Search in document |
| `n` / `N`    | Next / prev match  |
| `?`          | Show keymap help   |

### Modes

| Key         | Action              |
|-------------|---------------------|
| `g`          | Goto mode          |
| `Space`      | Command mode       |
| `z`          | View mode          |
| `Space f`    | File search        |
| `Space t`    | Theme picker       |
| `Space w z`  | Zen layout         |
| `g w`        | Link hints (jump)  |

### Block Select

| Key         | Action                    |
|-------------|---------------------------|
| `v`          | Enter block select mode  |
| `V`          | Select current section   |
| `j` / `k`   | Move cursor block        |
| `]` / `[`   | Jump to heading          |
| `x`          | Toggle individual block  |
| `a`          | Select all               |
| `y`          | Copy as Markdown         |
| `Y`          | Copy as plain text       |
| `c`          | Copy as AI context block |
| `Enter`      | Agent action menu        |
| `Escape`     | Cancel selection         |

In the agent menu (`Enter`):

| Key | Action |
|-----|--------|
| `c` | Copy as `<context>` XML block |
| `o` | Open in Claude desktop |
| `p` | Pipe to shell command |
| `u` | Send to URL endpoint |

## Themes

Five built-in themes: **Dark**, **Light**, **Nord**, **Solarized**, **Mono**.

Custom themes are TOML files in `~/.config/lexer/themes/`:

```toml
[meta]
name = "My Theme"
base = "dark"

[colors]
accent = "#ff6b6b"
select_bar = "#ff6b6b"
select_bg = "rgba(255, 107, 107, 0.08)"
```

All selection indicator colors are themeable via `select_bar`, `select_bg`, `select_cursor_bar`, `select_cursor_bg`, `select_bar_width`, and `select_bar_offset`.

## Development

```bash
cargo install tauri-cli
cargo tauri dev -- -- path/to/file.md
```

## Docs

Full specification in [`docs/`](docs/SPEC.md).

## License

TBD
