use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;

/// Watches a single file for modifications and fires a debounced callback.
/// Dropping the `FileWatcher` stops watching (the sender is dropped, which
/// causes the debounce thread's `recv()` to return `Err` and exit).
pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

impl FileWatcher {
    /// Create a file watcher that calls `on_change` when the file is modified.
    /// The callback is invoked on a background thread with 300ms debounce.
    pub fn new<F>(path: &Path, on_change: F) -> Result<Self, String>
    where
        F: Fn(&Path) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<()>();
        let watched_path = path.to_path_buf();
        let callback_path = path.to_path_buf();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    if event.kind.is_modify() {
                        let _ = tx.send(());
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher
            .watch(&watched_path, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch {}: {}", watched_path.display(), e))?;

        // Debounce thread: coalesce rapid events, fire callback at most once per 300ms
        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                std::thread::sleep(Duration::from_millis(300));
                while rx.try_recv().is_ok() {}
                on_change(&callback_path);
            }
        });

        Ok(Self { _watcher: watcher })
    }
}
