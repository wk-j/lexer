# CR-002: Global Shortcut to Toggle Window Visibility

**Date:** 2026-03-07
**Status:** Implemented
**Scope:** Window Management, macOS, Config
**Platform:** macOS first (Linux/Windows follow-up)

---

## Summary

Register a system-wide global keyboard shortcut that toggles the Lexer window between visible/focused and hidden. This enables a Raycast/iTerm2-style workflow where the user can summon or dismiss Lexer instantly from any application.

**Default shortcut:** `Cmd+Shift+L`
**Configurable via:** `~/.config/lexer/config.toml`

---

## Motivation

Lexer is a viewer -- users frequently switch between their editor and Lexer to preview Markdown. A global hotkey eliminates Cmd+Tab cycling and makes Lexer feel like a utility panel that can be summoned/dismissed instantly.

---

## Design

### Toggle Behavior

| Window State | Action on Shortcut |
|---|---|
| Visible and focused | Hide the window |
| Visible but not focused | Bring to front and focus |
| Hidden | Show, activate app, and focus |
| Minimized | Unminimize, show, and focus |

### Registration

The shortcut is registered **on the Rust side** during `tauri::Builder::setup()`. This ensures the hotkey works even when the window is hidden (JS handlers cannot fire when the webview is not visible).

### macOS App Activation

On macOS, showing a window does not automatically bring the application to the foreground. After `window.show()` + `window.set_focus()`, call `NSApplication::sharedApplication().activate()` via `objc2-app-kit` to ensure the app becomes frontmost.

---

## Implementation Plan

### 1. Add Dependency

**File:** `src-tauri/Cargo.toml`

```toml
[target.'cfg(target_os = "macos")'.dependencies]
tauri-plugin-global-shortcut = "2"
```

Note: The plugin supports desktop platforms. For macOS-first, scope it to `cfg(target_os = "macos")`. When adding Linux/Windows support later, change to `cfg(desktop)`.

### 2. Add `NSApplication` Feature

**File:** `src-tauri/Cargo.toml`

Add `"NSApplication"` and `"NSRunningApplication"` to `objc2-app-kit` features:

```toml
objc2-app-kit = { version = "0.3", features = [
    "NSWindow", "NSButton", "NSControl", "NSView", "NSResponder",
    "NSApplication", "NSRunningApplication"
] }
```

### 3. Add Config Field

**File:** `src-tauri/src/config.rs`

Add a `[shortcuts]` section to `LexerConfig`:

```rust
#[derive(Debug, Deserialize, Serialize, Default, Clone)]
pub struct ShortcutsConfig {
    /// Global shortcut to toggle window visibility.
    /// Format: "Super+Shift+KeyL" (Tauri shortcut string syntax).
    /// Set to "" or "none" to disable.
    pub toggle_window: Option<String>,
}
```

Add to `LexerConfig`:

```rust
pub struct LexerConfig {
    // ... existing fields ...
    #[serde(default)]
    pub shortcuts: ShortcutsConfig,
}
```

**User config example** (`~/.config/lexer/config.toml`):

```toml
[shortcuts]
toggle_window = "Super+Shift+L"
```

### 4. Register Global Shortcut

**File:** `src-tauri/src/main.rs`

In the `tauri::Builder` chain, register the plugin and shortcut:

```rust
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

// Read shortcut from config (default: Cmd+Shift+L)
let toggle_shortcut_str = user_config
    .shortcuts
    .toggle_window
    .clone()
    .unwrap_or_else(|| "Super+Shift+KeyL".to_string());

// Parse the shortcut string
let toggle_shortcut: Shortcut = toggle_shortcut_str
    .parse()
    .unwrap_or_else(|_| {
        tracing::warn!(
            "Invalid toggle_window shortcut '{}', using default",
            toggle_shortcut_str
        );
        Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyL)
    });

tauri::Builder::default()
    .plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                if shortcut == &toggle_shortcut {
                    toggle_main_window(app);
                }
            })
            .build(),
    )
    // ... existing plugins ...
```

