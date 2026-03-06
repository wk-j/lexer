use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use sysinfo::System;

/// Cached connection to a discovered OpenCode instance.
pub struct OpenCodeConnection {
    pub port: u16,
    pub pid: u32,
    pub server_cwd: PathBuf,
    pub client: reqwest::Client,
}

/// Mutable state for OpenCode integration.
pub struct OpenCodeState {
    pub connection: Option<OpenCodeConnection>,
    pub last_error: Option<String>,
}

impl OpenCodeState {
    pub fn new() -> Self {
        Self {
            connection: None,
            last_error: None,
        }
    }
}

/// Status returned from discovery.
#[derive(Debug, Clone, Serialize)]
pub struct OpenCodeStatus {
    pub connected: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
    pub server_cwd: Option<String>,
    pub error: Option<String>,
}

/// Result of sending a prompt.
#[derive(Debug, Clone, Serialize)]
pub struct OpenCodeSendResult {
    pub success: bool,
    pub message: String,
}

/// Response from GET /path on the OpenCode server.
#[derive(Debug, Deserialize)]
struct PathResponse {
    directory: Option<String>,
    worktree: Option<String>,
}

/// Discover a running OpenCode instance whose CWD matches ours.
///
/// Scans running processes for "opencode" with "--port", extracts the port,
/// then validates via GET /path and compares working directories.
pub async fn discover(our_cwd: &Path) -> Result<OpenCodeConnection, String> {
    let our_cwd = our_cwd
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize CWD: {}", e))?;

    // Scan processes for opencode instances with --port
    // NOTE: System::new_all() is required to populate command-line arguments;
    // System::new() + refresh_processes() does NOT load cmd args.
    let sys = System::new_all();

    let mut candidates: Vec<(u16, u32)> = Vec::new();

    for (pid, process) in sys.processes() {
        let cmd = process.cmd();
        let cmd_str = cmd.join(" ");

        if !cmd_str.contains("opencode") || !cmd_str.contains("--port") {
            continue;
        }

        // Extract port from --port <N> or --port=<N>
        if let Some(port) = extract_port(cmd) {
            candidates.push((port, pid.as_u32()));
        }
    }

    if candidates.is_empty() {
        return Err("No OpenCode instance found. Start with: opencode --port <N>".to_string());
    }

    // Build a client with timeout for discovery
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Try each candidate
    for (port, pid) in &candidates {
        let url = format!("http://localhost:{}/path", port);
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.json::<PathResponse>().await {
                    let server_dir = body
                        .directory
                        .or(body.worktree)
                        .ok_or("OpenCode returned no directory")?;
                    let server_cwd = PathBuf::from(&server_dir)
                        .canonicalize()
                        .unwrap_or_else(|_| PathBuf::from(&server_dir));

                    // Bidirectional prefix match
                    if our_cwd.starts_with(&server_cwd) || server_cwd.starts_with(&our_cwd) {
                        return Ok(OpenCodeConnection {
                            port: *port,
                            pid: *pid,
                            server_cwd,
                            client,
                        });
                    }
                }
            }
            Ok(resp) => {
                tracing::warn!(
                    "OpenCode on port {} returned status {}",
                    port,
                    resp.status()
                );
            }
            Err(e) => {
                tracing::warn!("OpenCode on port {} unreachable: {}", port, e);
            }
        }
    }

    Err("No OpenCode instance for this directory".to_string())
}

/// Send an already-expanded prompt to an OpenCode instance.
///
/// Step 1: POST /tui/publish with tui.prompt.append
/// Step 2: POST /tui/publish with tui.command.execute → prompt.submit
pub async fn send_prompt(conn: &OpenCodeConnection, prompt: &str) -> Result<(), String> {
    let url = format!("http://localhost:{}/tui/publish", conn.port);

    // Step 1: Append prompt text
    let append_body = serde_json::json!({
        "type": "tui.prompt.append",
        "properties": {
            "text": prompt
        }
    });
    conn.client
        .post(&url)
        .json(&append_body)
        .send()
        .await
        .map_err(|e| format!("Failed to append prompt: {}", e))?
        .error_for_status()
        .map_err(|e| format!("OpenCode rejected prompt: {}", e))?;

    // Step 2: Submit the prompt
    let submit_body = serde_json::json!({
        "type": "tui.command.execute",
        "properties": {
            "command": "prompt.submit"
        }
    });
    conn.client
        .post(&url)
        .json(&submit_body)
        .send()
        .await
        .map_err(|e| format!("Failed to submit prompt: {}", e))?
        .error_for_status()
        .map_err(|e| format!("OpenCode rejected submit: {}", e))?;

    Ok(())
}

/// Extract a port number from a process command line containing --port.
fn extract_port(cmd: &[String]) -> Option<u16> {
    for (i, arg) in cmd.iter().enumerate() {
        // --port=<N>
        if let Some(val) = arg.strip_prefix("--port=") {
            return val.parse::<u16>().ok();
        }
        // --port <N>
        if arg == "--port" {
            if let Some(next) = cmd.get(i + 1) {
                return next.parse::<u16>().ok();
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_port_equals() {
        let cmd: Vec<String> = vec!["opencode".into(), "--port=4096".into()];
        assert_eq!(extract_port(&cmd), Some(4096));
    }

    #[test]
    fn test_extract_port_space() {
        let cmd: Vec<String> = vec!["opencode".into(), "--port".into(), "8080".into()];
        assert_eq!(extract_port(&cmd), Some(8080));
    }

    #[test]
    fn test_extract_port_none() {
        let cmd: Vec<String> = vec!["opencode".into(), "--verbose".into()];
        assert_eq!(extract_port(&cmd), None);
    }
}
