# Build & Run

## Commands

```bash
# Prerequisites
cargo install tauri-cli

# Development (with hot-reload)
cargo tauri dev -- -- path/to/file.md

# Open multiple files
cargo tauri dev -- -- docs/overview.md docs/api.md

# Release build (creates platform installer)
cargo tauri build

# Run tests (Rust backend only)
cargo test --manifest-path src-tauri/Cargo.toml
```

## Platform Support

| Platform | Webview Engine       | Status   |
| -------- | -------------------- | -------- |
| macOS    | WebKit (WKWebView)   | Primary  |
| Linux    | WebKitGTK            | Planned  |
| Windows  | WebView2 (Edge)      | Planned  |
