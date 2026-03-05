use std::path::PathBuf;

use crate::fs::FileWatcher;

pub struct AppState {
    pub current_file: Option<PathBuf>,
    pub watcher: Option<FileWatcher>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            current_file: None,
            watcher: None,
        }
    }
}
