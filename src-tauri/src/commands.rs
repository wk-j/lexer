use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::WalkDir;

use crate::config::LexerConfig;
use crate::fs::FileWatcher;
use crate::highlight::LanguageRegistry;
use crate::markdown::{render_markdown, TocEntry};
use crate::state::{AppState, BufferState, LayoutMode};
use crate::theme::{ThemeEngine, ThemeInfo};

// --- Response types ---

#[derive(Debug, Clone, Serialize)]
pub struct RenderedContent {
    pub html: String,
    pub title: String,
    pub toc: Vec<TocEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenFileResult {
    pub buffer_id: u64,
    pub html: String,
    pub title: String,
    pub toc: Vec<TocEntry>,
    pub already_open: bool,
    pub buffers: Vec<BufferInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BufferInfo {
    pub id: u64,
    pub title: String,
    pub file_path: Option<String>,
    pub modified: bool,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BufferContent {
    pub buffer_id: u64,
    pub html: String,
    pub title: String,
    pub toc: Vec<TocEntry>,
    pub scroll_position: f64,
    pub buffers: Vec<BufferInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BufferSwitchResult {
    pub new_active: Option<BufferContent>,
    pub buffers: Vec<BufferInfo>,
}

// --- Helpers ---

fn buffer_info_list(state: &AppState) -> Vec<BufferInfo> {
    state
        .buffers
        .iter()
        .enumerate()
        .map(|(i, b)| BufferInfo {
            id: b.id,
            title: b.title.clone(),
            file_path: b
                .file_path
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned()),
            modified: b.modified,
            active: i == state.active_buffer,
        })
        .collect()
}

fn buffer_content(buf: &BufferState, buffers: Vec<BufferInfo>) -> BufferContent {
    BufferContent {
        buffer_id: buf.id,
        html: buf.html.clone(),
        title: buf.title.clone(),
        toc: buf.toc.clone(),
        scroll_position: buf.scroll_position,
        buffers,
    }
}

// --- Commands ---

#[tauri::command]
pub fn open_file(
    path: String,
    scroll_position: Option<f64>,
    app: AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
    registry: State<'_, Arc<LanguageRegistry>>,
) -> Result<OpenFileResult, String> {
    let (content, canonical) = crate::fs::load_file(&path)?;

    let mut st = state.lock().map_err(|e| e.to_string())?;

    // Save current buffer's scroll position if provided
    if let Some(scroll) = scroll_position {
        let idx = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(idx) {
            buf.scroll_position = scroll;
        }
    }

    // Track in recent files
    st.push_recent(&canonical);

    // Check if this file is already open in a buffer
    if let Some(idx) = st.find_buffer_by_path(&canonical) {
        st.active_buffer = idx;
        let buf = &st.buffers[idx];
        let buffers = buffer_info_list(&st);
        return Ok(OpenFileResult {
            buffer_id: buf.id,
            html: buf.html.clone(),
            title: buf.title.clone(),
            toc: buf.toc.clone(),
            already_open: true,
            buffers,
        });
    }

    // Render markdown
    let title = canonical
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".into());

    let (html, toc, block_sources) = render_markdown(&content, &registry);

    // Create buffer
    let buffer_id = st.alloc_buffer_id();
    let buffer = BufferState {
        id: buffer_id,
        file_path: Some(canonical.clone()),
        title: title.clone(),
        html: html.clone(),
        toc: toc.clone(),
        scroll_position: 0.0,
        modified: false,
        source: content.clone(),
        block_sources: block_sources.clone(),
    };

    st.buffers.push(buffer);
    st.active_buffer = st.buffers.len() - 1;

    // Start file watcher if we don't already have one for this path
    let has_watcher = st.watchers.iter().any(|(p, _, _)| p == &canonical);
    if !has_watcher {
        let watch_path = canonical.clone();
        let handle = app.clone();
        let reg = Arc::clone(&registry);
        let state_clone = Arc::clone(state.inner());
        let watcher = FileWatcher::new(&watch_path, move |path| {
            if let Ok(source) = std::fs::read_to_string(path) {
                let file_title = path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Untitled".into());
                let (rendered_html, rendered_toc, rendered_blocks) = render_markdown(&source, &reg);

                // Update all buffers for this file
                if let Ok(mut st) = state_clone.lock() {
                    let canonical_path =
                        std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
                    let active_idx = st.active_buffer;

                    for (i, buf) in st.buffers.iter_mut().enumerate() {
                        if buf.file_path.as_ref() == Some(&canonical_path) {
                            buf.html = rendered_html.clone();
                            buf.toc = rendered_toc.clone();
                            buf.title = file_title.clone();
                            buf.source = source.clone();
                            buf.block_sources = rendered_blocks.clone();

                            if i == active_idx {
                                // Active buffer: emit file-changed to update content panel
                                let payload = RenderedContent {
                                    html: rendered_html.clone(),
                                    title: file_title.clone(),
                                    toc: rendered_toc.clone(),
                                };
                                let _ = handle.emit("file-changed", payload);
                            } else {
                                // Inactive buffer: mark as modified
                                buf.modified = true;
                                let _ = handle.emit("buffer-modified", buf.id);
                            }
                        }
                    }
                }
            }
        });

        if let Ok(w) = watcher {
            st.watchers.push((canonical.clone(), w, vec![buffer_id]));
        }
    } else {
        // Add buffer_id to existing watcher's buffer list
        if let Some((_, _, ref mut ids)) = st.watchers.iter_mut().find(|(p, _, _)| p == &canonical)
        {
            ids.push(buffer_id);
        }
    }

    let buffers = buffer_info_list(&st);

    Ok(OpenFileResult {
        buffer_id,
        html,
        title,
        toc,
        already_open: false,
        buffers,
    })
}

#[tauri::command]
pub fn close_buffer(
    buffer_id: u64,
    scroll_position: Option<f64>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<BufferSwitchResult, String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;

    // Save current buffer's scroll position
    if let Some(scroll) = scroll_position {
        let active = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(active) {
            buf.scroll_position = scroll;
        }
    }

    // Find the buffer to close
    let idx = st
        .buffers
        .iter()
        .position(|b| b.id == buffer_id)
        .ok_or("Buffer not found")?;

    let removed = st.buffers.remove(idx);

    // Cleanup watcher if needed
    if let Some(ref path) = removed.file_path {
        // Remove buffer_id from watcher's list
        for (_, _, ref mut ids) in st.watchers.iter_mut() {
            ids.retain(|&id| id != buffer_id);
        }
        st.cleanup_watcher(path);
    }

    if st.buffers.is_empty() {
        st.active_buffer = 0;
        let buffers = buffer_info_list(&st);
        return Ok(BufferSwitchResult {
            new_active: None,
            buffers,
        });
    }

    // Adjust active_buffer index
    if idx <= st.active_buffer {
        st.active_buffer = st.active_buffer.saturating_sub(1);
    }
    if st.active_buffer >= st.buffers.len() {
        st.active_buffer = st.buffers.len() - 1;
    }

    let buf = &st.buffers[st.active_buffer];
    let buffers = buffer_info_list(&st);
    let content = buffer_content(buf, buffers.clone());

    Ok(BufferSwitchResult {
        new_active: Some(content),
        buffers,
    })
}

#[tauri::command]
pub fn switch_buffer(
    buffer_id: u64,
    scroll_position: Option<f64>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<BufferContent, String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;

    // Save current buffer's scroll position
    if let Some(scroll) = scroll_position {
        let active = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(active) {
            buf.scroll_position = scroll;
        }
    }

    // Find target buffer
    let idx = st
        .buffers
        .iter()
        .position(|b| b.id == buffer_id)
        .ok_or("Buffer not found")?;

    st.active_buffer = idx;

    // Clear modified flag when switching to it
    st.buffers[idx].modified = false;

    let buf = &st.buffers[idx];
    let buffers = buffer_info_list(&st);
    Ok(buffer_content(buf, buffers))
}

#[tauri::command]
pub fn next_buffer(
    scroll_position: Option<f64>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<BufferContent, String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;

    if st.buffers.is_empty() {
        return Err("No buffers open".into());
    }

    // Save current scroll
    if let Some(scroll) = scroll_position {
        let active = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(active) {
            buf.scroll_position = scroll;
        }
    }

    let len = st.buffers.len();
    st.active_buffer = (st.active_buffer + 1) % len;
    let active = st.active_buffer;
    st.buffers[active].modified = false;

    let buf = &st.buffers[active];
    let buffers = buffer_info_list(&st);
    Ok(buffer_content(buf, buffers))
}

#[tauri::command]
pub fn prev_buffer(
    scroll_position: Option<f64>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<BufferContent, String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;

    if st.buffers.is_empty() {
        return Err("No buffers open".into());
    }

    // Save current scroll
    if let Some(scroll) = scroll_position {
        let active = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(active) {
            buf.scroll_position = scroll;
        }
    }

    if st.active_buffer == 0 {
        st.active_buffer = st.buffers.len() - 1;
    } else {
        st.active_buffer -= 1;
    }
    let active = st.active_buffer;
    st.buffers[active].modified = false;

    let buf = &st.buffers[active];
    let buffers = buffer_info_list(&st);
    Ok(buffer_content(buf, buffers))
}

#[tauri::command]
pub fn list_buffers(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<BufferInfo>, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    Ok(buffer_info_list(&st))
}

#[tauri::command]
pub fn save_scroll(scroll: f64, state: State<'_, Arc<Mutex<AppState>>>) -> Result<(), String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;
    let active = st.active_buffer;
    if let Some(buf) = st.buffers.get_mut(active) {
        buf.scroll_position = scroll;
    }
    Ok(())
}

#[tauri::command]
pub fn close_other_buffers(
    scroll_position: Option<f64>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<BufferContent, String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;

    if st.buffers.is_empty() {
        return Err("No buffers open".into());
    }

    // Save current scroll
    if let Some(scroll) = scroll_position {
        let active = st.active_buffer;
        if let Some(buf) = st.buffers.get_mut(active) {
            buf.scroll_position = scroll;
        }
    }

    let active = st.active_buffer;
    let active_id = st.buffers[active].id;

    // Collect paths of buffers being closed for watcher cleanup
    let paths_to_check: Vec<PathBuf> = st
        .buffers
        .iter()
        .filter(|b| b.id != active_id)
        .filter_map(|b| b.file_path.clone())
        .collect();

    let closed_ids: Vec<u64> = st
        .buffers
        .iter()
        .filter(|b| b.id != active_id)
        .map(|b| b.id)
        .collect();

    // Keep only the active buffer
    st.buffers.retain(|b| b.id == active_id);
    st.active_buffer = 0;

    // Remove closed buffer IDs from watchers
    for (_, _, ref mut ids) in st.watchers.iter_mut() {
        ids.retain(|id| !closed_ids.contains(id));
    }

    // Cleanup watchers for removed paths
    for path in &paths_to_check {
        st.cleanup_watcher(path);
    }

    let buf = &st.buffers[0];
    let buffers = buffer_info_list(&st);
    Ok(buffer_content(buf, buffers))
}

// --- Block Select: get source for selected blocks ---

#[tauri::command]
pub fn get_block_sources(
    indices: Vec<usize>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    let buf = st.active_buffer().ok_or("No buffer open")?;

    let mut parts: Vec<&str> = Vec::new();
    for &idx in &indices {
        if let Some(block) = buf.block_sources.iter().find(|b| b.index == idx) {
            if block.end <= buf.source.len() {
                parts.push(&buf.source[block.start..block.end]);
            }
        }
    }

    Ok(parts.join("\n\n"))
}

// --- Existing commands (updated) ---

#[tauri::command]
pub fn get_toc(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<TocEntry>, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    let buf = st.active_buffer().ok_or("No buffer open")?;
    Ok(buf.toc.clone())
}

#[tauri::command]
pub fn get_current_file(state: State<'_, Arc<Mutex<AppState>>>) -> Option<String> {
    let st = state.lock().ok()?;
    st.active_buffer()
        .and_then(|b| b.file_path.as_ref())
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

// --- Recent files ---

#[tauri::command]
pub fn get_recent_files(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<String>, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    Ok(st
        .recent_files
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect())
}

// --- Working directory ---

/// Return the process working directory (where `lexer` was launched from).
#[tauri::command]
pub fn get_working_directory() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

// --- Theme commands ---

#[tauri::command]
pub fn list_themes(
    theme_engine: State<'_, Arc<Mutex<ThemeEngine>>>,
) -> Result<Vec<ThemeInfo>, String> {
    let engine = theme_engine.lock().map_err(|e| e.to_string())?;
    Ok(engine.list_themes())
}

#[derive(Debug, Clone, Serialize)]
pub struct ThemeResult {
    pub name: String,
    pub css: String,
}

#[tauri::command]
pub fn load_theme(
    name: String,
    theme_engine: State<'_, Arc<Mutex<ThemeEngine>>>,
) -> Result<ThemeResult, String> {
    let mut engine = theme_engine.lock().map_err(|e| e.to_string())?;
    let theme = engine.load_theme(&name)?;
    engine.active_theme = name.clone();

    // Persist selected theme to config file
    LexerConfig::set_field("appearance", "theme", &name);

    Ok(ThemeResult {
        name: theme.meta.name,
        css: theme.css,
    })
}

#[tauri::command]
pub fn get_active_theme(
    theme_engine: State<'_, Arc<Mutex<ThemeEngine>>>,
) -> Result<String, String> {
    let engine = theme_engine.lock().map_err(|e| e.to_string())?;
    Ok(engine.active_theme.clone())
}

// --- Layout commands ---

#[tauri::command]
pub fn set_layout(
    layout: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let mode = match layout.as_str() {
        "default" => LayoutMode::Default,
        "focus" => LayoutMode::Focus,
        "zen" => LayoutMode::Zen,
        "split" => LayoutMode::Split,
        _ => return Err(format!("Unknown layout: {}", layout)),
    };
    let mut st = state.lock().map_err(|e| e.to_string())?;
    st.layout = mode;
    Ok(layout)
}

#[tauri::command]
pub fn get_layout(state: State<'_, Arc<Mutex<AppState>>>) -> Result<String, String> {
    let st = state.lock().map_err(|e| e.to_string())?;
    Ok(st.layout.as_str().to_string())
}

// --- Multi-window commands ---

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub id: String,
    pub title: String,
}

#[tauri::command]
pub fn new_window(app: AppHandle, path: Option<String>) -> Result<String, String> {
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;

    let id = format!(
        "win-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let title = path.as_deref().unwrap_or("Lexer");

    let _window = WebviewWindowBuilder::new(&app, &id, WebviewUrl::default())
        .title(title)
        .inner_size(960.0, 720.0)
        .transparent(true)
        .hidden_title(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .build()
        .map_err(|e| e.to_string())?;

    // If a file path was provided, tell the new window to open it
    if let Some(file_path) = path {
        let handle = app.clone();
        let window_id = id.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = handle.emit_to(&window_id, "open-file-arg", file_path);
        });
    }

    Ok(id)
}

#[tauri::command]
pub fn list_windows(app: AppHandle) -> Vec<WindowInfo> {
    let windows = app.webview_windows();
    windows
        .iter()
        .map(|(label, win)| {
            let title = win.title().unwrap_or_else(|_| "Lexer".into());
            WindowInfo {
                id: label.clone(),
                title,
            }
        })
        .collect()
}

#[tauri::command]
pub fn focus_window(app: AppHandle, window_id: String) -> Result<(), String> {
    let win: tauri::WebviewWindow = app
        .get_webview_window(&window_id)
        .ok_or_else(|| format!("Window not found: {}", window_id))?;
    win.set_focus().map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}
