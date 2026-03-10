# CR-003: Neon Glassmorphism Visual Effects Enhancement

**Date:** 2026-03-10
**Status:** Implemented
**Scope:** Visual Effects, Theme Engine, CSS, JavaScript

---

## Summary

Enhance Lexer's visual effects to achieve a neon-glassmorphism aesthetic inspired by the reference image: intensified frosted glass panels, full-perimeter neon window glow, ambient bokeh light orbs, vivid neon syntax highlighting colors, glowing sidebar active states, and an inner content area glow. All new effects are theme-configurable and respect the existing `effects-off` toggle.

---

## Motivation

The current dark theme has a subtle, muted aesthetic. The reference image shows a much more dramatic look: heavy glass blur, vivid neon edge glow wrapping the entire window, colorful bokeh light bleed in the background, and high-contrast neon syntax colors. This CR brings Lexer closer to that cyberpunk/glassmorphism style while keeping everything toggleable and theme-driven.

---

## Design

### 1. Full-Perimeter Neon Window Glow

**Files:** `src/effects.js`, `src/effects.css`

The current GX border draws an L-shape (left + top edges only). Extend this to draw a **full rectangle** with rounded corners and neon glow on all four sides.

- Add a new effect mode: `gx_border_mode` — `"l-shape"` (current default) or `"full"`.
- When `"full"`, the canvas draws a closed rounded rectangle path instead of the open L-shape.
- Corner radius controlled by new CSS property `--gx-border-radius` (default `8px`).
- The bloom pass count increases from 3 to 4 for a more intense glow.
- The bottom edge glow uses `--gx-border-color-end` fading to transparent for a subtle gradient effect.

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--gx-border-radius` | `8px` | Corner radius for full-perimeter mode |

#### New Theme TOML Field

```toml
[effects]
gx_border_mode = "full"  # "l-shape" or "full"
```

### 2. Ambient Bokeh Light Orbs

**Files:** `src/effects.css`, `src/effects.js`

Add floating, blurred, colorful light orbs behind the content to simulate the bokeh/ambient light bleed seen in the reference image.

- 5-8 `<div class="bokeh-orb">` elements injected into `.app-backdrop` by `effects.js`.
- Each orb: 150-400px diameter, radial gradient from a theme color to transparent, `filter: blur(60-100px)`, `opacity: 0.08-0.15`.
- Colors cycle through `--bokeh-color-1` through `--bokeh-color-4`.
- Gentle drift animation: `@keyframes bokeh-drift` — translateX/Y oscillation over 20-40s, infinite, alternate.
- Each orb gets a random animation-delay and duration for organic movement.
- Stacking: orbs sit between the gradient mesh backdrop and the noise overlay (z-index 0, within `.app-backdrop`).

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--bokeh-color-1` | `rgba(138, 43, 226, 0.12)` | Purple bokeh orb |
| `--bokeh-color-2` | `rgba(0, 191, 255, 0.10)` | Cyan bokeh orb |
| `--bokeh-color-3` | `rgba(255, 0, 128, 0.08)` | Pink/magenta bokeh orb |
| `--bokeh-color-4` | `rgba(0, 255, 136, 0.06)` | Green bokeh orb |
| `--bokeh-blur` | `80px` | Orb blur radius |
| `--bokeh-count` | `6` | Number of orbs (read by JS) |

#### New Theme TOML Fields

```toml
[effects]
bokeh_orbs = true

[colors]
bokeh_color_1 = "rgba(138, 43, 226, 0.12)"
bokeh_color_2 = "rgba(0, 191, 255, 0.10)"
bokeh_color_3 = "rgba(255, 0, 128, 0.08)"
bokeh_color_4 = "rgba(0, 255, 136, 0.06)"
bokeh_blur = "80px"
```

### 3. Enhanced Frosted Glass Intensity

**Files:** `src/style.css`, `src/effects.css`

Increase the default glass effect intensity to match the heavy frosted-glass look in the reference.

