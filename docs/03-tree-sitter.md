# Tree-sitter Integration

## Purpose

Tree-sitter provides **accurate, grammar-based** syntax highlighting for fenced code blocks. Unlike regex-based highlighters, Tree-sitter builds a full syntax tree, producing correct highlighting even for complex or nested constructs.

## Architecture

```
Fenced Code Block (lang, source)
        |
        v
+-------------------+
| Language Registry  |  Maps lang identifiers -> grammar + highlight queries
+-------------------+
        |
        v
+-------------------+
| tree-sitter parse |  Parse source into syntax tree
+-------------------+
        |
        v
+-------------------+
| Highlight Query    |  Apply highlights.scm to tree
+-------------------+
        |
        v
+-------------------+
| HTML Emitter       |  Convert highlight spans to <span class="...">
+-------------------+
        |
        v
   Highlighted HTML
```

## Crate

Use the `tree-sitter-highlight` crate which provides a high-level API:

```rust
use tree_sitter_highlight::{Highlighter, HighlightConfiguration, HighlightEvent, HtmlRenderer};
```

## Language Registry

A registry maps language identifiers (from the fenced code block info string) to their Tree-sitter `HighlightConfiguration`.

```rust
struct LanguageRegistry {
    configs: HashMap<String, HighlightConfiguration>,
}

impl LanguageRegistry {
    fn get(&self, lang: &str) -> Option<&HighlightConfiguration> {
        // Normalize aliases: "js" -> "javascript", "py" -> "python", etc.
        let normalized = normalize_lang(lang);
        self.configs.get(&normalized)
    }
}
```

## Supported Languages (Initial)

| Language    | Crate                        | Aliases            |
| ----------- | ---------------------------- | ------------------ |
| Rust        | `tree-sitter-rust`           | `rust`, `rs`       |
| JavaScript  | `tree-sitter-javascript`     | `javascript`, `js` |
| TypeScript  | `tree-sitter-typescript`     | `typescript`, `ts` |
| Python      | `tree-sitter-python`         | `python`, `py`     |
| Go          | `tree-sitter-go`             | `go`, `golang`     |
| C           | `tree-sitter-c`              | `c`                |
| C++         | `tree-sitter-cpp`            | `cpp`, `c++`, `cxx`|
| JSON        | `tree-sitter-json`           | `json`             |
| TOML        | `tree-sitter-toml`           | `toml`             |
| HTML        | `tree-sitter-html`           | `html`             |
| CSS         | `tree-sitter-css`            | `css`              |
| Bash        | `tree-sitter-bash`           | `bash`, `sh`, `shell` |
| Markdown    | `tree-sitter-md`             | `markdown`, `md`   |

Additional languages can be added by including the grammar crate and registering it.

## Highlight Themes

Highlight classes map to CSS classes. The theme is defined entirely in CSS:

```css
/* Example theme (dark) */
.highlight-keyword    { color: #c678dd; }
.highlight-string     { color: #98c379; }
.highlight-comment    { color: #5c6370; font-style: italic; }
.highlight-function   { color: #61afef; }
.highlight-type       { color: #e5c07b; }
.highlight-number     { color: #d19a66; }
.highlight-operator   { color: #56b6c2; }
.highlight-variable   { color: #e06c75; }
.highlight-punctuation { color: #abb2bf; }
```

## Fallback

If a language grammar is not available for a given code block, fall back to plain `<pre><code>` rendering with no highlighting.
