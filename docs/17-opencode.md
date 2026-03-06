# OpenCode Integration

Lexer integrates with [OpenCode](https://github.com/nicholasgriffintn/opencode) to send selected Markdown content as prompts to a running AI coding agent. The integration is fully automatic — Lexer discovers a running OpenCode instance in the same working directory, with no manual configuration required.

## Overview

```
Lexer (viewer)                          OpenCode (AI agent)
┌──────────────┐                        ┌──────────────────┐
│ Block Select │                        │  TUI running on  │
│   v → select │  HTTP POST /tui/publish│  --port 4096     │
│   o → send   │ ───────────────────▶   │                  │
│              │                        │  same CWD as     │
│  /Users/wk/  │  GET /path (discovery) │  Lexer launch    │
│  Source/proj  │ ◀─────────────────    │  /Users/wk/      │
└──────────────┘                        │  Source/proj      │
                                        └──────────────────┘
```

The user selects blocks in Lexer, presses `o` (or `Enter` → `o` in agent sub-mode), and the selected Markdown is sent as a prompt to OpenCode. OpenCode receives it as if the user typed it directly into its TUI input.

## Discovery

Lexer auto-discovers OpenCode by scanning running processes. No port configuration is needed.

### Discovery Flow

```
1. Scan all processes (sysinfo crate)
2. Filter to processes whose command line contains "opencode" AND "--port"
3. Extract port from --port <N> or --port=<N>
4. For each candidate:
   a. GET http://localhost:<port>/path → get server's working directory
   b. Compare server CWD with Lexer's CWD (bidirectional prefix match)
   c. First match wins
```

### Working Directory Matching

The match is bidirectional after `canonicalize()`:

```rust
our_cwd.starts_with(&server_cwd) || server_cwd.starts_with(&our_cwd)
```

This means:
- Lexer launched from `/Users/wk/Source/project` matches OpenCode at `/Users/wk/Source/project`
- Lexer at `/Users/wk/Source/project/docs` matches OpenCode at `/Users/wk/Source/project` (subdirectory)
- Lexer at `/Users/wk/Source/project` matches OpenCode at `/Users/wk/Source/project/src` (parent)
- Symlinks are resolved before comparison

### Discovery Caching

Discovery runs **once** at the time of the first send action, not on app startup. The result is cached in `AppState` for subsequent sends. If the cached server becomes unreachable, discovery runs again on the next attempt.

```rust
pub struct OpenCodeConnection {
    pub port: u16,
    pub pid: u32,
    pub server_cwd: PathBuf,
}
```

### Discovery Errors

| Condition | User-visible behavior |
|---|---|
| No `opencode` processes found | Toast: `No OpenCode instance found. Start with: opencode --port <N>` |
| OpenCode found but CWD doesn't match | Toast: `No OpenCode instance for this directory` |
| OpenCode found but HTTP unreachable | Toast: `OpenCode not responding on port <N>` |
| Port extracted but server returns error | Toast: `OpenCode connection failed: <error>` |

## OpenCode HTTP API

All requests go to `http://localhost:<port>` with no authentication.

### GET /path

Validate server and get its working directory.

**Response:**
```json
{
  "directory": "/Users/wk/Source/project",
  "worktree": "/Users/wk/Source/project"
}
```

Fields are `Option<String>`. Lexer uses `directory` first, falls back to `worktree`.

### POST /tui/publish

Send events to the OpenCode TUI. Used for both injecting prompt text and triggering submission.

**Step 1 — Append prompt text:**
```json
{
  "type": "tui.prompt.append",
  "properties": {
    "text": "the prompt content here"
  }
}
```

**Step 2 — Submit the prompt:**
```json
{
  "type": "tui.command.execute",
  "properties": {
    "command": "prompt.submit"
  }
}
```

Both steps are sequential — step 2 fires only after step 1 succeeds. A 5-second timeout applies to each request.

## Keyboard Integration

OpenCode send is wired into the Block Select agent sub-mode.

### From Block Select

| Key | Context | Action |
|---|---|---|
| `o` | Select mode | Send selection to OpenCode (direct) |
| `Enter` → `o` | Agent sub-mode | Send selection to OpenCode (via menu) |

The `o` key is reused from the existing agent sub-mode (previously "open in Claude"). The action is renamed to "send to OpenCode" since it's the more practical integration.

### Prompt Format

When sending to OpenCode, the selected blocks are extracted as original Markdown source (via `get_block_sources`) and sent as the prompt text. The prompt is prefixed with a context header:

```
[context: path/to/file.md blocks 3-7]

## Architecture

The system uses a modular design with three layers...

```rust
fn main() {
    let app = App::new();
    app.run();
}
```
```

The context header helps the AI agent understand where the content comes from. The format is:
```
[context: <relative-path> blocks <range>]
\n
<markdown content>
```

### Status Indicator

When an OpenCode instance is detected, the status bar shows a small indicator:

```
 NOR  ●  readme.md                              OC ✓
```

`OC ✓` means a matching OpenCode instance was found. `OC ✗` means no connection (shown only after a failed send attempt, not on startup).

## Tauri Commands

### `discover_opencode`

Scan for a running OpenCode instance matching the current working directory.

```rust
#[tauri::command]
pub fn discover_opencode() -> Result<OpenCodeStatus, String>

#[derive(Serialize)]
pub struct OpenCodeStatus {
    pub connected: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
    pub server_cwd: Option<String>,
    pub error: Option<String>,
}
```

Called lazily on first send, or explicitly via a status check command.

### `send_to_opencode`

Send a prompt to the discovered OpenCode instance.

```rust
#[tauri::command]
pub async fn send_to_opencode(
    content: String,
    source: Option<String>,
    blocks: Option<Vec<usize>>,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<OpenCodeSendResult, String>

#[derive(Serialize)]
pub struct OpenCodeSendResult {
    pub success: bool,
    pub message: String,
}
```

Flow:
1. If no cached connection, run discovery
2. Format prompt with context header
3. `POST /tui/publish` with `tui.prompt.append`
4. `POST /tui/publish` with `tui.command.execute` → `prompt.submit`
5. Return success/failure

If the cached connection fails (server went away), clear the cache and retry discovery once.

## Dependencies

```toml
# Cargo.toml additions
sysinfo = "0.30"       # Process scanning for discovery
reqwest = { version = "0.12", features = ["json"] }  # HTTP client
```

`sysinfo` is used only for process discovery. `reqwest` handles all HTTP communication. Both are async-compatible.

Note: Tauri already includes a Tokio runtime, so async HTTP requests work naturally inside `#[tauri::command]` handlers marked `async`.

## State

```rust
// Added to AppState or as separate managed state
pub struct OpenCodeState {
    pub connection: Option<OpenCodeConnection>,
    pub last_error: Option<String>,
}

pub struct OpenCodeConnection {
    pub port: u16,
    pub pid: u32,
    pub server_cwd: PathBuf,
    pub client: reqwest::Client,  // reused across requests
}
```

The `reqwest::Client` is created once and reused (connection pooling). The connection is cleared if a send fails, triggering rediscovery on next attempt.

## Configuration

OpenCode integration works without configuration. Optional overrides in `~/.config/lexer/config.toml`:

```toml
[opencode]
# Override auto-discovery with a fixed port
port = 4096

# Disable OpenCode integration entirely
enabled = true

# Custom prompt prefix format (default shown)
prompt_prefix = "[context: {path} blocks {blocks}]"
```

All fields are optional. When `port` is set, discovery skips process scanning and validates the specified port directly.

## Implementation Notes

### Process Scanning

`sysinfo::System::new_all()` is expensive (~50-100ms). It should be called lazily (on first send) and the result cached. Don't call it on app startup or in a hot path.

### HTTP Timeout

Use a 5-second timeout for all OpenCode HTTP requests. If the server is unresponsive, fail fast and show a toast rather than blocking the UI.

### Async Commands

`send_to_opencode` must be `async` because it makes HTTP requests. Tauri v2 supports async commands natively — the command runs on the async runtime and the frontend `invoke()` returns a Promise.

### Error Recovery

If a send fails due to connection error:
1. Clear the cached connection
2. Show toast with error message
3. On next send attempt, rediscovery runs automatically

The user never needs to manually reconnect or restart.

### Prompt Size

OpenCode's TUI input accepts arbitrary-length text via `tui.prompt.append`. There is no known size limit, but very large selections (>100KB) should show a confirmation toast before sending.

## Examples

### Send a code block to OpenCode

```
v        → enter select mode (cursor on code block)
o        → send to OpenCode
```

Toast: `Sent to OpenCode ✓`

### Send multiple blocks as context

```
v        → enter select mode
j j j    → expand selection down 3 blocks
Enter    → agent menu
o        → send to OpenCode
```

Toast: `Sent 4 blocks to OpenCode ✓`

### OpenCode not running

```
v        → enter select mode
o        → attempt send
```

Toast: `No OpenCode instance found. Start with: opencode --port <N>`
