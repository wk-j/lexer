use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Lexer configuration loaded from ~/.config/lexer/config.toml
#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[allow(dead_code)]
pub struct LexerConfig {
    #[serde(default)]
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub behavior: BehaviorConfig,
    #[serde(default)]
    pub effects: EffectsConfig,
    #[serde(default)]
    pub shortcuts: ShortcutsConfig,
    #[serde(default)]
    pub window: WindowConfig,
    #[serde(default)]
    pub commands: Vec<CustomCommand>,
}

/// A user-defined shell command with placeholder support.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CustomCommand {
    pub name: String,
    pub command: String,
    #[serde(default = "default_output_mode")]
    pub output: String,
    #[serde(default)]
    pub confirm: bool,
    pub working_dir: Option<String>,
    pub shell: Option<String>,
}

fn default_output_mode() -> String {
    "ignore".to_string()
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[allow(dead_code)]
pub struct WindowConfig {
    /// Padding (in points) between the window edges and the screen's usable area.
    /// A single value applies uniformly to all sides; use [top, right, bottom, left]
    /// for per-side control.  Defaults to 0 (fill the desktop).
    pub padding: Option<WindowPadding>,
    /// Initial window width in logical points. When set (along with height),
    /// the window opens at this exact size instead of filling the desktop.
    pub width: Option<f64>,
    /// Initial window height in logical points.
    pub height: Option<f64>,
}

/// Accepts either a single number or a [top, right, bottom, left] array.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum WindowPadding {
    Uniform(f64),
    Sides([f64; 4]),
}

impl WindowPadding {
    /// Returns (top, right, bottom, left) in logical points.
    pub fn to_trbl(&self) -> (f64, f64, f64, f64) {
        match self {
            WindowPadding::Uniform(v) => (*v, *v, *v, *v),
            WindowPadding::Sides([t, r, b, l]) => (*t, *r, *b, *l),
        }
    }
}

impl Default for WindowPadding {
    fn default() -> Self {
        WindowPadding::Uniform(0.0)
    }
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
pub struct AppearanceConfig {
    pub theme: Option<String>,
    pub default_layout: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[allow(dead_code)]
pub struct BehaviorConfig {
    #[serde(default = "default_true")]
    pub live_reload: bool,
    #[serde(default = "default_true")]
    pub preserve_scroll: bool,
    #[serde(default)]
    pub restore_session: bool,
    /// Scroll speed for j/k navigation (pixels per keypress). Default: 200.
    pub scroll_speed: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[allow(dead_code)]
pub struct EffectsConfig {
    pub frosted_glass: Option<bool>,
    pub gradient_backdrop: Option<bool>,
    pub noise_texture: Option<bool>,
    pub ambient_glow: Option<bool>,
    pub scroll_animations: Option<bool>,
    pub particles: Option<bool>,
    /// Master toggle: if set to false, disables all effects
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize, Default, Clone)]
#[allow(dead_code)]
pub struct ShortcutsConfig {
    /// Global shortcut to toggle window visibility.
    /// Format: "Super+Shift+KeyL" (Tauri global-shortcut string syntax).
    /// Set to "" or "none" to disable.
    pub toggle_window: Option<String>,
}

fn default_true() -> bool {
    true
}

impl LexerConfig {
    /// Load config from ~/.config/lexer/config.toml, returning defaults if not found.
    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(content) => match toml::from_str(&content) {
                    Ok(config) => return config,
                    Err(e) => {
                        tracing::warn!("Failed to parse config file: {}", e);
                    }
                },
                Err(e) => {
                    tracing::warn!("Failed to read config file: {}", e);
                }
            }
        }
        Self::default()
    }

    /// Returns true if effects are globally enabled.
    pub fn effects_enabled(&self) -> bool {
        self.effects.enabled.unwrap_or(true)
    }

    /// Persist a specific field into the config file.
    /// Reads the existing file as a TOML table, updates the field, writes back.
    /// This preserves user comments and unrecognized fields as much as `toml` allows.
    pub fn set_field(section: &str, key: &str, value: &str) {
        let path = Self::config_path();

        // Read existing content or start fresh
        let mut doc: toml::Value = if path.exists() {
            std::fs::read_to_string(&path)
                .ok()
                .and_then(|s| toml::from_str(&s).ok())
                .unwrap_or_else(|| toml::Value::Table(toml::map::Map::new()))
        } else {
            toml::Value::Table(toml::map::Map::new())
        };

        // Ensure the section table exists, then set the key
        if let toml::Value::Table(ref mut root) = doc {
            let section_table = root
                .entry(section)
                .or_insert_with(|| toml::Value::Table(toml::map::Map::new()));
            if let toml::Value::Table(ref mut tbl) = section_table {
                tbl.insert(key.to_string(), toml::Value::String(value.to_string()));
            }
        }

        // Ensure parent directory exists and write
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(content) = toml::to_string_pretty(&doc) {
            if let Err(e) = std::fs::write(&path, content) {
                tracing::warn!("Failed to write config file: {}", e);
            }
        }
    }

    pub fn config_path() -> PathBuf {
        dirs_config_dir().join("lexer").join("config.toml")
    }
}

/// Platform-appropriate config directory.
fn dirs_config_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(".config");
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(dir) = std::env::var("XDG_CONFIG_HOME") {
            return PathBuf::from(dir);
        }
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(".config");
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(dir) = std::env::var("APPDATA") {
            return PathBuf::from(dir);
        }
    }
    PathBuf::from(".")
}
