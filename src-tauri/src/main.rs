// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod fs;
mod highlight;
mod markdown;
mod state;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

fn main() {
    tracing_subscriber::fmt::init();

    let registry = Arc::new(highlight::LanguageRegistry::build());
    let app_state = Arc::new(Mutex::new(state::AppState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(registry)
        .manage(app_state)
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
        ])
        .setup(|app| {
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
