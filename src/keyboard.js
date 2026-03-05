// Lexer - Helix-Style Keyboard Navigation Engine
// Uses `invoke` and `listen` from app.js (loaded first)

class KeyboardEngine {
  constructor() {
    this.mode = 'normal';
    this.pending = '';
    this.timeout = null;
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchIndex = -1;

    // DOM refs
    this.contentEl = document.getElementById('content');
    this.modeBadge = document.getElementById('mode-badge');
    this.pendingEl = document.getElementById('pending-keys');
    this.whichKeyEl = document.getElementById('which-key');
    this.searchBar = document.getElementById('search-bar');
    this.searchInput = document.getElementById('search-input');

    // Focused link index for Tab navigation
    this.focusedLinkIndex = -1;

    this._bindKeymaps();
  }

  // --- Keymap Definitions ---

  _bindKeymaps() {
    this.keymaps = {
      normal: {
        'j':      { fn: () => this._scroll(120) },
        'k':      { fn: () => this._scroll(-120) },
        'ArrowDown': { fn: () => this._scroll(120) },
        'ArrowUp':   { fn: () => this._scroll(-120) },
        'd':      { fn: () => this._scroll(this.contentEl.clientHeight / 2) },
        'u':      { fn: () => this._scroll(-this.contentEl.clientHeight / 2) },
        'f':      { fn: () => this._scroll(this.contentEl.clientHeight) },
        'b':      { fn: () => this._scroll(-this.contentEl.clientHeight) },
        'G':      { fn: () => this._scrollTo(this.contentEl.scrollHeight) },
        ']':      { fn: () => this._jumpHeading(1) },
        '[':      { fn: () => this._jumpHeading(-1) },
        ']]':     { fn: () => this._jumpHeading(1, 2) },
        '[[':     { fn: () => this._jumpHeading(-1, 2) },
        '1':      { fn: () => this._jumpHeadingLevel(1) },
        '2':      { fn: () => this._jumpHeadingLevel(2) },
        '3':      { fn: () => this._jumpHeadingLevel(3) },
        '4':      { fn: () => this._jumpHeadingLevel(4) },
        '5':      { fn: () => this._jumpHeadingLevel(5) },
        '6':      { fn: () => this._jumpHeadingLevel(6) },
        'Tab':    { fn: () => this._focusLink(1) },
        'S-Tab':  { fn: () => this._focusLink(-1) },
        'Enter':  { fn: () => this._activateFocusedLink() },
        'y':      { fn: () => this._copyAnchor() },
        'r':      { fn: () => this._reload() },
        'n':      { fn: () => this._searchNext(1) },
        'N':      { fn: () => this._searchNext(-1) },
        'H':      { fn: () => window.lexerApp?.prevBuffer() },
        'L':      { fn: () => window.lexerApp?.nextBuffer() },
        '?':      { fn: () => this._showHelp() },
        'g':      { mode: 'goto' },
        ' ':      { mode: 'space' },
        'z':      { mode: 'view' },
        '/':      { mode: 'search' },
      },

      goto: {
        'g':  { fn: () => this._scrollTo(0) },
        'e':  { fn: () => this._scrollTo(this.contentEl.scrollHeight) },
        'h':  { fn: () => this._jumpToFirstHeading() },
        'l':  { fn: () => this._jumpToLastHeading() },
        't':  { fn: () => this._toggleToc() },
      },

      space: {
        'f':  { fn: () => this._openPalette('') },
        'bb': { fn: () => this._openPalette('%') },
        'bn': { fn: () => window.lexerApp?.nextBuffer() },
        'bp': { fn: () => window.lexerApp?.prevBuffer() },
        'bd': { fn: () => this._closeCurrentBuffer() },
        'bN': { fn: () => this._newEmptyBuffer() },
        'bo': { fn: () => window.lexerApp?.closeOtherBuffers() },
        'r':  { fn: () => this._openPalette('>') },
        'h':  { fn: () => this._openPalette('#') },
        'c':  { fn: () => this._openPalette(':') },
        't':  { fn: () => this._openPalette('@') },
        '/':  { fn: () => this.setMode('search') },
        's':  { fn: () => this._toggleToc() },
        'e':  { fn: () => this._toggleEffects() },
        'l':  { fn: () => this._toggleLineNumbers() },
      },

      view: {
        'z':  { fn: () => this._viewCenter() },
        't':  { fn: () => this._viewTop() },
        'b':  { fn: () => this._viewBottom() },
        '+':  { fn: () => this._zoom(1) },
        '=':  { fn: () => this._zoomReset() },
        '-':  { fn: () => this._zoom(-1) },
      },
    };

    // Which-key labels for discoverable modes
    this.whichKeyLabels = {
      goto: {
        title: 'g - Goto',
        keys: [
          ['g', 'top of document'],
          ['e', 'end of document'],
          ['h', 'first heading'],
          ['l', 'last heading'],
          ['t', 'table of contents'],
        ],
      },
      space: {
        title: 'Space - Commands',
        keys: [
          ['f', 'file search'],
          ['b', 'buffer...'],
          ['r', 'recent files'],
          ['h', 'heading jump'],
          ['c', 'command mode'],
          ['t', 'theme picker'],
          ['/', 'text search'],
          ['s', 'toggle sidebar'],
          ['e', 'toggle effects'],
          ['l', 'toggle line numbers'],
        ],
      },
      'space:b': {
        title: 'b - Buffer',
        keys: [
          ['b', 'buffer picker'],
          ['n', 'next buffer'],
          ['p', 'previous buffer'],
          ['d', 'close buffer'],
          ['N', 'new empty buffer'],
          ['o', 'close others'],
        ],
      },
      view: {
        title: 'z - View',
        keys: [
          ['z', 'center viewport'],
          ['t', 'scroll to top'],
          ['b', 'scroll to bottom'],
          ['+', 'zoom in'],
          ['-', 'zoom out'],
          ['=', 'reset zoom'],
        ],
      },
    };
  }

