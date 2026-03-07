// Lexer - Frontend Application

// In Tauri v2 without npm, core APIs are on window.__TAURI__
// but plugin APIs must be called via invoke with plugin:name|command
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const contentEl = document.getElementById('content');
const statusFileEl = document.getElementById('status-file');
const tabBarEl = document.getElementById('tab-bar');

// --- Window Drag (entire window, except interactive areas) ---
// Elements that should NOT trigger window dragging
const noDragSelectors = [
  '.content-panel',    // scrollable content area
  '.tab-bar',          // tab clicks
  '.status-bar',       // status bar interactions
  '.search-bar',       // search input
  '.palette-overlay',  // command palette
  '.which-key',        // which-key popup
  '.traffic-lights',   // custom traffic light buttons
  'button', 'input', 'a', 'select', 'textarea',
];

function isDragTarget(el) {
  // Walk up from target to see if it's inside a no-drag zone
  for (const sel of noDragSelectors) {
    if (el.closest(sel)) return false;
  }
  return true;
}

document.addEventListener('mousedown', async (e) => {
  if (e.button === 0 && e.detail === 1 && isDragTarget(e.target)) {
    try {
      await window.__TAURI__.window.getCurrentWindow().startDragging();
    } catch (_) {
      try { await window.__TAURI__.window.appWindow.startDragging(); } catch (_) {}
    }
  }
});

