mod loader;
mod watcher;

pub use loader::load_file;
// Will be used when file watching is integrated
#[allow(unused_imports)]
pub use loader::resolve_path;
#[allow(unused_imports)]
pub use watcher::FileWatcher;
