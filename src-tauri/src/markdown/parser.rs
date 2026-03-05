use pulldown_cmark::{CodeBlockKind, Event, Options, Parser, Tag, TagEnd};
use serde::Serialize;

use crate::highlight::{highlight_code, LanguageRegistry};

#[derive(Debug, Clone, Serialize)]
pub struct TocEntry {
    pub level: u8,
    pub text: String,
    pub id: String,
}

pub fn render_markdown(source: &str, registry: &LanguageRegistry) -> (String, Vec<TocEntry>) {
    let opts = Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_FOOTNOTES;

    let parser = Parser::new_ext(source, opts);

    let mut html = String::with_capacity(source.len() * 2);
    let mut toc: Vec<TocEntry> = Vec::new();
    let mut in_code_block = false;
    let mut code_lang = String::new();
    let mut code_buffer = String::new();
    let mut in_heading = false;
    let mut heading_level: u8 = 0;
    let mut heading_text = String::new();

    // Collect events, intercept code blocks and headings
    for event in parser {
        match event {
            Event::Start(Tag::CodeBlock(kind)) => {
                in_code_block = true;
                code_buffer.clear();
                code_lang = match kind {
                    CodeBlockKind::Fenced(lang) => {
                        lang.split_whitespace().next().unwrap_or("").to_string()
                    }
                    CodeBlockKind::Indented => String::new(),
                };
            }
            Event::End(TagEnd::CodeBlock) => {
                in_code_block = false;
                let highlighted = if !code_lang.is_empty() {
                    highlight_code(registry, &code_lang, &code_buffer)
                } else {
                    None
                };

                let lang_attr = if !code_lang.is_empty() {
                    format!(" data-lang=\"{}\"", escape_attr(&code_lang))
                } else {
                    String::new()
                };

                match highlighted {
                    Some(hl) => {
                        html.push_str(&format!("<pre{}><code>{}</code></pre>\n", lang_attr, hl));
                    }
                    None => {
                        html.push_str(&format!(
                            "<pre{}><code>{}</code></pre>\n",
                            lang_attr,
                            escape_html(&code_buffer)
                        ));
                    }
                }
            }
            Event::Text(text) if in_code_block => {
                code_buffer.push_str(&text);
            }
            Event::Start(Tag::Heading { level, .. }) => {
                in_heading = true;
                heading_level = level as u8;
                heading_text.clear();
            }
            Event::End(TagEnd::Heading(_)) => {
                in_heading = false;
                let id = slugify(&heading_text);
                toc.push(TocEntry {
                    level: heading_level,
                    text: heading_text.clone(),
                    id: id.clone(),
                });
                html.push_str(&format!(
                    "<h{} id=\"{}\">{}</h{}>\n",
                    heading_level,
                    escape_attr(&id),
                    escape_html(&heading_text),
                    heading_level
                ));
            }
            Event::Text(text) if in_heading => {
                heading_text.push_str(&text);
            }
            Event::Code(code) if in_heading => {
                heading_text.push_str(&code);
            }
            // For all other events, use pulldown_cmark's HTML output
            _ => {
                if !in_heading {
                    let single = std::iter::once(event);
                    pulldown_cmark::html::push_html(&mut html, single);
                }
            }
        }
    }

    (html, toc)
}

fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

fn escape_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
