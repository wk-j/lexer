# CR-001: Opera GX-Style Border & Custom Vertical Traffic Lights

**Date:** 2026-03-07
**Status:** Implemented
**Scope:** UI, Theme Engine, Window Chrome

---

## Summary

Adds an Opera GX-inspired neon border with a cut corner to the window chrome, replaces the native macOS horizontal traffic light buttons with custom vertical ones, and reserves a left strip for the traffic light column (future sidebar/toolbar use). Also fixes a code block rendering bug where lines collapsed into a single line.

---

## Changes

### 1. Opera GX-Style Window Border

**Files:** `src/effects.js`, `src/effects.css`, `src/style.css`, `src/index.html`, `src-tauri/src/theme/engine.rs`, `src-tauri/themes/lexer-dark.toml`

A `<canvas>` element (`#gx-border`) draws an L-shaped neon border along the **left edge and top edge** of the window, connected by a diagonal cut corner in the top-left.

- **Border path:** Open L-shape (bottom-left -> up the left edge -> diagonal cut -> across the top edge). Only two sides are drawn, matching the Opera GX style.
- **Cut corner size:** `--gx-corner-size: 10px` (configurable via theme).
- **Neon glow:** Multi-pass bloom effect using the accent color, with configurable opacity and spread.
- **Opaque fill:** The cut corner triangle is filled with `--bg-base-opaque` to mask content behind it.
- **Theme reactivity:** A `MutationObserver` watches the `<style id="lexer-theme">` element and redraws the border when the theme changes.
- **Resize handling:** Redraws on `window.resize` via `requestAnimationFrame`.
- **Toggleable:** Controlled by `[effects] gx_border = true|false` in theme TOML. Hidden when `body.effects-off`.

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--gx-border-color-start` | `var(--accent)` | Gradient start color |
| `--gx-border-color-mid` | `var(--accent)` | Gradient mid color |
| `--gx-border-color-end` | `rgba(88,166,255,0.2)` | Gradient end color |
| `--gx-border-width` | `1.5px` | Border stroke width |
| `--gx-corner-size` | `10px` | Diagonal cut size |
| `--gx-glow-opacity` | `0.6` | Neon glow opacity |
| `--gx-glow-spread` | `8px` | Neon glow blur radius |

#### New Theme TOML Fields

```toml
[colors]
gx_border_color_start = "#ff6600"
gx_border_color_mid = "#ff6600"
gx_border_color_end = "rgba(255, 102, 0, 0.2)"
gx_border_width = "2px"
gx_corner_size = "12px"
gx_glow_opacity = "0.8"
gx_glow_spread = "10px"

[effects]
gx_border = true
```

---

### 2. Custom Vertical Traffic Light Buttons

**Files:** `src/index.html`, `src/style.css`, `src/app.js`, `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`

Native macOS traffic light buttons are hidden and replaced with custom HTML/CSS/JS buttons in a **vertical column** layout, matching the Opera GX aesthetic.

#### Native Button Hiding (Rust)

In `main.rs` setup, after applying vibrancy, the native `NSWindow` buttons are hidden via `objc2`:

```rust
use objc2::runtime::AnyObject;
use objc2_app_kit::NSWindowButton;

// Hide CloseButton, MiniaturizeButton, ZoomButton
let btn = objc2::msg_send![ns_window, standardWindowButton: button_type];
let _: () = objc2::msg_send![btn, setHidden: true];
```

New macOS-only dependencies added to `Cargo.toml`:
- `objc2 = "0.6"`
- `objc2-app-kit = "0.3"` (features: NSWindow, NSButton, NSControl, NSView, NSResponder)

#### Custom Buttons (HTML/CSS/JS)

- **HTML:** Three `<button>` elements inside a `.traffic-lights` container, placed before the app div.
- **CSS:** `position: fixed; top: 16px; left: 14px;` with `flex-direction: column; gap: 11px`. Buttons are 14px circles with standard macOS colors (#ff5f57 red, #febc2e yellow, #28c840 green). Hover reveals action icons (x, -, arrows). Window blur greys them out via `.inactive` class.
- **JS:** Wired to Tauri window API:
  - Close -> `win.close()`
  - Minimize -> `win.minimize()`
  - Fullscreen -> `win.setFullscreen()` toggle

#### Capabilities

Added `core:window:allow-minimize` to `src-tauri/capabilities/default.json`.

---

### 3. Left Strip Layout Reserve

**Files:** `src/style.css`

The `.app` container has `margin-left: 36px` to reserve a left strip for the traffic light column. This keeps the sidebar and content area clear of the buttons and provides space for future toolbar/icon use.

- Tab bar and sidebar start after the 36px reserve.
- Sidebar top padding aligned with content (no extra offset).
- Titlebar drag region reduced to `4px` (thin top-edge strip).

---

### 4. Code Block Line Rendering Fix

**Files:** `src/style.css`

Fixed a bug where code blocks rendered all lines on a single line. The tree-sitter highlighter wraps each line in `<span class="line">` and strips newline characters, but `display: block` was only applied under `body.line-numbers`.

**Fix:** Added unconditional rule:

```css
pre code .line {
  display: block;
}
```

---

## Files Modified

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Added `objc2`, `objc2-app-kit` macOS deps |
| `src-tauri/Cargo.lock` | Lockfile update |
| `src-tauri/capabilities/default.json` | Added `core:window:allow-minimize` |
| `src-tauri/gen/schemas/capabilities.json` | Auto-generated schema update |
| `src-tauri/src/main.rs` | Hide native traffic lights via NSWindow API |
| `src-tauri/src/theme/engine.rs` | GX border CSS variables + `gx_border` effect toggle |
| `src-tauri/themes/lexer-dark.toml` | Enable `gx_border = true` |
| `src/index.html` | Add `<canvas>` for GX border, traffic light buttons |
| `src/style.css` | GX CSS vars, traffic light styles, app left margin, code block fix |
| `src/effects.css` | GX border canvas positioning + effects-off rule |
| `src/effects.js` | GX border canvas drawing (L-shape path, neon glow) |
| `src/app.js` | Traffic light button event wiring, no-drag selector |

---

## Spec References

- `docs/04-ui.md` — Window chrome, titlebar
- `docs/05-visual-effects.md` — Effects engine
- `docs/09-themes.md` — Theme TOML format, CSS custom properties