### 5. Toggle Window Function

**File:** `src-tauri/src/main.rs` (or a new `src-tauri/src/window.rs` module)

```rust
fn toggle_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);

    if visible && focused && !minimized {
        // Window is front and center -- hide it
        let _ = window.hide();
    } else {
        // Window is hidden, unfocused, or minimized -- bring it back
        if minimized {
            let _ = window.unminimize();
        }
        let _ = window.show();
        let _ = window.set_focus();

        // macOS: activate the application to bring it to the foreground
        #[cfg(target_os = "macos")]
        {
            use objc2_app_kit::NSApplication;
            unsafe {
                let ns_app = NSApplication::sharedApplication();
                ns_app.activate();
            }
        }
    }
}
```

### 6. Capabilities (Optional)

**File:** `src-tauri/capabilities/default.json`

Only needed if JS-side registration is desired (not required for Rust-only registration):

```json
"global-shortcut:allow-register",
"global-shortcut:allow-unregister",
"global-shortcut:allow-is-registered"
```

For the initial implementation (Rust-only registration), **no capability changes are needed**.

### 7. Window Permissions

**File:** `src-tauri/capabilities/default.json`

Add permissions for show/hide:

```json
"core:window:allow-show",
"core:window:allow-hide",
"core:window:allow-is-visible",
"core:window:allow-is-focused",
"core:window:allow-is-minimized",
"core:window:allow-unminimize"
```

---

## Files to Modify

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-global-shortcut`, add `NSApplication` feature to `objc2-app-kit` |
| `src-tauri/src/config.rs` | Add `ShortcutsConfig` struct with `toggle_window` field |
| `src-tauri/src/main.rs` | Register plugin, parse shortcut from config, implement `toggle_main_window()` |
| `src-tauri/capabilities/default.json` | Add window show/hide/visibility permissions |

## Files to Update (Docs)

| File | Change |
|---|---|
| `docs/12-config.md` | Document `[shortcuts]` section |
| `docs/07-keyboard.md` | Mention global shortcut in keyboard overview |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Multiple windows open | Toggle applies to the `"main"` window only |
| Fullscreen mode | `hide()` exits fullscreen first, then hides |
| Config shortcut is `""` or `"none"` | Do not register any global shortcut |
| Config shortcut is invalid | Log warning, fall back to `Cmd+Shift+L` |
| Shortcut conflicts with another app | The last app to register wins (OS behavior). User can change via config |
| Window closed (not hidden) | Shortcut is a no-op (window handle is gone). Future: could re-create the window |

---

## macOS Notes

- **No accessibility permissions required.** The `global-hotkey` crate uses `CGEvent` tap / `NSEvent` APIs that work without accessibility access.
- **`NSApp.activate()`** is the modern replacement for the deprecated `activateIgnoringOtherApps:`. Requires macOS 14+ for the non-deprecated variant; the `objc2-app-kit` binding handles the correct API.
- **App Nap:** macOS may throttle hidden apps. The global shortcut handler runs in the main thread and is not affected by App Nap.

---

## Future Enhancements

- **Linux/Windows support:** Change `cfg(target_os = "macos")` to `cfg(desktop)`. Linux uses X11/Wayland hotkey APIs; Windows uses `RegisterHotKey`.
- **Shortcut customization UI:** Add a palette command to change the shortcut at runtime.
- **Multi-window toggle:** Cycle through all open windows, or show/hide all at once.
- **Slide-in animation:** Animate the window sliding in from the side (like iTerm2 visor mode).

---

## Spec References

- `docs/04-ui.md` — Window management, Tauri commands
- `docs/07-keyboard.md` — Keyboard engine, keymaps
- `docs/12-config.md` — Configuration file format
- `docs/13-dependencies.md` — Cargo.toml dependencies
