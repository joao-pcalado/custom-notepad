// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
const editor    = document.getElementById('editor');
const gutter    = document.getElementById('gutter');
const previewEl = document.getElementById('preview-pane');
const root      = document.documentElement;

let tabs = [];
let activeTab = null;
let tabCounter = 0;

let previewOn   = true; // minimap visível por padrão
let focusOn     = false;
let autoSaveTimer = null;
let autoSaveOn  = false;
let findMatches = [], findIdx = 0;

const RECENT_KEY = 'blocoCustomRecent';
let recentFiles = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');

// ══════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════
function newTab(name, content) {
  const id = ++tabCounter;
  const tab = {
    id,
    name: name || 'Sem título',
    content: content || '',
    dirty: false,
    scrollTop: 0,
    selStart: 0,
    selEnd: 0,
    filePath: null,
  };
  tabs.push(tab);
  renderTabs();
  switchTab(id);
  return tab;
}

function switchTab(id) {
  if (activeTab) {
    activeTab.content   = getEditorText();
    activeTab.scrollTop = editor.scrollTop;
  }
  activeTab = tabs.find(t => t.id === id);
  if (!activeTab) return;

  setEditorText(activeTab.content);
  editor.scrollTop = activeTab.scrollTop;

  renderTabs();
  updateStats();
  updateCursor();
  updateGutter();
  updateStatusFile();
}

function closeTab(id, e) {
  if (e) e.stopPropagation();
  const idx = tabs.findIndex(t => t.id === id);
  const tab = tabs[idx];
  if (tab.dirty && !confirm(`Fechar "${tab.name}" sem salvar?`)) return;
  tabs.splice(idx, 1);
  if (tabs.length === 0) { newTab(); return; }
  if (activeTab && activeTab.id === id) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    switchTab(next.id);
  } else {
    renderTabs();
  }
}

let dragSrcId = null;

function renderTabs() {
  const bar = document.getElementById('tabbar');
  const newBtn = bar.querySelector('.new-tab-btn');
  bar.innerHTML = '';
  bar.appendChild(newBtn);

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (activeTab && activeTab.id === tab.id ? ' active' : '');
    el.draggable = true;
    el.dataset.id = tab.id;

    el.innerHTML = `
      <span class="tab-name">${escHtml(tab.name)}</span>
      ${tab.dirty ? '<span class="dirty">●</span>' : ''}
      <button class="close-tab" onclick="closeTab(${tab.id},event)">×</button>
    `;

    // click para trocar de aba (ignora se veio de botão fechar)
    el.addEventListener('click', e => {
      if (!e.target.classList.contains('close-tab')) switchTab(tab.id);
    });

    // drag events
    el.addEventListener('dragstart', e => {
      dragSrcId = tab.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      if (tab.id !== dragSrcId) el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (dragSrcId === null || dragSrcId === tab.id) return;

      const fromIdx = tabs.findIndex(t => t.id === dragSrcId);
      const toIdx   = tabs.findIndex(t => t.id === tab.id);
      if (fromIdx === -1 || toIdx === -1) return;

      // reorder
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      dragSrcId = null;
      renderTabs();
    });

    bar.insertBefore(el, newBtn);
  });
}

function setDirty(val) {
  if (!activeTab) return;
  activeTab.dirty = val;
  renderTabs();
  updateStatusFile();
}

function updateStatusFile() {
  if (!activeTab) return;
  document.getElementById('sFile').textContent = activeTab.name + (activeTab.dirty ? ' ●' : '');
}

// ══════════════════════════════════════════════════
// EDITOR EVENTS
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// CONTENTEDITABLE HELPERS
// ══════════════════════════════════════════════════
function getEditorText() {
  // walk childNodes to extract plain text, preserving newlines from <br> and block elements
  function nodeText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeName === 'BR') return '\n';
    if (node.classList && node.classList.contains('link-chip')) {
      // chip represents its data-url
      return node.dataset.url || '';
    }
    let t = '';
    node.childNodes.forEach(c => t += nodeText(c));
    // block-level elements add a newline after
    const block = ['DIV','P','LI','TR','BLOCKQUOTE'];
    if (block.includes(node.nodeName) && node !== editor) t += '\n';
    return t;
  }
  let text = nodeText(editor);
  // remove trailing newline added by last div
  if (text.endsWith('\n')) text = text.slice(0, -1);
  return text;
}

