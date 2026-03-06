# AI Agent Integration

Lexer integrates with AI coding agents through the **`;` leader key** (AI actions). Currently supported targets:

- **OpenCode** — via HTTP API to a local instance (auto-discovered)
- **Claude Desktop** — via `claude://` deep link protocol

The `;` key works from normal mode without any selection. With block select, the same prompt dialog is available through the agent sub-mode (`Enter` → `o`/`c`).

## OpenCode

Lexer integrates with [OpenCode](https://github.com/nicholasgriffintn/opencode) to send prompts to a running AI coding agent. The integration is fully automatic — Lexer discovers a running OpenCode instance in the same working directory, with no manual configuration required.

## Overview

```
Lexer (viewer)                          OpenCode (AI agent)
┌──────────────┐                        ┌──────────────────┐
│  ;o → prompt │  HTTP POST /tui/publish│  TUI running on  │
│  dialog      │ ───────────────────▶   │  --port 4096     │
│              │                        │                  │
│  /Users/wk/  │  GET /path (discovery) │  same CWD as     │
│  Source/proj  │ ◀─────────────────    │  Lexer launch    │
└──────────────┘                        └──────────────────┘
```

The user presses `;o` from normal mode (or `Enter` → `o` from block select) and a **prompt dialog** appears. The user composes their prompt, optionally using placeholder tokens like `@selection` and `@path`. On submit, Lexer expands the placeholders and sends the final prompt to OpenCode.

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

OpenCode actions are accessed two ways: the **`;` leader key** (from normal mode, no selection required) and the **agent sub-mode** (from block select, with selection context).

### `;` Leader Key (AI Actions)

Pressing `;` in **normal mode** enters the AI action sub-mode. This works even without a selection — the user can send prompts about the current file, ask questions, or include the entire file as context.

| Key | Action | Delivery |
|---|---|---|
| `;` | Enter AI action mode (which-key shows available actions) | — |
| `;o` | Open prompt dialog → send to OpenCode | HTTP POST `/tui/publish` |
| `;c` | Open prompt dialog → send to Claude | `claude://context?text=...` deep link |

The `;` leader works like `g` or `Space` — it shows a which-key popup and waits for a follow-up key.

### Claude Delivery

`;c` uses the same prompt dialog as `;o`. After placeholder expansion, the prompt is sent to Claude Desktop via the `claude://` deep link protocol:

```
claude://context?text=<url-encoded prompt>
```

If Claude Desktop is not installed (deep link fails), Lexer copies the expanded prompt to the clipboard and shows a toast: `Claude not found — copied to clipboard`.

### From Block Select

When blocks are selected, the same prompt dialog is available via the agent sub-mode:

| Key | Context | Action |
|---|---|---|
| `Enter` → `o` | Agent sub-mode | Open prompt dialog for OpenCode (with selection) |
| `Enter` → `c` | Agent sub-mode | Open prompt dialog for Claude (with selection) |

### Prompt Dialog

Both `;o`/`;c` (normal mode) and agent `o`/`c` (select mode) open the same prompt dialog. The dialog input is pre-populated differently depending on context:

- **With selection** (from select mode): pre-populated with `@selection`
- **Without selection** (from `;` leader): empty input, user types freely

The user can type free-form text using placeholder tokens to reference context:

| Placeholder | Expands to |
|---|---|
| `@selection` | A context block containing the file path, block range, and the selected Markdown source. Empty string if nothing selected. |
| `@path` | The relative path of the current file |

`@selection` automatically includes the source path so the AI agent knows where the content comes from. It expands to:
```
[context: <relative-path> blocks <range>]

<markdown source>
```

For example, selecting blocks 3-7 in `docs/17-opencode.md` expands `@selection` to:
```
[context: docs/17-opencode.md blocks 3-7]

## Architecture

The system uses a modular design...
```

**Dialog behavior:**
- `Enter` — submit the prompt (expand placeholders, send to OpenCode)
- `Escape` — cancel and return to previous mode
- The input supports free-form text around the placeholders

**Example inputs (with selection):**
```
Refactor this code: @selection
```
```
@selection
```

**Example inputs (without selection, via `;o`):**
```
Explain the architecture of @path
```
```
What does this file do?
```
```
Fix the bug in the render function
```

If the user submits with just `@selection` and blocks are selected, the selected markdown is sent as the entire prompt. If `@selection` is used but nothing is selected, it expands to an empty string.

### Placeholder Expansion

Before sending, Lexer replaces placeholders in the user's prompt:

1. `@selection` → context header + Markdown source from selected blocks (empty string if none selected)
2. `@path` → relative file path (e.g., `docs/17-opencode.md`)

If a placeholder appears multiple times, each occurrence is expanded. Unknown `@` tokens are left as-is.

### Prompt Format (sent to OpenCode)

The expanded prompt is sent directly as the `text` value in the `tui.prompt.append` call.

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

Send an already-expanded prompt to the discovered OpenCode instance. Placeholder expansion (`@selection`, `@path`) happens on the frontend before calling this command.

```rust
#[tauri::command]
pub async fn send_to_opencode(
    prompt: String,
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
2. `POST /tui/publish` with `tui.prompt.append` using the expanded prompt
3. `POST /tui/publish` with `tui.command.execute` → `prompt.submit`
4. Return success/failure

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

### Quick prompt from normal mode (no selection)

```
;        → AI action mode (which-key shows: o=OpenCode, c=Claude)
o        → prompt dialog appears (empty input)
           user types: "Explain the architecture of this file"
Enter    → sends to OpenCode
```

Toast: `Sent to OpenCode ✓`

### Ask about current file

```
;o       → prompt dialog appears
           user types: "What does @path do?"
Enter    → expands @path, sends to OpenCode
```

### Send a code block with instructions

```
v        → enter select mode (cursor on code block)
Enter    → agent menu
o        → prompt dialog appears (pre-filled: @selection)
           user edits: "Refactor this: @selection"
Enter    → expands @selection, sends to OpenCode
```

Toast: `Sent to OpenCode ✓`

### Send selection as-is

```
v        → enter select mode
j j j    → expand selection down 3 blocks
Enter    → agent menu
o        → prompt dialog appears (pre-filled: @selection)
Enter    → sends the raw selection to OpenCode
```

Toast: `Sent to OpenCode ✓`

### Cancel without sending

```
;o       → prompt dialog appears
Escape   → cancel, return to normal mode (nothing sent)
```

### OpenCode not running

```
;o       → prompt dialog appears
           user types: "Fix the bug"
Enter    → attempts to send
```

Toast: `No OpenCode instance found. Start with: opencode --port <N>`
