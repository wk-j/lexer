// Lexer - Command Palette
// Uses `invoke` from app.js (loaded first)

class CommandPalette {
  constructor() {
    this.overlay = document.getElementById('palette');
    this.input = document.getElementById('palette-input');
    this.resultsList = document.getElementById('palette-results');
    this.countEl = document.getElementById('palette-count');
    this.hintEl = document.getElementById('palette-hint');

    this.visible = false;
    this.mode = 'file';        // file | command | heading | theme | recent | search
    this.fileScope = 'cwd'; // 'cwd' | 'directory' — determines file search root
    this.items = [];            // current candidate list
    this.filtered = [];         // after fuzzy filtering
    this.selectedIndex = 0;
    this._renderingFromKeyboard = false; // suppress mouseenter during keyboard-driven renders
    this._loadGeneration = 0; // discard stale async results

    // Cache (keyed by directory path)
    this._fileCache = {};       // { dir: items[] }

    this._bindEvents();
  }

  // --- Public API ---

  open(prefix, scope) {
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
      '%': 'buffer',
      '&': 'window',
    };
    this.mode = modeMap[prefix] || 'file';

    // File scope: 'project' (default) or 'directory'
    if (this.mode === 'file' && scope) {
      this.fileScope = scope;
    }

    // Set input with prefix
    this.input.value = prefix || '';
    const placeholders = {
      file: this.fileScope === 'directory' ? 'Search files in buffer directory...' : 'Search files in working directory...',
      command: 'Type a command...',
      heading: 'Jump to heading...',
      theme: 'Pick a theme...',
      recent: 'Recent files...',
      buffer: 'Switch to buffer...',
      window: 'Switch to window...',
    };
    this.input.placeholder = placeholders[this.mode] || 'Search...';
    this.input.focus();

    // Load candidates — re-focus input after async load in case focus was lost
    const gen = ++this._loadGeneration;
    this._loadCandidates().then(() => {
      if (gen !== this._loadGeneration) return; // stale — user changed mode or re-opened
      this._filter();
      this._render();
      // Re-assert focus after async load completes
      if (this.visible) {
        this.input.focus();
      }
    });