function setEditorText(text) {
  // Clear and re-render as chips-aware HTML
  if (linkChipsOn) {
    renderChipsFromText(text);
  } else {
    // plain text — set as divs per line (browser contenteditable convention)
    editor.innerHTML = '';
    const lines = (text || '').split('\n');
    lines.forEach((line, i) => {
      if (i === 0) {
        // first line: text nodes directly
        editor.appendChild(document.createTextNode(line));
        if (lines.length > 1) editor.appendChild(document.createElement('br'));
      } else {
        editor.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) editor.appendChild(document.createElement('br'));
      }
    });
  }
}

function getCaretOffset() {
  // returns char offset of caret within getEditorText()
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.setStart(editor, 0);
  const tmp = document.createElement('span');
  range.insertNode(tmp);
  const text = getEditorText();
  tmp.remove();
  return text.length; // approximate — used only for line/col display
}

function getCaretLineCol() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return { line:1, col:1 };
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);

  // count newlines before caret by extracting text of a range from start to caret
  const preRange = document.createRange();
  preRange.setStart(editor, 0);
  preRange.setEnd(range.startContainer, range.startOffset);
  const div = document.createElement('div');
  div.appendChild(preRange.cloneContents());
  // replace chips with their URL text
  div.querySelectorAll('.link-chip').forEach(c => c.replaceWith(c.dataset.url || ''));
  const text = div.innerText || div.textContent || '';
  const lines = text.split('\n');
  return { line: lines.length, col: (lines[lines.length-1]||'').length + 1 };
}

function onEditorInput() {
  if (!activeTab) return;
  // if chips on, re-render chips after typing
  if (linkChipsOn) scheduleChipRender();
  activeTab.content = getEditorText();
  setDirty(true);
  updateStats();
  updateCursor();
  updateGutter();
  updateMinimap();
  if (autoSaveOn) scheduleAutoSave();
}

function updateStats() {
  const val = getEditorText();
  const words = val.trim() === '' ? 0 : val.trim().split(/\s+/).length;
  document.getElementById('sWords').textContent = words;
  document.getElementById('sChars').textContent = val.length;
  document.getElementById('wcTop').textContent = words + (words === 1 ? ' palavra' : ' palavras');
}

function updateCursor() {
  const { line, col } = getCaretLineCol();
  document.getElementById('sLine').textContent = line;
  document.getElementById('sCol').textContent  = col;
  highlightCurrentLine();
}