  // --- Event Handler ---

  handleKey(e) {
    // Ignore when palette or other overlay is open
    if (this._isOverlayActive()) return;

    // Search mode has special handling
    if (this.mode === 'search') {
      this._handleSearchKey(e);
      return;
    }

    // Ignore keys with Ctrl/Cmd (let browser/Tauri handle those)
    if (e.ctrlKey || e.metaKey) return;

    const key = this._normalizeKey(e);
    const map = this.keymaps[this.mode];
    if (!map) return;

    // Build sequence
    const seq = this.pending + key;

    // Check exact match
    if (map[seq]) {
      e.preventDefault();
      this._execute(map[seq]);
      this.pending = '';
      this._clearTimeout();
      this._hideWhichKey();
      return;
    }

    // Check if seq is a prefix of any key
    if (this._hasPrefix(map, seq)) {
      e.preventDefault();
      this.pending = seq;
      this._updatePending();
      this._resetTimeout();
      // Show contextual which-key for sub-modes (e.g. Space > b shows buffer menu)
      const subKey = `${this.mode}:${seq}`;
      if (this.whichKeyLabels[subKey]) {
        this._showWhichKey(subKey);
      }
      return;
    }

    // No match — if in sub-mode, return to normal
    if (this.mode !== 'normal') {
      this.setMode('normal');
    }
    this.pending = '';
    this._updatePending();
    this._hideWhichKey();
  }

  // --- Execution ---

  _execute(action) {
    if (action.mode) {
      this.setMode(action.mode);
    } else if (action.fn) {
      action.fn();
      // Return to normal after action in sub-modes
      if (this.mode !== 'normal' && this.mode !== 'search') {
        this.setMode('normal');
      }
    }
  }

  // --- Mode Management ---

  setMode(mode) {
    this.mode = mode;
    this.pending = '';
    document.documentElement.dataset.mode = mode;
    this._updateModeBadge();
    this._updatePending();

    if (mode === 'search') {
      this._enterSearch();
    } else {
      this._exitSearch();
      if (this.whichKeyLabels[mode]) {
        this._showWhichKey(mode);
      } else {
        this._hideWhichKey();
      }
    }
  }

