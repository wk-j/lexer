# Visual Effects

Lexer provides a distinctive visual identity through layered rendering effects. Effects are GPU-accelerated via CSS and composited efficiently by the webview engine.

## Background & Atmosphere

| Effect                  | Implementation                     | Description                                                  |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Frosted glass panels    | `backdrop-filter: blur() saturate()` | Semi-transparent content panels with blur behind them       |
| Gradient mesh backdrop  | CSS `radial-gradient` layers       | Soft, multi-stop color gradients behind the content area     |
| Noise texture overlay   | CSS `background-image` (SVG/data URI) | Subtle grain texture for depth, blended via `mix-blend-mode` |
| Ambient glow            | CSS `box-shadow` with large spread | Soft colored glow around code blocks and blockquotes         |

```css
/* Frosted glass content panel */
.content-panel {
    background: var(--panel-bg);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
}

/* Gradient mesh backdrop */
.app-backdrop {
    background:
        radial-gradient(ellipse at 20% 50%, var(--gradient-a) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, var(--gradient-b) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, var(--gradient-c) 0%, transparent 50%),
        var(--bg-base);
}
```

## Element-Level Effects

| Element         | Effect                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Code blocks     | Subtle inner shadow, ambient glow matching syntax theme accent color   |
| Blockquotes     | Left border gradient, slight frosted background                        |
| Headings        | Optional text gradient fill via `background-clip: text`                |
| Links           | Underline animation on hover (slide-in from left)                      |
| Tables          | Alternating row tint, header row with blur backdrop                    |
| Horizontal rule | Gradient fade line with glow pulse                                     |
| Images          | Rounded corners, subtle drop shadow, zoom-on-hover transition          |

## Transitions & Animations

| Trigger              | Animation                                      | Duration  |
| -------------------- | ---------------------------------------------- | --------- |
| Theme switch         | Cross-fade entire document via `transition`     | 300ms     |
| Content reload       | Fade-out old -> fade-in new                     | 200ms     |
| Scroll into view     | Headings and blocks fade-up via `IntersectionObserver` | 400ms ease-out |
| Code block hover     | Glow intensity increase, slight scale           | 150ms     |
| ToC sidebar toggle   | Slide-in/out from left with backdrop fade       | 250ms     |
| Image load           | Progressive fade-in from transparent            | 300ms     |

```javascript
// Scroll-triggered fade-in for content blocks
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
```

```css
.fade-up {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 400ms ease-out, transform 400ms ease-out;
}
.fade-up.visible {
    opacity: 1;
    transform: translateY(0);
}
```

## Particle & Canvas Background Effects

A lightweight `<canvas>` layer sits behind the content panel. It renders ambient particle animations that react to the active theme's color palette. The canvas is GPU-composited and runs at a capped frame rate to stay efficient.

| Effect Preset     | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `floating_dots`   | Small translucent dots drift slowly with Brownian motion                 |
| `constellation`   | Dots connected by faint lines when within proximity (graph/network look) |
| `aurora`           | Smooth sine-wave color bands that shift horizontally over time           |
| `fireflies`       | Sparse glowing points that pulse in/out with random timing              |
| `rain`            | Thin vertical streaks falling at slight angles, fading at the bottom     |
| `none`            | Canvas disabled, pure CSS background only                                |

