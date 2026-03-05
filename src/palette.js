// Lexer - Command Palette

const { invoke } = window.__TAURI__.core;

class CommandPalette {
  constructor() {
    this.overlay = document.getElementById('palette');
    this.input = document.getElementById('palette-input');
    this.resultsList = document.getElementById('palette-results');
    this.countEl = document.getElementById('palette-count');
    this.hintEl = document.getElementById('palette-hint');

    this.visible = false;
    this.mode = 'file';        // file | command | heading | theme | recent | search
    this.items = [];            // current candidate list
    this.filtered = [];         // after fuzzy filtering
    this.selectedIndex = 0;

    // Cache
    this._fileCache = null;
    this._fileCacheDir = null;

    this._bindEvents();
  }

  // --- Public API ---

  open(prefix) {
    this.visible = true;
    this.overlay.classList.add('visible');
    this.selectedIndex = 0;

    // Determine mode from prefix
    const modeMap = {
      ':': 'command',
      '#': 'heading',
      '@': 'theme',
      '>': 'recent',
      '/': 'search',
    };
    this.mode = modeMap[prefix] || 'file';

    // Set input with prefix
    this.input.value = prefix || '';
    this.input.focus();

    // Load candidates
    this._loadCandidates().then(() => {
      this._filter();
      this._render();
    });

    this._updateHint();
  }

  close() {
    this.visible = false;
    this.overlay.classList.remove('visible');
    this.input.value = '';
    this.items = [];
    this.filtered = [];
  }

  // --- Event Binding ---

  _bindEvents() {
    // Keyboard inside palette
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._select(this.selectedIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._select(this.selectedIndex - 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this._execute();
        return;
      }
    });

    // Input changes
    this.input.addEventListener('input', () => {
      this._onInput();
    });

    // Click on overlay background closes palette
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Listen for open-palette events from keyboard engine
    window.addEventListener('open-palette', (e) => {
      this.open(e.detail.prefix);
    });