- Increase `--blur` default from `20px` to `28px`.
- Increase `--saturate` default from `180%` to `200%`.
- Add a subtle `brightness(1.05)` to the `backdrop-filter` chain on panels.
- Add `--glass-brightness` CSS property for theme control.
- Apply enhanced glass to the ToC sidebar (`.toc-sidebar`) — currently it has no backdrop-filter.
- Add a subtle `border: 1px solid rgba(255, 255, 255, 0.08)` to glass panels that don't already have one.

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--glass-brightness` | `1.05` | Brightness boost on glass panels |

#### Updated Defaults

| Property | Old | New |
|---|---|---|
| `--blur` | `20px` | `28px` |
| `--saturate` | `180%` | `200%` |

### 4. Neon Glow on Active Sidebar Items

**Files:** `src/style.css`, `src/layout.css`

The ToC sidebar active item should have a neon glow matching the reference's purple/blue highlighted sidebar state.

- Active ToC item (`.toc-item.active`): add `box-shadow: 0 0 12px var(--sidebar-glow-color), inset 0 0 6px var(--sidebar-glow-color)`.
- Active item background: `rgba(var(--accent-rgb), 0.12)` with a left border accent.
- Hover state on all ToC items: subtle glow `box-shadow: 0 0 8px var(--sidebar-glow-color)`.
- Transition: 200ms ease for glow in/out.

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--sidebar-glow-color` | `rgba(88, 166, 255, 0.3)` | Sidebar active/hover glow |
| `--accent-rgb` | `88, 166, 255` | RGB triplet of accent for alpha compositing |

### 5. Inner Content Area Glow

**Files:** `src/effects.css`

Add a subtle inward glow on the content panel edges, simulating the inner light bleed visible in the reference.

- `.content-panel::before` pseudo-element: full-size, `pointer-events: none`.
- `box-shadow: inset 0 0 60px rgba(var(--accent-rgb), 0.04), inset 0 0 120px rgba(var(--accent-rgb), 0.02)`.
- Controlled by `--inner-glow-intensity` (default `1`, set to `0` to disable).
- Disabled when `body.effects-off`.

#### New CSS Custom Properties

| Property | Default | Description |
|---|---|---|
| `--inner-glow-intensity` | `1` | Multiplier for inner content glow (0 = off) |

### 6. Neon Cyberpunk Theme (`lexer-neon.toml`)

**Files:** `src-tauri/themes/lexer-neon.toml` (new file)

Create a new theme that fully activates all neon-glassmorphism effects with vivid colors matching the reference image.

```toml
[meta]
name = "Lexer Neon"
author = "Lexer"
base = "dark"
version = "1.0.0"

[colors]
bg_base = "transparent"
bg_base_opaque = "#0a0a14"
bg_panel = "rgba(14, 14, 28, 0.60)"
bg_panel_border = "rgba(138, 43, 226, 0.15)"
text_primary = "#e0e0ff"
text_secondary = "#8888aa"
text_muted = "#444466"
accent = "#bf5af2"
link = "#00d4ff"
link_hover = "#40e0ff"
gradient_a = "rgba(138, 43, 226, 0.10)"
gradient_b = "rgba(0, 191, 255, 0.08)"
gradient_c = "rgba(255, 0, 128, 0.06)"
code_bg = "rgba(14, 14, 28, 0.50)"
code_border = "rgba(138, 43, 226, 0.12)"
glow_color = "rgba(138, 43, 226, 0.30)"
glow_radius = "25px"
blockquote_border = "#bf5af2"
blockquote_bg = "rgba(138, 43, 226, 0.08)"
hr_color = "rgba(138, 43, 226, 0.3)"
table_header_bg = "rgba(138, 43, 226, 0.10)"
table_border = "rgba(138, 43, 226, 0.12)"
table_row_alt = "rgba(138, 43, 226, 0.03)"
spotlight_color = "rgba(191, 90, 242, 0.03)"
heading_gradient = "linear-gradient(135deg, #bf5af2, #00d4ff)"
select_bar = "#bf5af2"
select_bg = "rgba(138, 43, 226, 0.12)"
select_cursor_bar = "#e0e0ff"
select_cursor_bg = "rgba(138, 43, 226, 0.20)"
gx_border_color_start = "#bf5af2"
gx_border_color_mid = "#00d4ff"
gx_border_color_end = "rgba(0, 212, 255, 0.15)"
gx_border_width = "1.5px"
gx_corner_size = "10px"
gx_glow_opacity = "0.8"
gx_glow_spread = "12px"
sidebar_glow_color = "rgba(191, 90, 242, 0.35)"
bokeh_color_1 = "rgba(138, 43, 226, 0.14)"
bokeh_color_2 = "rgba(0, 191, 255, 0.12)"
bokeh_color_3 = "rgba(255, 0, 128, 0.10)"
bokeh_color_4 = "rgba(0, 255, 136, 0.06)"
bokeh_blur = "90px"
accent_rgb = "191, 90, 242"
inner_glow_intensity = "1"
glass_brightness = "1.08"

[syntax]
keyword = "#ff6ac1"
string = "#5af2c0"
comment = "#666688"
function = "#bf5af2"
type = "#00d4ff"
number = "#ffcc66"
operator = "#ff6ac1"
variable = "#ff9e64"
punctuation = "#666688"
constant = "#00d4ff"
tag = "#5af2c0"
attribute = "#00d4ff"
property = "#00d4ff"
constructor = "#ff9e64"
embedded = "#e0e0ff"

[typography]
font_size = 16
line_height = 1.4
code_font_size = 14

[effects]
frosted_glass = true
frosted_blur = "28px"
frosted_saturate = "200%"
gradient_backdrop = true
noise_texture = true
noise_opacity = 0.03
scroll_animations = true
heading_gradient_text = true
gx_border = true
gx_border_mode = "full"
bokeh_orbs = true
```

