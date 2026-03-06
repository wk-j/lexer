// Lexer - Interactive Visual Effects
// Uses DOM refs from app.js (loaded first)

class EffectsEngine {
  constructor() {
    this.contentEl = document.getElementById('content');
    this.observer = null;
    this.lightboxEl = null;
    this._initGXBorder();
    this._initCursorTracking();
    this._initClickRipple();
    this._initScrollObserver();
    this._initContentObserver();
    this._applyEffects();
  }

  // --- Opera GX-Style Border with Cut Corner ---

  _initGXBorder() {
    this._gxCanvas = document.getElementById('gx-border');
    if (!this._gxCanvas) return;
    this._gxCtx = this._gxCanvas.getContext('2d');
    this._gxDpr = window.devicePixelRatio || 1;

    this._updateGXBorder();
    window.addEventListener('resize', () => {
      requestAnimationFrame(() => this._updateGXBorder());
    });

    // Redraw when theme changes (CSS variables update)
    const themeObserver = new MutationObserver(() => {
      requestAnimationFrame(() => this._updateGXBorder());
    });
    // Watch the <style id="lexer-theme"> element for content changes
    const watchForThemeEl = () => {
      const themeEl = document.getElementById('lexer-theme');
      if (themeEl) {
        themeObserver.observe(themeEl, { childList: true, characterData: true, subtree: true });
      } else {
        // Theme style not injected yet; watch <head> until it appears
        const headObs = new MutationObserver(() => {
          const el = document.getElementById('lexer-theme');
          if (el) {
            headObs.disconnect();
            themeObserver.observe(el, { childList: true, characterData: true, subtree: true });
            requestAnimationFrame(() => this._updateGXBorder());
          }
        });
        headObs.observe(document.head, { childList: true });
      }
    };
    watchForThemeEl();
  }

  _updateGXBorder() {
    const canvas = this._gxCanvas;
    const ctx = this._gxCtx;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Size canvas to window at device pixel ratio
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    const styles = getComputedStyle(document.documentElement);
    const cs = parseFloat(styles.getPropertyValue('--gx-corner-size')) || 10;
    const bw = parseFloat(styles.getPropertyValue('--gx-border-width')) || 1.5;
    const glowSpread = parseFloat(styles.getPropertyValue('--gx-glow-spread')) || 4;
    const glowOpacity = parseFloat(styles.getPropertyValue('--gx-glow-opacity')) || 0.5;

    // Read accent color for border
    const accent = styles.getPropertyValue('--accent').trim() || '#58a6ff';
    const bgOpaque = styles.getPropertyValue('--bg-base-opaque').trim() || '#0d1117';

    ctx.clearRect(0, 0, w, h);

    // Opera GX-style: only left edge + cut diagonal + top edge (open L-shape)
    const inset = bw / 2 + 0.5;
    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(inset, h);                       // bottom-left
      ctx.lineTo(inset, cs + inset);              // left edge up to cut
      ctx.lineTo(cs + inset, inset);              // diagonal cut
      ctx.lineTo(w, inset);                       // top edge to right
    };

