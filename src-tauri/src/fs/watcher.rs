use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

#[allow(dead_code)]
pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    pub rx: mpsc::Receiver<PathBuf>,
}

#[allow(dead_code)]
impl FileWatcher {
    pub fn new(path: &Path) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        let watched_path = path.to_path_buf();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    if event.kind.is_modify() {
                        let _ = tx.send(watched_path.clone());
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch {}: {}", path.display(), e))?;

        Ok(Self {
            _watcher: watcher,
            rx,
        })
    }
}
