// Lexer - Layout & ToC Sidebar Engine
// Uses `invoke` from app.js (loaded first)

class LayoutEngine {
  constructor() {
    this.sidebar = document.getElementById('toc-sidebar');
    this.contentEl = document.getElementById('content');
    this.zenControls = document.getElementById('zen-controls');

    this._bindEvents();
    this._initZenControls();
  }

  // --- ToC Rendering ---

  async renderToc() {
    if (!this.sidebar) return;

    try {
      const toc = await invoke('get_toc');
      if (!toc || toc.length === 0) {
        this.sidebar.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 12px;">No headings</div>';
        return;
      }

      this.sidebar.innerHTML = toc.map(entry =>
        `<a class="toc-item" data-level="${entry.level}" href="#${entry.id}">${this._escapeHtml(entry.text)}</a>`
      ).join('');

      // Click handlers
      this.sidebar.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.getElementById(item.getAttribute('href').slice(1));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // Start scroll-spy
      this._startScrollSpy();
    } catch (err) {
      console.error('Failed to render ToC:', err);
    }
  }

  // --- Scroll Spy (highlight active heading in ToC) ---

  _startScrollSpy() {
    if (this._scrollSpyRaf) return; // already running

    const update = () => {
      if (!this.sidebar.classList.contains('visible') &&
          document.documentElement.dataset.layout !== 'split') {
        this._scrollSpyRaf = null;
        return;
      }

      const headings = this.contentEl.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
      const scrollTop = this.contentEl.scrollTop + 40;
      let activeId = null;

      for (const h of headings) {
        if (h.offsetTop <= scrollTop) {
          activeId = h.id;
        } else {
          break;
        }
      }

      const items = this.sidebar.querySelectorAll('.toc-item');
      items.forEach(item => {
        const href = item.getAttribute('href');
        if (href === `#${activeId}`) {
          item.classList.add('active');
          // Scroll active item into view in sidebar
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });

      this._scrollSpyRaf = requestAnimationFrame(update);
    };

    this.contentEl.addEventListener('scroll', () => {
      if (!this._scrollSpyRaf) {
        this._scrollSpyRaf = requestAnimationFrame(update);
      }
    }, { passive: true });

    // Initial update
    this._scrollSpyRaf = requestAnimationFrame(update);
  }

  // --- Zen Mode Controls ---

  _initZenControls() {
    if (!this.zenControls) return;

    document.addEventListener('mousemove', (e) => {
      if (document.documentElement.dataset.layout === 'zen') {
        this.zenControls.classList.toggle('visible', e.clientY < 40);
      }
    }, { passive: true });
  }

  // --- Events ---

  _bindEvents() {
    // Re-render ToC when content changes (file open, file-changed)
    const observer = new MutationObserver(() => {
      const layout = document.documentElement.dataset.layout;
      if (layout === 'split' || this.sidebar?.classList.contains('visible')) {
        // Debounce slightly
        clearTimeout(this._tocDebounce);
        this._tocDebounce = setTimeout(() => this.renderToc(), 100);
      }
    });

    if (this.contentEl) {
      observer.observe(this.contentEl, { childList: true });
    }
  }

  // --- Helpers ---

  _escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// --- Bootstrap ---
const layoutEngine = new LayoutEngine();
window.lexerLayout = layoutEngine;