// ══════════════════════════════════════════════════
// LINE NUMBERS
// ══════════════════════════════════════════════════
function updateGutter() {
  const text    = getEditorText();
  const total   = (text.match(/\n/g) || []).length + 1;
  const curLine = getCaretLineCol().line;
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<span class="gutter-line${i === curLine ? ' current' : ''}">${i}</span>\n`;
  }
  gutter.innerHTML = html;
  gutter.style.fontSize  = getComputedStyle(root).getPropertyValue('--fs').trim();
  gutter.style.lineHeight = getComputedStyle(root).getPropertyValue('--lh').trim();
}

function highlightCurrentLine() {
  updateGutter();
}

function syncScroll() {
  gutter.scrollTop = editor.scrollTop;
  updateMinimap();
}

editor.addEventListener('scroll', syncScroll);

// ══════════════════════════════════════════════════
// MINIMAP
// ══════════════════════════════════════════════════
const minimapEl       = document.getElementById('minimap');
const minimapCanvas   = document.getElementById('minimapCanvas');
const minimapViewport = document.getElementById('minimap-viewport');
const mmCtx           = minimapCanvas.getContext('2d');
const MM_SCALE        = 0.18; // how much we shrink the text
let mmRaf = null;

function updateMinimap() {
  if (mmRaf) cancelAnimationFrame(mmRaf);
  mmRaf = requestAnimationFrame(drawMinimap);
}

function drawMinimap() {
  const W = minimapEl.clientWidth;
  const H = minimapEl.clientHeight;
  if (W === 0 || H === 0) return;

  minimapCanvas.width  = W;
  minimapCanvas.height = H;

  const style   = getComputedStyle(root);
  const bgColor = style.getPropertyValue('--bg').trim();
  const txtColor= style.getPropertyValue('--text').trim();
  const acColor = style.getPropertyValue('--accent').trim();

  // background
  mmCtx.fillStyle = bgColor;
  mmCtx.fillRect(0, 0, W, H);

  const lines     = getEditorText().split('\n');
  const totalLines= lines.length;
  const fs        = parseFloat(style.getPropertyValue('--fs')) || 15;
  const lh        = parseFloat(style.getPropertyValue('--lh')) || 1.75;
  const lineH     = fs * lh;
  const mmLineH   = Math.max(2, lineH * MM_SCALE);
  const totalH    = totalLines * mmLineH;

  // where editor currently is
  const scrollRatio  = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
  const visibleRatio = editor.clientHeight / Math.max(1, editor.scrollHeight);

  // offset so minimap scrolls with content when it overflows
  const mmOffset = scrollRatio * Math.max(0, totalH - H);

  // current cursor line
  const curLine = editor.value.slice(0, editor.selectionStart).split('\n').length - 1;

  mmCtx.font = `${Math.round(fs * MM_SCALE)}px monospace`;

  lines.forEach((line, i) => {
    const y = i * mmLineH - mmOffset;
    if (y + mmLineH < 0 || y > H) return;

    // highlight current line
    if (i === curLine) {
      mmCtx.fillStyle = 'rgba(255,255,255,0.06)';
      mmCtx.fillRect(0, y, W, mmLineH);
    }

    if (!line.trim()) return;
    // draw text as tiny colored blocks
    mmCtx.fillStyle = line.startsWith('#') ? acColor :
                      line.startsWith('//') || line.startsWith('--') ? style.getPropertyValue('--muted').trim() :
                      txtColor;
    mmCtx.globalAlpha = 0.7;
    mmCtx.fillText(line.slice(0, 120), 4, y + mmLineH * 0.75);
    mmCtx.globalAlpha = 1;
  });

  // viewport indicator
  const vpTop    = scrollRatio * H;
  const vpHeight = Math.max(20, visibleRatio * H);
  minimapViewport.style.top    = vpTop + 'px';
  minimapViewport.style.height = vpHeight + 'px';
}

// click/drag on minimap → scroll editor
let mmDragging = false;

minimapEl.addEventListener('mousedown', e => {
  mmDragging = true;
  seekMinimap(e);
});
document.addEventListener('mousemove', e => { if (mmDragging) seekMinimap(e); });
document.addEventListener('mouseup',   () => { mmDragging = false; });

function seekMinimap(e) {
  const rect  = minimapEl.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
  syncScroll();
  updateCursor();
}

function toggleLineNumbers() {
  gutter.style.display = document.getElementById('lnTgl').checked ? '' : 'none';
}

// ══════════════════════════════════════════════════
// LINK CHIPS
// ══════════════════════════════════════════════════
let linkChipsOn = false;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const linkCache = {};
let chipRenderTimer = null;

function toggleLinkChips() {
  linkChipsOn = document.getElementById('chipTgl').checked;
  const text = getEditorText();
  if (linkChipsOn) {
    renderChipsFromText(text);
  } else {
    // restaura texto puro
    setEditorText(text);
  }
}

function scheduleChipRender() {
  // debounce: espera parar de digitar 600ms antes de converter links em chips
  clearTimeout(chipRenderTimer);
  chipRenderTimer = setTimeout(() => {
    if (!linkChipsOn) return;
    const text = getEditorText();
    renderChipsFromText(text);
  }, 600);
}

function renderChipsFromText(text) {
  // Salva posição do caret para restaurar depois
  const sel = window.getSelection();
  const hadFocus = document.activeElement === editor;

  // Reconstrói o innerHTML do editor com chips no lugar das URLs
  const matches = [...text.matchAll(URL_RE)];
  if (!matches.length) {
    // nenhuma URL — só texto puro
    editor.innerHTML = '';
    insertTextNodes(editor, text);
    if (hadFocus) editor.focus();
    return;
  }

  const frag = document.createDocumentFragment();
  let cursor = 0;

  matches.forEach(m => {
    // texto antes da URL
    const before = text.slice(cursor, m.index);
    if (before) insertTextNodes(frag, before);

    // chip
    const url = m[0];
    frag.appendChild(buildChipNode(url, linkCache[url]));
    cursor = m.index + url.length;

    // fetch título se não cacheado
    if (!linkCache[url]) fetchLinkMeta(url);
  });

  // texto após última URL
  const after = text.slice(cursor);
  if (after) insertTextNodes(frag, after);

  editor.innerHTML = '';
  editor.appendChild(frag);

  // move caret para o fim
  if (hadFocus) {
    editor.focus();
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

function insertTextNodes(parent, text) {
  // split by \n and insert text + <br> nodes
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line) parent.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) parent.appendChild(document.createElement('br'));
  });
}

function buildChipNode(url, meta) {
  const domain  = domainOf(url);
  const title   = meta?.title || domain;
  const a = document.createElement('a');
  a.className   = 'link-chip';
  a.href        = url;
  a.dataset.url = url;
  a.target      = '_blank';
  a.rel         = 'noopener';
  a.contentEditable = 'false'; // chip é atômico — não editável por dentro

  // favicon
  if (meta?.favicon) {
    const img = document.createElement('img');
    img.src = meta.favicon;
    img.style.cssText = 'width:12px;height:12px;border-radius:2px;object-fit:contain;';
    img.onerror = () => img.replaceWith(chipIconSpan());
    a.appendChild(img);
  } else {
    a.appendChild(chipIconSpan());
  }

  const tSpan = document.createElement('span');
  tSpan.className = 'chip-title';
  tSpan.textContent = title;
  a.appendChild(tSpan);

  const dSpan = document.createElement('span');
  dSpan.className = 'chip-domain';
  dSpan.textContent = domain;
  a.appendChild(dSpan);

  // clique abre link sem interferir no editor
  a.addEventListener('click', e => { e.preventDefault(); window.open(url, '_blank'); });

  return a;
}

function chipIconSpan() {
  const s = document.createElement('span');
  s.className = 'chip-icon';
  s.textContent = '🔗';
  return s;
}

function domainOf(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return url.slice(0, 20); }
}

async function fetchLinkMeta(url) {
  linkCache[url] = { title: domainOf(url), favicon: faviconUrl(url) };
  // mostra domínio imediatamente nos chips já no DOM
  editor.querySelectorAll(`.link-chip[data-url="${CSS.escape(url)}"]`).forEach(chip => {
    const tSpan = chip.querySelector('.chip-title');
    if (tSpan) tSpan.textContent = domainOf(url);
  });

  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res   = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
    const json  = await res.json();
    const html  = json.contents || '';

    const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
    const ogMatch    = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,120})["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']{1,120})["'][^>]+property=["']og:title["']/i);

    const title = (ogMatch?.[1] || titleMatch?.[1] || domainOf(url))
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();

    linkCache[url] = { title, favicon: faviconUrl(url) };
    // atualiza chips existentes no DOM sem reescrever tudo
    editor.querySelectorAll(`.link-chip[data-url="${CSS.escape(url)}"]`).forEach(chip => {
      const tSpan = chip.querySelector('.chip-title');
      if (tSpan) tSpan.textContent = title;
      const favicon = chip.querySelector('img') || chip.querySelector('.chip-icon');
      if (favicon && faviconUrl(url)) {
        const img = document.createElement('img');
        img.src = faviconUrl(url);
        img.style.cssText = 'width:12px;height:12px;border-radius:2px;object-fit:contain;';
        img.onerror = () => img.replaceWith(chipIconSpan());
        favicon.replaceWith(img);
      }
    });
  } catch {
    // mantém domínio como fallback
  }
}

function faviconUrl(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch { return null; }
}

// ══════════════════════════════════════════════════
// MINIMAP TOGGLE (botão "Preview MD" / Ctrl+Shift+P)
// ══════════════════════════════════════════════════
function togglePreview() {
  previewOn = !previewOn;
  minimapEl.style.display = previewOn ? '' : 'none';
  document.getElementById('previewBtn').classList.toggle('active', previewOn);
  if (previewOn) updateMinimap();
}

function updatePreview() {
  // mantido por compatibilidade com chamadas existentes — não faz nada
}

function simpleMarkdown(md) {
  let html = escHtml(md);
  // fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code}</code></pre>`);
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // hr
  html = html.replace(/^---+$/gm, '<hr>');
  // bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  // strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // links + images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // unordered lists
  html = html.replace(/(^[*\-+] .+(\n[*\-+] .+)*)/gm, m => {
    const items = m.split('\n').map(l => `<li>${l.replace(/^[*\-+] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  // ordered lists
  html = html.replace(/(^\d+\. .+(\n\d+\. .+)*)/gm, m => {
    const items = m.split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  // tables
  html = html.replace(/(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)+)/g, m => {
    const rows = m.trim().split('\n');
    const header = rows[0].split('|').filter(c=>c.trim()).map(c=>`<th>${c.trim()}</th>`).join('');
    const body = rows.slice(2).map(r =>
      '<tr>'+r.split('|').filter(c=>c.trim()).map(c=>`<td>${c.trim()}</td>`).join('')+'</tr>'
    ).join('');
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  });
  // paragraphs
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*(<(?:h[1-6]|pre|ul|ol|blockquote|hr|table)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|pre|ul|ol|blockquote|hr|table)>)\s*<\/p>/g, '$1');
  // line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ══════════════════════════════════════════════════
// FILE OPS
// ══════════════════════════════════════════════════
function openFile() { document.getElementById('fileInput').click(); }

function handleOpen(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const tab = newTab(file.name, ev.target.result);
    tab.dirty = false;
    setDirty(false);
    addRecent(file.name);
    updateStats();
    updateGutter();
  };
  reader.readAsText(file);
  e.target.value = '';
}

function saveFile() {
  if (!activeTab) return;
  const content = getEditorText();
  activeTab.content = content;
  const name = activeTab.name.endsWith('.txt') || activeTab.name.includes('.')
    ? activeTab.name : activeTab.name + '.txt';
  const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  setDirty(false);
  addRecent(name);
  notify('Arquivo salvo!');
}

function saveAs() {
  const name = prompt('Nome do arquivo:', activeTab ? activeTab.name : 'nota');
  if (name === null) return;
  if (activeTab) activeTab.name = name;
  saveFile();
}

// ══════════════════════════════════════════════════
// RECENT FILES
// ══════════════════════════════════════════════════
function addRecent(name) {
  recentFiles = [name, ...recentFiles.filter(n => n !== name)].slice(0, 10);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentFiles)); } catch {}
}

function toggleRecent() {
  const drop = document.getElementById('recentDrop');
  drop.classList.toggle('show');
  if (drop.classList.contains('show')) renderRecent();
}

function renderRecent() {
  const drop = document.getElementById('recentDrop');
  if (recentFiles.length === 0) {
    drop.innerHTML = '<div class="recent-empty">Nenhum arquivo recente</div>';
    return;
  }
  drop.innerHTML = recentFiles.map(n =>
    `<div class="recent-item" onclick="openRecent('${escHtml(n)}')">${escHtml(n)}<span>abrir</span></div>`
  ).join('');
}

function openRecent(name) {
  document.getElementById('recentDrop').classList.remove('show');
  notify(`"${name}" foi aberto anteriormente nesta sessão. Use Abrir para carregar o arquivo.`);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) {
    document.getElementById('recentDrop').classList.remove('show');
  }
});

// ══════════════════════════════════════════════════
// AUTO-SAVE
// ══════════════════════════════════════════════════
function toggleAutoSave() {
  autoSaveOn = document.getElementById('autoSaveTgl').checked;
  if (!autoSaveOn && autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => { saveFile(); notify('Auto-salvo!'); }, 5000);
}

// ══════════════════════════════════════════════════
// FIND & REPLACE
// ══════════════════════════════════════════════════
function toggleFind() {
  const bar = document.getElementById('findbar');
  bar.classList.toggle('show');
  if (bar.classList.contains('show')) document.getElementById('findInput').focus();
  else { findMatches = []; document.getElementById('matchInfo').textContent = ''; }
}

function findKey(e) {
  if (e.key === 'Enter') { e.shiftKey ? prevMatch() : nextMatch(); }
  if (e.key === 'Escape') toggleFind();
}

function doFind() {
  const q = document.getElementById('findInput').value;
  const info = document.getElementById('matchInfo');
  if (!q) { findMatches = []; info.textContent = ''; return; }
  const cs = document.getElementById('caseCk').checked;
  const wb = document.getElementById('wordCk').checked;
  const flags = cs ? 'g' : 'gi';
  const pat = wb ? `\\b${escRe(q)}\\b` : escRe(q);
  try {
    findMatches = [...getEditorText().matchAll(new RegExp(pat, flags))];
    info.textContent = findMatches.length + (findMatches.length === 1 ? ' result' : ' results');
    findIdx = 0;
    if (findMatches.length) selectMatch(0);
  } catch {}
}

function selectMatch(i) {
  if (!findMatches.length) return;
  findIdx = ((i % findMatches.length) + findMatches.length) % findMatches.length;
  document.getElementById('matchInfo').textContent = (findIdx+1) + ' / ' + findMatches.length;
  // highlight via window.find (best effort in contenteditable)
  editor.focus();
  const m = findMatches[findIdx];
  const text = getEditorText();
  notify(`Resultado ${findIdx+1} de ${findMatches.length}`);
}

function nextMatch() { selectMatch(findIdx + 1); }
function prevMatch() { selectMatch(findIdx - 1); }

function doReplace() {
  const rep = document.getElementById('replaceInput').value;
  if (!findMatches.length) return;
  const m = findMatches[findIdx];
  const text = getEditorText();
  const newText = text.slice(0, m.index) + rep + text.slice(m.index + m[0].length);
  setEditorText(newText);
  if (activeTab) activeTab.content = newText;
  setDirty(true);
  doFind();
}

function doReplaceAll() {
  const q = document.getElementById('findInput').value;
  const rep = document.getElementById('replaceInput').value;
  if (!q) return;
  const cs = document.getElementById('caseCk').checked;
  const wb = document.getElementById('wordCk').checked;
  const flags = cs ? 'g' : 'gi';
  const pat = wb ? `\\b${escRe(q)}\\b` : escRe(q);
  try {
    const newText = getEditorText().replace(new RegExp(pat, flags), rep);
    setEditorText(newText);
    if (activeTab) activeTab.content = newText;
    setDirty(true);
    doFind();
  } catch {}
}

// ══════════════════════════════════════════════════
// FOCUS MODE
// ══════════════════════════════════════════════════
function toggleFocus() {
  focusOn = !focusOn;
  document.body.classList.toggle('focus-mode', focusOn);
  document.getElementById('focusBtn').classList.toggle('active', focusOn);
}

// ══════════════════════════════════════════════════
// FONT / SIZE / WRAP
// ══════════════════════════════════════════════════
function applyFont() { setVar('--font', document.getElementById('fontSel').value); updateGutter(); }

function applyFontSize(v) {
  document.getElementById('fsVal').textContent = v;
  setVar('--fs', v + 'px');
  setTimeout(updateGutter, 50);
}

function applyLineHeight(v) {
  const lh = (v / 10).toFixed(2);
  document.getElementById('lhVal').textContent = lh;
  setVar('--lh', lh);
  setTimeout(updateGutter, 50);
}

function changeFontSize(d) {
  const r = document.getElementById('fsRange');
  r.value = Math.min(28, Math.max(11, +r.value + d));
  applyFontSize(r.value);
}

function toggleWrap() {
  const on = document.getElementById('wrapTgl').checked;
  editor.style.whiteSpace = on ? 'pre-wrap' : 'pre';
  editor.style.wordWrap   = on ? 'break-word' : 'normal';
  document.body.classList.toggle('wrap-on', on);
}

function toggleSpell() {
  editor.spellcheck = document.getElementById('spellTgl').checked;
}

// ══════════════════════════════════════════════════
// SETTINGS PANEL
// ══════════════════════════════════════════════════
function toggleSettings() {
  document.getElementById('settings').classList.toggle('open');
}

function setVar(v, val) { root.style.setProperty(v, val); }

// ══════════════════════════════════════════════════
// THEMES
// ══════════════════════════════════════════════════
const THEMES = [
  { name:'Noite Azul', bg:'#1a1a2e', surface:'#16213e', bar:'#0f3460', gutter:'#0d2040', text:'#e0e0e0', muted:'#7a8aaa', accent:'#e94560', border:'#2a3a5a', ln:'#4a6080' },
  { name:'Floresta',   bg:'#1b2b1e', surface:'#152318', bar:'#0d1f10', gutter:'#111a12', text:'#c8e6c9', muted:'#6a916e', accent:'#69f0ae', border:'#2a4a2e', ln:'#3a6040' },
  { name:'Carvão',     bg:'#1c1c1c', surface:'#242424', bar:'#2c2c2c', gutter:'#181818', text:'#d4d4d4', muted:'#666',    accent:'#d97706', border:'#383838', ln:'#484848' },
  { name:'Lavanda',    bg:'#1e1b2e', surface:'#2a2540', bar:'#332d4f', gutter:'#191626', text:'#e8e0ff', muted:'#8878bb', accent:'#bf87ff', border:'#3a3358', ln:'#4a3a70' },
  { name:'Papel',      bg:'#f5f0e8', surface:'#ece7da', bar:'#ddd6c8', gutter:'#e8e2d8', text:'#2c2416', muted:'#8a7a60', accent:'#b5451b', border:'#cec7ba', ln:'#a89878' },
  { name:'Neve',       bg:'#f0f4f8', surface:'#e2eaf2', bar:'#d0dce8', gutter:'#e8eef4', text:'#1a2634', muted:'#6688aa', accent:'#1d7dd4', border:'#c0cdd8', ln:'#8aaac8' },
  { name:'Terminal',   bg:'#0d0d0d', surface:'#111',    bar:'#0a0a0a', gutter:'#080808', text:'#00ff41', muted:'#006614', accent:'#00ff41', border:'#002200', ln:'#004d18' },
  { name:'Oceano',     bg:'#0a1628', surface:'#0e1e38', bar:'#0b1930', gutter:'#081220', text:'#cce4ff', muted:'#5588bb', accent:'#38bdf8', border:'#1a2e48', ln:'#2a4a6a' },
  { name:'Róseo',      bg:'#2b1a1a', surface:'#3a2020', bar:'#4a2828', gutter:'#221414', text:'#f5d5d5', muted:'#aa6868', accent:'#ff6b6b', border:'#5a3030', ln:'#7a4040' },
];

let currentThemeIdx = 0;

function buildThemeGrid() {
  const grid = document.getElementById('themeGrid');
  THEMES.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'tchip' + (i === 0 ? ' on' : '');
    el.style.cssText = `background:${t.bg};color:${t.text}`;
    el.textContent = t.name;
    el.onclick = () => applyTheme(i);
    grid.appendChild(el);
  });
}

function applyTheme(i) {
  const t = THEMES[i];
  currentThemeIdx = i;
  setVar('--bg', t.bg); setVar('--surface', t.surface);
  setVar('--bar', t.bar); setVar('--gutter', t.gutter);
  setVar('--text', t.text); setVar('--muted', t.muted);
  setVar('--accent', t.accent); setVar('--border', t.border);
  setVar('--ln-text', t.ln);
  document.getElementById('cBg').value = t.bg;
  document.getElementById('cText').value = t.text;
  document.getElementById('cAccent').value = t.accent;
  document.querySelectorAll('.tchip').forEach((c, j) => c.classList.toggle('on', j === i));
}

// ══════════════════════════════════════════════════
// NOTIFICATION
// ══════════════════════════════════════════════════
let notifTimer;
function notify(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ══════════════════════════════════════════════════
// EDITOR EVENT LISTENERS
// ══════════════════════════════════════════════════
editor.addEventListener('input',   onEditorInput);
editor.addEventListener('keyup',   updateCursor);
editor.addEventListener('mouseup', updateCursor);
editor.addEventListener('click',   updateCursor);

editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '    ');
  }
  // Enter: insert <br> instead of <div> in some browsers
  if (e.key === 'Enter') {
    e.preventDefault();
    document.execCommand('insertLineBreak');
  }
});

// ══════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'F11') { e.preventDefault(); toggleFocus(); }
  if (ctrl && e.key === 'f') { e.preventDefault(); toggleFind(); }
  if (ctrl && e.key === 's') { e.preventDefault(); e.shiftKey ? saveAs() : saveFile(); }
  if (ctrl && e.key === 'n') { e.preventDefault(); newTab(); }
  if (ctrl && e.key === 'o') { e.preventDefault(); openFile(); }
  if (ctrl && e.key === 't') { e.preventDefault(); newTab(); }
  if (ctrl && e.key === 'w') { e.preventDefault(); if (activeTab) closeTab(activeTab.id); }
  if (ctrl && e.shiftKey && e.key === 'P') { e.preventDefault(); togglePreview(); }
  if (ctrl && e.key === ',') { e.preventDefault(); toggleSettings(); }
  if (ctrl && e.key === 'Tab') {
    e.preventDefault();
    const idx = tabs.findIndex(t => t.id === activeTab?.id);
    const next = tabs[(idx + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
    if (next) switchTab(next.id);
  }
});

// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
buildThemeGrid();
applyTheme(0);
newTab();
editor.focus();
updateGutter();
updateMinimap();
window.addEventListener('resize', updateMinimap);