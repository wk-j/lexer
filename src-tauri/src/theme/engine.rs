use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// --- Theme structs (deserialized from TOML) ---

#[derive(Debug, Clone, Deserialize)]
pub struct ThemeFile {
    #[serde(default)]
    pub meta: ThemeMeta,
    #[serde(default)]
    pub colors: ThemeColors,
    #[serde(default)]
    pub syntax: HashMap<String, String>,
    #[serde(default)]
    pub typography: ThemeTypography,
    #[serde(default)]
    pub effects: ThemeEffects,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeMeta {
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default = "default_base")]
    pub base: String, // "dark" or "light"
    #[serde(default)]
    pub version: String,
}

impl Default for ThemeMeta {
    fn default() -> Self {
        Self {
            name: default_name(),
            author: String::new(),
            base: default_base(),
            version: String::new(),
        }
    }
}

fn default_name() -> String {
    "Untitled Theme".into()
}
fn default_base() -> String {
    "dark".into()
}

#[derive(Debug, Clone, Deserialize)]
pub struct ThemeColors {
    #[serde(default)]
    pub bg_base: Option<String>,
    #[serde(default)]
    pub bg_base_opaque: Option<String>,
    #[serde(default)]
    pub bg_panel: Option<String>,
    #[serde(default)]
    pub bg_panel_border: Option<String>,
    #[serde(default)]
    pub text_primary: Option<String>,
    #[serde(default)]
    pub text_secondary: Option<String>,
    #[serde(default)]
    pub text_muted: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub link_hover: Option<String>,
    // Gradient mesh
    #[serde(default)]
    pub gradient_a: Option<String>,
    #[serde(default)]
    pub gradient_b: Option<String>,
    #[serde(default)]
    pub gradient_c: Option<String>,
    // Code block
    #[serde(default)]
    pub code_bg: Option<String>,
    #[serde(default)]
    pub code_border: Option<String>,
    #[serde(default)]
    pub glow_color: Option<String>,
    #[serde(default)]
    pub glow_radius: Option<String>,
    // Elements
    #[serde(default)]
    pub blockquote_border: Option<String>,
    #[serde(default)]
    pub blockquote_bg: Option<String>,
    #[serde(default)]
    pub hr_color: Option<String>,
    #[serde(default)]
    pub table_header_bg: Option<String>,
    #[serde(default)]
    pub table_border: Option<String>,
    #[serde(default)]
    pub table_row_alt: Option<String>,
    // Spotlight / effects
    #[serde(default)]
    pub spotlight_color: Option<String>,
    #[serde(default)]
    pub heading_gradient: Option<String>,
    // Block select
    #[serde(default)]
    pub select_bar: Option<String>,
    #[serde(default)]
    pub select_bg: Option<String>,
    #[serde(default)]
    pub select_cursor_bar: Option<String>,
    #[serde(default)]
    pub select_cursor_bg: Option<String>,
    #[serde(default)]
    pub select_bar_width: Option<String>,
    #[serde(default)]
    pub select_bar_offset: Option<String>,
    // GX-style border decoration
    #[serde(default)]
    pub gx_border_color_start: Option<String>,
    #[serde(default)]
    pub gx_border_color_mid: Option<String>,
    #[serde(default)]
    pub gx_border_color_end: Option<String>,
    #[serde(default)]
    pub gx_border_width: Option<String>,
    #[serde(default)]
    pub gx_corner_size: Option<String>,
    #[serde(default)]
    pub gx_glow_opacity: Option<String>,
    #[serde(default)]
    pub gx_glow_spread: Option<String>,
}