    // 1) Fill the cut corner triangle with opaque bg to mask content behind
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cs + inset + 1, 0);
    ctx.lineTo(0, cs + inset + 1);
    ctx.closePath();
    ctx.fillStyle = bgOpaque;
    ctx.fill();
    ctx.restore();

    // 2) Draw glow layer (multiple passes for neon bloom)
    ctx.save();
    for (let i = 3; i >= 1; i--) {
      buildPath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = bw + i * 2;
      ctx.globalAlpha = glowOpacity * (0.3 / i);
      ctx.shadowColor = accent;
      ctx.shadowBlur = glowSpread * i * 2;
      ctx.stroke();
    }
    ctx.restore();

    // 3) Draw sharp border line
    ctx.save();
    buildPath();
    ctx.strokeStyle = accent;
    ctx.lineWidth = bw;
    ctx.globalAlpha = 1;
    ctx.shadowColor = accent;
    ctx.shadowBlur = glowSpread;
    ctx.stroke();
    ctx.restore();

    // 4) Brighter accent on the cut diagonal for emphasis
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(inset, cs + inset);
    ctx.lineTo(cs + inset, inset);
    ctx.strokeStyle = accent;
    ctx.lineWidth = bw + 0.5;
    ctx.globalAlpha = 1;
    ctx.shadowColor = accent;
    ctx.shadowBlur = glowSpread * 3;
    ctx.stroke();
    ctx.restore();
  }

  // --- Cursor Spotlight ---

  _initCursorTracking() {
    document.addEventListener('mousemove', (e) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    }, { passive: true });
  }

  // --- Click Ripple ---

  _initClickRipple() {
    document.addEventListener('click', (e) => {
      // Don't ripple on interactive elements
      if (e.target.closest('a, button, input, .palette-overlay, .lightbox-overlay')) return;
      if (document.body.classList.contains('effects-off')) return;

      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      const size = 50;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - size / 2}px`;
      ripple.style.top = `${e.clientY - size / 2}px`;
      document.body.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  // --- Scroll-in Observer ---

  _initScrollObserver() {
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          this.observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.1 });
  }

  // --- Content Mutation Observer ---
  // Re-apply effects whenever #content innerHTML changes (file open, reload)

  _initContentObserver() {
    const mo = new MutationObserver(() => {
      // Debounce: wait a frame for DOM to settle
      requestAnimationFrame(() => this._applyEffects());
    });
    mo.observe(this.contentEl, { childList: true, subtree: false });
  }

  // --- Apply Effects to Content ---

  _applyEffects() {
    this._observeFadeUp();
    this._injectCopyButtons();
    this._bindImageLightbox();
    this._bindImageTilt();
  }

  // --- Fade-up on scroll ---

  _observeFadeUp() {
    // Observe headings, code blocks, blockquotes, images, tables
    const selectors = 'h1, h2, h3, h4, h5, h6, pre, blockquote, img, table';
    const elements = this.contentEl.querySelectorAll(selectors);
    for (const el of elements) {
      if (!el.classList.contains('fade-up')) {
        el.classList.add('fade-up');
        this.observer.observe(el);
      }
    }
  }

  // --- Code Block Copy Button ---

  _injectCopyButtons() {
    const blocks = this.contentEl.querySelectorAll('pre');
    for (const pre of blocks) {
      if (pre.querySelector('.code-copy-btn')) continue; // already injected

      // Ensure pre is positioned for absolute children
      if (getComputedStyle(pre).position === 'static') {
        pre.style.position = 'relative';
      }

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1500);
        }).catch(() => {});
      });
      pre.appendChild(btn);
    }
  }

  // --- Image Lightbox ---

  _bindImageLightbox() {
    const images = this.contentEl.querySelectorAll('img');
    for (const img of images) {
      if (img.dataset.lightboxBound) continue;
      img.dataset.lightboxBound = 'true';

      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openLightbox(img.src, img.alt);
      });
    }
  }

  _openLightbox(src, alt) {
    if (this.lightboxEl) return; // already open

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    overlay.appendChild(img);

    const close = () => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        this.lightboxEl = null;
      }, 250);
    };

    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    });

    document.body.appendChild(overlay);
    this.lightboxEl = overlay;
    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  // --- Image 3D Tilt ---

  _bindImageTilt() {
    const images = this.contentEl.querySelectorAll('img');
    for (const img of images) {
      if (img.dataset.tiltBound) continue;
      img.dataset.tiltBound = 'true';

      img.addEventListener('mousemove', (e) => {
        if (document.body.classList.contains('effects-off')) return;
        const rect = img.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        img.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) scale(1.02)`;
      });

      img.addEventListener('mouseleave', () => {
        img.style.transform = '';
      });
    }
  }
}

// --- Bootstrap ---
const effects = new EffectsEngine();
window.lexerEffects = effects;
