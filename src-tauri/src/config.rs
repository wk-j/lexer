use serde::Deserialize;
use std::path::PathBuf;

/// Lexer configuration loaded from ~/.config/lexer/config.toml
#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct LexerConfig {
    #[serde(default)]
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub behavior: BehaviorConfig,
    #[serde(default)]
    pub effects: EffectsConfig,
}

#[derive(Debug, Deserialize, Default)]
pub struct AppearanceConfig {
    pub theme: Option<String>,
    pub default_layout: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct BehaviorConfig {
    #[serde(default = "default_true")]
    pub live_reload: bool,
    #[serde(default = "default_true")]
    pub preserve_scroll: bool,
    #[serde(default)]
    pub restore_session: bool,
}

#[derive(Debug, Deserialize, Default)]
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
