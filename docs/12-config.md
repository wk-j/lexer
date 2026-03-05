# Configuration

## CLI Arguments

```
USAGE:
    lexer [OPTIONS] [FILE]...

ARGS:
    <FILE>...    One or more Markdown files (each opens in its own window)

OPTIONS:
    -t, --theme <THEME>      Theme name: lexer-dark | lexer-light | auto | <custom> (default: auto)
    --layout <LAYOUT>        Initial layout: default | focus | zen | split (default: default)
    --no-effects             Disable all visual effects
    --new-window             Force open in a new window (even if already running)
    -h, --help               Print help information
    -V, --version            Print version information
```

Use `clap` for argument parsing.

## Config File

`~/.config/lexer/config.toml`:

```toml
[appearance]
theme = "lexer-dark"           # Name of built-in or user theme
default_layout = "default"     # default | focus | zen | split

[behavior]
live_reload = true
preserve_scroll = true
restore_session = true         # Restore windows on launch

[effects]
# Override theme effect defaults (optional)
frosted_glass = true
gradient_backdrop = true
noise_texture = true
ambient_glow = true
scroll_animations = true

[keymap.normal]
"j" = "scroll_down"
"k" = "scroll_up"
# Custom remaps...

[keymap.space]
"f" = "palette_files"
"r" = "palette_recent"
# Custom remaps...
```
