# Custom Commands

User-defined shell commands configured in `config.toml`. Each command appears in the command palette and can reference the current file, selection, and other context through placeholder variables.

## Configuration

Custom commands are defined in the `[[commands]]` array in `~/.config/lexer/config.toml`:

```toml
[[commands]]
name = "Open in GitHub"
command = "gh browse {file}"

[[commands]]
name = "Blame in GitHub"
command = "gh browse {file} --blame"

[[commands]]
name = "Copy GitHub URL"
command = "gh browse {file} --no-browser"
output = "clipboard"

[[commands]]
name = "Open in VS Code"
command = "code {file_absolute}"

[[commands]]
name = "Reveal in Finder"
command = "open -R {file_absolute}"

[[commands]]
name = "Format with Prettier"
command = "prettier --write {file_absolute}"

[[commands]]
name = "Word count"
command = "wc -w {file_absolute}"
output = "toast"

[[commands]]
name = "Grep TODOs"
command = "rg TODO {dir}"
output = "toast"
```

### Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | yes | string | Display name shown in the command palette |
| `command` | yes | string | Shell command with placeholder variables |
| `output` | no | string | What to do with stdout: `"ignore"` (default), `"toast"`, `"clipboard"` |
| `confirm` | no | bool | Show confirmation before running (default: `false`) |
| `working_dir` | no | string | Override working directory (supports placeholders, default: Lexer's CWD) |
| `shell` | no | string | Shell to use (default: `"sh"` on Unix, `"cmd"` on Windows) |

## Placeholder Variables

Placeholders use `{name}` syntax inside the `command` string. They are expanded before execution.

| Placeholder | Description | Example Value |
|---|---|---|
| `{file}` | Relative path of the current file from CWD | `docs/18-custom-commands.md` |
| `{file_absolute}` | Absolute path of the current file | `/Users/wk/Source/lexer/docs/18-custom-commands.md` |
| `{file_name}` | File name without directory | `18-custom-commands.md` |
| `{file_stem}` | File name without extension | `18-custom-commands` |
| `{file_ext}` | File extension | `md` |
| `{dir}` | Directory containing the current file (relative) | `docs` |
| `{dir_absolute}` | Directory containing the current file (absolute) | `/Users/wk/Source/lexer/docs` |
| `{cwd}` | Lexer's working directory (absolute) | `/Users/wk/Source/lexer` |
| `{line}` | Current heading/scroll position (best-effort line number) | `42` |
| `{selection}` | Selected block source text (empty if none selected) | `## Overview\n\nSome text...` |
| `{clipboard}` | Current system clipboard text content | *(clipboard contents)* |

### Placeholder Rules

- Unknown placeholders are left as-is (e.g., `{unknown}` stays literal).
- Empty values: if the current file is not set, `{file}` expands to an empty string. The command still runs.
- Shell quoting: Lexer does **not** add quotes around expanded values. Use shell quoting in the command string if paths may contain spaces:

```toml
[[commands]]
name = "Open in editor"
command = "code \"{file_absolute}\""
```

## Command Palette Integration

Custom commands appear in the command palette (`:` mode) alongside built-in commands. They are listed after built-in commands, in the order defined in config.

```
+---------------------------------------------------------------+
|  : Search commands...                                         |
|---------------------------------------------------------------|
|  > toggle sidebar         Show/hide ToC sidebar               |
|    toggle effects         Enable/disable visual effects       |
|    ...                                                        |
|  ─────────────────────────────────────────────────────────     |
|    Open in GitHub         gh browse {file}                    |
|    Blame in GitHub        gh browse {file} --blame            |
|    Open in VS Code        code {file_absolute}                |
|  ─────────────────────────────────────────────────────────     |
|  12 results  ·  ↑↓ navigate  ·  Enter run  ·  Esc close      |
+---------------------------------------------------------------+
```

Custom commands show the raw command template as their `detail` text, so the user can see what will run.

## Execution

### Flow

1. User selects a custom command from the palette
2. Lexer gathers context: current file path, CWD, selection (if any), clipboard
3. Placeholders in the command string are expanded
4. The command is executed via shell (`sh -c "..."` on Unix, `cmd /c "..."` on Windows)
5. Based on `output` mode:
   - `"ignore"` (default): fire and forget, show toast `Ran: <name>`
   - `"toast"`: capture stdout and show first line in the status bar toast
   - `"clipboard"`: capture stdout and copy to system clipboard, show toast `Copied to clipboard`
6. On error (non-zero exit code), show error toast with stderr (first line)

### Tauri Command

```rust
#[tauri::command]
pub async fn run_custom_command(
    command: String,
    working_dir: Option<String>,
    output_mode: String,
) -> Result<CustomCommandResult, String>

#[derive(Serialize)]
pub struct CustomCommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}
```

The frontend handles placeholder expansion (it has access to all context: file path, selection, clipboard). The expanded command string is sent to the backend for execution.

### Shell Execution

```rust
let output = std::process::Command::new("sh")
    .args(["-c", &expanded_command])
    .current_dir(&working_dir)
    .output()
    .map_err(|e| format!("Failed to run command: {}", e))?;
```

## Config Struct

```rust
#[derive(Debug, Deserialize, Serialize, Default, Clone)]
pub struct LexerConfig {
    #[serde(default)]
    pub appearance: AppearanceConfig,
    #[serde(default)]
    pub behavior: BehaviorConfig,
    #[serde(default)]
    pub effects: EffectsConfig,
    #[serde(default)]
    pub commands: Vec<CustomCommand>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CustomCommand {
    pub name: String,
    pub command: String,
    #[serde(default = "default_output_ignore")]
    pub output: String,
    #[serde(default)]
    pub confirm: bool,
    pub working_dir: Option<String>,
    pub shell: Option<String>,
}
```

## Frontend Integration

### Loading Commands

On startup (and after config hot-reload), the frontend fetches custom commands:

```rust
#[tauri::command]
pub fn get_custom_commands(
    config: State<'_, Arc<Mutex<LexerConfig>>>,
) -> Result<Vec<CustomCommandInfo>, String>

#[derive(Serialize)]
pub struct CustomCommandInfo {
    pub name: String,
    pub command: String,     // template with placeholders (for display)
    pub output: String,
    pub confirm: bool,
}
```

### Palette Display

Custom commands use `type: 'custom-command'` in the palette item list:

```javascript
// In palette._loadCommands()
const customCmds = await invoke('get_custom_commands');
for (const cmd of customCmds) {
    this.items.push({
        label: cmd.name,
        detail: cmd.command,
        value: cmd,
        type: 'custom-command',
    });
}
```

### Placeholder Expansion (Frontend)

```javascript
async _expandCommandPlaceholders(template) {
    let result = template;
    const filePath = await invoke('get_current_file') || '';
    const cwd = await invoke('get_working_directory') || '';

    result = result.replaceAll('{file}', filePath);
    result = result.replaceAll('{file_absolute}', /* resolve absolute */);
    result = result.replaceAll('{file_name}', filePath.split('/').pop() || '');
    result = result.replaceAll('{file_stem}', /* name without ext */);
    result = result.replaceAll('{file_ext}', /* extension */);
    result = result.replaceAll('{dir}', /* parent dir relative */);
    result = result.replaceAll('{dir_absolute}', /* parent dir absolute */);
    result = result.replaceAll('{cwd}', cwd);
    // ... etc

    return result;
}
```

## Examples

### Open current file on GitHub

```toml
[[commands]]
name = "Open in GitHub"
command = "gh browse {file}"
```

User is viewing `docs/18-custom-commands.md`. After expansion:
```bash
sh -c "gh browse docs/18-custom-commands.md"
```

### Open file at current line on GitHub

```toml
[[commands]]
name = "Open in GitHub at line"
command = "gh browse {file}:{line}"
```

### Copy GitHub permalink

```toml
[[commands]]
name = "Copy GitHub URL"
command = "gh browse {file} --no-browser"
output = "clipboard"
```

Stdout (the URL) is copied to the system clipboard.

### Run a linter

```toml
[[commands]]
name = "Lint Markdown"
command = "markdownlint \"{file_absolute}\""
output = "toast"
```

First line of stdout shown in the status bar toast.

### Open terminal at file location

```toml
[[commands]]
name = "Terminal here"
command = "open -a Terminal \"{dir_absolute}\""
```

### Send file to a webhook

```toml
[[commands]]
name = "Post to webhook"
command = "curl -s -X POST -d @\"{file_absolute}\" https://hooks.example.com/md"
output = "toast"
confirm = true
```

The `confirm = true` flag shows a confirmation before running.

### Use selection as input

```toml
[[commands]]
name = "Count words in selection"
command = "echo \"{selection}\" | wc -w"
output = "toast"
```

## Reload Behavior

Custom commands are loaded from config at startup. When the config file changes (detected by the theme hot-reload watcher), the command list is refreshed. The palette always reads the latest list when opened.

## Error Handling

| Condition | Behavior |
|---|---|
| Config parse error on `[[commands]]` | Skip malformed entries, warn via tracing |
| Missing `name` or `command` field | Skip entry, warn via tracing |
| Command not found (e.g., `gh` not installed) | Toast: `Command failed: <stderr first line>` |
| Non-zero exit code | Toast: `<name> failed (exit <code>)` |
| Timeout (>30 seconds) | Kill process, toast: `<name> timed out` |
| Empty `output = "clipboard"` result | Toast: `No output to copy` |
