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

/// Wrap plain (non-highlighted) code in line spans.
/// Input should already be HTML-escaped.
pub fn wrap_plain_lines(escaped_html: &str) -> String {
    let trimmed = escaped_html.strip_suffix('\n').unwrap_or(escaped_html);
    let mut result = String::with_capacity(trimmed.len() + trimmed.len() / 4);
    for line in trimmed.split('\n') {
        result.push_str("<span class=\"line\">");
        result.push_str(line);
        result.push_str("</span>");
    }
    result
}

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

    Some(wrap_lines(&html))
}

/// Wrap each line of highlighted HTML in `<span class="line">...</span>`.
///
/// This is tricky because highlight spans can cross line boundaries.
/// We split on newlines and re-open/close any active spans at boundaries.
fn wrap_lines(html: &str) -> String {
    let html = html.strip_suffix('\n').unwrap_or(html);
    let mut result = String::with_capacity(html.len() + html.len() / 4);
    let mut open_spans: Vec<String> = Vec::new();

    result.push_str("<span class=\"line\">");

    let mut chars = html.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '<' {
            // Read the full tag
            let mut tag = String::from('<');
            for c in chars.by_ref() {
                tag.push(c);
                if c == '>' {
                    break;
                }
            }

            if tag.starts_with("</span") {
                open_spans.pop();
                result.push_str(&tag);
            } else if tag.starts_with("<span") {
                open_spans.push(tag.clone());
                result.push_str(&tag);
            } else {
                result.push_str(&tag);
            }
        } else if ch == '\n' {
            // Close all open spans, end line, start new line, re-open spans
            for _ in open_spans.iter().rev() {
                result.push_str("</span>");
            }
            result.push_str("</span><span class=\"line\">");
            for span in &open_spans {
                result.push_str(span);
            }
        } else {
            result.push(ch);
        }
    }

    result.push_str("</span>");
    result
}
