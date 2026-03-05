use std::path::{Path, PathBuf};

/// Read file contents, returning (content, canonical_path)
pub fn load_file(path: &str) -> Result<(String, PathBuf), String> {
    let path = resolve_path(path)?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    Ok((content, path))
}

/// Resolve a path string to an absolute canonical path
pub fn resolve_path(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    let absolute = if p.is_absolute() {
        p.to_path_buf()
    } else {
        std::env::current_dir().map_err(|e| e.to_string())?.join(p)
    };
    absolute
        .canonicalize()
        .map_err(|e| format!("Cannot resolve path {}: {}", path, e))
}