    // Ctrl+P / Cmd+P opens file palette
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (this.visible) {
          this.close();
        } else {
          this.open('');
        }
      }
    });
  }

  // --- Candidate Loading ---

  async _loadCandidates() {
    switch (this.mode) {
      case 'file':
        await this._loadFiles();
        break;
      case 'command':
        this._loadCommands();
        break;
      case 'heading':
        await this._loadHeadings();
        break;
      case 'theme':
        this._loadThemes();
        break;
      case 'recent':
        this._loadRecent();
        break;
      default:
        this.items = [];
    }
  }

  async _loadFiles() {
    try {
      const currentFile = await invoke('get_current_file');
      let dir = '.';
      if (currentFile) {
        const lastSlash = currentFile.lastIndexOf('/');
        dir = lastSlash >= 0 ? currentFile.substring(0, lastSlash) : '.';
        // Go up to find project root (look for common markers)
        // For now, use the file's directory
      }

      if (this._fileCacheDir === dir && this._fileCache) {
        this.items = this._fileCache;
        return;
      }

      const entries = await invoke('scan_directory', { path: dir });
      this.items = entries.map(e => ({
        label: e.path,
        detail: this._formatTime(e.modified),
        value: dir + '/' + e.path,
        type: 'file',
      }));
      this._fileCache = this.items;
      this._fileCacheDir = dir;
    } catch (err) {
      console.error('scan_directory failed:', err);
      this.items = [];
    }
  }

  _loadCommands() {
    this.items = [
      { label: 'toggle sidebar', detail: 'Show/hide ToC sidebar', value: 'toggle-sidebar', type: 'command' },
      { label: 'toggle effects', detail: 'Enable/disable visual effects', value: 'toggle-effects', type: 'command' },
      { label: 'toggle line-numbers', detail: 'Show/hide code line numbers', value: 'toggle-line-numbers', type: 'command' },
      { label: 'zoom in', detail: 'Increase font size', value: 'zoom-in', type: 'command' },
      { label: 'zoom out', detail: 'Decrease font size', value: 'zoom-out', type: 'command' },
      { label: 'zoom reset', detail: 'Reset font size', value: 'zoom-reset', type: 'command' },
      { label: 'open', detail: 'Open file dialog', value: 'open-file', type: 'command' },
      { label: 'reload', detail: 'Force re-render current file', value: 'reload', type: 'command' },
      { label: 'copy path', detail: 'Copy file path to clipboard', value: 'copy-path', type: 'command' },
    ];
  }

  async _loadHeadings() {
    try {
      const toc = await invoke('get_toc');
      this.items = toc.map(entry => ({
        label: '  '.repeat(entry.level - 1) + entry.text,
        detail: `h${entry.level}`,
        value: entry.id,
        type: 'heading',
      }));
    } catch {
      this.items = [];
    }
  }

  _loadThemes() {
    // Placeholder — will be populated when theme engine is implemented
    this.items = [
      { label: 'lexer-dark', detail: 'Default dark theme', value: 'lexer-dark', type: 'theme' },
      { label: 'lexer-light', detail: 'Light theme', value: 'lexer-light', type: 'theme' },
    ];
  }

  _loadRecent() {
    // Placeholder — will be populated when recent files tracking is implemented
    this.items = [];
  }

  // --- Filtering ---

  _onInput() {
    const raw = this.input.value;

    // Check if prefix changed mode
    const prefixMap = { ':': 'command', '#': 'heading', '@': 'theme', '>': 'recent' };
    const firstChar = raw[0];
    if (prefixMap[firstChar] && this.mode !== prefixMap[firstChar]) {
      this.mode = prefixMap[firstChar];
      this._loadCandidates().then(() => {
        this._filter();
        this._render();
      });
      this._updateHint();
      return;
    }

    this._filter();
    this._render();
  }

  _filter() {
    const raw = this.input.value;
    // Strip mode prefix for query
    const prefixes = [':', '#', '@', '>'];
    const query = prefixes.includes(raw[0]) ? raw.slice(1).trim() : raw.trim();

    if (!query) {
      this.filtered = this.items.slice(0, 50);
    } else {
      const scored = this.items
        .map(item => ({ item, score: fuzzyScore(query, item.label) }))
        .filter(s => s.score >= 0)
        .sort((a, b) => b.score - a.score);
      this.filtered = scored.map(s => s.item).slice(0, 50);
    }

    this.selectedIndex = 0;
  }

  // --- Rendering ---

  _render() {
    const raw = this.input.value;
    const prefixes = [':', '#', '@', '>'];
    const query = prefixes.includes(raw[0]) ? raw.slice(1).trim() : raw.trim();

    let html = '';
    for (let i = 0; i < this.filtered.length; i++) {
      const item = this.filtered[i];
      const selected = i === this.selectedIndex ? ' selected' : '';
      const label = query ? highlightMatches(query, item.label) : escapeHtml(item.label);
      html += `<div class="palette-item${selected}" data-index="${i}">`;
      html += `<span class="palette-item-label">${label}</span>`;
      if (item.detail) {
        html += `<span class="palette-item-detail">${escapeHtml(item.detail)}</span>`;
      }
      html += `</div>`;
    }

    this.resultsList.innerHTML = html;

    // Click handler on items
    this.resultsList.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selectedIndex = parseInt(el.dataset.index, 10);
        this._execute();
      });
      el.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(el.dataset.index, 10);
        this._render();
      });
    });

    if (this.countEl) {
      this.countEl.textContent = `${this.filtered.length} result${this.filtered.length === 1 ? '' : 's'}`;
    }

    // Ensure selected item is visible
    const selectedEl = this.resultsList.querySelector('.palette-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  _select(index) {
    if (this.filtered.length === 0) return;
    this.selectedIndex = ((index % this.filtered.length) + this.filtered.length) % this.filtered.length;
    this._render();
  }

  _updateHint() {
    if (!this.hintEl) return;
    const hints = {
      file: 'Type to search files  ·  : commands  ·  # headings  ·  @ themes',
      command: 'Type to filter commands  ·  Enter to run',
      heading: 'Type to filter headings  ·  Enter to jump',
      theme: 'Type to filter themes  ·  Enter to apply',
      recent: 'Recently opened files  ·  Enter to open',
    };
    this.hintEl.textContent = hints[this.mode] || '';
  }

  // --- Execution ---

  _execute() {
    if (this.filtered.length === 0) return;
    const item = this.filtered[this.selectedIndex];
    this.close();

    switch (item.type) {
      case 'file':
        invoke('open_file', { path: item.value }).then(result => {
          const contentEl = document.getElementById('content');
          const statusFileEl = document.getElementById('status-file');
          contentEl.innerHTML = result.html;
          statusFileEl.textContent = result.title;
          document.title = `${result.title} - Lexer`;
          contentEl.scrollTop = 0;
        }).catch(err => console.error('Failed to open file:', err));
        break;

      case 'heading':
        const target = document.getElementById(item.value);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;

      case 'command':
        this._runCommand(item.value);
        break;

      case 'theme':
        // Will be implemented with theme engine
        break;
    }
  }

  _runCommand(cmd) {
    const kb = window.lexerKeyboard;
    switch (cmd) {
      case 'toggle-sidebar':
        if (kb) kb._toggleToc();
        break;
      case 'toggle-effects':
        if (kb) kb._toggleEffects();
        break;
      case 'toggle-line-numbers':
        if (kb) kb._toggleLineNumbers();
        break;
      case 'zoom-in':
        if (kb) kb._zoom(1);
        break;
      case 'zoom-out':
        if (kb) kb._zoom(-1);
        break;
      case 'zoom-reset':
        if (kb) kb._zoomReset();
        break;
      case 'open-file':
        invoke('plugin:dialog|open', {
          options: { multiple: false, filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] },
        }).then(selected => {
          if (selected) invoke('open_file', { path: selected });
        });
        break;
      case 'reload':
        if (kb) kb._reload();
        break;
      case 'copy-path':
        invoke('get_current_file').then(path => {
          if (path) navigator.clipboard.writeText(path).catch(() => {});
        });
        break;
    }
  }

  // --- Helpers ---

  _formatTime(unixSecs) {
    if (!unixSecs) return '';
    const now = Date.now() / 1000;
    const diff = now - unixSecs;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}

// --- Fuzzy Matching ---

function fuzzyScore(query, target) {
  let qi = 0, ti = 0, score = 0;
  const lq = query.toLowerCase();
  const lt = target.toLowerCase();
  let consecutive = 0;

  while (qi < lq.length && ti < lt.length) {
    if (lq[qi] === lt[ti]) {
      score += 1 + consecutive * 2;
      if (ti === 0 || target[ti - 1] === '/' || target[ti - 1] === ' ') score += 5;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
    ti++;
  }
  return qi === lq.length ? score : -1;
}

function highlightMatches(query, target) {
  const lq = query.toLowerCase();
  const lt = target.toLowerCase();
  let qi = 0;
  let html = '';

  for (let ti = 0; ti < target.length; ti++) {
    if (qi < lq.length && lq[qi] === lt[ti]) {
      html += `<span class="match">${escapeHtml(target[ti])}</span>`;
      qi++;
    } else {
      html += escapeHtml(target[ti]);
    }
  }
  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Bootstrap ---
const palette = new CommandPalette();
window.lexerPalette = palette;