```javascript
// Canvas effect engine (simplified)
class ParticleCanvas {
    constructor(canvas, theme) {
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.preset = theme.effects.canvas_preset; // e.g. "constellation"
        this.colors = [theme.colors.gradient_a, theme.colors.gradient_b];
        this.fps = 30; // capped for battery
    }

    spawn(count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.4 + 0.1,
            });
        }
    }

    drawConstellation() {
        const maxDist = 120;
        for (const p of this.particles) {
            // Draw dot
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${this.rgb}, ${p.opacity})`;
            this.ctx.fill();
            // Draw connections
            for (const q of this.particles) {
                const d = Math.hypot(p.x - q.x, p.y - q.y);
                if (d < maxDist) {
                    this.ctx.strokeStyle = `rgba(${this.rgb}, ${0.08 * (1 - d / maxDist)})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(q.x, q.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    tick() { /* update positions, wrap edges, call draw */ }
}
```

```css
/* Canvas sits behind everything */
.particle-canvas {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
    pointer-events: none;
}
.app-backdrop { z-index: 1; }
.content-panel { z-index: 2; position: relative; }
```

## Parallax & Depth Layers

The viewport is composed of stacked depth layers that shift at different rates during scroll, creating a subtle 3D parallax effect.

| Layer (back to front) | Content                        | Scroll Rate | CSS Strategy                |
| --------------------- | ------------------------------ | ----------- | --------------------------- |
| L0 - Deep background  | Particle canvas                | 0.1x        | `transform: translateY(calc(var(--scroll) * 0.1))` |
| L1 - Gradient mesh    | Radial gradient blobs          | 0.3x        | Same, with 0.3 multiplier   |
| L2 - Noise overlay    | Grain texture                  | 0.5x        | Stays mostly static          |
| L3 - Content panel    | Rendered Markdown              | 1.0x        | Normal scroll                |
| L4 - Floating UI      | ToC sidebar, status bar        | 1.0x        | `position: sticky/fixed`     |

```javascript
// Parallax scroll handler (throttled to rAF)
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const y = window.scrollY;
            document.documentElement.style.setProperty('--scroll', y);
            ticking = false;
        });
        ticking = true;
    }
});
```

```css
.layer-deep     { transform: translateY(calc(var(--scroll, 0) * -0.1px)); }
.layer-gradient { transform: translateY(calc(var(--scroll, 0) * -0.3px)); }
.layer-noise    { transform: translateY(calc(var(--scroll, 0) * -0.05px)); }
```

## Cursor-Reactive Effects

The mouse cursor influences nearby elements, adding a layer of interactivity to the reading experience.

| Effect              | Behavior                                                              |
| ------------------- | --------------------------------------------------------------------- |
| Spotlight glow      | A soft radial gradient follows the cursor across the backdrop          |
| Code block proximity| Code blocks subtly brighten/glow as the cursor approaches              |
| Magnetic headings   | Headings shift very slightly toward the cursor (< 2px) on hover       |
| Ripple on click     | Clicking anywhere spawns a CSS ripple ring that expands and fades      |

```javascript
// Cursor spotlight - soft glow that follows mouse
document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    document.documentElement.style.setProperty('--cursor-x', `${x}px`);
    document.documentElement.style.setProperty('--cursor-y', `${y}px`);
});
```

```css
/* Cursor spotlight overlay */
.cursor-spotlight {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 1;
    background: radial-gradient(
        600px circle at var(--cursor-x) var(--cursor-y),
        var(--spotlight-color, rgba(255, 255, 255, 0.03)),
        transparent 60%
    );
    transition: background 50ms ease;
}

/* Ripple on click */
.ripple {
    position: absolute;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.15;
    transform: scale(0);
    animation: ripple-expand 600ms ease-out forwards;
    pointer-events: none;
}
@keyframes ripple-expand {
    to { transform: scale(4); opacity: 0; }
}
```

```javascript
// Click ripple
document.addEventListener('click', (e) => {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - 25}px`;
    ripple.style.top = `${e.clientY - 25}px`;
    ripple.style.width = ripple.style.height = '50px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
});
```

## Advanced Code Block Effects

Code blocks are the centerpiece of a Markdown viewer for developers. They receive special rendering treatment.

| Effect                  | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| Line highlight on hover | Hovering a line adds a subtle background tint to that line             |
| Line numbers            | Optional gutter with muted line numbers (toggleable)                   |
| Copy glow               | Clicking the copy button triggers a brief green glow on the block      |
| Language badge           | Floating pill label in the top-right corner showing the language       |
| Scroll shadow           | Inner shadow at top/bottom edges when code block is scrollable         |
| Focus dim               | Hovering a code block dims the rest of the page slightly               |

```css
/* Line highlight on hover */
pre code .line:hover {
    background: var(--code-line-hover, rgba(255, 255, 255, 0.04));
    border-radius: 2px;
}

/* Scroll shadow for overflowing code blocks */
pre {
    background:
        linear-gradient(var(--code-bg) 30%, transparent),
        linear-gradient(transparent, var(--code-bg) 70%) 0 100%,
        radial-gradient(farthest-side at 50% 0, rgba(0,0,0,0.15), transparent),
        radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,0.15), transparent) 0 100%;
    background-repeat: no-repeat;
    background-size: 100% 40px, 100% 40px, 100% 12px, 100% 12px;
    background-attachment: local, local, scroll, scroll;
}

/* Language badge */
pre .lang-badge {
    position: absolute;
    top: 8px; right: 12px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--panel-bg);
    color: var(--text-muted);
    backdrop-filter: blur(8px);
}