// Double-click titlebar area to maximize/restore
const dragEl = document.getElementById('titlebar-drag');
if (dragEl) {
  dragEl.addEventListener('dblclick', async () => {
    try {
      const win = window.__TAURI__.window.getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch (_) {}
  });
}

// --- Custom Vertical Traffic Lights ---
{
  const win = window.__TAURI__.window.getCurrentWindow();

  const tlClose = document.getElementById('tl-close');
  const tlMinimize = document.getElementById('tl-minimize');
  const tlMaximize = document.getElementById('tl-maximize');

  if (tlClose) tlClose.addEventListener('click', () => win.close().catch(() => {}));
  if (tlMinimize) tlMinimize.addEventListener('click', () => win.minimize().catch(() => {}));
  if (tlMaximize) {
    tlMaximize.addEventListener('click', async () => {
      try {
        if (await win.isFullscreen()) {
          await win.setFullscreen(false);
        } else {
          await win.setFullscreen(true);
        }
      } catch (_) {}
    });
  }

  // Grey out buttons when window loses focus
  const tlBtns = document.querySelectorAll('.tl-btn');
  window.addEventListener('blur', () => tlBtns.forEach(b => b.classList.add('inactive')));
  window.addEventListener('focus', () => tlBtns.forEach(b => b.classList.remove('inactive')));
}

// --- Buffer State ---

let currentBufferId = null;

// --- Tab Bar Rendering ---

function renderTabBar(buffers) {
  if (!tabBarEl) return;

  if (!buffers || buffers.length <= 1) {
    tabBarEl.classList.remove('visible');
    tabBarEl.innerHTML = '';
    return;
  }

  tabBarEl.classList.add('visible');
  tabBarEl.innerHTML = buffers.map(buf => {
    const classes = ['tab'];
    if (buf.active) classes.push('active');
    return `<div class="${classes.join(' ')}" data-buffer-id="${buf.id}">
      ${buf.modified ? '<span class="tab-modified">●</span>' : ''}
      <span class="tab-title">${escapeHtml(buf.title)}</span>
      <button class="tab-close" data-buffer-id="${buf.id}">&times;</button>
    </div>`;
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Tab Bar Click Handlers ---

if (tabBarEl) {
  tabBarEl.addEventListener('click', async (e) => {
    // Close button click
    const closeBtn = e.target.closest('.tab-close');
    if (closeBtn) {
      e.stopPropagation();
      const bufferId = Number(closeBtn.dataset.bufferId);
      await closeBuffer(bufferId);
      return;
    }

    // Tab click — switch buffer
    const tab = e.target.closest('.tab');
    if (tab) {
      const bufferId = Number(tab.dataset.bufferId);
      if (bufferId !== currentBufferId) {
        await switchBuffer(bufferId);
      }
    }
  });

  // Middle-click to close tab
  tabBarEl.addEventListener('auxclick', async (e) => {
    if (e.button === 1) {
      const tab = e.target.closest('.tab');
      if (tab) {
        e.preventDefault();
        const bufferId = Number(tab.dataset.bufferId);
        await closeBuffer(bufferId);
      }
    }
  });
}

// --- Buffer Operations ---

async function switchBuffer(bufferId) {
  try {
    const result = await invoke('switch_buffer', {
      bufferId,
      scrollPosition: contentEl.scrollTop,
    });
    applyBufferContent(result);
  } catch (err) {
    console.error('Failed to switch buffer:', err);
  }
}

async function closeBuffer(bufferId) {
  try {
    const result = await invoke('close_buffer', {
      bufferId,
      scrollPosition: contentEl.scrollTop,
    });
    renderTabBar(result.buffers);
    if (result.new_active) {
      applyBufferContent(result.new_active);
    } else {
      // No buffers left — show empty state
      currentBufferId = null;
      contentEl.innerHTML = `<div class="empty-state">
        <h1>Lexer</h1>
        <p>Open a Markdown file to get started.</p>
        <p class="hint">Drag &amp; drop a <code>.md</code> file, or press <kbd>Cmd+O</kbd></p>
      </div>`;
      statusFileEl.textContent = 'No file open';
      document.title = 'Lexer';
    }
  } catch (err) {
    console.error('Failed to close buffer:', err);
  }
}

async function nextBuffer() {
  try {
    const result = await invoke('next_buffer', {
      scrollPosition: contentEl.scrollTop,
    });
    applyBufferContent(result);
  } catch (err) {
    console.error('Failed to switch to next buffer:', err);
  }
}

async function prevBuffer() {
  try {
    const result = await invoke('prev_buffer', {
      scrollPosition: contentEl.scrollTop,
    });
    applyBufferContent(result);
  } catch (err) {
    console.error('Failed to switch to previous buffer:', err);
  }
}

async function closeOtherBuffers() {
  try {
    const result = await invoke('close_other_buffers', {
      scrollPosition: contentEl.scrollTop,
    });
    applyBufferContent(result);
  } catch (err) {
    console.error('Failed to close other buffers:', err);
  }
}

function applyBufferContent(result) {
  currentBufferId = result.buffer_id;
  contentEl.innerHTML = result.html;
  indexBlocks();
  statusFileEl.textContent = result.title;
  document.title = `${result.title} - Lexer`;

  // Restore scroll position
  requestAnimationFrame(() => {
    contentEl.scrollTop = result.scroll_position || 0;
  });

  // Update tab bar
  if (result.buffers) {
    renderTabBar(result.buffers);
  }
}

// --- File Opening ---

async function openFile(path) {
  try {
    const result = await invoke('open_file', {
      path,
      scrollPosition: contentEl.scrollTop,
    });
    currentBufferId = result.buffer_id;
    contentEl.innerHTML = result.html;
    indexBlocks();
    statusFileEl.textContent = result.title;
    document.title = `${result.title} - Lexer`;
    renderTabBar(result.buffers);

    if (result.already_open) {
      // File was already open — content is already cached, restore scroll
      // (scroll_position not in OpenFileResult, we get it from the buffer content)
    } else {
      contentEl.scrollTop = 0;
    }
  } catch (err) {
    console.error('Failed to open file:', err);
    statusFileEl.textContent = `Error: ${err}`;
  }
}

async function openFileDialog() {
  try {
    // Tauri v2 plugin command for file open dialog
    const result = await invoke('plugin:dialog|open', {
      options: {
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mkd', 'mdx'] }],
      },
    });
    console.log('dialog result:', JSON.stringify(result));
    // Result may be a string path, an object with path property, or an array
    const path = typeof result === 'string' ? result
      : (result && typeof result === 'object' && result.path) ? result.path
      : Array.isArray(result) ? result[0]
      : null;
    if (path) {
      const filePath = typeof path === 'string' ? path : path.path || String(path);
      await openFile(filePath);
    }
  } catch (err) {
    console.error('Failed to open dialog:', err);
  }
}

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
  // Cmd+O: open file (macOS only — Ctrl+O is reserved for prev buffer)
  if (e.metaKey && !e.ctrlKey && e.key === 'o') {
    e.preventDefault();
    openFileDialog();
  }
});

// --- Drag and Drop ---

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.name.match(/\.(md|markdown|mkd|mdx)$/i)) {
      openFile(file.path || file.name);
    }
  }
});

