mod registry;

pub use registry::LanguageRegistry;

use tree_sitter_highlight::{HighlightEvent, Highlighter};

/// Highlight names that map to CSS classes
pub const HIGHLIGHT_NAMES: &[&str] = &[
    "attribute",
    "comment",
    "constant",
    "constant.builtin",
    "constructor",
    "embedded",
    "function",
    "function.builtin",
    "keyword",
    "number",
    "operator",
    "property",
    "punctuation",
    "punctuation.bracket",
    "punctuation.delimiter",
    "string",
    "string.special",
    "tag",
    "type",
    "type.builtin",
    "variable",
    "variable.builtin",
    "variable.parameter",
];

/// CSS class names corresponding to HIGHLIGHT_NAMES
const CSS_CLASSES: &[&str] = &[
    "hl-attribute",
    "hl-comment",
    "hl-constant",
    "hl-constant",
    "hl-constructor",
    "hl-embedded",
    "hl-function",
    "hl-function",
    "hl-keyword",
    "hl-number",
    "hl-operator",
    "hl-property",
    "hl-punctuation",
    "hl-punctuation",
    "hl-punctuation",
    "hl-string",
    "hl-string",
    "hl-tag",
    "hl-type",
    "hl-type",
    "hl-variable",
    "hl-variable",
    "hl-variable",
];

/// Highlight source code and return HTML with <span class="hl-*"> wrappers
pub fn highlight_code(registry: &LanguageRegistry, lang: &str, source: &str) -> Option<String> {
    let config = registry.get(lang)?;
    let mut highlighter = Highlighter::new();

    let highlights = highlighter
        .highlight(config, source.as_bytes(), None, |_| None)
        .ok()?;

    let mut html = String::with_capacity(source.len() * 2);
    let mut span_stack: Vec<&str> = Vec::new();

    for event in highlights {
        match event.ok()? {
            HighlightEvent::Source { start, end } => {
                let text = &source[start..end];
                // Escape HTML entities
                for ch in text.chars() {
                    match ch {
                        '<' => html.push_str("&lt;"),
                        '>' => html.push_str("&gt;"),
                        '&' => html.push_str("&amp;"),
                        '"' => html.push_str("&quot;"),
                        _ => html.push(ch),
                    }
                }
            }
            HighlightEvent::HighlightStart(highlight) => {
                let class = CSS_CLASSES.get(highlight.0).unwrap_or(&"hl-unknown");
                html.push_str(&format!("<span class=\"{}\">", class));
                span_stack.push(class);
            }
            HighlightEvent::HighlightEnd => {
                html.push_str("</span>");
                span_stack.pop();
            }
        }
    }

    Some(html)
}
