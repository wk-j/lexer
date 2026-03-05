use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

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
    state: State<'_, Mutex<AppState>>,
    registry: State<'_, LanguageRegistry>,
) -> Result<RenderedContent, String> {
    let (content, canonical) = crate::fs::load_file(&path)?;

    let title = canonical
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".into());

    let (html, toc) = render_markdown(&content, &registry);

    // Update app state
    {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.current_file = Some(canonical);
    }

    Ok(RenderedContent { html, title, toc })
}

#[tauri::command]
pub fn get_toc(
    state: State<'_, Mutex<AppState>>,
    registry: State<'_, LanguageRegistry>,
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
