# Keyboard Navigation (Helix-Style)

Lexer implements a full modal keyboard navigation system inspired by the [Helix editor](https://helix-editor.com). All app functionality is accessible without a mouse. The system uses **modes**, **keymaps**, and a **which-key popup** for discoverability.

## Modes

| Mode       | Indicator   | Purpose                                         | Entry             | Exit          |
| ---------- | ----------- | ----------------------------------------------- | ----------------- | ------------- |
| **Normal** | `NOR`       | Default. Navigate, scroll, trigger actions       | `Escape` from any | --            |
| **Goto**   | `GOT`       | Jump to locations (top, bottom, heading, link)   | `g` in Normal     | After action or `Escape` |
| **Space**  | `SPC`       | Leader-key menu for commands and palette modes   | `Space` in Normal | After action or `Escape` |
| **Search** | `/ ...`     | Text search within rendered content              | `/` in Normal     | `Escape` or `Enter` |
| **View**   | `VIW`       | Viewport adjustments (center, top, zoom)         | `z` in Normal     | After action or `Escape` |

The current mode is displayed in the status bar. Unrecognized keys in any mode are ignored (no accidental actions).

## Normal Mode Keymap

**Scrolling & Movement:**

| Key          | Action                                     |
| ------------ | ------------------------------------------ |
| `j` / `Down` | Scroll down by line                        |
| `k` / `Up`   | Scroll up by line                          |
| `d`          | Scroll down half page                       |
| `u`          | Scroll up half page                         |
| `f`          | Scroll down full page (PageDown)            |
| `b`          | Scroll up full page (PageUp)                |
| `G`          | Scroll to bottom of document                |
| `g g`        | Scroll to top of document (enters Goto, then `g`) |

**Heading Navigation:**

| Key     | Action                                        |
| ------- | --------------------------------------------- |
| `]`     | Jump to next heading                           |
| `[`     | Jump to previous heading                       |
| `] ]`   | Jump to next h2+ heading (skip h3-h6)         |
| `[ [`   | Jump to previous h2+ heading                   |
| `1`-`6` | Jump to next heading of that level (h1-h6)     |

**Link Navigation:**

| Key   | Action                                          |
| ----- | ----------------------------------------------- |
| `Tab` | Focus next link / interactive element            |
| `S-Tab` | Focus previous link / interactive element      |
| `Enter` | Open focused link (navigate or open in browser)|

**Actions:**

| Key   | Action                                          |
| ----- | ----------------------------------------------- |
| `y`   | Copy current heading anchor / URL to clipboard   |
| `p`   | Open file from clipboard path                    |
| `r`   | Force reload current file                        |
| `q`   | Quit application                                 |
| `?`   | Show full keymap help overlay                    |

## Goto Mode (`g`)

Entered by pressing `g` in Normal mode. The which-key popup shows available targets.

| Key   | Action                                |
| ----- | ------------------------------------- |
| `g`   | Go to top of document                  |
| `e`   | Go to end (bottom) of document         |
| `h`   | Go to first heading                    |
| `l`   | Go to last heading                     |
| `t`   | Go to table of contents sidebar        |
| `n`   | Go to next file (if directory scanned) |
| `p`   | Go to previous file                    |

## Space Mode (Leader Key)

Entered by pressing `Space` in Normal mode. Acts as the primary command launcher. Which-key popup appears immediately.

| Key   | Action                                      |
| ----- | ------------------------------------------- |
| `f`   | Open palette: **file search**                |
| `r`   | Open palette: **recent files**               |
| `h`   | Open palette: **heading jump**               |
| `c`   | Open palette: **command mode**               |
| `t`   | Open palette: **theme picker**               |
| `/`   | Open palette: **text search**                |
| `s`   | Toggle ToC sidebar                           |
| `e`   | Toggle all visual effects                    |
| `l`   | Toggle code line numbers                     |
| `p`   | Print / export PDF                           |
| `q`   | Quit                                         |
| `?`   | Show keymap help                             |

## View Mode (`z`)

Entered by pressing `z` in Normal mode. Adjusts viewport without changing document position.

| Key   | Action                                     |
| ----- | ------------------------------------------ |
| `z`   | Center current scroll position in viewport  |
| `t`   | Scroll so current position is at top         |
| `b`   | Scroll so current position is at bottom      |
| `+`   | Zoom in (increase font size)                 |
| `-`   | Zoom out (decrease font size)                |
| `=`   | Reset zoom to default                        |

## Search Mode (`/`)

Entered by pressing `/` in Normal mode or `Space /` in Space mode. A search input appears in the status bar area (not the command palette).

| Key       | Action                                     |
| --------- | ------------------------------------------ |
| *(type)*  | Incrementally highlight matches in document |
| `Enter`   | Confirm search, jump to first match, enter Normal mode |
| `n`       | Next match (available in Normal mode after search)      |
| `N`       | Previous match                              |
| `Escape`  | Cancel search, clear highlights             |

```css
/* Search match highlighting */
.search-match {
    background: rgba(255, 213, 79, 0.3);
    border-radius: 2px;
    outline: 1px solid rgba(255, 213, 79, 0.5);
}
.search-match.current {
    background: rgba(255, 213, 79, 0.6);
    outline: 2px solid var(--accent);
}
```

## Which-Key Popup

When the user enters a multi-key mode (Goto, Space, View), a floating popup appears after a brief delay (200ms) showing all available keys and their actions. This makes the keymap discoverable without memorization.

```
+------------------------------------+
|  g - Goto                          |
|                                    |
|  g  top of document                |
|  e  end of document                |
|  h  first heading                  |
|  l  last heading                   |
|  t  table of contents              |
|  n  next file                      |
|  p  previous file                  |
+------------------------------------+
```

```css
.which-key {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    backdrop-filter: blur(var(--blur)) saturate(var(--saturate));
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    padding: 12px 16px;
    min-width: 240px;
    z-index: 800;
    font-family: var(--font-family-mono);
    font-size: 13px;
}

.which-key-title {
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--panel-border);
}

.which-key-row {
    display: flex;
    gap: 12px;
    padding: 3px 0;
}
.which-key-key {
    color: var(--accent);
    min-width: 20px;
    font-weight: 700;
}
.which-key-desc {
    color: var(--text-secondary);
}
```

## Status Bar Mode Indicator

The status bar displays the current mode with a colored badge. It also shows pending key sequences (e.g., after pressing `g`, it shows `g-` waiting for the next key).

```
+-------------------------------------------------------------------+
| NOR | docs/SPEC.md | Last modified: 2 min ago       | g-          |
+-------------------------------------------------------------------+
       ^                                                 ^
       filename                                          pending key
```

```css
.mode-badge {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.mode-normal  { background: var(--accent); color: var(--bg-base); }
.mode-goto    { background: #e5c07b; color: #1e2127; }
.mode-space   { background: #c678dd; color: #1e2127; }
.mode-search  { background: #98c379; color: #1e2127; }
.mode-view    { background: #56b6c2; color: #1e2127; }
```

## Keyboard Engine (JS)

```javascript
class KeyboardEngine {
    constructor() {
        this.mode = 'normal';
        this.pending = '';         // buffered key sequence
        this.timeout = null;       // clear pending after 1s
        this.keymaps = {
            normal: { /* key -> action or mode-switch */ },
            goto:   { /* ... */ },
            space:  { /* ... */ },
            view:   { /* ... */ },
        };
    }

    handleKey(e) {
        // Ignore when palette or lightbox is open
        if (this.isOverlayActive()) return;

        const key = this.normalizeKey(e);
        const map = this.keymaps[this.mode];
        const seq = this.pending + key;

        // Check for exact match
        if (map[seq]) {
            e.preventDefault();
            this.execute(map[seq]);
            this.pending = '';
            return;
        }

        // Check for prefix (multi-key sequence in progress)
        if (this.hasPrefix(map, seq)) {
            e.preventDefault();
            this.pending = seq;
            this.showWhichKey(this.mode, seq);
            this.resetTimeout();
            return;
        }

        // No match - reset
        this.pending = '';
        this.hideWhichKey();
    }

    execute(action) {
        this.hideWhichKey();
        if (action.mode) {
            this.setMode(action.mode);
        } else if (action.fn) {
            action.fn();
            if (this.mode !== 'normal') this.setMode('normal');
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.pending = '';
        document.documentElement.dataset.mode = mode;
        this.updateStatusBar();
        if (mode !== 'normal' && mode !== 'search') {
            this.showWhichKey(mode, '');
        }
    }

    normalizeKey(e) {
        // Map e.key to Helix-style names:
        // Shift+key -> uppercase, Space -> 'Space', etc.
        if (e.key === ' ') return 'Space';
        if (e.key === 'Escape') return 'Escape';
        if (e.shiftKey && e.key.length === 1) return e.key.toUpperCase();
        return e.key;
    }
}

// Bootstrap
const kb = new KeyboardEngine();
document.addEventListener('keydown', (e) => kb.handleKey(e));
```

## Keymap Configuration (Future)

Users will be able to remap keys via config:

```toml
# ~/.config/lexer/config.toml

[keymap.normal]
"j" = "scroll_down"
"k" = "scroll_up"
"H" = "prev_heading"       # remap example
"L" = "next_heading"

[keymap.space]
"f" = "palette_files"
"r" = "palette_recent"
"w" = "close"              # custom binding
```
