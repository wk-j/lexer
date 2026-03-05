use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;

use crate::fs::FileWatcher;
use crate::highlight::LanguageRegistry;
use crate::markdown::{render_markdown, TocEntry};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct RenderedContent {
    pub html: String,
    pub title: String,
    pub toc: Vec<TocEntry>,
}

#[tauri::command]
pub fn open_file(
    path: String,
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    registry: State<'_, Arc<LanguageRegistry>>,
) -> Result<RenderedContent, String> {
    let (content, canonical) = crate::fs::load_file(&path)?;

    let title = canonical
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".into());

    let (html, toc) = render_markdown(&content, &registry);

    // Start file watcher for live reload
    let watcher = {
        let watch_path = canonical.clone();
        let handle = app.clone();
        let reg = Arc::clone(&registry);
        FileWatcher::new(&watch_path, move |path| {
            if let Ok(source) = std::fs::read_to_string(path) {
                let file_title = path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Untitled".into());
                let (rendered_html, rendered_toc) = render_markdown(&source, &reg);
                let payload = RenderedContent {
                    html: rendered_html,
                    title: file_title,
                    toc: rendered_toc,
                };
                let _ = handle.emit("file-changed", payload);
            }
        })
    };

    // Update app state (drops old watcher, stopping it)
    {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.current_file = Some(canonical);
        st.watcher = watcher.ok();
    }

    Ok(RenderedContent { html, title, toc })
}

#[tauri::command]
pub fn get_toc(
    state: State<'_, Mutex<AppState>>,
    registry: State<'_, Arc<LanguageRegistry>>,
) -> Result<Vec<TocEntry>, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    let path = st.current_file.as_ref().ok_or("No file open")?;

    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let (_, toc) = render_markdown(&content, &registry);
    Ok(toc)
}

#[tauri::command]
pub fn get_current_file(state: State<'_, Mutex<AppState>>) -> Option<String> {
    let st = state.lock().ok()?;
    st.current_file
        .as_ref()
        .map(|p| p.to_string_lossy().into_owned())
}

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub modified: u64,
    pub size: u64,
}

#[tauri::command]
pub fn scan_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let root = std::path::Path::new(&path);
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map_or(false, |ext| ext == "md" || ext == "markdown")
        })
    {
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(FileEntry {
            path: entry
                .path()
                .strip_prefix(root)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .into_owned(),
            name: entry.file_name().to_string_lossy().into_owned(),
            modified: meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_secs()),
            size: meta.len(),
        });
    }
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}
