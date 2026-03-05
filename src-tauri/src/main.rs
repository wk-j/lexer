// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod fs;
mod highlight;
mod markdown;
mod state;

use std::sync::Mutex;
use tauri::Emitter;

fn main() {
    tracing_subscriber::fmt::init();

    let registry = highlight::LanguageRegistry::build();
    let app_state = Mutex::new(state::AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(registry)
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::get_toc,
            commands::get_current_file,
        ])
        .setup(|app| {
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
