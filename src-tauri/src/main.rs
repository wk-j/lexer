// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod fs;
mod highlight;
mod markdown;
mod state;
mod theme;

use clap::Parser;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

/// Lexer — a beautiful Markdown viewer
#[derive(Parser, Debug)]
#[command(name = "lexer", version, about)]
struct Cli {
    /// Markdown files to open
    #[arg(value_name = "FILE")]
    files: Vec<PathBuf>,

    /// Theme name (e.g. lexer-dark, lexer-light, lexer-nord)
    #[arg(short, long)]
    theme: Option<String>,

    /// Initial layout: default, focus, zen, split
    #[arg(long, default_value = "default")]
    layout: String,

    /// Disable all visual effects
    #[arg(long)]
    no_effects: bool,
}

fn main() {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    let registry = Arc::new(highlight::LanguageRegistry::build());
    let app_state = Arc::new(Mutex::new(state::AppState::new()));

    // Load user config
    let user_config = config::LexerConfig::load();

    // Theme engine: built-in themes live next to the binary in "themes/" dir
    // During dev, resolve relative to the manifest directory
    let builtin_themes_dir = {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));
        let candidate = exe_dir
            .as_ref()
            .map(|d| d.join("themes"))
            .filter(|p| p.exists());
        candidate.unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("themes"))
    };
    let theme_engine = Arc::new(Mutex::new(theme::ThemeEngine::new(builtin_themes_dir)));

    // Resolve initial theme: CLI > config > default
    let initial_theme = cli
        .theme
        .clone()
        .or_else(|| user_config.appearance.theme.clone())
        .unwrap_or_else(|| "lexer-dark".to_string());

    // Resolve initial layout: CLI > config > default
    let initial_layout = if cli.layout != "default" {
        cli.layout.clone()
    } else {
        user_config
            .appearance
            .default_layout
            .clone()
            .unwrap_or_else(|| "default".to_string())
    };

    // Apply initial layout to app state
    {
        let mut st = app_state.lock().unwrap();
        st.layout = match initial_layout.as_str() {
            "focus" => state::LayoutMode::Focus,
            "zen" => state::LayoutMode::Zen,
            "split" => state::LayoutMode::Split,
            _ => state::LayoutMode::Default,
        };
    }

    // Collect files and flags to pass into setup closure
    let cli_files: Vec<String> = cli
        .files
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    let cli_no_effects = cli.no_effects || !user_config.effects_enabled();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(registry)
        .manage(app_state)
        .manage(theme_engine.clone())
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::get_toc,
            commands::get_current_file,
            commands::scan_directory,
            commands::close_buffer,
            commands::switch_buffer,
            commands::next_buffer,
            commands::prev_buffer,
            commands::list_buffers,
            commands::save_scroll,
            commands::close_other_buffers,
            commands::get_recent_files,
            commands::list_themes,
            commands::load_theme,
            commands::get_active_theme,
            commands::set_layout,
            commands::get_layout,
            commands::new_window,
            commands::list_windows,
            commands::focus_window,
        ])
        .setup(move |app| {
            // Apply macOS vibrancy (frosted glass blur behind the window)
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                let window = app.get_webview_window("main").unwrap();
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::UnderWindowBackground,
                    None,
                    None,
                )
                .expect("Failed to apply vibrancy");
            }

            // Start theme hot-reload watcher for user themes directory
            {
                let te = theme_engine.lock().unwrap();
                let user_dir = te.user_themes_dir().to_path_buf();
                drop(te);
                let _ = std::fs::create_dir_all(&user_dir);
                let handle = app.handle().clone();
                let te_clone = Arc::clone(&theme_engine);
                if let Ok(watcher) = crate::fs::FileWatcher::new(&user_dir, move |path| {
                    if path.extension().map_or(false, |e| e == "toml") {
                        if let Ok(engine) = te_clone.lock() {
                            let file_stem = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            if file_stem == engine.active_theme {
                                if let Ok(theme) = engine.load_theme(&engine.active_theme) {
                                    let _ = handle.emit("theme-updated", theme.css);
                                }
                            }
                        }
                    }
                }) {
                    app.manage(Arc::new(Mutex::new(Some(watcher))));
                }
            }

            // Send startup configuration to frontend
            {
                let handle = app.handle().clone();
                let theme = initial_theme.clone();
                let layout = initial_layout.clone();
                let no_effects = cli_no_effects;
                let files = cli_files.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    // Send initial config
                    let _ = handle.emit(
                        "startup-config",
                        serde_json::json!({
                            "theme": theme,
                            "layout": layout,
                            "noEffects": no_effects,
                        }),
                    );

                    // Open files passed via CLI
                    for file_path in &files {
                        let _ = handle.emit("open-file-arg", file_path.clone());
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