    this._updateHint();
  }

  close() {
    this.visible = false;
    this.overlay.classList.remove('visible');
    this.input.value = '';
    this.input.blur();
    this.items = [];
    this.filtered = [];
  }

  // --- Event Binding ---

  _bindEvents() {
    // Keyboard inside palette — stop propagation to prevent keyboard engine interference
    this.input.addEventListener('keydown', (e) => {
      // Only intercept when palette is actually visible
      if (!this.visible) return;
      // Stop keydown events from bubbling to the keyboard engine
      e.stopPropagation();

      // Cmd+P toggles palette (must handle here since stopPropagation blocks document handler)
      if (e.metaKey && !e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        this._select(this.selectedIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        this._select(this.selectedIndex - 1);
        return;
      }
      if (e.key === 'Tab' && this.mode === 'file') {
        e.preventDefault();
        this._toggleFileScope();
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

    // Clear the keyboard-rendering guard only when the mouse actually moves.
    // This prevents scrollIntoView-triggered mouseenter from resetting the selection.
    this.resultsList.addEventListener('mousemove', () => {
      this._renderingFromKeyboard = false;
    });

    // Listen for open-palette events from keyboard engine
    window.addEventListener('open-palette', (e) => {
      this.open(e.detail.prefix, e.detail.scope);
    });

    // Capture-phase handler: intercept ALL keydown events when palette is visible
    // This ensures palette navigation works regardless of which element has focus
    document.addEventListener('keydown', (e) => {
      if (!this.visible) return;

      // Cmd+P toggles palette
      if (e.metaKey && !e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
        e.preventDefault();
        e.stopPropagation();
        this._select(this.selectedIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        this._select(this.selectedIndex - 1);
        return;
      }
      if (e.key === 'Tab' && this.mode === 'file') {
        e.preventDefault();
        e.stopPropagation();
        this._toggleFileScope();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._execute();
        return;
      }
    }, true); // <-- capture phase: fires before target and bubble handlers

    // Cmd+P opens file palette when palette is NOT visible
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && !e.ctrlKey && e.key === 'p' && !this.visible) {
        e.preventDefault();
        this.open('');
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
        await this._loadCommands();
        break;
      case 'heading':
        await this._loadHeadings();
        break;
      case 'theme':
        await this._loadThemes();
        break;
      case 'recent':
        await this._loadRecent();
        break;
      case 'buffer':
        await this._loadBuffers();
        break;
      case 'window':
        await this._loadWindows();
        break;
      default:
        this.items = [];
    }
  }

  async _loadFiles() {
    try {
      let dir;
      if (this.fileScope === 'directory') {
        // Current buffer's parent directory
        const currentFile = await invoke('get_current_file');
        if (currentFile) {
          const lastSlash = currentFile.lastIndexOf('/');
          dir = lastSlash >= 0 ? currentFile.substring(0, lastSlash) : '.';
        } else {
          dir = '.';
        }
      } else {
        // Working directory (where lexer was launched)
        dir = await invoke('get_working_directory');
      }

      // Use cache if available for this directory
      if (this._fileCache[dir]) {
        this.items = this._fileCache[dir];
        this._updateFilePlaceholder();
        return;
      }

      const entries = await invoke('scan_directory', { path: dir });
      this.items = entries.map(e => ({
        label: e.path,
        detail: this._formatTime(e.modified),
        value: dir + '/' + e.path,
        type: 'file',
      }));
      this._fileCache[dir] = this.items;
      this._updateFilePlaceholder();
    } catch (err) {
      console.error('scan_directory failed:', err);
      this.items = [];
    }
  }

  _toggleFileScope() {
    this.fileScope = this.fileScope === 'cwd' ? 'directory' : 'cwd';
    const gen = ++this._loadGeneration;
    this._loadCandidates().then(() => {
      if (gen !== this._loadGeneration) return; // stale
      this._filter();
      this._render();
      this._updateHint();
    });
    this._updateFilePlaceholder();
  }

  _updateFilePlaceholder() {
    if (this.mode === 'file') {
      this.input.placeholder = this.fileScope === 'directory'
        ? 'Search files in buffer directory...'
        : 'Search files in working directory...';
    }
  }

  async _loadCommands() {
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
      { label: 'theme', detail: 'Open theme picker', value: 'theme-picker', type: 'command' },
      { label: 'layout default', detail: 'Switch to default layout', value: 'layout-default', type: 'command' },
      { label: 'layout focus', detail: 'Centered reading column', value: 'layout-focus', type: 'command' },
      { label: 'layout zen', detail: 'Fullscreen, no chrome', value: 'layout-zen', type: 'command' },
      { label: 'layout split', detail: 'Side-by-side with ToC', value: 'layout-split', type: 'command' },
      { label: 'new window', detail: 'Open a new empty window', value: 'new-window', type: 'command' },
      { label: 'edit config', detail: 'Open config.toml in text editor', value: 'edit-config', type: 'command' },
    ];

    // Append user-defined custom commands from config.toml
    try {
      const customCmds = await invoke('get_custom_commands');
      for (const cmd of customCmds) {
        this.items.push({
          label: cmd.name,
          detail: cmd.command,
          value: cmd,
          type: 'custom-command',
        });
      }
    } catch (e) {
      console.error('Failed to load custom commands:', e);
    }
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

  async _loadThemes() {
    try {
      const themes = await invoke('list_themes');
      const active = await invoke('get_active_theme');
      this.items = themes.map(t => ({
        label: (t.file_name === active ? '● ' : '  ') + t.name,
        detail: `${t.base} · ${t.author || 'built-in'}`,
        value: t.file_name,
        type: 'theme',
      }));
    } catch (err) {
      console.error('list_themes failed:', err);
      this.items = [
        { label: 'lexer-dark', detail: 'Default dark theme', value: 'lexer-dark', type: 'theme' },
        { label: 'lexer-light', detail: 'Light theme', value: 'lexer-light', type: 'theme' },
      ];
    }
  }

  async _loadRecent() {
    try {
      const files = await invoke('get_recent_files');
      this.items = files.map(path => {
        const name = path.split('/').pop() || path;
        return {
          label: name,
          detail: path,
          value: path,
          type: 'file',
        };
      });
    } catch (err) {
      console.error('get_recent_files failed:', err);
      this.items = [];
    }
  }

  async _loadBuffers() {
    try {
      const buffers = await invoke('list_buffers');
      this.items = buffers.map(buf => ({
        label: (buf.active ? '● ' : '  ') + buf.title,
        detail: buf.file_path || 'Untitled',
        value: buf.id,
        type: 'buffer',
        modified: buf.modified,
      }));
    } catch (err) {
      console.error('list_buffers failed:', err);
      this.items = [];
    }
  }

  async _loadWindows() {
    try {
      const windows = await invoke('list_windows');
      this.items = windows.map(w => ({
        label: w.title,
        detail: w.id,
        value: w.id,
        type: 'window',
      }));
    } catch (err) {
      console.error('list_windows failed:', err);
      this.items = [];
    }
  }

  // --- Filtering ---

  _onInput() {
    const raw = this.input.value;

    // Check if prefix changed mode
    const prefixMap = { ':': 'command', '#': 'heading', '@': 'theme', '>': 'recent', '%': 'buffer', '&': 'window' };
    const firstChar = raw[0];
    if (prefixMap[firstChar] && this.mode !== prefixMap[firstChar]) {
      this.mode = prefixMap[firstChar];
      const gen = ++this._loadGeneration;
      this._loadCandidates().then(() => {
        if (gen !== this._loadGeneration) return; // stale
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
    const prefixes = [':', '#', '@', '>', '%', '&'];
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
    const prefixes = [':', '#', '@', '>', '%', '&'];
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
        // Skip if this was triggered by a keyboard-driven DOM rebuild
        if (this._renderingFromKeyboard) return;
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
    // Suppress mouseenter events caused by scrollIntoView moving items under
    // the cursor. The flag is only cleared when the user actually moves the mouse.
    this._renderingFromKeyboard = true;
    this._render();
  }

  _updateHint() {
    if (!this.hintEl) return;
    const scopeLabel = this.fileScope === 'directory' ? 'buffer directory' : 'working directory';
    const hints = {
      file: `Searching ${scopeLabel}  ·  Tab toggle scope  ·  : commands  ·  # headings`,
      command: 'Type to filter commands  ·  Enter to run',
      heading: 'Type to filter headings  ·  Enter to jump',
      theme: 'Type to filter themes  ·  Enter to apply',
      recent: 'Recently opened files  ·  Enter to open',
      buffer: 'Type to filter buffers  ·  Enter to switch',
      window: 'Type to filter windows  ·  Enter to focus',
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
        if (window.lexerApp) {
          window.lexerApp.openFile(item.value);
        }
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

      case 'custom-command':
        this._runCustomCommand(item.value);
        break;

      case 'theme':
        if (window.lexerApp) {
          window.lexerApp.loadTheme(item.value);
        }
        break;

      case 'buffer':
        if (window.lexerApp) {
          window.lexerApp.switchBuffer(item.value);
        }
        break;

      case 'window':
        invoke('focus_window', { windowId: item.value }).catch(console.error);
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
        if (window.lexerApp) {
          window.lexerApp.openFileDialog();
        }
        break;
      case 'reload':
        if (kb) kb._reload();
        break;
      case 'copy-path':
        invoke('get_current_file').then(path => {
          if (path) navigator.clipboard.writeText(path).catch(() => {});
        });
        break;
      case 'theme-picker':
        setTimeout(() => this.open('@'), 50);
        break;
      case 'layout-default':
      case 'layout-focus':
      case 'layout-zen':
      case 'layout-split':
        if (kb) kb._setLayout(cmd.replace('layout-', ''));
        break;
      case 'new-window':
        invoke('new_window', { path: null }).catch(console.error);
        break;
      case 'edit-config':
        invoke('open_config_in_editor').catch(console.error);
        break;
    }
  }

  // --- Custom Commands ---

  async _runCustomCommand(cmd) {
    try {
      const expanded = await this._expandCommandPlaceholders(cmd.command);
      const result = await invoke('run_custom_command', {
        command: expanded,
        workingDir: null,
        outputMode: cmd.output || 'ignore',
      });

      if (result.success) {
        switch (cmd.output) {
          case 'clipboard':
            if (result.stdout) {
              await navigator.clipboard.writeText(result.stdout).catch(() => {});
              this._showToast('Copied to clipboard');
            } else {
              this._showToast('No output to copy', true);
            }
            break;
          case 'toast':
            this._showToast(result.stdout.split('\n')[0] || `Ran: ${cmd.name}`);
            break;
          default:
            this._showToast(`Ran: ${cmd.name}`);
        }
      } else {
        const errMsg = result.stderr.split('\n')[0] || `Exit code ${result.exit_code}`;
        this._showToast(`${cmd.name} failed: ${errMsg}`, true);
      }
    } catch (err) {
      this._showToast(`${cmd.name}: ${err}`, true);
    }
  }

  async _expandCommandPlaceholders(template) {
    let result = template;

    const fileAbsolute = await invoke('get_current_file').catch(() => '') || '';
    const cwd = await invoke('get_working_directory').catch(() => '') || '';

    // Make file path relative to CWD
    let filePath = fileAbsolute;
    if (cwd && fileAbsolute.startsWith(cwd + '/')) {
      filePath = fileAbsolute.substring(cwd.length + 1);
    }

    // Derive path components
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    const dir = parts.join('/');
    const dotIdx = fileName.lastIndexOf('.');
    const fileStem = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
    const fileExt = dotIdx > 0 ? fileName.substring(dotIdx + 1) : '';

    // Absolute directory
    const dirAbsolute = dir ? `${cwd}/${dir}` : cwd;

    result = result.replaceAll('{file_absolute}', fileAbsolute);
    result = result.replaceAll('{file_name}', fileName);
    result = result.replaceAll('{file_stem}', fileStem);
    result = result.replaceAll('{file_ext}', fileExt);
    result = result.replaceAll('{file}', filePath);
    result = result.replaceAll('{dir_absolute}', dirAbsolute);
    result = result.replaceAll('{dir}', dir);
    result = result.replaceAll('{cwd}', cwd);

    // Clipboard placeholder
    if (result.includes('{clipboard}')) {
      const clip = await navigator.clipboard.readText().catch(() => '');
      result = result.replaceAll('{clipboard}', clip || '');
    }

    // Selection placeholder (from block select, if any)
    if (result.includes('{selection}')) {
      let selectionText = '';
      const kb = window.lexerKeyboard;
      if (kb && kb._selectBlocks) {
        const indices = [...kb._getSelectedIndices()].sort((a, b) => a - b);
        if (indices.length > 0) {
          selectionText = await invoke('get_block_sources', { indices }).catch(() => '');
        }
      }
      result = result.replaceAll('{selection}', selectionText || '');
    }

    return result;
  }

  _showToast(message, isError = false) {
    const statusFile = document.getElementById('status-file');
    if (!statusFile) return;
    const original = statusFile.textContent;
    statusFile.textContent = `${message} ${isError ? '\u2717' : '\u2713'}`;
    if (isError) statusFile.style.color = '#f85149';
    setTimeout(() => {
      statusFile.textContent = original;
      statusFile.style.color = '';
    }, isError ? 4000 : 2000);
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