impl Default for ThemeColors {
    fn default() -> Self {
        Self {
            bg_base: None,
            bg_base_opaque: None,
            bg_panel: None,
            bg_panel_border: None,
            text_primary: None,
            text_secondary: None,
            text_muted: None,
            accent: None,
            link: None,
            link_hover: None,
            gradient_a: None,
            gradient_b: None,
            gradient_c: None,
            code_bg: None,
            code_border: None,
            glow_color: None,
            glow_radius: None,
            blockquote_border: None,
            blockquote_bg: None,
            hr_color: None,
            table_header_bg: None,
            table_border: None,
            table_row_alt: None,
            spotlight_color: None,
            heading_gradient: None,
            select_bar: None,
            select_bg: None,
            select_cursor_bar: None,
            select_cursor_bg: None,
            select_bar_width: None,
            select_bar_offset: None,
            gx_border_color_start: None,
            gx_border_color_mid: None,
            gx_border_color_end: None,
            gx_border_width: None,
            gx_corner_size: None,
            gx_glow_opacity: None,
            gx_glow_spread: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ThemeTypography {
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub font_family_mono: Option<String>,
    #[serde(default)]
    pub font_size: Option<u32>,
    #[serde(default)]
    pub line_height: Option<f64>,
    #[serde(default)]
    pub code_font_size: Option<u32>,
}

impl Default for ThemeTypography {
    fn default() -> Self {
        Self {
            font_family: None,
            font_family_mono: None,
            font_size: None,
            line_height: None,
            code_font_size: None,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct ThemeEffects {
    #[serde(default)]
    pub frosted_glass: Option<bool>,
    #[serde(default)]
    pub frosted_blur: Option<String>,
    #[serde(default)]
    pub frosted_saturate: Option<String>,
    #[serde(default)]
    pub gradient_backdrop: Option<bool>,
    #[serde(default)]
    pub noise_texture: Option<bool>,
    #[serde(default)]
    pub noise_opacity: Option<f64>,
    #[serde(default)]
    pub scroll_animations: Option<bool>,
    #[serde(default)]
    pub heading_gradient_text: Option<bool>,
    #[serde(default)]
    pub gx_border: Option<bool>,
}

impl Default for ThemeEffects {
    fn default() -> Self {
        Self {
            frosted_glass: None,
            frosted_blur: None,
            frosted_saturate: None,
            gradient_backdrop: None,
            noise_texture: None,
            noise_opacity: None,
            scroll_animations: None,
            heading_gradient_text: None,
            gx_border: None,
        }
    }
}

// --- Resolved theme (all values filled in) ---

#[derive(Debug, Clone)]
pub struct Theme {
    pub meta: ThemeMeta,
    pub css: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThemeInfo {
    pub name: String,
    pub file_name: String,
    pub author: String,
    pub base: String,
    pub builtin: bool,
}

// --- Theme Engine ---

pub struct ThemeEngine {
    builtin_dir: PathBuf,
    user_dir: PathBuf,
    pub active_theme: String,
}

impl ThemeEngine {
    pub fn new(builtin_dir: PathBuf) -> Self {
        let user_dir = dirs_config_path();
        Self {
            builtin_dir,
            user_dir,
            active_theme: "lexer-dark".into(),
        }
    }

    /// List all available themes (built-in + user).
    pub fn list_themes(&self) -> Vec<ThemeInfo> {
        let mut themes = Vec::new();

        // Built-in themes
        self.scan_dir(&self.builtin_dir, true, &mut themes);
        // User themes
        self.scan_dir(&self.user_dir, false, &mut themes);

        themes
    }

    fn scan_dir(&self, dir: &Path, builtin: bool, out: &mut Vec<ThemeInfo>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "toml") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(theme) = toml::from_str::<ThemeFile>(&content) {
                            let file_name = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            out.push(ThemeInfo {
                                name: theme.meta.name,
                                file_name,
                                author: theme.meta.author,
                                base: theme.meta.base,
                                builtin,
                            });
                        }
                    }
                }
            }
        }
    }

    /// Load and compile a theme by file_name (e.g. "lexer-dark").
    /// Returns the CSS custom property block.
    pub fn load_theme(&self, name: &str) -> Result<Theme, String> {
        let theme_file = self.resolve_theme_file(name)?;
        let content = std::fs::read_to_string(&theme_file)
            .map_err(|e| format!("Failed to read theme file: {}", e))?;
        let parsed: ThemeFile =
            toml::from_str(&content).map_err(|e| format!("Failed to parse theme TOML: {}", e))?;

        // Load base defaults
        let base_name = if parsed.meta.base == "light" {
            "lexer-light"
        } else {
            "lexer-dark"
        };

        let defaults = if name != base_name {
            self.load_base_defaults(base_name)
        } else {
            None
        };

        let css = compile_css(&parsed, defaults.as_ref());

        Ok(Theme {
            meta: parsed.meta,
            css,
        })
    }

    fn resolve_theme_file(&self, name: &str) -> Result<PathBuf, String> {
        let file_name = format!("{}.toml", name);

        // 1. User themes directory
        let user_path = self.user_dir.join(&file_name);
        if user_path.exists() {
            return Ok(user_path);
        }

        // 2. LEXER_THEMES_DIR env var
        if let Ok(env_dir) = std::env::var("LEXER_THEMES_DIR") {
            let env_path = PathBuf::from(env_dir).join(&file_name);
            if env_path.exists() {
                return Ok(env_path);
            }
        }

        // 3. Built-in themes
        let builtin_path = self.builtin_dir.join(&file_name);
        if builtin_path.exists() {
            return Ok(builtin_path);
        }

        Err(format!("Theme not found: {}", name))
    }

    fn load_base_defaults(&self, base_name: &str) -> Option<ThemeFile> {
        let path = self.builtin_dir.join(format!("{}.toml", base_name));
        let content = std::fs::read_to_string(&path).ok()?;
        toml::from_str(&content).ok()
    }

    /// Get the user themes directory path.
    pub fn user_themes_dir(&self) -> &Path {
        &self.user_dir
    }
}

// --- CSS Compilation ---

fn compile_css(theme: &ThemeFile, base: Option<&ThemeFile>) -> String {
    let mut css = String::from(":root {\n");

    // Helper: emit a CSS variable, falling back to base or default
    macro_rules! var {
        ($css_var:expr, $field:expr, $base_field:expr, $default:expr) => {
            let val = $field
                .as_deref()
                .or_else(|| $base_field.and_then(|b| b.as_deref()))
                .unwrap_or($default);
            css.push_str(&format!("  {}: {};\n", $css_var, val));
        };
    }

    let bc = base.map(|b| &b.colors);
    let c = &theme.colors;

    // Colors
    var!(
        "--bg-base",
        c.bg_base,
        bc.map(|b| &b.bg_base),
        "transparent"
    );
    var!(
        "--bg-base-opaque",
        c.bg_base_opaque,
        bc.map(|b| &b.bg_base_opaque),
        "#0d1117"
    );
    var!(
        "--panel-bg",
        c.bg_panel,
        bc.map(|b| &b.bg_panel),
        "rgba(22, 27, 34, 0.55)"
    );
    var!(
        "--panel-border",
        c.bg_panel_border,
        bc.map(|b| &b.bg_panel_border),
        "rgba(255, 255, 255, 0.10)"
    );
    var!(
        "--text-primary",
        c.text_primary,
        bc.map(|b| &b.text_primary),
        "#e6edf3"
    );
    var!(
        "--text-secondary",
        c.text_secondary,
        bc.map(|b| &b.text_secondary),
        "#8b949e"
    );
    var!(
        "--text-muted",
        c.text_muted,
        bc.map(|b| &b.text_muted),
        "#484f58"
    );
    var!("--accent", c.accent, bc.map(|b| &b.accent), "#58a6ff");
    var!("--link", c.link, bc.map(|b| &b.link), "#58a6ff");
    var!(
        "--link-hover",
        c.link_hover,
        bc.map(|b| &b.link_hover),
        "#79c0ff"
    );

    // Gradients
    var!(
        "--gradient-a",
        c.gradient_a,
        bc.map(|b| &b.gradient_a),
        "rgba(88, 166, 255, 0.08)"
    );
    var!(
        "--gradient-b",
        c.gradient_b,
        bc.map(|b| &b.gradient_b),
        "rgba(210, 168, 255, 0.06)"
    );
    var!(
        "--gradient-c",
        c.gradient_c,
        bc.map(|b| &b.gradient_c),
        "rgba(126, 231, 135, 0.05)"
    );

    // Code
    var!(
        "--code-bg",
        c.code_bg,
        bc.map(|b| &b.code_bg),
        "rgba(22, 27, 34, 0.45)"
    );
    var!(
        "--code-border",
        c.code_border,
        bc.map(|b| &b.code_border),
        "rgba(255, 255, 255, 0.08)"
    );
    var!(
        "--glow-color",
        c.glow_color,
        bc.map(|b| &b.glow_color),
        "rgba(88, 166, 255, 0.25)"
    );
    var!(
        "--glow-radius",
        c.glow_radius,
        bc.map(|b| &b.glow_radius),
        "20px"
    );

    // Elements
    var!(
        "--blockquote-border",
        c.blockquote_border,
        bc.map(|b| &b.blockquote_border),
        "#58a6ff"
    );
    var!(
        "--blockquote-bg",
        c.blockquote_bg,
        bc.map(|b| &b.blockquote_bg),
        "rgba(56, 139, 253, 0.08)"
    );
    var!(
        "--hr-color",
        c.hr_color,
        bc.map(|b| &b.hr_color),
        "rgba(48, 54, 61, 0.6)"
    );
    var!(
        "--table-header-bg",
        c.table_header_bg,
        bc.map(|b| &b.table_header_bg),
        "rgba(110, 118, 129, 0.12)"
    );
    var!(
        "--table-border",
        c.table_border,
        bc.map(|b| &b.table_border),
        "rgba(110, 118, 129, 0.15)"
    );
    var!(
        "--table-row-alt",
        c.table_row_alt,
        bc.map(|b| &b.table_row_alt),
        "rgba(110, 118, 129, 0.04)"
    );

    // Spotlight / heading
    var!(
        "--spotlight-color",
        c.spotlight_color,
        bc.map(|b| &b.spotlight_color),
        "rgba(255, 255, 255, 0.02)"
    );
    var!(
        "--heading-gradient",
        c.heading_gradient,
        bc.map(|b| &b.heading_gradient),
        "linear-gradient(135deg, var(--accent), var(--text-primary))"
    );

    // Block select
    var!(
        "--select-bar",
        c.select_bar,
        bc.map(|b| &b.select_bar),
        "var(--accent)"
    );
    var!(
        "--select-bg",
        c.select_bg,
        bc.map(|b| &b.select_bg),
        "rgba(88, 166, 255, 0.08)"
    );
    var!(
        "--select-cursor-bar",
        c.select_cursor_bar,
        bc.map(|b| &b.select_cursor_bar),
        "var(--text-primary)"
    );
    var!(
        "--select-cursor-bg",
        c.select_cursor_bg,
        bc.map(|b| &b.select_cursor_bg),
        "rgba(88, 166, 255, 0.15)"
    );
    var!(
        "--select-bar-width",
        c.select_bar_width,
        bc.map(|b| &b.select_bar_width),
        "3px"
    );
    var!(
        "--select-bar-offset",
        c.select_bar_offset,
        bc.map(|b| &b.select_bar_offset),
        "-16px"
    );

    // GX-style border decoration
    var!(
        "--gx-border-color-start",
        c.gx_border_color_start,
        bc.map(|b| &b.gx_border_color_start),
        "var(--accent)"
    );
    var!(
        "--gx-border-color-mid",
        c.gx_border_color_mid,
        bc.map(|b| &b.gx_border_color_mid),
        "var(--accent)"
    );
    var!(
        "--gx-border-color-end",
        c.gx_border_color_end,
        bc.map(|b| &b.gx_border_color_end),
        "rgba(88, 166, 255, 0.2)"
    );
    var!(
        "--gx-border-width",
        c.gx_border_width,
        bc.map(|b| &b.gx_border_width),
        "1.5px"
    );
    var!(
        "--gx-corner-size",
        c.gx_corner_size,
        bc.map(|b| &b.gx_corner_size),
        "10px"
    );
    var!(
        "--gx-glow-opacity",
        c.gx_glow_opacity,
        bc.map(|b| &b.gx_glow_opacity),
        "0.6"
    );
    var!(
        "--gx-glow-spread",
        c.gx_glow_spread,
        bc.map(|b| &b.gx_glow_spread),
        "8px"
    );

    // Syntax highlight tokens
    let base_syntax = base.map(|b| &b.syntax);
    let default_syntax = default_dark_syntax();
    for (token, default_val) in &default_syntax {
        let val = theme
            .syntax
            .get(*token)
            .or_else(|| base_syntax.and_then(|bs| bs.get(*token)))
            .map(|s| s.as_str())
            .unwrap_or(default_val);
        css.push_str(&format!("  --hl-{}: {};\n", token, val));
    }
    // Any extra syntax tokens not in defaults
    for (token, val) in &theme.syntax {
        if !default_syntax.iter().any(|(k, _)| k == &token.as_str()) {
            css.push_str(&format!("  --hl-{}: {};\n", token, val));
        }
    }

    // Typography
    let bt = base.map(|b| &b.typography);
    let t = &theme.typography;

    if let Some(ff) = t
        .font_family
        .as_deref()
        .or(bt.and_then(|b| b.font_family.as_deref()))
    {
        css.push_str(&format!("  --font-family: {};\n", ff));
    }
    if let Some(ff) = t
        .font_family_mono
        .as_deref()
        .or(bt.and_then(|b| b.font_family_mono.as_deref()))
    {
        css.push_str(&format!("  --font-family-mono: {};\n", ff));
    }
    if let Some(fs) = t.font_size.or(bt.and_then(|b| b.font_size)) {
        css.push_str(&format!("  --font-size: {}px;\n", fs));
    }
    if let Some(lh) = t.line_height.or(bt.and_then(|b| b.line_height)) {
        css.push_str(&format!("  --line-height: {};\n", lh));
    }
    if let Some(cfs) = t.code_font_size.or(bt.and_then(|b| b.code_font_size)) {
        css.push_str(&format!("  --code-font-size: {}px;\n", cfs));
    }

    // Effects
    let be = base.map(|b| &b.effects);
    let e = &theme.effects;
    if let Some(blur) = e
        .frosted_blur
        .as_deref()
        .or(be.and_then(|b| b.frosted_blur.as_deref()))
    {
        css.push_str(&format!("  --blur: {};\n", blur));
    }
    if let Some(sat) = e
        .frosted_saturate
        .as_deref()
        .or(be.and_then(|b| b.frosted_saturate.as_deref()))
    {
        css.push_str(&format!("  --saturate: {};\n", sat));
    }

    css.push_str("}\n");

    // Effect toggles as body classes
    let mut body_rules = String::new();

    let frosted = e
        .frosted_glass
        .or(be.and_then(|b| b.frosted_glass))
        .unwrap_or(true);
    if !frosted {
        body_rules.push_str("body { --blur: 0px; --saturate: 100%; }\n");
    }

    let noise = e
        .noise_texture
        .or(be.and_then(|b| b.noise_texture))
        .unwrap_or(true);
    if !noise {
        body_rules.push_str(".noise-overlay { display: none !important; }\n");
    }

    let gradient_bg = e
        .gradient_backdrop
        .or(be.and_then(|b| b.gradient_backdrop))
        .unwrap_or(true);
    if !gradient_bg {
        body_rules.push_str(".app-backdrop { background: transparent !important; }\n");
    }

    let heading_grad = e
        .heading_gradient_text
        .or(be.and_then(|b| b.heading_gradient_text))
        .unwrap_or(true);
    if !heading_grad {
        body_rules.push_str(
            ".content-panel h1, .content-panel h2, .content-panel h3 { background: none !important; -webkit-background-clip: unset !important; -webkit-text-fill-color: unset !important; background-clip: unset !important; }\n"
        );
    }

    let gx_border = e.gx_border.or(be.and_then(|b| b.gx_border)).unwrap_or(true);
    if !gx_border {
        body_rules.push_str(".gx-border { display: none !important; }\n");
    }

    if let Some(opacity) = e.noise_opacity.or(be.and_then(|b| b.noise_opacity)) {
        body_rules.push_str(&format!(
            ".noise-overlay {{ opacity: {} !important; }}\n",
            opacity
        ));
    }

    css.push_str(&body_rules);
    css
}

fn default_dark_syntax() -> Vec<(&'static str, &'static str)> {
    vec![
        ("keyword", "#ff7b72"),
        ("string", "#a5d6ff"),
        ("comment", "#8b949e"),
        ("function", "#d2a8ff"),
        ("type", "#79c0ff"),
        ("number", "#79c0ff"),
        ("operator", "#79c0ff"),
        ("variable", "#ffa657"),
        ("punctuation", "#8b949e"),
        ("constant", "#79c0ff"),
        ("tag", "#7ee787"),
        ("attribute", "#79c0ff"),
        ("property", "#79c0ff"),
        ("constructor", "#ffa657"),
        ("embedded", "#e6edf3"),
        ("unknown", "#e6edf3"),
    ]
}

fn dirs_config_path() -> PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        PathBuf::from(home)
            .join(".config")
            .join("lexer")
            .join("themes")
    } else {
        PathBuf::from(".")
    }
}
