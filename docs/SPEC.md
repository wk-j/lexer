# Lexer - Markdown Viewer Specification

> A high-performance Markdown viewer built in Rust with Tauri v2, Tree-sitter syntax highlighting, visual effects, Helix-style keyboard navigation, multi-window support, and custom themes.

## Spec Index

| # | Document | Description |
|---|----------|-------------|
| 1 | [Overview & Architecture](01-overview.md) | Goals, non-goals, system diagram, component breakdown, data flow |
| 2 | [Markdown Parsing](02-markdown.md) | pulldown-cmark config, supported features, HTML generation pipeline |
| 3 | [Tree-sitter Integration](03-tree-sitter.md) | Language registry, 13 grammars, highlight queries, fallback |
| 4 | [Webview / UI](04-ui.md) | Tauri v2 setup, frontend structure, IPC commands & events, styling |
| 5 | [Visual Effects](05-visual-effects.md) | Frosted glass, particles, parallax, cursor effects, code block effects, performance budgets |
| 6 | [Command Palette](06-command-palette.md) | Fuzzy search, file/command/heading/theme modes, styling |
| 7 | [Keyboard Navigation](07-keyboard.md) | Helix-style modes (Normal, Goto, Space, Search, View), which-key, keymap engine |
| 8 | [Windows & Layouts](08-windows-and-layouts.md) | Multi-window single-process, focus/zen/split layouts, window keyboard nav |
| 9 | [Custom Themes](09-themes.md) | TOML theme format, theme engine, hot-reload, CSS custom properties |
| 10 | [File System](10-filesystem.md) | File opening, watching, image handling |
| 11 | [Project Structure](11-project-structure.md) | Directory layout, module breakdown, user directories |
| 12 | [Configuration](12-config.md) | CLI arguments, config.toml format |
| 13 | [Dependencies](13-dependencies.md) | Cargo.toml, Tauri config |
| 14 | [Build & Run](14-build.md) | Dev/release commands, platform support |
| 15 | [Future Enhancements](15-future.md) | Roadmap items not yet in scope |
| 16 | [Block Select](16-block-select.md) | Structural block selection, copy as Markdown, AI agent integration |
| 17 | [OpenCode Integration](17-opencode.md) | Auto-discover OpenCode, send selections as prompts via HTTP |
| 18 | [Custom Commands](18-custom-commands.md) | User-defined shell commands with placeholder variables |

## Implementation Tracking

| Document | Description |
|----------|-------------|
| [PROGRESS.md](PROGRESS.md) | Checklist of all features by phase, updated as implementation proceeds |