  // --- Which-Key Popup ---

  _showWhichKey(mode) {
    const info = this.whichKeyLabels[mode];
    if (!info || !this.whichKeyEl) return;

    let html = `<div class="which-key-title">${info.title}</div>`;
    for (const [key, desc] of info.keys) {
      html += `<div class="which-key-row">`;
      html += `<span class="which-key-key">${this._escapeHtml(key)}</span>`;
      html += `<span class="which-key-desc">${this._escapeHtml(desc)}</span>`;
      html += `</div>`;
    }
    this.whichKeyEl.innerHTML = html;
    this.whichKeyEl.classList.add('visible');
  }

  _hideWhichKey() {
    if (this.whichKeyEl) {
      this.whichKeyEl.classList.remove('visible');
    }
  }

  // --- Status Bar ---

  _updateModeBadge() {
    if (!this.modeBadge) return;
    const labels = { normal: 'NOR', goto: 'GOT', space: 'SPC', search: 'SCH', view: 'VIW' };
    this.modeBadge.textContent = labels[this.mode] || this.mode.toUpperCase();
    this.modeBadge.className = `mode-badge mode-${this.mode}`;
  }

  _updatePending() {
    if (this.pendingEl) {
      this.pendingEl.textContent = this.pending ? this.pending + '-' : '';
    }
  }

  // --- Key Utilities ---

  _normalizeKey(e) {
    if (e.key === ' ') return ' ';
    if (e.key === 'Escape') return 'Escape';
    if (e.key === 'Tab') return e.shiftKey ? 'S-Tab' : 'Tab';
    if (e.key === 'Enter') return 'Enter';
    if (e.key === 'ArrowDown') return 'ArrowDown';
    if (e.key === 'ArrowUp') return 'ArrowUp';
    if (e.shiftKey && e.key.length === 1) return e.key; // already uppercase from browser
    return e.key;
  }

  _hasPrefix(map, prefix) {
    return Object.keys(map).some(k => k.startsWith(prefix) && k !== prefix);
  }

  _resetTimeout() {
    this._clearTimeout();
    this.timeout = setTimeout(() => {
      this.pending = '';
      this._updatePending();
      if (this.mode !== 'normal' && this.mode !== 'search') {
        this.setMode('normal');
      }
    }, 1000);
  }

  _clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  _isOverlayActive() {
    const palette = document.getElementById('palette');
    if (palette && palette.classList.contains('visible')) return true;
    const lightbox = document.querySelector('.lightbox.visible');
    if (lightbox) return true;
    return false;
  }

  // --- Scroll Actions ---

  _scroll(px) {
    this._animateScroll(this.contentEl.scrollTop + px, 100);
  }

  _scrollTo(y) {
    this._animateScroll(y, 300);
  }

  // Eased scroll animation using requestAnimationFrame
  _animateScroll(target, duration) {
    const el = this.contentEl;
    const start = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const dest = Math.max(0, Math.min(target, maxScroll));
    const distance = dest - start;

    if (Math.abs(distance) < 1) return;

    // Cancel any ongoing scroll animation
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);

    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = start + distance * ease;

