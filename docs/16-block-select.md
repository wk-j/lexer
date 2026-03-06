# Block Select Mode

Lexer is a viewer, not an editor. Character-level text selection (like Vim's visual mode) doesn't fit — there's no cursor, no lines to count, no editing operations to apply. Instead, Lexer introduces **Block Select**: a structural selection system that operates on semantic content blocks.

The user selects one or more rendered blocks (a heading, a paragraph, a code block, a table, a list, a blockquote) and then acts on them: copy as Markdown, copy as plain text, or send as context to an external AI agent. Every action is fully keyboard-driven — no mouse interaction is ever required.

## Design Rationale

Traditional text selection is character-oriented. In a Markdown viewer the natural unit of content is the **block** — the same structural elements that pulldown-cmark produces. Block selection is:

- **Faster** — one keystroke selects an entire code block instead of mouse-dragging across 40 lines
- **Precise** — no accidental partial selections or trailing whitespace
- **Markdown-aware** — copying a code block preserves its language fence; copying a table preserves pipe formatting
- **Composable** — select heading + the two paragraphs below it, then send all three to an AI agent as context

## Selectable Blocks

Every direct child of the content panel that maps to a Markdown construct is a selectable block:

| HTML Element | Markdown Construct | Example |
|---|---|---|
| `<h1>`–`<h6>` | Heading | `## Architecture` |
| `<p>` | Paragraph | Body text |
| `<pre>` | Fenced code block | ` ```rust ... ``` ` |
| `<blockquote>` | Blockquote | `> Note: ...` |
| `<ul>`, `<ol>` | List (entire) | `- item one\n- item two` |
| `<table>` | Table | GFM pipe table |
| `<hr>` | Thematic break | `---` |
| `<details>` | Collapsible section | `<details><summary>...` |
| `<div class="footnote-definition">` | Footnote | `[^1]: ...` |

Blocks are identified at runtime by querying `contentEl.children` and filtering to these tag names. Each block gets a `data-block-index` attribute for fast lookup.

## Mode

| Mode | Indicator | Purpose | Entry | Exit |
|---|---|---|---|---|
| **Select** | `SEL` | Pick content blocks and act on them | `v` in Normal | `Escape` or action |

Block Select is a new mode (`select`) added to the keyboard engine alongside the existing six modes. The mode badge shows `SEL` with a distinct color.

```css
.mode-select { background: #d19a66; color: #1e2127; }
```

## Full Keyboard Reference

Every interaction in Block Select mode is keyboard-driven. This section is the complete reference — no action requires a mouse.

### Entering Select Mode

| Key | Context | Action |
|---|---|---|
| `v` | Normal mode | Enter select mode. Anchor = block nearest viewport center. |
| `V` | Normal mode | Enter select mode with section selection: anchor = current heading, cursor = block before next heading of same or higher level. |

### Navigation

Movement keys move the **cursor block**. The selection range spans from anchor to cursor (inclusive). The viewport auto-scrolls to keep the cursor block visible with ~100px padding.

| Key | Action |
|---|---|
| `j` / `Down` | Move cursor to next block |
| `k` / `Up` | Move cursor to previous block |
| `d` | Move cursor down 5 blocks |
| `u` | Move cursor up 5 blocks |
| `G` | Move cursor to last block in document |
| `g` | Move cursor to first block in document |
| `]` | Move cursor to next heading block |
| `[` | Move cursor to previous heading block |
| `}` | Move cursor to end of current section (next heading - 1) |
| `{` | Move cursor to start of current section (current/previous heading) |

Note: `g` goes to the first block directly (single key, not `gg`) since Select mode has its own flat keymap without the Goto sub-mode prefix.

### Selection Manipulation

| Key | Action |
|---|---|
| `x` | Toggle individual block at cursor (disjoint selection, see below) |
| `o` | Swap anchor and cursor (flip selection direction, like Vim visual `o`) |
| `a` | Select all blocks in the document |

**Disjoint selection (`x`):** By default, selection is a contiguous range (anchor..cursor). Pressing `x` toggles the cursor block in/out of an explicit set, allowing non-contiguous selections. Toggled blocks keep their highlight even if outside the anchor..cursor range. Press `x` again on the same block to un-toggle it.

### Copy Actions

All copy actions write to the system clipboard, show a confirmation toast, and return to Normal mode.

| Key | Action | Clipboard content |
|---|---|---|
| `y` | Copy as Markdown | Original Markdown source for selected blocks (from source map) |
| `Y` | Copy as plain text | `element.textContent` of each selected block, joined by `\n\n` |

After `y` or `Y`, a toast notification appears in the status bar area:

```
+-------------------------------------------------------------------+
| NOR | docs/SPEC.md | Copied 3 blocks as markdown        ✓        |
+-------------------------------------------------------------------+
```

The toast auto-dismisses after 2 seconds.

### AI Agent Actions

| Key | Action |
|---|---|
| `Enter` | Open agent action menu (or execute default action if configured) |
| `c` | Direct: copy as context block |
| `s` | Direct: send to default agent (configured in config.toml) |

Pressing `Enter` opens the agent sub-mode. If `[agents] default_action` is set in config, `s` executes it directly without a menu.

### Agent Sub-Mode

When `Enter` is pressed, the mode transitions to `select:agent` — a sub-mode that displays the agent action which-key popup. The status bar shows `SEL·AGT`. All agent actions are single-key:

| Key | Action | Description |
|---|---|---|
| `c` | Copy as context block | Wrap in `<context>` XML tags, copy to clipboard |
| `o` | Open in Claude | Launch Claude desktop app with context |
| `p` | Pipe to command | Pipe to configured command, or enter command first |
| `u` | Send to URL endpoint | HTTP POST to configured endpoint |
| `1`-`9` | Quick pipe slot | Execute pipe command from slot 1-9 (see config) |
| `Escape` | Cancel | Return to Select mode (selection preserved) |
| `?` | Help | Show agent actions in which-key popup |

```
+--------------------------------------------+
|  ⏎ - Agent                                 |
|                                            |
|  c  copy as context block                  |
|  o  open in Claude                         |
|  p  pipe to command                        |
|  u  send to URL endpoint                   |
|  1-9  quick pipe slot                      |
|  esc  back to select                       |
+--------------------------------------------+
```

### Which-Key Popup (Select Mode)

On entering Select mode, the which-key popup shows:

```
+------------------------------------+
|  v - Select                        |
|                                    |
|  j/k  navigate blocks              |
|  d/u  jump 5 blocks                |
|  ]/[  next/prev heading            |
|  {/}  section start/end            |
|  x    toggle block                 |
|  o    swap anchor/cursor           |
|  a    select all                   |
|  y    copy as markdown             |
|  Y    copy as plain text           |
|  c    copy as context block        |
|  s    send to default agent        |
|  ⏎    agent menu                   |
|  esc  cancel                       |
+------------------------------------+
```

### Cancellation and Return

| State | `Escape` does | Result |
|---|---|---|
| Select mode | Clear all selection highlights, return to Normal | `NOR` |
| Agent sub-mode | Return to Select mode (selection preserved) | `SEL` |
| Pipe input prompt | Cancel prompt, return to Select mode | `SEL` |

After any successful agent action (copy, pipe, URL), the mode returns to Normal and a confirmation toast appears. The user never gets stuck — every state has a clear `Escape` path back.

## Visual Design

### Block Highlight

Selected blocks get a visual overlay — not a background color change (which would conflict with code block and blockquote styling) but a left-border accent and a subtle overlay:

```css
.block-selected {
    position: relative;
    border-left: 3px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-radius: 4px;
    margin-left: -12px;
    padding-left: 9px;
    transition: background 0.15s ease, border-color 0.15s ease;
}

.block-cursor {
    border-left-color: var(--text-primary);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.block-toggled {
    /* Disjoint-selected blocks (via 'x') outside the anchor..cursor range */
    border-left: 3px dashed var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, transparent);
}
```

The **cursor block** (where `j`/`k` navigation lands) has a brighter highlight than other selected blocks, making it clear where you are. Disjoint blocks toggled with `x` outside the range use a dashed border to visually distinguish them.

### Selection Counter

The status bar shows a selection count while in Select mode:

```
+-------------------------------------------------------------------+
| SEL | docs/SPEC.md | 3 blocks selected                            |
+-------------------------------------------------------------------+
```

In agent sub-mode:

```
+-------------------------------------------------------------------+
| SEL·AGT | docs/SPEC.md | 3 blocks → choose action                 |
+-------------------------------------------------------------------+
```

### Confirmation Toast

After every action, a toast replaces the status bar info briefly:

| Action | Toast message |
|---|---|
| `y` | `Copied 3 blocks as markdown ✓` |
| `Y` | `Copied 3 blocks as plain text ✓` |
| `c` | `Copied context block to clipboard ✓` |
| `o` | `Sent to Claude ✓` or `Claude not found — copied to clipboard ✓` |
| `p` | `Piped to "llm summarize" ✓` or `Command failed: <error> ✗` |
| `u` | `Sent to endpoint (200 OK) ✓` or `Endpoint error: 500 ✗` |

Toast auto-dismisses after 2 seconds. Errors use `var(--error)` color and persist for 4 seconds.

### Scroll Behavior

When the cursor moves beyond the visible viewport, the content scrolls smoothly (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`) to bring the cursor block into view with ~100px padding above and below.

## Markdown Reconstruction

When the user copies selected blocks (`y`), Lexer reconstructs the original Markdown source for each block rather than copying rendered HTML. This requires the backend to provide source ranges.

### Backend: Source Map

The `open_file` Rust command is extended to return a **source map** alongside the rendered HTML — an array mapping each top-level block to its byte range in the original Markdown source:

```rust
#[derive(Serialize)]
pub struct BlockSource {
    /// Index of this block among siblings (matches data-block-index)
    pub index: usize,
    /// Byte offset of the block start in the original Markdown source
    pub start: usize,
    /// Byte offset of the block end (exclusive)
    pub end: usize,
}
```

The `OpenFileResult` struct gains a new field:

```rust
pub struct OpenFileResult {
    pub buffer_id: u64,
    pub html: String,
    pub title: String,
    pub toc: Vec<TocEntry>,
    pub already_open: bool,
    pub buffers: Vec<BufferInfo>,
    pub block_sources: Vec<BlockSource>,  // NEW
}
```

During pulldown-cmark iteration, each time a top-level block event starts (heading, paragraph, code block, etc.), record the source byte offset from `Event::into_offset()`. When the block ends, record the end offset. Emit one `BlockSource` per block.

### Frontend: Markdown Copy

When `y` is pressed, the frontend:

1. Gathers the `data-block-index` of each selected block
2. Sends these indices to a new Tauri command `get_block_sources` which returns the original Markdown text for those ranges
3. Joins them with `\n\n` and writes to the clipboard via `navigator.clipboard.writeText()`
4. Shows confirmation toast, exits to Normal mode

```rust
#[tauri::command]
fn get_block_sources(indices: Vec<usize>) -> Result<String, String> {
    // Read the source map and original file content from state
    // Extract the byte ranges for the requested indices
    // Return the concatenated Markdown source
}
```

### Plain Text Copy

When `Y` is pressed, the frontend extracts `element.textContent` from each selected block, joins with `\n\n`, and writes to the clipboard. No backend call needed.

## AI Agent Integration

The most powerful use of Block Select: sending selected content as context to an external AI agent.

### Context Block Format

The `c` action wraps the selected Markdown in a structured context block optimized for AI consumption:

````xml
<context source="path/to/file.md" blocks="3-7">
## Architecture

The system uses a modular design with three layers...

```rust
fn main() {
    let app = App::new();
    app.run();
}
```

Each layer communicates through message passing.
</context>
````

This format:
- Identifies the source file
- Specifies which blocks were selected (for reproducibility)
- Preserves the original Markdown formatting
- Uses XML tags that AI models understand as context delimiters

### Claude Desktop Integration

The `o` action constructs a deep link that opens Claude desktop with the context pre-filled:

```
claude://context?text=<url-encoded-context-block>
```

The deep link is opened via the Tauri shell plugin (`invoke('plugin:shell|open', { path: url })`). If the deep link fails (Claude not installed), the context block is copied to clipboard instead and a toast shows the fallback.

### Pipe to Command

The `p` action pipes the selected Markdown to a shell command via stdin. The command is resolved in this order:

1. **Configured default** — if `[agents] pipe_command` is set in config, use it immediately
2. **Quick slots** — if the user pressed `1`-`9` in agent sub-mode, use the corresponding `pipe_slots` entry
3. **Inline prompt** — if no default is configured, show a command input bar (reuses the search bar UI) where the user types a command and presses `Enter`

The inline command prompt is fully keyboard-driven:

| Key | Context | Action |
|---|---|---|
| *(type)* | Pipe prompt | Enter shell command text |
| `Enter` | Pipe prompt | Execute the command with selection as stdin |
| `Escape` | Pipe prompt | Cancel, return to Select mode |
| `Up` | Pipe prompt | Recall previous pipe command from history |
| `Down` | Pipe prompt | Next pipe command in history |

The prompt shows a ` ▸` prefix to distinguish it from search mode's `/` prefix:

```
+-------------------------------------------------------------------+
| ▸ llm "summarize this section"                                    |
+-------------------------------------------------------------------+
```

Pipe command history (last 20 commands) is persisted in the app state and restored across sessions.

The actual execution happens in the Rust backend via `send_to_agent` which spawns the command as a child process, writes the selection to its stdin, and returns stdout/stderr. The frontend shows a toast with the result.

### URL Endpoint

The `u` action POSTs the selection to a configured HTTP endpoint. If no endpoint is configured, the agent sub-mode `u` key shows a toast: `No endpoint configured — set [agents] endpoint_url in config.toml`.

```
POST /context HTTP/1.1
Content-Type: application/json

{
    "source": "path/to/file.md",
    "format": "markdown",
    "content": "## Architecture\n\nThe system uses...",
    "blocks": [3, 4, 5, 6, 7]
}
```

### Configuration

Agent actions are configured in `~/.config/lexer/config.toml`:

```toml
[agents]
# Default action for 's' key in select mode
# Options: "context", "claude", "pipe", "url"
default_action = "context"

# Pipe command (used by 'p' action when no inline prompt)
pipe_command = "llm 'summarize this section'"

# Quick pipe slots (used by '1'-'9' in agent sub-mode)
pipe_slots = [
    "llm 'summarize this'",
    "llm 'explain this code'",
    "llm 'find bugs in this'",
    "pbcopy",
    "cat >> ~/notes/context.md",
]

# URL endpoint (used by 'u' action)
endpoint_url = "http://localhost:8080/context"
endpoint_method = "POST"
endpoint_headers = { "Authorization" = "Bearer $LEXER_API_KEY" }

# Claude desktop integration
claude_enabled = true
```

Environment variables in values (like `$LEXER_API_KEY`) are expanded at runtime.

## Tauri Commands (New)

| Command | Args | Returns | Description |
|---|---|---|---|
| `get_block_sources` | `indices: Vec<usize>` | `String` | Get original Markdown source for selected block indices |
| `send_to_agent` | `action: String, content: String, source: String, command: Option<String>` | `AgentResult` | Execute an agent action (pipe, url) on the backend |

```rust
#[derive(Serialize)]
pub struct AgentResult {
    pub success: bool,
    pub message: String,       // Human-readable result for toast
    pub output: Option<String>, // stdout from pipe command, or HTTP response body
}
```

## Complete Keyboard Flow Examples

### Example 1: Copy a code block as Markdown

```
v        → enter select mode (anchor = nearest block)
j j j    → move cursor down to the code block
y        → copy as markdown, exit to Normal
```

### Example 2: Select a section and send to Claude

```
V        → enter select mode with section selection (heading to next heading)
Enter    → open agent sub-mode
o        → send to Claude desktop
```

### Example 3: Select specific blocks and pipe to a command

```
v        → enter select mode
]        → jump to next heading
j j      → extend selection two blocks past the heading
x        → (optional) toggle off an unwanted block
Enter    → open agent sub-mode
p        → pipe to command
         → (if no default: type command in prompt)
llm "explain this"
Enter    → execute, see result toast, exit to Normal
```

### Example 4: Quick AI summary using slot

```
v        → enter select mode
a        → select all blocks
Enter    → open agent sub-mode
1        → execute pipe slot 1 ("llm 'summarize this'")
```

### Example 5: Copy non-contiguous blocks

```
v        → enter select mode (cursor on block 3)
x        → toggle block 3 into explicit set
j j      → move to block 5
x        → toggle block 5 into explicit set
j j j    → move to block 8
x        → toggle block 8 into explicit set
y        → copy blocks 3, 5, 8 as markdown
```

## Implementation Notes

### Block Index Assignment

On every content render (file open, file reload), the frontend walks `contentEl.children` and assigns `data-block-index="0"`, `data-block-index="1"`, etc. to each element that matches the selectable block criteria. This happens in `app.js` after setting `innerHTML`.

### State Management

Select mode state lives in the `KeyboardEngine`:

```javascript
// Select mode state
this._selectAnchor = null;       // index of the anchor block
this._selectCursor = null;       // index of the cursor block
this._selectBlocks = [];         // cached list of selectable block elements
this._selectExplicit = new Set();// explicitly toggled blocks (via 'x')
this._selectSubMode = null;      // null | 'agent' | 'pipe-prompt'
this._pipeHistory = [];          // last 20 pipe commands
```

The selected set is computed as: `range(min(anchor, cursor), max(anchor, cursor)) ∪ explicitSet`. When `x` toggles a block that's inside the range, it removes it; when `x` toggles a block outside the range, it adds it.

### Mode Integration

Select mode integrates with the existing mode system:

- `v` / `V` in Normal mode calls `_enterSelectMode()` / `_enterSectionSelectMode()`
- `_enterSelectMode()` indexes all blocks, sets the anchor to the block nearest viewport center, updates mode to `select`
- `handleKey` routes to `_handleSelectKey(e)` when `this.mode === 'select'`
- `_handleSelectKey` checks `this._selectSubMode` to delegate to agent or pipe-prompt handlers
- `_exitSelectMode()` clears all highlights, resets state, returns to Normal mode
- `_showSelectToast(message, isError)` replaces status bar info temporarily

### Sub-Mode Routing

```
Select mode (this.mode === 'select')
├── this._selectSubMode === null         → navigation, selection, copy keys
├── this._selectSubMode === 'agent'      → agent action which-key (c/o/p/u/1-9)
└── this._selectSubMode === 'pipe-prompt'→ text input for shell command
```

`Escape` always moves one level back: `pipe-prompt → agent → select → normal`.

### Performance

- Block indexing is O(n) where n is the number of blocks — typically < 200 for even large documents
- CSS class toggling on selection change is O(k) where k is the number of changed blocks (usually 1-2 per keystroke)
- No DOM mutation during selection — only `classList.add/remove`
- Source map is computed once per render and cached in `AppState`