### 7. Dynamic Particle Colors from Theme

**Files:** `src/particles.js`

Currently particle colors are hard-coded RGB triplets. Change to read from CSS custom properties at init and on theme change.

- On `start()` and on theme mutation (via `MutationObserver` on `<style id="lexer-theme">`), read `--accent`, `--gradient-b`, `--gradient-c` from computed styles and parse to RGB triplets.
- Fall back to current hard-coded values if parsing fails.

---

## Files to Modify

| File | Change |
|---|---|
| `src/effects.js` | Full-perimeter GX border mode, bokeh orb injection, theme-reactive particle colors |
| `src/effects.css` | Bokeh orb styles/animations, inner content glow, enhanced effects-off rules |
| `src/style.css` | New CSS custom properties in `:root`, increased glass defaults, glass-brightness, sidebar glow vars, accent-rgb |
| `src/layout.css` | ToC sidebar glass effect, active item neon glow |
| `src/particles.js` | Dynamic color reading from CSS custom properties |
| `src-tauri/src/theme/engine.rs` | New fields in `ThemeColors` and `ThemeEffects` structs, compile to CSS |
| `src-tauri/themes/lexer-neon.toml` | New neon cyberpunk theme file |
| `src-tauri/themes/lexer-dark.toml` | Add new color fields with subtle defaults (backward compatible) |

## Files to Update (Docs)

| File | Change |
|---|---|
| `docs/05-visual-effects.md` | Document bokeh orbs, full-perimeter glow, inner glow, sidebar glow |
| `docs/09-themes.md` | Document new TOML fields |
| `docs/PROGRESS.md` | Check off any related items |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| `gx_border_mode` not set in theme | Default to `"l-shape"` (backward compatible) |
| `bokeh_orbs = false` or unset | No orbs injected, no performance cost |
| Low-end hardware / reduced motion | `prefers-reduced-motion` disables bokeh drift animation; `effects-off` hides all |
| Theme switching at runtime | Bokeh orbs read new colors, GX border redraws, particles update colors |
| Window resize with bokeh orbs | Orbs use percentage-based positioning, no reflow needed |
| Existing themes (dark, light, etc.) | No change — new fields have sensible defaults or are optional |
| `glass_brightness` set to 0 or negative | Clamp to minimum 0.5 in CSS `max()` |
| `--accent-rgb` not set by theme | JS parses `--accent` hex to extract RGB, falls back to `88, 166, 255` |

---

## Future Enhancements

- Parallax depth layers (spec'd in `05-visual-effects.md`, not yet implemented)
- Magnetic heading attraction effect
- Letter stagger animation on h1
- Customizable bokeh orb count via command palette
- Animated gradient border (color shifting over time) as a third `gx_border_mode`
- Per-element glow intensity control via data attributes

---

## Spec References

- `docs/05-visual-effects.md` — Visual effects engine spec (authoritative)
- `docs/09-themes.md` — Theme TOML format, CSS custom properties
- `docs/04-ui.md` — Window chrome, panels, layout
- `docs/01-overview.md` — Architecture overview
