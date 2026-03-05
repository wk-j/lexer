// Lexer - Frontend Application

// In Tauri v2 without npm, core APIs are on window.__TAURI__
// but plugin APIs must be called via invoke with plugin:name|command
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const contentEl = document.getElementById('content');
const statusFileEl = document.getElementById('status-file');

// --- File Opening ---

async function openFile(path) {
  try {
    const result = await invoke('open_file', { path });
    contentEl.innerHTML = result.html;
    statusFileEl.textContent = result.title;
    document.title = `${result.title} - Lexer`;
    contentEl.scrollTop = 0;
  } catch (err) {
    console.error('Failed to open file:', err);
    statusFileEl.textContent = `Error: ${err}`;
  }
}

async function openFileDialog() {
  try {
    // Tauri v2 plugin command for file open dialog
    const selected = await invoke('plugin:dialog|open', {
      options: {
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mkd', 'mdx'] }],
      },
    });
    if (selected) {
      // selected is a path string (or null if cancelled)
      await openFile(selected);
    }
  } catch (err) {
    console.error('Failed to open dialog:', err);
  }
}

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
  // Ctrl+O / Cmd+O: open file
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
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

// File changed on disk
listen('file-changed', (event) => {
  const scrollPos = contentEl.scrollTop;
  contentEl.innerHTML = event.payload.html;
  statusFileEl.textContent = event.payload.title;
  requestAnimationFrame(() => {
    contentEl.scrollTop = scrollPos;
  });
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

  // Relative .md links: open in Lexer
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