// --- Events from Rust ---

// File passed via CLI argument
listen('open-file-arg', (event) => {
  openFile(event.payload);
});

// Active buffer's file changed on disk
listen('file-changed', (event) => {
  const scrollPos = contentEl.scrollTop;
  contentEl.innerHTML = event.payload.html;
  indexBlocks();
  statusFileEl.textContent = event.payload.title;
  requestAnimationFrame(() => {
    contentEl.scrollTop = scrollPos;
  });
});

// Inactive buffer modified on disk — update tab indicator
listen('buffer-modified', (event) => {
  const bufferId = event.payload;
  const tab = tabBarEl?.querySelector(`.tab[data-buffer-id="${bufferId}"]`);
  if (tab && !tab.querySelector('.tab-modified')) {
    const dot = document.createElement('span');
    dot.className = 'tab-modified';
    dot.textContent = '●';
    tab.insertBefore(dot, tab.firstChild);
  }
});

// --- Link handling ---

contentEl.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href) return;

  // External links: open in default browser
  if (href.startsWith('http://') || href.startsWith('https://')) {
    e.preventDefault();
    invoke('plugin:shell|open', { path: href }).catch(console.error);
    return;
  }

  // Anchor links: scroll to heading
  if (href.startsWith('#')) {
    e.preventDefault();
    const target = document.getElementById(href.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  // Relative .md links: open in Lexer (as new buffer)
  if (href.match(/\.(md|markdown)$/i)) {
    e.preventDefault();
    invoke('get_current_file').then((currentFile) => {
      if (currentFile) {
        const dir = currentFile.substring(0, currentFile.lastIndexOf('/'));
        openFile(`${dir}/${href}`);
      }
    });
  }
});

// --- Theme Management ---

let themeStyleEl = null;

function applyThemeCss(css) {
  if (!themeStyleEl) {
    themeStyleEl = document.createElement('style');
    themeStyleEl.id = 'lexer-theme';
    document.head.appendChild(themeStyleEl);
  }
  themeStyleEl.textContent = css;
}

async function loadTheme(name) {
  try {
    const result = await invoke('load_theme', { name });
    applyThemeCss(result.css);
    return result;
  } catch (err) {
    console.error('Failed to load theme:', err);
    return null;
  }
}

// Load initial theme on startup
(async () => {
  try {
    const active = await invoke('get_active_theme');
    await loadTheme(active);
  } catch (_) {
    // Default theme CSS is already in style.css as fallback
  }
})();

// Theme hot-reload from backend
listen('theme-updated', (event) => {
  applyThemeCss(event.payload);
});

// Startup configuration from backend (CLI args + config file)
listen('startup-config', async (event) => {
  const config = event.payload;

  // Apply theme
  if (config.theme) {
    await loadTheme(config.theme);
  }

  // Apply layout
  if (config.layout && config.layout !== 'default') {
    document.documentElement.dataset.layout = config.layout;
  }

  // Disable effects if requested
  if (config.noEffects) {
    document.body.classList.add('effects-off');
  }

  // Apply scroll speed
  if (config.scrollSpeed && window.lexerKeyboard) {
    window.lexerKeyboard.scrollSpeed = config.scrollSpeed;
  }
});

// --- Block Indexing (for Block Select mode) ---

const BLOCK_SELECTORS = 'h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol, table, hr, details, .footnote-definition';

function indexBlocks() {
  let idx = 0;
  for (const child of contentEl.children) {
    if (child.matches(BLOCK_SELECTORS)) {
      child.setAttribute('data-block-index', idx);
      idx++;
    } else {
      child.removeAttribute('data-block-index');
    }
  }
}

// --- Expose for other modules ---
window.lexerApp = {
  openFile,
  openFileDialog,
  switchBuffer,
  closeBuffer,
  nextBuffer,
  prevBuffer,
  closeOtherBuffers,
  loadTheme,
  indexBlocks,
  get currentBufferId() { return currentBufferId; },
};
