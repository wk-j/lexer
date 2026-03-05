use std::path::PathBuf;

pub struct AppState {
    pub current_file: Option<PathBuf>,
}

impl AppState {
    pub fn new() -> Self {
        Self { current_file: None }
    }
}