      if (progress < 1) {
        this._scrollRaf = requestAnimationFrame(step);
      } else {
        this._scrollRaf = null;
      }
    };

    this._scrollRaf = requestAnimationFrame(step);
  }

  // --- Heading Navigation ---

  _getHeadings(minLevel) {
    const selector = minLevel
      ? Array.from({ length: minLevel }, (_, i) => `h${i + 1}`).join(',')
      : 'h1, h2, h3, h4, h5, h6';
    return Array.from(this.contentEl.querySelectorAll(selector));
  }

  _getVisibleTop() {
    return this.contentEl.scrollTop + 10;
  }

  _jumpHeading(direction, maxLevel) {
    const sel = maxLevel
      ? Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(',')
      : 'h1, h2, h3, h4, h5, h6';
    const headings = Array.from(this.contentEl.querySelectorAll(sel));
    if (!headings.length) return;

    const scrollTop = this._getVisibleTop();

    if (direction > 0) {
      const next = headings.find(h => h.offsetTop > scrollTop + 5);
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const prev = [...headings].reverse().find(h => h.offsetTop < scrollTop - 5);
      if (prev) prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  _jumpHeadingLevel(level) {
    const headings = Array.from(this.contentEl.querySelectorAll(`h${level}`));
    if (!headings.length) return;
    const scrollTop = this._getVisibleTop();
    const next = headings.find(h => h.offsetTop > scrollTop + 5);
    if (next) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  _jumpToFirstHeading() {
    const h = this.contentEl.querySelector('h1, h2, h3, h4, h5, h6');
    if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _jumpToLastHeading() {
    const all = this.contentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (all.length) all[all.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Link Navigation ---

  _getLinks() {
    return Array.from(this.contentEl.querySelectorAll('a[href]'));
  }

  _focusLink(direction) {
    const links = this._getLinks();
    if (!links.length) return;

    // Remove existing focus highlight
    links.forEach(l => l.classList.remove('link-focused'));

    this.focusedLinkIndex += direction;
    if (this.focusedLinkIndex < 0) this.focusedLinkIndex = links.length - 1;
    if (this.focusedLinkIndex >= links.length) this.focusedLinkIndex = 0;

    const link = links[this.focusedLinkIndex];
    link.classList.add('link-focused');
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  _activateFocusedLink() {
    const links = this._getLinks();
    if (this.focusedLinkIndex >= 0 && this.focusedLinkIndex < links.length) {
      links[this.focusedLinkIndex].click();
    }
  }

  // --- Actions ---

  _copyAnchor() {
    // Find nearest heading above current scroll position
    const headings = Array.from(this.contentEl.querySelectorAll('[id]'));
    const scrollTop = this._getVisibleTop();
    const nearest = [...headings].reverse().find(h => h.offsetTop <= scrollTop);
    if (nearest && nearest.id) {
      const url = `#${nearest.id}`;
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  _reload() {
    invoke('get_current_file').then(path => {
      if (path) invoke('open_file', { path }).then(result => {
        this.contentEl.innerHTML = result.html;
        document.title = `${result.title} - Lexer`;
      });
    });
  }

  _toggleToc() {
    // Placeholder — will be implemented with layouts
    document.body.classList.toggle('toc-visible');
  }

  _toggleEffects() {
    document.body.classList.toggle('effects-off');
  }

  _toggleLineNumbers() {
    document.body.classList.toggle('line-numbers');
  }

  _openPalette(prefix) {
    // Dispatch custom event for palette.js to handle
    window.dispatchEvent(new CustomEvent('open-palette', { detail: { prefix } }));
  }

  _closeCurrentBuffer() {
    const id = window.lexerApp?.currentBufferId;
    if (id != null) {
      window.lexerApp.closeBuffer(id);
    }
  }

  _newEmptyBuffer() {
    // Open an empty buffer — for now, just open the palette in file mode
    // A true empty buffer would need backend support for buffers without files
    this._openPalette('');
  }

  _showHelp() {
    // Show all keybinds in the which-key popup
    const allKeys = [
      ...this.whichKeyLabels.goto.keys.map(([k, d]) => [k, `goto: ${d}`]),
      ...this.whichKeyLabels.space.keys.map(([k, d]) => [k, `space: ${d}`]),
      ...this.whichKeyLabels.view.keys.map(([k, d]) => [k, `view: ${d}`]),
    ];
    if (!this.whichKeyEl) return;
    let html = `<div class="which-key-title">? - Keyboard Help</div>`;
    html += `<div class="which-key-section">Normal: j/k scroll, d/u half-page, f/b page, G end, ] [ headings</div>`;
    html += `<div class="which-key-section">Tab/S-Tab links, y copy, r reload, / search, n/N next/prev match</div>`;
    html += `<div class="which-key-section">g goto, Space commands, z view, ? this help</div>`;
    this.whichKeyEl.innerHTML = html;
    this.whichKeyEl.classList.add('visible');
    // Auto-hide after 5 seconds
    setTimeout(() => this._hideWhichKey(), 5000);
  }

  // --- View Mode Actions ---

  _viewCenter() {
    // Center the viewport around the current scroll midpoint
    const mid = this.contentEl.scrollTop + this.contentEl.clientHeight / 2;
    this.contentEl.scrollTo({ top: mid - this.contentEl.clientHeight / 2, behavior: 'smooth' });
  }

  _viewTop() {
    // Already at top-relative view, no-op (scroll position is already correct)
  }

  _viewBottom() {
    // Scroll so current content is near bottom
  }

  _zoom(direction) {
    const root = document.documentElement;
    const current = parseFloat(getComputedStyle(root).fontSize);
    const newSize = Math.max(10, Math.min(28, current + direction * 2));
    root.style.fontSize = `${newSize}px`;
  }

  _zoomReset() {
    document.documentElement.style.fontSize = '';
  }

  // --- Search Mode ---

  _enterSearch() {
    if (this.searchBar) {
      this.searchBar.classList.add('visible');
    }
    if (this.searchInput) {
      this.searchInput.value = this.searchQuery;
      this.searchInput.focus();
    }
  }

  _exitSearch() {
    if (this.searchBar) {
      this.searchBar.classList.remove('visible');
    }
    if (this.searchInput) {
      this.searchInput.blur();
    }
  }

  _handleSearchKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._clearSearchHighlights();
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchIndex = -1;
      this.setMode('normal');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.searchMatches.length > 0) {
        this.searchIndex = 0;
        this._highlightCurrentMatch();
      }
      this.setMode('normal');
      return;
    }

    // Let the input handle the typing, then do incremental search
    setTimeout(() => {
      if (this.searchInput) {
        this.searchQuery = this.searchInput.value;
        this._incrementalSearch();
      }
    }, 0);
  }

  _incrementalSearch() {
    this._clearSearchHighlights();
    if (!this.searchQuery) {
      this.searchMatches = [];
      this.searchIndex = -1;
      return;
    }

    // Walk text nodes and wrap matches
    const query = this.searchQuery.toLowerCase();
    const walker = document.createTreeWalker(
      this.contentEl,
      NodeFilter.SHOW_TEXT,
      null
    );

    const matches = [];
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    for (const node of textNodes) {
      const text = node.textContent;
      const lower = text.toLowerCase();
      let idx = lower.indexOf(query);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;

      while (idx !== -1) {
        // Text before match
        if (idx > lastIdx) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        }
        // Match span
        const mark = document.createElement('mark');
        mark.className = 'search-match';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        matches.push(mark);

        lastIdx = idx + query.length;
        idx = lower.indexOf(query, lastIdx);
      }

      // Remaining text
      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }

      node.parentNode.replaceChild(frag, node);
    }

    this.searchMatches = matches;
    this.searchIndex = matches.length > 0 ? 0 : -1;

    if (matches.length > 0) {
      matches[0].classList.add('current');
      matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  _searchNext(direction) {
    if (this.searchMatches.length === 0) return;

    // Remove current highlight
    if (this.searchIndex >= 0) {
      this.searchMatches[this.searchIndex].classList.remove('current');
    }

    this.searchIndex += direction;
    if (this.searchIndex < 0) this.searchIndex = this.searchMatches.length - 1;
    if (this.searchIndex >= this.searchMatches.length) this.searchIndex = 0;

    this.searchMatches[this.searchIndex].classList.add('current');
    this.searchMatches[this.searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  _clearSearchHighlights() {
    // Replace all <mark class="search-match"> with their text content
    const marks = this.contentEl.querySelectorAll('mark.search-match');
    for (const mark of marks) {
      const text = document.createTextNode(mark.textContent);
      mark.parentNode.replaceChild(text, mark);
    }
    // Normalize adjacent text nodes
    this.contentEl.normalize();
    this.searchMatches = [];
    this.searchIndex = -1;
  }

  // --- Helpers ---

  _escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// --- Bootstrap ---
const kb = new KeyboardEngine();
document.addEventListener('keydown', (e) => kb.handleKey(e));

// Expose for other modules
window.lexerKeyboard = kb;
