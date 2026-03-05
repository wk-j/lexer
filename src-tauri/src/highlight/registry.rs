use std::collections::HashMap;
use tree_sitter_highlight::HighlightConfiguration;

use super::HIGHLIGHT_NAMES;

pub struct LanguageRegistry {
    configs: HashMap<String, HighlightConfiguration>,
    aliases: HashMap<String, String>,
}

impl LanguageRegistry {
    pub fn get(&self, lang: &str) -> Option<&HighlightConfiguration> {
        let normalized = lang.to_lowercase();
        let key = self.aliases.get(&normalized).unwrap_or(&normalized);
        self.configs.get(key)
    }

    pub fn build() -> Self {
        let mut reg = Self {
            configs: HashMap::new(),
            aliases: HashMap::new(),
        };

        reg.add(
            "rust",
            &["rs"],
            tree_sitter_rust::LANGUAGE.into(),
            tree_sitter_rust::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg.add(
            "javascript",
            &["js", "jsx"],
            tree_sitter_javascript::LANGUAGE.into(),
            tree_sitter_javascript::HIGHLIGHT_QUERY,
            tree_sitter_javascript::INJECTIONS_QUERY,
            tree_sitter_javascript::LOCALS_QUERY,
        );

        reg.add(
            "typescript",
            &["ts", "tsx"],
            tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            tree_sitter_typescript::HIGHLIGHTS_QUERY,
            "",
            tree_sitter_typescript::LOCALS_QUERY,
        );

        reg.add(
            "python",
            &["py"],
            tree_sitter_python::LANGUAGE.into(),
            tree_sitter_python::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg.add(
            "json",
            &[],
            tree_sitter_json::LANGUAGE.into(),
            tree_sitter_json::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg.add(
            "bash",
            &["sh", "shell", "zsh"],
            tree_sitter_bash::LANGUAGE.into(),
            tree_sitter_bash::HIGHLIGHT_QUERY,
            "",
            "",
        );

        reg.add(
            "c",
            &[],
            tree_sitter_c::LANGUAGE.into(),
            tree_sitter_c::HIGHLIGHT_QUERY,
            "",
            "",
        );

        reg.add(
            "cpp",
            &["c++", "cxx", "cc"],
            tree_sitter_cpp::LANGUAGE.into(),
            tree_sitter_cpp::HIGHLIGHT_QUERY,
            "",
            "",
        );

        reg.add(
            "go",
            &["golang"],
            tree_sitter_go::LANGUAGE.into(),
            tree_sitter_go::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg.add(
            "toml",
            &[],
            tree_sitter_toml_ng::LANGUAGE.into(),
            tree_sitter_toml_ng::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg.add(
            "html",
            &["htm"],
            tree_sitter_html::LANGUAGE.into(),
            tree_sitter_html::HIGHLIGHTS_QUERY,
            tree_sitter_html::INJECTIONS_QUERY,
            "",
        );

        reg.add(
            "css",
            &[],
            tree_sitter_css::LANGUAGE.into(),
            tree_sitter_css::HIGHLIGHTS_QUERY,
            "",
            "",
        );

        reg
    }

    fn add(
        &mut self,
        name: &str,
        aliases: &[&str],
        language: tree_sitter::Language,
        highlights: &str,
        injections: &str,
        locals: &str,
    ) {
        match HighlightConfiguration::new(language, name, highlights, injections, locals) {
            Ok(mut config) => {
                config.configure(HIGHLIGHT_NAMES);
                self.configs.insert(name.to_string(), config);
                for alias in aliases {
                    self.aliases.insert(alias.to_lowercase(), name.to_string());
                }
            }
            Err(e) => {
                tracing::warn!("Failed to register language '{}': {}", name, e);
            }
        }
    }
}
