use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::fs::FileWatcher;
use crate::markdown::TocEntry;

#[derive(Debug, Clone, Serialize)]
pub struct BufferState {
    pub id: u64,
    pub file_path: Option<PathBuf>,
    pub title: String,
    pub html: String,
    pub toc: Vec<TocEntry>,
    pub scroll_position: f64,
    pub modified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LayoutMode {
    #[serde(rename = "default")]
    Default,
    #[serde(rename = "focus")]
    Focus,
    #[serde(rename = "zen")]
    Zen,
    #[serde(rename = "split")]
    Split,
}

impl LayoutMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::Focus => "focus",
            Self::Zen => "zen",
            Self::Split => "split",
        }
    }
}

pub struct AppState {
    pub buffers: Vec<BufferState>,
    pub active_buffer: usize,
    pub next_buffer_id: u64,
    pub layout: LayoutMode,
    /// File watchers keyed by canonical path. Each entry tracks which buffer IDs use it.
    pub watchers: Vec<(PathBuf, FileWatcher, Vec<u64>)>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            buffers: Vec::new(),
            active_buffer: 0,
            next_buffer_id: 1,
            layout: LayoutMode::Default,
            watchers: Vec::new(),
        }
    }

    pub fn alloc_buffer_id(&mut self) -> u64 {
        let id = self.next_buffer_id;
        self.next_buffer_id += 1;
        id
    }

    /// Find a buffer by file path (canonical). Returns index if found.
    pub fn find_buffer_by_path(&self, path: &PathBuf) -> Option<usize> {
        self.buffers
            .iter()
            .position(|b| b.file_path.as_ref() == Some(path))
    }

    /// Get the active buffer, if any.
    pub fn active_buffer(&self) -> Option<&BufferState> {
        self.buffers.get(self.active_buffer)
    }

    /// Remove watcher for a path if no buffers reference it anymore.
    pub fn cleanup_watcher(&mut self, path: &PathBuf) {
        // Check if any buffer still uses this path
        let still_used = self
            .buffers
            .iter()
            .any(|b| b.file_path.as_ref() == Some(path));
        if !still_used {
            self.watchers.retain(|(p, _, _)| p != path);
        }
    }
}
