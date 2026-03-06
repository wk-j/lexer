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
        'p':      { fn: () => this._openFromClipboard() },
        'r':      { fn: () => this._reload() },
        'n':      { fn: () => this._searchNext(1) },
        'N':      { fn: () => this._searchNext(-1) },
        'H':      { fn: () => window.lexerApp?.prevBuffer() },
        'L':      { fn: () => window.lexerApp?.nextBuffer() },
        'q':      { fn: () => this._quit() },
        'v':      { fn: () => this._enterSelectMode(false) },
        'V':      { fn: () => this._enterSelectMode(true) },
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
        'w':  { fn: () => this._enterHintMode() },
        'n':  { fn: () => this._gotoSiblingFile(1) },
        'p':  { fn: () => this._gotoSiblingFile(-1) },
      },

      space: {
        'f':  { fn: () => this._openPalette('') },
        'bb': { fn: () => this._openPalette('%') },
        'bn': { fn: () => window.lexerApp?.nextBuffer() },
        'bp': { fn: () => window.lexerApp?.prevBuffer() },
        'bd': { fn: () => this._closeCurrentBuffer() },
        'bN': { fn: () => this._newEmptyBuffer() },
        'bo': { fn: () => window.lexerApp?.closeOtherBuffers() },
        'wn': { fn: () => this._newWindow() },
        'wN': { fn: () => this._newWindowSameFile() },
        'wc': { fn: () => this._closeWindow() },
        'ww': { fn: () => this._cycleWindow(1) },
        'wW': { fn: () => this._cycleWindow(-1) },
        'wl': { fn: () => this._openPalette('&') },
        'wd': { fn: () => this._setLayout('default') },
        'wf': { fn: () => this._setLayout('focus') },
        'wz': { fn: () => this._setLayout('zen') },
        'ws': { fn: () => this._setLayout('split') },
        'wb': { fn: () => this._toggleStatusBar() },
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
          ['w', 'link hints (jump)'],
          ['n', 'next file in dir'],
          ['p', 'prev file in dir'],
        ],
      },
      space: {
        title: 'Space - Commands',
        keys: [
          ['f', 'file search'],
          ['b', 'buffer...'],
          ['w', 'window/layout...'],
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
      'space:w': {
        title: 'w - Window / Layout',
        keys: [
          ['n', 'new window'],
          ['N', 'new (same file)'],
          ['c', 'close window'],
          ['w', 'next window'],
          ['W', 'prev window'],
          ['l', 'window list'],
          ['d', 'layout: default'],
          ['f', 'layout: focus'],
          ['z', 'layout: zen'],
          ['s', 'layout: split'],
          ['b', 'toggle status bar'],
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
      select: {
        title: 'v - Select',
        keys: [
          ['j/k', 'navigate blocks'],
          ['d/u', 'jump 5 blocks'],
          [']/[', 'next/prev heading'],
          ['{/}', 'section start/end'],
          ['x', 'toggle block'],
          ['o', 'swap anchor/cursor'],
          ['a', 'select all'],
          ['y', 'copy as markdown'],
          ['Y', 'copy as plain text'],
          ['c', 'copy as context block'],
          ['\u21B5', 'agent menu'],
          ['esc', 'cancel'],
        ],
      },
      'select:agent': {
        title: '\u21B5 - Agent',
        keys: [
          ['c', 'copy as context block'],
          ['o', 'open in Claude'],
          ['p', 'pipe to command'],
          ['u', 'send to URL endpoint'],
          ['esc', 'back to select'],
        ],
      },
    };
  }

  // --- Event Handler ---

  handleKey(e) {
    // Ignore when palette or other overlay is open
    if (this._isOverlayActive()) return;

    // Escape in zen mode: exit to default layout
    if (e.key === 'Escape' && document.documentElement.dataset.layout === 'zen') {
      e.preventDefault();
      this._setLayout('default');
      return;
    }

    // Search mode has special handling
    if (this.mode === 'search') {
      this._handleSearchKey(e);
      return;
    }

    // Hint mode has special handling (Vimium-style link jump)
    if (this.mode === 'hint') {
      this._handleHintKey(e);
      return;
    }

    // Select mode has special handling (block selection)
    if (this.mode === 'select') {
      this._handleSelectKey(e);
      return;
    }

    // Ctrl+O / Ctrl+I: previous / next buffer (Helix-style jumplist)
    if (e.ctrlKey && !e.metaKey && e.key === 'o') {
      e.preventDefault();
      window.lexerApp?.prevBuffer();
      return;
    }
    if (e.ctrlKey && !e.metaKey && e.key === 'i') {
      e.preventDefault();
      window.lexerApp?.nextBuffer();
      return;
    }

    // Ignore other keys with Ctrl/Cmd (let browser/Tauri handle those)
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
      // Only hide which-key if the action was NOT a mode switch
      // (mode switches show their own which-key via setMode)
      if (!map[seq].mode) {
        this._hideWhichKey();
      }
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
      if (this.mode !== 'normal' && this.mode !== 'search' && this.mode !== 'hint' && this.mode !== 'select') {
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
    const labels = { normal: 'NOR', goto: 'GOT', space: 'SPC', search: 'SCH', view: 'VIW', hint: 'HNT', select: 'SEL' };
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
      if (this.mode !== 'normal' && this.mode !== 'search' && this.mode !== 'select') {
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
    const sidebar = document.getElementById('toc-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('visible');
      // Render ToC if becoming visible
      if (sidebar.classList.contains('visible')) {
        window.lexerLayout?.renderToc();
      }
    }
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

  // --- Clipboard, Quit, Sibling File ---

  async _openFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed && /\.(md|markdown|mkd|mdx)$/i.test(trimmed)) {
        window.lexerApp?.openFile(trimmed);
      } else if (trimmed && !trimmed.includes('\n')) {
        // Try opening anyway — backend will error if file doesn't exist
        window.lexerApp?.openFile(trimmed);
      }
    } catch (err) {
      console.error('Clipboard read failed:', err);
    }
  }

  _quit() {
    try {
      window.__TAURI__.window.getCurrentWindow().close();
    } catch (_) {}
  }

  async _gotoSiblingFile(direction) {
    try {
      const currentFile = await invoke('get_current_file');
      if (!currentFile) return;
      const lastSlash = currentFile.lastIndexOf('/');
      const dir = lastSlash >= 0 ? currentFile.substring(0, lastSlash) : '.';
      const entries = await invoke('scan_directory', { path: dir });
      if (entries.length === 0) return;

      // Find current file in the list
      const currentName = currentFile.substring(lastSlash + 1);
      const idx = entries.findIndex(e => e.name === currentName);
      if (idx < 0) {
        // Current file not found — open first or last
        const target = direction > 0 ? entries[0] : entries[entries.length - 1];
        window.lexerApp?.openFile(dir + '/' + target.path);
        return;
      }

      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= entries.length) return; // at boundary
      window.lexerApp?.openFile(dir + '/' + entries[newIdx].path);
    } catch (err) {
      console.error('Sibling file navigation failed:', err);
    }
  }

  // --- Layout & Window Actions ---

  _setLayout(mode) {
    document.documentElement.dataset.layout = mode;
    invoke('set_layout', { layout: mode }).catch(() => {});

    if (mode === 'zen') {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }

    // Trigger ToC render for split layout
    if (mode === 'split') {
      window.lexerLayout?.renderToc();
    }
  }

  _toggleStatusBar() {
    const sb = document.querySelector('.status-bar');
    if (sb) {
      sb.style.display = sb.style.display === 'none' ? '' : 'none';
    }
  }

  async _newWindow() {
    try { await invoke('new_window', { path: null }); } catch (e) { console.error(e); }
  }

  async _newWindowSameFile() {
    try {
      const path = await invoke('get_current_file');
      await invoke('new_window', { path });
    } catch (e) { console.error(e); }
  }

  _closeWindow() {
    try {
      window.__TAURI__.window.getCurrentWindow().close();
    } catch (_) {}
  }

  async _cycleWindow(direction) {
    try {
      const windows = await invoke('list_windows');
      if (windows.length <= 1) return;
      const current = window.__TAURI__.window.getCurrentWindow().label;
      const idx = windows.findIndex(w => w.id === current);
      const next = (idx + direction + windows.length) % windows.length;
      await invoke('focus_window', { windowId: windows[next].id });
    } catch (e) { console.error(e); }
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
      // Confirm search — jump to first match if not already there
      if (this.searchMatches.length > 0 && this.searchIndex < 0) {
        this.searchIndex = 0;
        this.searchMatches[0].classList.add('current');
        this.searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      this.setMode('normal');
      return;
    }

    // n/N to navigate matches while still in search mode
    if (e.key === 'n' && e.ctrlKey) {
      e.preventDefault();
      this._searchNext(1);
      return;
    }
    if (e.key === 'p' && e.ctrlKey) {
      e.preventDefault();
      this._searchNext(-1);
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

    this._updateSearchCount();
  }

  _searchNext(direction) {
    if (this.searchMatches.length === 0) return;

    // Verify matches are still in the DOM (content may have been re-rendered)
    if (!this.searchMatches[0].isConnected) {
      this.searchMatches = [];
      this.searchIndex = -1;
      return;
    }

    // Remove current highlight
    if (this.searchIndex >= 0 && this.searchIndex < this.searchMatches.length) {
      this.searchMatches[this.searchIndex].classList.remove('current');
    }

    this.searchIndex += direction;
    if (this.searchIndex < 0) this.searchIndex = this.searchMatches.length - 1;
    if (this.searchIndex >= this.searchMatches.length) this.searchIndex = 0;

    this.searchMatches[this.searchIndex].classList.add('current');
    this.searchMatches[this.searchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Update status bar with match position
    this._updateSearchCount();
  }

  _updateSearchCount() {
    if (this.searchMatches.length > 0 && this.pendingEl) {
      this.pendingEl.textContent = `[${this.searchIndex + 1}/${this.searchMatches.length}]`;
    }
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
    if (this.pendingEl) this.pendingEl.textContent = '';
  }

  // --- Link Hint Mode (Vimium-style gw) ---

  _enterHintMode() {
    // Collect all visible clickable elements in the content area
    const containerRect = this.contentEl.getBoundingClientRect();
    const scrollTop = this.contentEl.scrollTop;
    const scrollLeft = this.contentEl.scrollLeft;

    const selectors = 'a[href], button, [role="button"], summary, input[type="checkbox"]';
    const allElements = Array.from(this.contentEl.querySelectorAll(selectors));

    // Filter to only visible elements within the scroll viewport
    // Use getBoundingClientRect to correctly handle elements nested inside tables/containers
    const visibleElements = allElements.filter(el => {
      const rect = el.getBoundingClientRect();
      // Element must overlap with the visible container and have non-zero size
      return rect.bottom > containerRect.top && rect.top < containerRect.bottom &&
             rect.width > 0 && rect.height > 0;
    });

    if (visibleElements.length === 0) return;

    // Generate hint labels (a, s, d, f, j, k, l, then aa, as, ad, ...)
    const labels = this._generateHintLabels(visibleElements.length);

    // Store hint state
    this._hints = [];
    this._hintInput = '';
    this._hintContainer = document.createElement('div');
    this._hintContainer.className = 'hint-container';
    this._hintContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:850;';
    this.contentEl.appendChild(this._hintContainer);

    for (let i = 0; i < visibleElements.length; i++) {
      const el = visibleElements[i];
      const label = labels[i];

      // Position the hint label near the element using getBoundingClientRect
      // to correctly handle elements nested inside tables and other containers
      const elRect = el.getBoundingClientRect();
      const hintTop = elRect.top - containerRect.top + scrollTop;
      const hintLeft = elRect.left - containerRect.left + scrollLeft - 20;

      const hint = document.createElement('span');
      hint.className = 'hint-label';
      hint.textContent = label;
      hint.style.top = `${hintTop}px`;
      hint.style.left = `${Math.max(0, hintLeft)}px`;

      this._hintContainer.appendChild(hint);
      el.classList.add('hint-active');

      this._hints.push({ el, label, hintEl: hint });
    }

    // Enter hint mode
    this.mode = 'hint';
    this._updateModeBadge();
    if (this.pendingEl) this.pendingEl.textContent = '';
  }

  _handleHintKey(e) {
    e.preventDefault();

    if (e.key === 'Escape') {
      this._exitHintMode();
      return;
    }

    // Backspace removes last typed character
    if (e.key === 'Backspace') {
      if (this._hintInput.length > 0) {
        this._hintInput = this._hintInput.slice(0, -1);
        this._updateHintDisplay();
      } else {
        this._exitHintMode();
      }
      return;
    }

    // Ignore modifier keys alone
    if (e.key.length > 1) return;

    // Append typed character
    this._hintInput += e.key.toLowerCase();
    if (this.pendingEl) this.pendingEl.textContent = this._hintInput;

    // Filter hints
    const matching = this._hints.filter(h => h.label.startsWith(this._hintInput));

    if (matching.length === 0) {
      // No match — exit
      this._exitHintMode();
      return;
    }

    if (matching.length === 1 && matching[0].label === this._hintInput) {
      // Exact match — activate the element
      const target = matching[0].el;
      this._exitHintMode();
      this._activateHintTarget(target);
      return;
    }

    // Partial match — update display to show remaining hints
    this._updateHintDisplay();
  }

  _updateHintDisplay() {
    for (const hint of this._hints) {
      if (hint.label.startsWith(this._hintInput)) {
        hint.hintEl.style.display = '';
        hint.el.classList.add('hint-active');
        // Dim the already-typed prefix
        const matched = hint.label.slice(0, this._hintInput.length);
        const remaining = hint.label.slice(this._hintInput.length);
        hint.hintEl.innerHTML = `<span class="hint-matched">${this._escapeHtml(matched)}</span>${this._escapeHtml(remaining)}`;
      } else {
        hint.hintEl.style.display = 'none';
        hint.el.classList.remove('hint-active');
      }
    }
    if (this.pendingEl) this.pendingEl.textContent = this._hintInput;
  }

  _activateHintTarget(el) {
    if (el.tagName === 'A') {
      el.click();
    } else if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
      el.click();
    } else if (el.tagName === 'SUMMARY') {
      el.click();
    } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
      el.click();
    } else {
      el.click();
    }
    // Briefly highlight the activated element
    el.classList.add('hint-active');
    setTimeout(() => el.classList.remove('hint-active'), 300);
  }

  _exitHintMode() {
    // Remove all hint labels and active outlines
    if (this._hintContainer) {
      this._hintContainer.remove();
      this._hintContainer = null;
    }
    if (this._hints) {
      for (const hint of this._hints) {
        hint.el.classList.remove('hint-active');
      }
      this._hints = null;
    }
    this._hintInput = '';
    this.setMode('normal');
  }

  _generateHintLabels(count) {
    // Use home-row keys for fast typing
    const chars = 'asdfghjkl';
    const labels = [];

    if (count <= chars.length) {
      // Single character labels
      for (let i = 0; i < count; i++) {
        labels.push(chars[i]);
      }
    } else {
      // Two character labels
      for (let i = 0; i < chars.length && labels.length < count; i++) {
        for (let j = 0; j < chars.length && labels.length < count; j++) {
          labels.push(chars[i] + chars[j]);
        }
      }
    }
    return labels;
  }

  // --- Block Select Mode ---

  _getSelectableBlocks() {
    const sel = 'h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol, table, hr, details, .footnote-definition';
    return Array.from(this.contentEl.querySelectorAll('[data-block-index]'));
  }

  _enterSelectMode(sectionSelect) {
    this._selectBlocks = this._getSelectableBlocks();
    if (this._selectBlocks.length === 0) return;

    this._selectExplicit = new Set();
    this._selectSubMode = null;

    // Find the block nearest to viewport center
    const viewMid = this.contentEl.scrollTop + this.contentEl.clientHeight / 2;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < this._selectBlocks.length; i++) {
      const el = this._selectBlocks[i];
      const elMid = el.offsetTop + el.offsetHeight / 2;
      const dist = Math.abs(elMid - viewMid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    this._selectAnchor = nearestIdx;
    this._selectCursor = nearestIdx;

    if (sectionSelect) {
      // V: select from current heading to before next heading of same/higher level
      // Find the heading at or before current position
      let headingIdx = nearestIdx;
      while (headingIdx > 0 && !this._isHeadingBlock(headingIdx)) {
        headingIdx--;
      }
      this._selectAnchor = headingIdx;

      // Find next heading of same or higher level
      const anchorLevel = this._getHeadingLevel(headingIdx) || 99;
      let endIdx = headingIdx + 1;
      while (endIdx < this._selectBlocks.length) {
        const lvl = this._getHeadingLevel(endIdx);
        if (lvl && lvl <= anchorLevel) break;
        endIdx++;
      }
      this._selectCursor = Math.min(endIdx - 1, this._selectBlocks.length - 1);
    }

    this.mode = 'select';
    document.documentElement.dataset.mode = 'select';
    this._updateModeBadge();
    this._updateSelectHighlights();
    this._updateSelectStatus();
    this._showWhichKey('select');
    this._scrollCursorIntoView();
  }

  _exitSelectMode() {
    // Clear all block highlights
    for (const el of (this._selectBlocks || [])) {
      el.classList.remove('block-selected', 'block-cursor', 'block-toggled');
    }
    this._selectBlocks = null;
    this._selectAnchor = null;
    this._selectCursor = null;
    this._selectExplicit = null;
    this._selectSubMode = null;
    this.setMode('normal');
  }

  _handleSelectKey(e) {
    // Agent sub-mode
    if (this._selectSubMode === 'agent') {
      this._handleAgentKey(e);
      return;
    }

    // Pipe prompt sub-mode
    if (this._selectSubMode === 'pipe-prompt') {
      this._handlePipePromptKey(e);
      return;
    }

    e.preventDefault();
    const key = e.key;

    switch (key) {
      case 'Escape':
        this._exitSelectMode();
        break;
      case 'j':
      case 'ArrowDown':
        this._selectMove(1);
        break;
      case 'k':
      case 'ArrowUp':
        this._selectMove(-1);
        break;
      case 'd':
        this._selectMove(5);
        break;
      case 'u':
        this._selectMove(-5);
        break;
      case 'G':
        this._selectMoveTo(this._selectBlocks.length - 1);
        break;
      case 'g':
        this._selectMoveTo(0);
        break;
      case ']':
        this._selectMoveToHeading(1);
        break;
      case '[':
        this._selectMoveToHeading(-1);
        break;
      case '}':
        this._selectMoveToSectionEnd();
        break;
      case '{':
        this._selectMoveToSectionStart();
        break;
      case 'x':
        this._selectToggle();
        break;
      case 'o':
        this._selectSwapAnchor();
        break;
      case 'a':
        this._selectAll();
        break;
      case 'y':
        this._selectCopyMarkdown();
        break;
      case 'Y':
        this._selectCopyPlainText();
        break;
      case 'c':
        this._selectCopyContext();
        break;
      case 's':
        this._selectSendDefault();
        break;
      case 'Enter':
        this._enterAgentSubMode();
        break;
      default:
        break;
    }
  }

  // --- Select: Navigation ---

  _selectMove(delta) {
    if (!this._selectBlocks) return;
    const newIdx = Math.max(0, Math.min(this._selectBlocks.length - 1, this._selectCursor + delta));
    this._selectCursor = newIdx;
    this._updateSelectHighlights();
    this._updateSelectStatus();
    this._scrollCursorIntoView();
  }

  _selectMoveTo(idx) {
    if (!this._selectBlocks) return;
    this._selectCursor = Math.max(0, Math.min(this._selectBlocks.length - 1, idx));
    this._updateSelectHighlights();
    this._updateSelectStatus();
    this._scrollCursorIntoView();
  }

  _selectMoveToHeading(direction) {
    if (!this._selectBlocks) return;
    let idx = this._selectCursor + direction;
    while (idx >= 0 && idx < this._selectBlocks.length) {
      if (this._isHeadingBlock(idx)) {
        this._selectCursor = idx;
        this._updateSelectHighlights();
        this._updateSelectStatus();
        this._scrollCursorIntoView();
        return;
      }
      idx += direction;
    }
  }

  _selectMoveToSectionEnd() {
    if (!this._selectBlocks) return;
    const curLevel = this._getCurrentSectionLevel();
    let idx = this._selectCursor + 1;
    while (idx < this._selectBlocks.length) {
      const lvl = this._getHeadingLevel(idx);
      if (lvl && lvl <= curLevel) {
        this._selectMoveTo(idx - 1);
        return;
      }
      idx++;
    }
    this._selectMoveTo(this._selectBlocks.length - 1);
  }

  _selectMoveToSectionStart() {
    if (!this._selectBlocks) return;
    // Move to the heading that starts the current section
    let idx = this._selectCursor;
    while (idx > 0 && !this._isHeadingBlock(idx)) {
      idx--;
    }
    this._selectMoveTo(idx);
  }

  // --- Select: Manipulation ---

  _selectToggle() {
    if (!this._selectExplicit) return;
    const idx = this._selectCursor;
    if (this._selectExplicit.has(idx)) {
      this._selectExplicit.delete(idx);
    } else {
      this._selectExplicit.add(idx);
    }
    this._updateSelectHighlights();
    this._updateSelectStatus();
  }

  _selectSwapAnchor() {
    const tmp = this._selectAnchor;
    this._selectAnchor = this._selectCursor;
    this._selectCursor = tmp;
    this._updateSelectHighlights();
    this._scrollCursorIntoView();
  }

  _selectAll() {
    if (!this._selectBlocks) return;
    this._selectAnchor = 0;
    this._selectCursor = this._selectBlocks.length - 1;
    this._selectExplicit = new Set();
    this._updateSelectHighlights();
    this._updateSelectStatus();
  }

  // --- Select: Highlight Updates ---

  _getSelectedIndices() {
    const lo = Math.min(this._selectAnchor, this._selectCursor);
    const hi = Math.max(this._selectAnchor, this._selectCursor);
    const indices = new Set();
    for (let i = lo; i <= hi; i++) {
      indices.add(i);
    }
    // Union with explicit toggles: add those outside range, remove those inside
    if (this._selectExplicit) {
      for (const idx of this._selectExplicit) {
        if (indices.has(idx)) {
          indices.delete(idx);
        } else {
          indices.add(idx);
        }
      }
    }
    return indices;
  }

  _updateSelectHighlights() {
    if (!this._selectBlocks) return;
    const selected = this._getSelectedIndices();
    for (let i = 0; i < this._selectBlocks.length; i++) {
      const el = this._selectBlocks[i];
      const isSelected = selected.has(i);
      const isCursor = i === this._selectCursor;
      const isToggled = this._selectExplicit && this._selectExplicit.has(i) && !this._isInRange(i);

      el.classList.toggle('block-selected', isSelected && !isCursor);
      el.classList.toggle('block-cursor', isCursor);
      el.classList.toggle('block-toggled', isToggled && isSelected);
    }
  }

  _isInRange(idx) {
    const lo = Math.min(this._selectAnchor, this._selectCursor);
    const hi = Math.max(this._selectAnchor, this._selectCursor);
    return idx >= lo && idx <= hi;
  }

  _updateSelectStatus() {
    const count = this._getSelectedIndices().size;
    if (this.pendingEl) {
      const modeLabel = this._selectSubMode === 'agent' ? 'SEL\u00B7AGT' : '';
      this.pendingEl.textContent = `${count} block${count !== 1 ? 's' : ''} selected`;
    }
  }

  _scrollCursorIntoView() {
    if (!this._selectBlocks || this._selectCursor == null) return;
    const el = this._selectBlocks[this._selectCursor];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Select: Helpers ---

  _isHeadingBlock(idx) {
    if (!this._selectBlocks || !this._selectBlocks[idx]) return false;
    return /^H[1-6]$/.test(this._selectBlocks[idx].tagName);
  }

  _getHeadingLevel(idx) {
    if (!this._selectBlocks || !this._selectBlocks[idx]) return null;
    const tag = this._selectBlocks[idx].tagName;
    const m = tag.match(/^H([1-6])$/);
    return m ? parseInt(m[1], 10) : null;
  }

  _getCurrentSectionLevel() {
    // Walk backward from cursor to find the enclosing heading level
    let idx = this._selectCursor;
    while (idx >= 0) {
      const lvl = this._getHeadingLevel(idx);
      if (lvl) return lvl;
      idx--;
    }
    return 1; // default to h1 if no heading found
  }

  // --- Select: Clipboard Helper ---

  async _writeClipboard(text) {
    // Use Tauri clipboard plugin to bypass browser permission restrictions
    await invoke('plugin:clipboard-manager|write_text', { text });
  }

  // --- Select: Copy Actions ---

  async _selectCopyMarkdown() {
    const indices = [...this._getSelectedIndices()].sort((a, b) => a - b);
    if (indices.length === 0) return;

    try {
      const source = await invoke('get_block_sources', { indices });
      await this._writeClipboard(source);
      this._showSelectToast(`Copied ${indices.length} block${indices.length !== 1 ? 's' : ''} as markdown`);
    } catch (err) {
      this._showSelectToast(`Copy failed: ${err}`, true);
    }
    this._exitSelectMode();
  }

  async _selectCopyPlainText() {
    const indices = [...this._getSelectedIndices()].sort((a, b) => a - b);
    if (indices.length === 0) return;

    try {
      const texts = indices.map(i => this._selectBlocks[i]?.textContent?.trim()).filter(Boolean);
      const text = texts.join('\n\n');
      await this._writeClipboard(text);
      this._showSelectToast(`Copied ${indices.length} block${indices.length !== 1 ? 's' : ''} as plain text`);
    } catch (err) {
      this._showSelectToast(`Copy failed: ${err}`, true);
    }
    this._exitSelectMode();
  }

  async _selectCopyContext() {
    const indices = [...this._getSelectedIndices()].sort((a, b) => a - b);
    if (indices.length === 0) return;

    try {
      const source = await invoke('get_block_sources', { indices });
      const filePath = await invoke('get_current_file') || 'unknown';
      const blockRange = indices.length === 1 ? `${indices[0]}` : `${indices[0]}-${indices[indices.length - 1]}`;
      const context = `<context source="${filePath}" blocks="${blockRange}">\n${source}\n</context>`;
      await this._writeClipboard(context);
      this._showSelectToast(`Copied context block to clipboard`);
    } catch (err) {
      this._showSelectToast(`Copy failed: ${err}`, true);
    }
    this._exitSelectMode();
  }

  _selectSendDefault() {
    // For now, default to context copy. Config-driven dispatch is future work.
    this._selectCopyContext();
  }

  // --- Select: Agent Sub-Mode ---

  _enterAgentSubMode() {
    this._selectSubMode = 'agent';
    this._hideWhichKey();
    this._showWhichKey('select:agent');
    // Update mode badge to show SEL·AGT
    if (this.modeBadge) {
      this.modeBadge.textContent = 'SEL\u00B7AGT';
    }
    this._updateSelectStatus();
  }

  _handleAgentKey(e) {
    e.preventDefault();
    const key = e.key;

    switch (key) {
      case 'Escape':
        // Return to select mode (preserve selection)
        this._selectSubMode = null;
        this._hideWhichKey();
        this._showWhichKey('select');
        this._updateModeBadge();
        this._updateSelectStatus();
        break;
      case 'c':
        this._selectCopyContext();
        break;
      case 'o':
        this._selectOpenClaude();
        break;
      case 'p':
        this._enterPipePrompt();
        break;
      case 'u':
        this._selectSendUrl();
        break;
      default:
        break;
    }
  }

  async _selectOpenClaude() {
    const indices = [...this._getSelectedIndices()].sort((a, b) => a - b);
    if (indices.length === 0) return;

    try {
      const source = await invoke('get_block_sources', { indices });
      const filePath = await invoke('get_current_file') || 'unknown';
      const blockRange = indices.length === 1 ? `${indices[0]}` : `${indices[0]}-${indices[indices.length - 1]}`;
      const context = `<context source="${filePath}" blocks="${blockRange}">\n${source}\n</context>`;
      const encoded = encodeURIComponent(context);
      const url = `claude://context?text=${encoded}`;

      try {
        await invoke('plugin:shell|open', { path: url });
        this._showSelectToast('Sent to Claude');
      } catch (_) {
        // Fallback: copy to clipboard
        await this._writeClipboard(context);
        this._showSelectToast('Claude not found \u2014 copied to clipboard');
      }
    } catch (err) {
      this._showSelectToast(`Failed: ${err}`, true);
    }
    this._exitSelectMode();
  }

  // --- Select: Pipe Prompt ---

  _enterPipePrompt() {
    this._selectSubMode = 'pipe-prompt';
    this._hideWhichKey();
    // Reuse search bar for pipe prompt
    if (this.searchBar) {
      this.searchBar.classList.add('visible');
      const label = this.searchBar.querySelector('.search-label');
      if (label) label.textContent = '\u25B8';
    }
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchInput.placeholder = 'Shell command...';
      this.searchInput.focus();
    }
  }

  _handlePipePromptKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._exitPipePrompt();
      // Return to agent sub-mode
      this._selectSubMode = 'agent';
      this._showWhichKey('select:agent');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = this.searchInput?.value?.trim();
      if (cmd) {
        this._executePipe(cmd);
      }
      return;
    }

    // Let input handle all other typing
  }

  _exitPipePrompt() {
    if (this.searchBar) {
      this.searchBar.classList.remove('visible');
      const label = this.searchBar.querySelector('.search-label');
      if (label) label.textContent = '/';
    }
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchInput.placeholder = 'Search...';
      this.searchInput.blur();
    }
  }

  async _executePipe(command) {
    this._exitPipePrompt();
    const indices = [...this._getSelectedIndices()].sort((a, b) => a - b);
    if (indices.length === 0) return;

    try {
      const source = await invoke('get_block_sources', { indices });
      // Use shell plugin to pipe content to command
      const result = await invoke('plugin:shell|execute', {
        program: 'sh',
        args: ['-c', `echo ${JSON.stringify(source)} | ${command}`],
      });
      this._showSelectToast(`Piped to "${command}"`);
    } catch (err) {
      // Shell plugin execute may not be available, fallback to copying
      try {
        const source = await invoke('get_block_sources', { indices });
        await this._writeClipboard(source);
        this._showSelectToast(`Pipe unavailable \u2014 copied to clipboard`);
      } catch (e2) {
        this._showSelectToast(`Pipe failed: ${err}`, true);
      }
    }
    this._exitSelectMode();
  }

  async _selectSendUrl() {
    // URL endpoint support requires config — show helpful message for now
    this._showSelectToast('Set [agents] endpoint_url in config.toml');
    this._selectSubMode = null;
    this._hideWhichKey();
    this._showWhichKey('select');
    this._updateModeBadge();
  }

  // --- Select: Toast ---

  _showSelectToast(message, isError) {
    const statusFile = document.getElementById('status-file');
    if (!statusFile) return;

    const original = statusFile.textContent;
    statusFile.textContent = `${message} ${isError ? '\u2717' : '\u2713'}`;
    if (isError) {
      statusFile.style.color = '#f85149';
    }

    const duration = isError ? 4000 : 2000;
    setTimeout(() => {
      statusFile.textContent = original;
      statusFile.style.color = '';
    }, duration);
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
