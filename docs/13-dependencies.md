# Dependencies

## Rust Backend (`src-tauri/Cargo.toml`)

```toml
[package]
name = "lexer"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
# Tauri
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"       # Native file open dialog
tauri-plugin-fs = "2"           # File system access
tauri-plugin-shell = "2"        # Open URLs in default browser
tauri-plugin-clipboard-manager = "2"  # Copy to clipboard

# Markdown
pulldown-cmark = { version = "0.12", features = ["simd"] }

# Tree-sitter
tree-sitter = "0.24"
tree-sitter-highlight = "0.24"
tree-sitter-rust = "0.23"
tree-sitter-javascript = "0.23"
tree-sitter-typescript = "0.23"
tree-sitter-python = "0.23"
tree-sitter-go = "0.23"
tree-sitter-c = "0.23"
tree-sitter-cpp = "0.23"
tree-sitter-json = "0.23"
tree-sitter-toml = "0.23"
tree-sitter-html = "0.23"
tree-sitter-css = "0.23"
tree-sitter-bash = "0.23"
tree-sitter-md = "0.23"

# File system
notify = "6"
walkdir = "2"                   # Recursive directory scan for palette file search

# Serialization & config
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"                    # Parse theme & config TOML files

# Error handling
anyhow = "1"
thiserror = "2"

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"
```

> **Note:** Pin exact versions after verifying latest compatible releases at build time.

## Tauri Configuration (`src-tauri/tauri.conf.json`)

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Lexer",
  "version": "0.1.0",
  "identifier": "com.lexer.app",
  "build": {
    "frontendDist": "../src"
  },
  "app": {
    "windows": [
      {
        "title": "Lexer",
        "width": 900,
        "height": 700,
        "resizable": true,
        "fileDropEnabled": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' https: asset: ; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"]
  }
}
```
