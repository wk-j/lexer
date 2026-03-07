# Configuration

## CLI Arguments

```
Lexer — a beautiful Markdown viewer

Usage: lexer [OPTIONS] [FILE]...

Arguments:
  [FILE]...  Markdown files to open

Options:
  -t, --theme <THEME>    Theme name (e.g. lexer-dark, lexer-light, lexer-nord)
      --layout <LAYOUT>  Initial layout: default, focus, zen, split [default: default]
      --no-effects       Disable all visual effects
  -h, --help             Print help
  -V, --version          Print version
```

Uses `clap` (v4, derive) for argument parsing. CLI arguments take priority over config file values.

**Examples:**

```bash
# Open a file with the nord theme
lexer --theme lexer-nord README.md

# Open in zen mode without effects
lexer --layout zen --no-effects docs/guide.md

# Open multiple files (each opens as a buffer)
lexer file1.md file2.md file3.md

# Just launch (empty state)
lexer
```

## Config File

`~/.config/lexer/config.toml`:

```toml
[appearance]
theme = "lexer-dark"           # Name of built-in or user theme
default_layout = "default"     # default | focus | zen | split

[behavior]
live_reload = true             # Watch files for changes
preserve_scroll = true         # Restore scroll position on buffer switch
restore_session = true         # Restore windows on launch (future)
scroll_speed = 200             # Pixels per j/k keypress (default: 200)

[effects]
enabled = true                 # Master toggle for all visual effects
frosted_glass = true
gradient_backdrop = true
noise_texture = true
ambient_glow = true
scroll_animations = true
particles = true
```

## Priority Order

Settings are resolved in this order (first wins):

1. **CLI arguments** (`--theme`, `--layout`, `--no-effects`)
2. **Config file** (`~/.config/lexer/config.toml`)
3. **Built-in defaults** (theme: `lexer-dark`, layout: `default`, effects: enabled)

## Config File Location

| Platform | Path |
|----------|------|
| macOS    | `~/.config/lexer/config.toml` |
| Linux    | `$XDG_CONFIG_HOME/lexer/config.toml` (default: `~/.config/lexer/config.toml`) |
| Windows  | `%APPDATA%\lexer\config.toml` |

The config file is optional. If not found, all defaults are used. Invalid TOML is warned via tracing but doesn't prevent startup.

## Custom Commands

User-defined shell commands can be added to the config file. They appear in the command palette and support placeholder variables like `{file}`, `{file_absolute}`, `{dir}`, `{cwd}`, and `{selection}`.

```toml
[[commands]]
name = "Open in GitHub"
command = "gh browse {file}"

[[commands]]
name = "Open in VS Code"
command = "code {file_absolute}"

[[commands]]
name = "Copy GitHub URL"
command = "gh browse {file} --no-browser"
output = "clipboard"
```

See [18-custom-commands.md](18-custom-commands.md) for the full specification, all placeholder variables, and more examples.
