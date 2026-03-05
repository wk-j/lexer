// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod fs;
mod highlight;
mod markdown;
mod state;
mod theme;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

fn main() {
    tracing_subscriber::fmt::init();

    let registry = Arc::new(highlight::LanguageRegistry::build());
    let app_state = Arc::new(Mutex::new(state::AppState::new()));

    // Theme engine: built-in themes live next to the binary in "themes/" dir
    // During dev, resolve relative to the manifest directory
    let builtin_themes_dir = {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));
        // Check next to executable first (production bundle)
        let candidate = exe_dir
            .as_ref()
            .map(|d| d.join("themes"))
            .filter(|p| p.exists());
        // Fallback: relative to project root (dev mode)
        candidate.unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("themes"))
    };
    let theme_engine = Arc::new(Mutex::new(theme::ThemeEngine::new(builtin_themes_dir)));

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
                // Create user themes directory if it doesn't exist
                let _ = std::fs::create_dir_all(&user_dir);
                let handle = app.handle().clone();
                let te_clone = Arc::clone(&theme_engine);
                // Watch user themes directory for changes
                if let Ok(watcher) = crate::fs::FileWatcher::new(&user_dir, move |path| {
                    if path.extension().map_or(false, |e| e == "toml") {
                        // Check if the changed file is the active theme
                        if let Ok(engine) = te_clone.lock() {
                            let file_stem = path
                                .file_stem()
                                .map(|s| s.to_string_lossy().into_owned())
                                .unwrap_or_default();
                            if file_stem == engine.active_theme {
                                // Reload the active theme
                                if let Ok(theme) = engine.load_theme(&engine.active_theme) {
                                    let _ = handle.emit("theme-updated", theme.css);
                                }
                            }
                        }
                    }
                }) {
                    // Store the watcher so it doesn't get dropped
                    app.manage(Arc::new(Mutex::new(Some(watcher))));
                }
            }

            // If a file path was passed via CLI args, send it to the frontend
            let args: Vec<String> = std::env::args().collect();
            if let Some(file_arg) = args.get(1) {
                if file_arg.ends_with(".md") || file_arg.ends_with(".markdown") {
                    let file_path = file_arg.clone();
                    let handle = app.handle().clone();
                    // Emit after window is ready (slight delay)
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("open-file-arg", file_path);
                    });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