/* Focus dim: dim everything else when hovering a code block */
.content-panel:has(pre:hover) > *:not(pre:hover) {
    opacity: 0.6;
    transition: opacity 300ms ease;
}
pre:hover {
    opacity: 1;
    box-shadow: 0 0 var(--glow-radius) var(--glow-color);
}
```

## Heading & Typography Effects

| Effect                   | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| Gradient text fill       | Heading text rendered with a gradient via `background-clip: text`    |
| Underline reveal         | A decorative underline slides in from the left when heading scrolls into view |
| Letter stagger           | On first appear, heading letters animate in with a staggered delay (optional, h1 only) |
| Section divider glow     | A faint horizontal glow line appears below each h2                    |

```css
/* Gradient heading text */
h1, h2, h3 {
    background: var(--heading-gradient, linear-gradient(135deg, var(--accent), var(--text-primary)));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Underline reveal on scroll-in */
h2::after {
    content: '';
    display: block;
    width: 0;
    height: 2px;
    margin-top: 4px;
    background: var(--accent);
    transition: width 500ms ease-out;
}
h2.visible::after {
    width: 60px;
}

/* Section divider glow below h2 */
h2 {
    padding-bottom: 12px;
    border-bottom: 1px solid transparent;
    box-shadow: 0 1px 12px -4px var(--accent);
}
```

## Image & Media Effects

| Effect                | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| Lazy fade-in          | Images start transparent and fade in when loaded                       |
| Tilt on hover         | Slight 3D `perspective` + `rotateX/Y` tilt following cursor position   |
| Lightbox              | Click to expand image into a centered overlay with blurred backdrop    |
| Rounded frame         | Subtle border, rounded corners, and drop shadow                        |
| Caption slide-up      | If alt text exists, it slides up as a caption overlay on hover         |

```css
/* Image tilt on hover (3D perspective) */
.md-image-wrapper {
    perspective: 800px;
    display: inline-block;
}
.md-image-wrapper img {
    transition: transform 200ms ease-out, box-shadow 200ms ease;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
.md-image-wrapper:hover img {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

/* Caption from alt text */
.md-image-wrapper .caption {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    color: #fff;
    font-size: 13px;
    border-radius: 0 0 8px 8px;
    transform: translateY(100%);
    transition: transform 250ms ease;
}
.md-image-wrapper:hover .caption {
    transform: translateY(0);
}

/* Lightbox overlay */
.lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 250ms ease;
}
.lightbox-overlay.active { opacity: 1; }
.lightbox-overlay img {
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.5);
}
```

```javascript
// Image tilt effect (follows cursor within image bounds)
document.querySelectorAll('.md-image-wrapper').forEach(wrapper => {
    const img = wrapper.querySelector('img');
    wrapper.addEventListener('mousemove', (e) => {
        const rect = wrapper.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 to 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        img.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    wrapper.addEventListener('mouseleave', () => {
        img.style.transform = 'rotateY(0) rotateX(0)';
    });
});

// Lightbox
document.querySelectorAll('.md-image-wrapper img').forEach(img => {
    img.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
        overlay.addEventListener('click', () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 250);
        });
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
    });
});
```

## Performance Budgets

Visual effects must not degrade the reading experience. Hard limits:

| Metric                     | Budget                                          |
| -------------------------- | ----------------------------------------------- |
| Canvas frame rate           | Capped at 30fps (idle: 10fps when tab in background) |
| Canvas particle count       | Max 80 particles (auto-reduce on low-end)       |
| Scroll jank                 | All scroll handlers run in `requestAnimationFrame`, no forced layout |
| GPU layers                  | Max 6 composited layers (canvas, gradient, noise, panel, spotlight, lightbox) |
| Effect init time            | < 16ms on startup, lazy-init canvas on first idle |
| Reduced motion              | All animations disabled when `prefers-reduced-motion: reduce` |
| Battery                     | Canvas auto-pauses after 30s of no scroll/mouse activity |

```css
/* Respect user motion preference */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
    .particle-canvas { display: none; }
    .cursor-spotlight { display: none; }
}
```

```javascript
// Auto-pause canvas when idle
let idleTimer;
function resetIdle() {
    clearTimeout(idleTimer);
    canvas.resume();
    idleTimer = setTimeout(() => canvas.pause(), 30000);
}
window.addEventListener('scroll', resetIdle, { passive: true });
window.addEventListener('mousemove', resetIdle, { passive: true });
```

## Effect Configuration

All visual effects are controlled by the theme and can be toggled by the user. Effects degrade gracefully -- if `backdrop-filter` is unsupported, panels fall back to solid backgrounds.

```toml
# In theme file or user config
[effects]
frosted_glass = true            # backdrop-filter blur panels
gradient_backdrop = true        # gradient mesh background
noise_texture = true            # grain overlay
ambient_glow = true             # glow around code blocks
scroll_animations = true        # fade-up on scroll
transition_duration = 300       # ms, global transition speed

# Canvas
canvas_preset = "constellation" # floating_dots | constellation | aurora | fireflies | rain | none
canvas_particle_count = 60      # number of particles (max 80)
canvas_opacity = 0.4            # overall canvas opacity

# Parallax
parallax = true                 # enable depth layers
parallax_intensity = 1.0        # multiplier (0.0 = off, 2.0 = exaggerated)

# Cursor
cursor_spotlight = true         # radial glow follows cursor
cursor_spotlight_size = 600     # px, diameter of spotlight
cursor_ripple = true            # click ripple effect

# Code blocks
code_line_highlight = true      # highlight line on hover
code_line_numbers = false       # show line numbers
code_focus_dim = true           # dim surrounding content on hover
code_copy_button = true         # show copy button
code_lang_badge = true          # show language label

# Headings
heading_gradient_text = true    # gradient fill on headings
heading_underline_reveal = true # animated underline on scroll-in

# Images
image_tilt = true               # 3D tilt on hover
image_lightbox = true           # click-to-expand overlay
image_caption_reveal = true     # slide-up alt-text caption
```
