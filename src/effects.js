// Lexer - Interactive Visual Effects
// Uses DOM refs from app.js (loaded first)

class EffectsEngine {
  constructor() {
    this.contentEl = document.getElementById('content');
    this.observer = null;
    this.lightboxEl = null;
    this._initCursorTracking();
    this._initClickRipple();
    this._initScrollObserver();
    this._initScrollBlurToggle();
    this._initContentObserver();
    this._applyEffects();
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

  // --- Disable blur while scrolling for performance ---

  _initScrollBlurToggle() {
    let scrollTimer = null;
    this.contentEl.addEventListener('scroll', () => {
      if (!this.contentEl.classList.contains('is-scrolling')) {
        this.contentEl.classList.add('is-scrolling');
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        this.contentEl.classList.remove('is-scrolling');
      }, 150);
    }, { passive: true });
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
