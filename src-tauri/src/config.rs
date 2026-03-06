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

    fn config_path() -> PathBuf {
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
