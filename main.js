// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
const U      = window.BlocoUtils;
const $      = id => document.getElementById(id);
const editor = $('editor');
const gutter = $('gutter');
const root   = document.documentElement;

// ?test → armazenamento separado, sem rede (usado por tests/)
const TEST_MODE    = new URLSearchParams(location.search).has('test');
const STORE        = TEST_MODE ? 'blocoTest:' : '';
const RECENT_KEY   = STORE + 'blocoCustomRecent';
const SESSION_KEY  = STORE + 'blocoCustomSession';
const SETTINGS_KEY = STORE + 'blocoCustomSettings';
const RECENT_MAX_CHARS = 200000;   // conteúdo maior que isso fica só com o nome
const BIG_FILE_BYTES   = 2 * 1024 * 1024;

const DEFAULT_SETTINGS = {
  theme: 0, colors: null,
  font: "'JetBrains Mono', monospace", fs: 15, lh: 1.75,
  wrap: false, spell: true, lineNumbers: true, chips: false,
  minimap: true, session: true,
};
const settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON(SETTINGS_KEY, {}));

let tabs = [];
let activeTab = null;
let tabCounter = 0;

let currentText = '';               // texto do editor, atualizado a cada input
let caret = { start: 0, end: 0, line: 1, col: 1 };
let focusOn = false;
let findMatches = [], findIdx = 0;

// ══════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════
function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch { return fallback; }
}

function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function saveSetting(key, value) {
  settings[key] = value;
  saveJSON(SETTINGS_KEY, settings);
}

// ══════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════
function makeTab(name, content, extra) {
  return Object.assign({
    id: ++tabCounter,
    uid: Date.now().toString(36) + Math.random().toString(36).slice(2), // estável entre sessões
    name: name || 'Sem título',
    content: content || '',
    dirty: false,
    scrollTop: 0,
    selStart: 0,
    selEnd: 0,
    eol: '\n',       // fim de linha original do arquivo ('\n' ou '\r\n')
    handle: null,    // FileSystemFileHandle, quando aberto/salvo pelo seletor nativo
  }, extra);
}

function newTab(name, content, extra) {
  const tab = makeTab(name, content, extra);
  tabs.push(tab);
  switchTab(tab.id);
  schedulePersist();
  return tab;
}

function switchTab(id) {
  const next = tabs.find(t => t.id === id);
  if (!next) return;
  if (activeTab && activeTab !== next) {
    activeTab.content   = currentText;
    activeTab.scrollTop = editor.scrollTop;
    activeTab.selStart  = caret.start;
    activeTab.selEnd    = caret.end;
  }
  activeTab = next;

  setEditorText(activeTab.content);
  currentText = activeTab.content;
  editor.focus({ preventScroll: true });
  setSelectionOffsets(activeTab.selStart, activeTab.selEnd);
  editor.scrollTop = activeTab.scrollTop;

  renderTabs();
  updateStatusFile();
  refreshEditorUI();
  if (findOpen()) doFind();
}

function closeTab(id, e) {
  if (e) e.stopPropagation();
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const tab = tabs[idx];
  if (tab.dirty && !confirm(`Fechar "${tab.name}" sem salvar?`)) return;
  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    activeTab = null;
    newTab();
  } else if (activeTab === tab) {
    activeTab = null;
    switchTab(tabs[Math.min(idx, tabs.length - 1)].id);
  } else {
    renderTabs();
  }
  schedulePersist();
}

function renameTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  const name = prompt('Renomear aba:', tab.name);
  if (name === null || !name.trim()) return;
  tab.name = name.trim();
  renderTabs();
  updateStatusFile();
  schedulePersist();
}

let dragSrcId = null;

function renderTabs() {
  const bar = $('tabbar');
  const newBtn = bar.querySelector('.new-tab-btn');
  bar.replaceChildren(newBtn);

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (activeTab === tab ? ' active' : '');
    el.draggable = true;
    el.dataset.id = tab.id;
    el.title = tab.name + ' — duplo clique para renomear';

    const name = document.createElement('span');
    name.className = 'tab-name';
    name.textContent = tab.name;
    el.appendChild(name);

    if (tab.dirty) {
      const dot = document.createElement('span');
      dot.className = 'dirty';
      dot.textContent = '●';
      el.appendChild(dot);
    }

    const close = document.createElement('button');
    close.className = 'close-tab';
    close.textContent = '×';
    close.title = 'Fechar (Ctrl+W)';
    close.addEventListener('click', e => closeTab(tab.id, e));
    el.appendChild(close);

    el.addEventListener('click', () => { if (activeTab !== tab) switchTab(tab.id); });
    el.addEventListener('dblclick', e => { if (e.target !== close) renameTab(tab.id); });
    el.addEventListener('auxclick', e => { if (e.button === 1) closeTab(tab.id, e); });

    // reordenação por arrastar
    el.addEventListener('dragstart', e => {
      dragSrcId = tab.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-bloco-tab', String(tab.id));
    });
    el.addEventListener('dragend', () => {
      dragSrcId = null;
      el.classList.remove('dragging');
      bar.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      if (dragSrcId === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      bar.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      if (tab.id !== dragSrcId) el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      if (dragSrcId === null) return;
      e.preventDefault();
      el.classList.remove('drag-over');
      moveTab(dragSrcId, tab.id);
    });

    bar.insertBefore(el, newBtn);
  });

  bar.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function moveTab(fromId, toId) {
  const fromIdx = tabs.findIndex(t => t.id === fromId);
  const toIdx   = tabs.findIndex(t => t.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
  const [moved] = tabs.splice(fromIdx, 1);
  tabs.splice(toIdx, 0, moved);
  renderTabs();
  schedulePersist();
}

function setDirty(val) {
  if (!activeTab || activeTab.dirty === val) return;
  activeTab.dirty = val;
  renderTabs();
  updateStatusFile();
}

function updateStatusFile() {
  if (!activeTab) return;
  $('sFile').textContent = activeTab.name + (activeTab.dirty ? ' ●' : '');
  $('sEol').textContent  = activeTab.eol === '\r\n' ? 'CRLF' : 'LF';
  document.title = (activeTab.dirty ? '● ' : '') + activeTab.name + ' — Bloco';
}

// ══════════════════════════════════════════════════
// EDITOR MODEL (contenteditable ⇄ texto puro)
// ══════════════════════════════════════════════════
// O DOM do editor contém texto, <br> e chips de link. O texto equivalente:
//  - nó de texto → como está;  <br> → '\n';  chip → sua URL;
//  - blocos (<div>, <p>…) começam/terminam linhas;
//  - a última quebra de um bloco (um <br>, ou o '\n' final do último nó de texto,
//    que o Chrome usa com white-space: pre) é "sentinela": o navegador precisa
//    dela para exibir uma linha final vazia, mas ela não representa um caractere.
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'TR', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

const isChip = n => n.nodeType === Node.ELEMENT_NODE && n.classList.contains('link-chip');
const indexOfNode = n => Array.prototype.indexOf.call(n.parentNode.childNodes, n);

function isLastInBlock(node) {
  const p = node.parentNode;
  if (p !== editor && !BLOCK_TAGS.has(p.nodeName)) return false;
  for (let n = node.nextSibling; n; n = n.nextSibling) {
    if (n.nodeType !== Node.TEXT_NODE || n.data !== '') return false;
  }
  return true;
}

function normalizePoint(node, offset) {
  if (!node || !editor.contains(node)) return null;
  for (let n = node; n && n !== editor; n = n.parentNode) {
    if (isChip(n)) return { node: n.parentNode, offset: indexOfNode(n) + 1 };
  }
  return { node, offset };
}

// Percorre o DOM uma vez: devolve o texto, os "pedaços" (para mapear offset → DOM)
// e o offset de texto de cada ponto {node, offset} pedido.
function serializeEditor(rawPoints) {
  const points  = (rawPoints || []).map(p => p && normalizePoint(p.node, p.offset));
  const offsets = points.map(() => null);
  const lazy    = [];   // pontos que caem antes de uma quebra virtual ainda pendente
  const pieces  = [];
  const parts   = [];
  let len = 0, pending = false;

  const emit = s => { parts.push(s); len += s.length; };
  const flush = () => {
    if (!pending) return;
    pending = false;
    pieces.push({ kind: 'virtual', start: len, end: len + 1 });
    emit('\n');
    lazy.splice(0).forEach(i => { offsets[i] = len; });
  };
  const resolve = (i, value) => {
    if (offsets[i] !== null || lazy.includes(i)) return;
    if (value === undefined) { if (pending) lazy.push(i); else offsets[i] = len; }
    else offsets[i] = value;
  };
  const markBoundary = (el, idx) => points.forEach((p, i) => {
    if (p && p.node === el && p.offset === idx) resolve(i);
  });

  function walk(el) {
    const kids = el.childNodes;
    for (let i = 0; i < kids.length; i++) {
      markBoundary(el, i);
      visit(kids[i]);
    }
    markBoundary(el, kids.length);
  }

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.data;
      if (t.endsWith('\n') && isLastInBlock(node)) t = t.slice(0, -1); // '\n' sentinela
      if (t || node.data) flush();
      points.forEach((p, i) => {
        if (p && p.node === node) resolve(i, t || !pending ? len + Math.min(p.offset, t.length) : undefined);
      });
      if (t) { pieces.push({ kind: 'text', node, start: len, end: len + t.length }); emit(t); }
    } else if (node.nodeName === 'BR') {
      flush();
      if (isLastInBlock(node)) {
        pieces.push({ kind: 'placeholder', node, start: len, end: len });
      } else {
        pieces.push({ kind: 'br', node, start: len, end: len + 1 });
        emit('\n');
      }
    } else if (isChip(node)) {
      flush();
      const url = node.dataset.url || '';
      pieces.push({ kind: 'chip', node, start: len, end: len + url.length });
      emit(url);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const block = BLOCK_TAGS.has(node.nodeName);
      if (block && len > 0) pending = true;
      walk(node);
      if (block) pending = true;
    }
  }

  walk(editor);
  lazy.forEach(i => { offsets[i] = len; });
  return { text: parts.join(''), pieces, offsets };
}

function getEditorText() { return serializeEditor().text; }

// offset de texto → ponto no DOM
function pointAt(offset, pieces) {
  const before = n => ({ node: n.parentNode, offset: indexOfNode(n) });
  for (const p of pieces) {
    if (p.kind === 'text' && offset >= p.start && offset <= p.end) return { node: p.node, offset: offset - p.start };
    if ((p.kind === 'br' || p.kind === 'placeholder') && offset === p.start) return before(p.node);
    if (p.kind === 'chip' && offset >= p.start && offset <= p.end) {
      const b = before(p.node);
      return offset === p.start ? b : { node: b.node, offset: b.offset + 1 };
    }
  }
  return { node: editor, offset: editor.childNodes.length };
}

function rangeFromOffsets(start, end, pieces) {
  pieces = pieces || serializeEditor().pieces;
  const a = pointAt(start, pieces);
  const b = end === start ? a : pointAt(end, pieces);
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  return r;
}

function getSelectionOffsets() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.startContainer)) return null;
  const { text, offsets } = serializeEditor([
    { node: r.startContainer, offset: r.startOffset },
    { node: r.endContainer,   offset: r.endOffset },
  ]);
  if (offsets[0] === null) return null;
  return { start: offsets[0], end: offsets[1] === null ? offsets[0] : offsets[1], text };
}

function setSelectionOffsets(start, end) {
  const len = currentText.length;
  start = Math.max(0, Math.min(start || 0, len));
  end   = Math.max(start, Math.min(end === undefined ? start : end, len));
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(rangeFromOffsets(start, end));
}

// texto → DOM. `urls` = links a renderizar como chip (padrão: todos, se chips ativos)
function setEditorText(text, urls) {
  text = text || '';
  if (urls === undefined) urls = linkChipsOn ? U.findUrls(text) : [];
  const frag = document.createDocumentFragment();
  const pushText = s => s.split('\n').forEach((line, i) => {
    if (i) frag.appendChild(document.createElement('br'));
    if (line) frag.appendChild(document.createTextNode(line));
  });

  let pos = 0;
  urls.forEach(m => {
    pushText(text.slice(pos, m.index));
    frag.appendChild(buildChipNode(m.url));
    if (!linkCache[m.url]) fetchLinkMeta(m.url);
    pos = m.index + m.url.length;
  });
  pushText(text.slice(pos));
  if (text.endsWith('\n')) frag.appendChild(document.createElement('br')); // sentinela

  editor.replaceChildren(frag);
  editor.classList.toggle('is-empty', text === '');
}

// re-renderiza o editor a partir do texto, sem perder cursor/scroll
function rerenderEditor(urls) {
  const sel = document.activeElement === editor ? getSelectionOffsets() : null;
  const top = editor.scrollTop, left = editor.scrollLeft;
  setEditorText(currentText, urls);
  if (sel) setSelectionOffsets(sel.start, sel.end);
  editor.scrollTop = top;
  editor.scrollLeft = left;
}

// substitui um trecho mantendo o histórico de desfazer (Ctrl+Z) do navegador
function replaceRange(start, end, str) {
  editor.focus({ preventScroll: true });
  setSelectionOffsets(start, end);
  const ok = str
    ? document.execCommand('insertText', false, str)
    : start === end || document.execCommand('delete');
  if (!ok) {
    currentText = currentText.slice(0, start) + str + currentText.slice(end);
    setEditorText(currentText);
    setSelectionOffsets(start + str.length);
    onEditorInput();
  }
}

// ══════════════════════════════════════════════════
// EDITOR EVENTS
// ══════════════════════════════════════════════════
// elementos que não pertencem ao modelo (ex.: HTML arrastado de outra página).
// <div> é tolerado: o Chrome o usa em colagens de várias linhas, e reconstruir o
// DOM nesse momento quebraria o Ctrl+Z.
const FOREIGN_SELECTOR = ':not(br):not(div):not(.link-chip):not(.link-chip *)';

function onEditorInput() {
  if (!activeTab) return;
  currentText = getEditorText();
  if (editor.querySelector(FOREIGN_SELECTOR)) rerenderEditor();
  activeTab.content = currentText;
  editor.classList.toggle('is-empty', currentText === '');
  setDirty(true);
  refreshEditorUI();
  if (linkChipsOn) scheduleChipRender();
  if (findOpen()) doFind(true);
  schedulePersist();
}

function refreshEditorUI() {
  updateStats();
  updateCursor();
  updateGutter();
  updateMinimap();
}

function updateStats() {
  const words = U.countWords(currentText);
  $('sWords').textContent = words;
  $('sChars').textContent = currentText.length;
  $('wcTop').textContent  = U.formatWordCount(words);
}

function updateCursor() {
  const sel = getSelectionOffsets();
  if (sel) {
    const { line, col } = U.lineColAt(sel.text, sel.end);
    caret = { start: sel.start, end: sel.end, line, col };
  }
  $('sLine').textContent = caret.line;
  $('sCol').textContent  = caret.col;
  const selLen = caret.end - caret.start;
  $('sSel').textContent  = selLen ? `(${selLen} selecionados)` : '';
  setGutterCurrent(caret.line);
  updateMinimap();
}

let caretRaf = null;
document.addEventListener('selectionchange', () => {
  if (caretRaf) return;
  caretRaf = requestAnimationFrame(() => {
    caretRaf = null;
    if (document.activeElement === editor) updateCursor();
  });
});

editor.addEventListener('input', onEditorInput);
editor.addEventListener('scroll', syncScroll);

editor.addEventListener('keydown', e => {
  if (e.isComposing) return;
  if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (e.shiftKey) outdentLine();
    else document.execCommand('insertText', false, '    ');
  }
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    // mantém a indentação da linha atual
    const sel = getSelectionOffsets();
    const lineStart = sel ? currentText.lastIndexOf('\n', sel.start - 1) + 1 : 0;
    const indent = sel ? currentText.slice(lineStart, sel.start).match(/^[ \t]*/)[0] : '';
    if (!document.execCommand('insertLineBreak')) document.execCommand('insertText', false, '\n');
    if (indent) document.execCommand('insertText', false, indent);
  }
});

function outdentLine() {
  const sel = getSelectionOffsets();
  if (!sel) return;
  const lineStart = currentText.lastIndexOf('\n', sel.start - 1) + 1;
  const m = currentText.slice(lineStart).match(/^( {1,4}|\t)/);
  if (!m) return;
  const n = m[0].length;
  replaceRange(lineStart, lineStart + n, '');
  setSelectionOffsets(Math.max(lineStart, sel.start - n), Math.max(lineStart, sel.end - n));
}

// colar sempre como texto puro
editor.addEventListener('paste', e => {
  e.preventDefault();
  const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
  if (!text) return;
  const clean = text.replace(/\r\n?/g, '\n');
  if (!document.execCommand('insertText', false, clean)) {
    const sel = getSelectionOffsets() || { start: currentText.length, end: currentText.length };
    replaceRange(sel.start, sel.end, clean);
  }
});

// copiar/recortar: garante texto puro (URLs no lugar dos chips)
['copy', 'cut'].forEach(type => editor.addEventListener(type, e => {
  const sel = getSelectionOffsets();
  if (!sel || sel.start === sel.end || !e.clipboardData) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', sel.text.slice(sel.start, sel.end));
  if (type === 'cut') document.execCommand('delete');
}));

// ══════════════════════════════════════════════════
// LINE NUMBERS
// ══════════════════════════════════════════════════
let gutterLines = 0, gutterCurrent = 0;

function updateGutter() {
  const total = U.countLines(currentText);
  if (total !== gutterLines) {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= total; i++) {
      const s = document.createElement('span');
      s.className = 'gutter-line';
      s.textContent = i;
      frag.appendChild(s);
    }
    gutter.replaceChildren(frag);
    gutterLines = total;
    gutterCurrent = 0;
  }
  setGutterCurrent(caret.line);
  scheduleWrapMeasure();
  syncScroll();
}

// Com quebra automática, uma linha lógica pode ocupar várias linhas na tela.
// Uma cópia invisível do texto, com a mesma largura e fonte, mede a altura de
// cada linha, e cada número do gutter recebe essa altura (como no VS Code).
let wrapRaf = null;

function scheduleWrapMeasure() {
  if (!settings.wrap || wrapRaf) return;
  wrapRaf = requestAnimationFrame(() => { wrapRaf = null; measureWrappedLines(); });
}

function measureWrappedLines() {
  if (!settings.wrap || !editor.clientWidth) return;
  const cs = getComputedStyle(editor);
  const mirror = document.createElement('div');
  mirror.className = 'wrap-mirror';
  mirror.style.width        = editor.clientWidth + 'px';
  mirror.style.paddingLeft  = cs.paddingLeft;
  mirror.style.paddingRight = cs.paddingRight;

  currentText.split('\n').forEach(line => {
    const row = document.createElement('div');
    let pos = 0;
    (linkChipsOn ? U.findUrls(line) : []).forEach(m => {
      row.append(line.slice(pos, m.index), buildChipNode(m.url));
      pos = m.index + m.url.length;
    });
    row.append(line.slice(pos) || (pos ? '' : '​')); // linha vazia ainda ocupa altura
    mirror.appendChild(row);
  });

  editor.parentNode.appendChild(mirror);
  const rows = mirror.children, nums = gutter.children;
  for (let i = 0; i < nums.length && i < rows.length; i++) nums[i].style.height = rows[i].offsetHeight + 'px';
  mirror.remove();
}

function setGutterCurrent(line) {
  if (line === gutterCurrent) return;
  gutter.children[gutterCurrent - 1]?.classList.remove('current');
  gutter.children[line - 1]?.classList.add('current');
  gutterCurrent = line;
}

function syncScroll() {
  gutter.scrollTop = editor.scrollTop;
  updateMinimap();
}

function toggleLineNumbers() {
  saveSetting('lineNumbers', $('lnTgl').checked);
  document.body.classList.toggle('no-line-numbers', !settings.lineNumbers);
}

// ══════════════════════════════════════════════════
// MINIMAP
// ══════════════════════════════════════════════════
const minimapEl       = $('minimap');
const minimapCanvas   = $('minimapCanvas');
const minimapViewport = $('minimap-viewport');
const mmCtx           = minimapCanvas.getContext('2d');
const MM_SCALE        = 0.18; // quanto o texto encolhe
let mmRaf = null;

function updateMinimap() {
  if (!settings.minimap || mmRaf) return;
  mmRaf = requestAnimationFrame(() => { mmRaf = null; drawMinimap(); });
}

function drawMinimap() {
  const W = minimapEl.clientWidth;
  const H = minimapEl.clientHeight;
  if (W === 0 || H === 0) return;

  const dpr = window.devicePixelRatio || 1;
  minimapCanvas.width  = W * dpr;
  minimapCanvas.height = H * dpr;
  mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const style   = getComputedStyle(root);
  const color   = name => style.getPropertyValue(name).trim();
  const txtColor = color('--text'), acColor = color('--accent'), mutedColor = color('--muted');

  mmCtx.fillStyle = color('--gutter');
  mmCtx.fillRect(0, 0, W, H);

  const lines   = currentText.split('\n');
  const fs      = parseFloat(color('--fs')) || 15;
  const lh      = parseFloat(color('--lh')) || 1.75;
  const mmLineH = Math.max(2, fs * lh * MM_SCALE);
  const totalH  = lines.length * mmLineH;

  // posição atual do editor
  const scrollRatio  = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
  const visibleRatio = editor.clientHeight / Math.max(1, editor.scrollHeight);
  const mmOffset     = scrollRatio * Math.max(0, totalH - H);
  const curLine      = caret.line - 1;

  mmCtx.font = `${Math.max(2, Math.round(fs * MM_SCALE))}px monospace`;

  const first = Math.max(0, Math.floor(mmOffset / mmLineH));
  const last  = Math.min(lines.length, Math.ceil((mmOffset + H) / mmLineH) + 1);
  for (let i = first; i < last; i++) {
    const line = lines[i];
    const y = i * mmLineH - mmOffset;

    if (i === curLine) {
      mmCtx.globalAlpha = 0.18;
      mmCtx.fillStyle = acColor;
      mmCtx.fillRect(0, y, W, mmLineH);
    }
    if (!line.trim()) continue;
    // títulos (#) e comentários (//, --) com cores próprias
    mmCtx.fillStyle = line.startsWith('#') ? acColor
                    : /^\s*(\/\/|--)/.test(line) ? mutedColor : txtColor;
    mmCtx.globalAlpha = 0.7;
    mmCtx.fillText(line.slice(0, 120), 4, y + mmLineH * 0.75);
  }
  mmCtx.globalAlpha = 1;

  minimapViewport.style.top    = scrollRatio * (H - Math.max(20, visibleRatio * H)) + 'px';
  minimapViewport.style.height = Math.max(20, visibleRatio * H) + 'px';
}

// clicar/arrastar no minimap → rola o editor
let mmDragging = false;
minimapEl.addEventListener('mousedown', e => { e.preventDefault(); mmDragging = true; seekMinimap(e); });
document.addEventListener('mousemove', e => { if (mmDragging) seekMinimap(e); });
document.addEventListener('mouseup',   () => { mmDragging = false; });

function seekMinimap(e) {
  const rect  = minimapEl.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
  syncScroll();
}

// botão "Minimap" / Ctrl+Shift+P
function togglePreview(force) {
  saveSetting('minimap', force === undefined ? !settings.minimap : !!force);
  minimapEl.style.display = settings.minimap ? '' : 'none';
  $('previewBtn').classList.toggle('active', settings.minimap);
  updateMinimap();
}

// ══════════════════════════════════════════════════
// LINK CHIPS
// ══════════════════════════════════════════════════
let linkChipsOn = false;
const linkCache = {};
let chipRenderTimer = null;

function toggleLinkChips() {
  linkChipsOn = $('chipTgl').checked;
  saveSetting('chips', linkChipsOn);
  rerenderEditor();
}

function scheduleChipRender() {
  // espera parar de digitar antes de converter links em chips
  clearTimeout(chipRenderTimer);
  chipRenderTimer = setTimeout(renderPendingChips, 600);
}

function renderPendingChips() {
  if (!linkChipsOn) return;
  const sel = getSelectionOffsets();
  const { text, pieces } = serializeEditor();
  const chips = pieces.filter(p => p.kind === 'chip').map(p => p.start + ' ' + p.node.dataset.url);
  const chipStarts = new Set(pieces.filter(p => p.kind === 'chip').map(p => p.start));
  // URL que o cursor ainda está digitando continua como texto
  const urls = U.findUrls(text).filter(u => chipStarts.has(u.index) || !sel ||
    sel.end < u.index || sel.end > u.index + u.url.length);
  const wanted = urls.map(u => u.index + ' ' + u.url);
  if (wanted.join('\n') === chips.join('\n')) return;
  currentText = text;
  rerenderEditor(urls);
}

function buildChipNode(url) {
  const meta   = linkCache[url];
  const domain = U.domainOf(url);
  const a = document.createElement('a');
  a.className   = 'link-chip';
  a.href        = url;
  a.dataset.url = url;
  a.target      = '_blank';
  a.rel         = 'noopener noreferrer';
  a.contentEditable = 'false'; // chip é atômico — não editável por dentro

  a.appendChild(meta?.favicon ? faviconImg(meta.favicon) : chipIconSpan());

  const tSpan = document.createElement('span');
  tSpan.className = 'chip-title';
  tSpan.textContent = meta?.title || domain;
  a.appendChild(tSpan);

  const dSpan = document.createElement('span');
  dSpan.className = 'chip-domain';
  dSpan.textContent = domain;
  a.appendChild(dSpan);

  a.addEventListener('click', e => { e.preventDefault(); window.open(url, '_blank', 'noopener'); });
  return a;
}

function faviconImg(src) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = 'chip-favicon';
  img.onerror = () => img.replaceWith(chipIconSpan());
  return img;
}

function chipIconSpan() {
  const s = document.createElement('span');
  s.className = 'chip-icon';
  s.textContent = '🔗';
  return s;
}

function chipsFor(url) {
  return editor.querySelectorAll(`.link-chip[data-url="${CSS.escape(url)}"]`);
}

async function fetchLinkMeta(url) {
  const domain = U.domainOf(url);
  linkCache[url] = { title: domain, favicon: TEST_MODE ? null : U.faviconUrl(url) };
  if (TEST_MODE) return;

  try {
    // títulos de páginas externas exigem um proxy CORS (o link é enviado a allorigins.win)
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const opts  = typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(6000) } : {};
    const json  = await (await fetch(proxy, opts)).json();
    linkCache[url].title = U.extractTitle(json.contents || '', domain);
  } catch {
    // mantém o domínio como fallback
  }

  chipsFor(url).forEach(chip => {
    const tSpan = chip.querySelector('.chip-title');
    if (tSpan) tSpan.textContent = linkCache[url].title;
    const icon = chip.querySelector('.chip-icon');
    if (icon && linkCache[url].favicon) icon.replaceWith(faviconImg(linkCache[url].favicon));
  });
}

// ══════════════════════════════════════════════════
// FILE OPS
// ══════════════════════════════════════════════════
const FILE_EXTS  = ['.txt', '.md', '.log', '.csv', '.json', '.xml', '.html', '.js', '.css',
                    '.py', '.ts', '.jsx', '.tsx', '.sh', '.yaml', '.yml', '.ini', '.cfg'];
const FILE_TYPES = [{ description: 'Arquivos de texto', accept: { 'text/plain': FILE_EXTS } }];

$('fileInput').accept = FILE_EXTS.join(',');

async function openFile() {
  // File System Access API (Chrome/Edge): permite salvar de volta no mesmo arquivo
  if (typeof window.showOpenFilePicker !== 'function') { $('fileInput').click(); return; }
  try {
    const handles = await window.showOpenFilePicker({ multiple: true, types: FILE_TYPES });
    for (const h of handles) await openFromFile(await h.getFile(), h);
  } catch (err) {
    if (err.name !== 'AbortError') notify('Não foi possível abrir: ' + err.message);
  }
}

async function handleOpen(e) {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) await openFromFile(f);
}

async function openFromFile(file, handle) {
  if (file.size > BIG_FILE_BYTES &&
      !confirm(`"${file.name}" tem ${(file.size / 1048576).toFixed(1)} MB e pode deixar o editor lento. Abrir mesmo assim?`)) return null;

  const raw = await file.text();
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const content = raw.replace(/\r\n?/g, '\n');

  // arquivo já aberto pelo mesmo handle → troca para a aba (e recarrega se não houver edições)
  if (handle) {
    for (const t of tabs) {
      if (!t.handle || !(await t.handle.isSameEntry(handle))) continue;
      t.handle = handle;
      if (!t.dirty) Object.assign(t, { content, eol });
      if (activeTab === t) activeTab = null; // força recarregar o editor
      switchTab(t.id);
      if (t.dirty) notify(`"${t.name}" tem alterações não salvas — mantida a sua versão`);
      persistHandles();
      return t;
    }
  }

  // reaproveita a aba atual se ela for uma aba nova, vazia e intocada
  const blank = activeTab && !activeTab.dirty && !activeTab.handle &&
                activeTab.content === '' && activeTab.name === 'Sem título' ? activeTab : null;
  const tab = newTab(file.name, content, { eol, handle: handle || null });
  if (blank) { tabs = tabs.filter(t => t !== blank); renderTabs(); }

  addRecent(file.name, content);
  schedulePersist();
  return tab;
}

function toDisk(text, eol) { return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text; }

async function writeHandle(handle, content) {
  // handles restaurados do IndexedDB precisam de nova permissão de escrita
  if (typeof handle.queryPermission === 'function') {
    const mode = { mode: 'readwrite' };
    if (await handle.queryPermission(mode) !== 'granted' &&
        await handle.requestPermission(mode) !== 'granted') {
      throw Object.assign(new Error('permissão de escrita negada'), { name: 'NotAllowedError' });
    }
  }
  const w = await handle.createWritable();
  await w.write(content);
  await w.close();
}

function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function saveFile(asNew) {
  if (!activeTab) return false;
  const tab  = activeTab;
  const text = currentText;
  const data = toDisk(text, tab.eol);

  try {
    if (!asNew && tab.handle) {
      await writeHandle(tab.handle, data);
    } else if (typeof window.showSaveFilePicker === 'function') {
      const h = await window.showSaveFilePicker({ suggestedName: U.ensureExtension(tab.name), types: FILE_TYPES });
      await writeHandle(h, data);
      tab.handle = h;
      tab.name   = h.name;
    } else {
      // sem acesso ao disco: baixa o arquivo
      let name = tab.name;
      if (asNew) {
        name = prompt('Nome do arquivo:', U.ensureExtension(tab.name));
        if (name === null) return false;
      }
      tab.name = U.ensureExtension(name);
      downloadText(tab.name, data);
    }
  } catch (err) {
    if (err.name !== 'AbortError') notify('Erro ao salvar: ' + err.message);
    return false;
  }

  tab.content = tab === activeTab ? currentText : tab.content;
  if (tab.content === text) tab.dirty = false;
  renderTabs();
  updateStatusFile();
  addRecent(tab.name, text);
  persistSession();
  notify(`"${tab.name}" salvo!`);
  return true;
}

function saveAs() { return saveFile(true); }

// arrastar arquivos para a janela abre em novas abas
const hasFiles = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
document.addEventListener('dragover', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  document.body.classList.add('drop-target');
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) document.body.classList.remove('drop-target');
});
document.addEventListener('drop', async e => {
  document.body.classList.remove('drop-target');
  if (!hasFiles(e)) return;
  e.preventDefault();
  for (const f of [...e.dataTransfer.files]) await openFromFile(f);
});

// ══════════════════════════════════════════════════
// RECENT FILES
// ══════════════════════════════════════════════════
// formato antigo: lista de nomes; formato novo: { name, content, at }
let recentFiles = loadJSON(RECENT_KEY, [])
  .map(r => typeof r === 'string' ? { name: r, content: null, at: 0 } : r)
  .filter(r => r && r.name);

function addRecent(name, content) {
  const entry = { name, content: content.length <= RECENT_MAX_CHARS ? content : null, at: Date.now() };
  recentFiles = [entry, ...recentFiles.filter(r => r.name !== name)].slice(0, 10);
  if (!saveJSON(RECENT_KEY, recentFiles)) {
    // sem espaço: guarda só os nomes
    saveJSON(RECENT_KEY, recentFiles.map(r => ({ name: r.name, content: null, at: r.at })));
  }
}

function toggleRecent() {
  const drop = $('recentDrop');
  drop.classList.toggle('show');
  $('recentBtn').setAttribute('aria-expanded', drop.classList.contains('show'));
  if (drop.classList.contains('show')) renderRecent();
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
}

function renderRecent() {
  const drop = $('recentDrop');
  drop.replaceChildren();
  if (recentFiles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = 'Nenhum arquivo recente';
    drop.appendChild(empty);
    return;
  }
  recentFiles.forEach((r, i) => {
    const item = document.createElement('button');
    item.className = 'recent-item';
    item.disabled = r.content === null;
    const name = document.createElement('b');
    name.textContent = r.name;
    const meta = document.createElement('span');
    meta.textContent = r.content === null ? 'sem cópia' : formatDate(r.at);
    item.append(name, meta);
    item.title = r.content === null ? 'Conteúdo grande demais para guardar — use Abrir' : 'Reabrir a última versão guardada';
    item.addEventListener('click', () => openRecent(i));
    drop.appendChild(item);
  });
  const clear = document.createElement('button');
  clear.className = 'recent-clear';
  clear.textContent = 'Limpar lista';
  clear.addEventListener('click', () => { recentFiles = []; saveJSON(RECENT_KEY, []); renderRecent(); });
  drop.appendChild(clear);
}

function openRecent(i) {
  const r = recentFiles[i];
  $('recentDrop').classList.remove('show');
  if (!r || r.content === null) return;
  const open = tabs.find(t => t.name === r.name && t.content === r.content);
  if (open) { switchTab(open.id); return; }
  newTab(r.name, r.content);
  notify(`"${r.name}" — versão de ${formatDate(r.at)}`);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) $('recentDrop').classList.remove('show');
});

// ══════════════════════════════════════════════════
// SESSION (abas restauradas ao reabrir)
// ══════════════════════════════════════════════════
let persistTimer = null;
let sessionWarned = false;

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistSession, 400);
}

function persistSession() {
  clearTimeout(persistTimer);
  if (!settings.session || !activeTab) return;
  activeTab.content = currentText;
  const data = {
    v: 1,
    active: tabs.indexOf(activeTab),
    tabs: tabs.map(t => ({ uid: t.uid, name: t.name, content: t.content, dirty: t.dirty, eol: t.eol })),
  };
  if (!saveJSON(SESSION_KEY, data) && !sessionWarned) {
    sessionWarned = true;
    notify('Sessão grande demais para guardar no navegador.');
  }
  persistHandles();
}

function restoreSession() {
  const data = settings.session ? loadJSON(SESSION_KEY, null) : null;
  if (!data || !Array.isArray(data.tabs) || !data.tabs.length) return false;
  data.tabs.forEach(t => tabs.push(makeTab(t.name, String(t.content || ''), Object.assign({
    dirty: !!t.dirty,
    eol: t.eol === '\r\n' ? '\r\n' : '\n',
  }, t.uid ? { uid: String(t.uid) } : {}))));
  switchTab((tabs[data.active] || tabs[0]).id);
  return true;
}

function toggleSession() {
  saveSetting('session', $('sessionTgl').checked);
  if (settings.session) persistSession();
  else {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    handleStore('readwrite', s => s.clear());
    lastHandleSig = '';
  }
}

// ── vínculo aba ⇄ arquivo ────────────────────────
// FileSystemFileHandle não cabe no localStorage: fica no IndexedDB, por aba (uid),
// para que Ctrl+S continue gravando no mesmo arquivo depois de reabrir o app.
const HANDLE_DB = STORE + 'blocoHandles';
let handleDbPromise = null;
let lastHandleSig = '';

function handleStore(mode, fn) {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  handleDbPromise = handleDbPromise || new Promise(resolve => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles', { keyPath: 'uid' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return handleDbPromise.then(db => db && new Promise(resolve => {
    const tx = db.transaction('handles', mode);
    let req = null;
    tx.oncomplete = () => resolve(req ? req.result : null);
    tx.onerror = tx.onabort = () => resolve(null);
    try { req = fn(tx.objectStore('handles')); }
    catch { tx.abort(); } // ex.: objeto que não pode ser clonado
  }));
}

function persistHandles() {
  if (!settings.session) return;
  const linked = tabs.filter(t => t.handle);
  const sig = linked.map(t => t.uid + ':' + t.handle.name).join('|');
  if (sig === lastHandleSig) return; // nada mudou
  lastHandleSig = sig;
  handleStore('readwrite', s => {
    s.clear();
    linked.forEach(t => s.put({ uid: t.uid, handle: t.handle }));
  });
}

async function restoreHandles() {
  if (!settings.session) return;
  const rows = (await handleStore('readonly', s => s.getAll())) || [];
  rows.forEach(({ uid, handle }) => {
    const tab = tabs.find(t => t.uid === uid);
    if (tab && !tab.handle) tab.handle = handle;
  });
  lastHandleSig = tabs.filter(t => t.handle).map(t => t.uid + ':' + t.handle.name).join('|');
}

window.addEventListener('beforeunload', e => {
  persistSession();
  if (!settings.session && tabs.some(t => t.dirty)) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) persistSession(); });

// ══════════════════════════════════════════════════
// FIND & REPLACE
// ══════════════════════════════════════════════════
const HAS_HIGHLIGHTS = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';

function findOpen() { return $('findbar').classList.contains('show'); }

function toggleFind(force, focusReplace) {
  const show = force === undefined ? !findOpen() : !!force;
  $('findbar').classList.toggle('show', show);
  if (show) {
    const sel = getSelectionOffsets();
    const picked = sel ? sel.text.slice(sel.start, sel.end) : '';
    if (picked && !picked.includes('\n')) $('findInput').value = picked;
    const input = focusReplace ? $('replaceInput') : $('findInput');
    input.focus();
    input.select();
    doFind();
  } else {
    findMatches = [];
    $('matchInfo').textContent = '';
    clearHighlights();
    editor.focus({ preventScroll: true });
  }
}

function findKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch(); }
  if (e.key === 'Escape') toggleFind(false);
}

function replaceKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.ctrlKey || e.metaKey ? doReplaceAll() : doReplace(); }
  if (e.key === 'Escape') toggleFind(false);
}

function searchRegex() {
  try {
    return U.buildSearchRegex($('findInput').value, {
      caseSensitive: $('caseCk').checked,
      wholeWord: $('wordCk').checked,
    });
  } catch { return null; }
}

// keep=true: recalcula mantendo o resultado atual (usado durante a digitação)
function doFind(keep) {
  findMatches = U.findAll(currentText, searchRegex());
  if (keep) {
    findIdx = Math.min(findIdx, Math.max(0, findMatches.length - 1));
  } else {
    const i = findMatches.findIndex(m => m.index >= caret.start);
    findIdx = i === -1 ? 0 : i;
  }
  paintMatches();
  if (!keep && findMatches.length) revealMatch();
}

function paintMatches() {
  const q = $('findInput').value;
  $('matchInfo').textContent = !q ? '' : !findMatches.length ? 'Nenhum resultado'
                             : `${findIdx + 1} de ${findMatches.length}`;
  $('findbar').classList.toggle('no-match', !!q && !findMatches.length);
  if (!HAS_HIGHLIGHTS) return;
  const { pieces } = serializeEditor();
  const all = new Highlight(), current = new Highlight();
  findMatches.forEach((m, i) => (i === findIdx ? current : all)
    .add(rangeFromOffsets(m.index, m.index + m.length, pieces)));
  CSS.highlights.set('find-match', all);
  CSS.highlights.set('find-current', current);
}

function clearHighlights() {
  if (!HAS_HIGHLIGHTS) return;
  CSS.highlights.delete('find-match');
  CSS.highlights.delete('find-current');
}

function revealMatch() {
  const m = findMatches[findIdx];
  if (!m) return;
  const range = rangeFromOffsets(m.index, m.index + m.length);
  const r = range.getBoundingClientRect();
  const box = editor.getBoundingClientRect();
  if (r.top < box.top + 20 || r.bottom > box.bottom - 20) editor.scrollTop += r.top - box.top - editor.clientHeight / 3;
  if (r.left < box.left + 20 || r.right > box.right - 20) editor.scrollLeft += r.left - box.left - editor.clientWidth / 3;
  // sem Highlight API: seleciona o trecho para ele aparecer
  if (!HAS_HIGHLIGHTS) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
}

function selectMatch(i) {
  if (!findMatches.length) return;
  findIdx = ((i % findMatches.length) + findMatches.length) % findMatches.length;
  paintMatches();
  revealMatch();
}

function nextMatch() { selectMatch(findIdx + 1); }
function prevMatch() { selectMatch(findIdx - 1); }

function doReplace() {
  const m = findMatches[findIdx];
  if (!m) return;
  const rep = $('replaceInput').value;
  const focused = document.activeElement;
  replaceRange(m.index, m.index + m.length, rep);
  // continua do próximo resultado após o texto inserido
  findMatches = U.findAll(currentText, searchRegex());
  const next = findMatches.findIndex(x => x.index >= m.index + rep.length);
  findIdx = next === -1 ? 0 : next;
  paintMatches();
  revealMatch();
  if (focused && focused !== editor) focused.focus();
}

function doReplaceAll() {
  const re = searchRegex();
  const count = U.findAll(currentText, re).length;
  if (!count) return;
  const newText = U.replaceAllLiteral(currentText, re, $('replaceInput').value);
  const focused = document.activeElement;
  replaceRange(0, currentText.length, newText); // um único passo de desfazer
  doFind(true);
  if (focused && focused !== editor) focused.focus();
  notify(count === 1 ? '1 substituição' : `${count} substituições`);
}

// ══════════════════════════════════════════════════
// FOCUS MODE
// ══════════════════════════════════════════════════
function toggleFocus() {
  focusOn = !focusOn;
  document.body.classList.toggle('focus-mode', focusOn);
  $('focusBtn').classList.toggle('active', focusOn);
  updateMinimap();
}

// ══════════════════════════════════════════════════
// FONT / SIZE / WRAP
// ══════════════════════════════════════════════════
function applyFont() {
  saveSetting('font', $('fontSel').value);
  setVar('--font', settings.font);
  scheduleWrapMeasure();
  updateMinimap();
}

function applyFontSize(v) {
  v = Math.min(28, Math.max(11, Number(v) || DEFAULT_SETTINGS.fs));
  $('fsRange').value = v;
  $('fsVal').textContent = v;
  setVar('--fs', v + 'px');
  saveSetting('fs', v);
  updateMinimap();
  scheduleWrapMeasure();
}

function applyLineHeight(v) {
  const lh = Math.min(3, Math.max(1.2, Number(v) / 100 || DEFAULT_SETTINGS.lh));
  $('lhRange').value = Math.round(lh * 100);
  $('lhVal').textContent = lh.toFixed(2);
  setVar('--lh', lh);
  saveSetting('lh', lh);
  updateMinimap();
  scheduleWrapMeasure();
}

function changeFontSize(d) { applyFontSize(Number($('fsRange').value) + d); }

function toggleWrap() {
  saveSetting('wrap', $('wrapTgl').checked);
  document.body.classList.toggle('wrap-on', settings.wrap);
  if (settings.wrap) scheduleWrapMeasure();
  else [...gutter.children].forEach(s => { s.style.height = ''; });
  updateMinimap();
}

function toggleSpell() {
  saveSetting('spell', $('spellTgl').checked);
  editor.spellcheck = settings.spell;
}

// ══════════════════════════════════════════════════
// SETTINGS PANEL
// ══════════════════════════════════════════════════
function toggleSettings(force) {
  const panel = $('settings');
  panel.classList.toggle('open', force === undefined ? !panel.classList.contains('open') : !!force);
}

function setVar(v, val) { root.style.setProperty(v, val); }

// ══════════════════════════════════════════════════
// THEMES
// ══════════════════════════════════════════════════
const THEMES = [
  { name:'Noite Azul', bg:'#1a1a2e', surface:'#16213e', bar:'#0f3460', gutter:'#0d2040', text:'#e0e0e0', muted:'#7a8aaa', accent:'#e94560', border:'#2a3a5a', ln:'#4a6080' },
  { name:'Floresta',   bg:'#1b2b1e', surface:'#152318', bar:'#0d1f10', gutter:'#111a12', text:'#c8e6c9', muted:'#6a916e', accent:'#69f0ae', border:'#2a4a2e', ln:'#3a6040' },
  { name:'Carvão',     bg:'#1c1c1c', surface:'#242424', bar:'#2c2c2c', gutter:'#181818', text:'#d4d4d4', muted:'#888888', accent:'#d97706', border:'#383838', ln:'#5a5a5a' },
  { name:'Lavanda',    bg:'#1e1b2e', surface:'#2a2540', bar:'#332d4f', gutter:'#191626', text:'#e8e0ff', muted:'#8878bb', accent:'#bf87ff', border:'#3a3358', ln:'#4a3a70' },
  { name:'Papel',      bg:'#f5f0e8', surface:'#ece7da', bar:'#ddd6c8', gutter:'#e8e2d8', text:'#2c2416', muted:'#7a6a50', accent:'#b5451b', border:'#cec7ba', ln:'#a89878' },
  { name:'Neve',       bg:'#f0f4f8', surface:'#e2eaf2', bar:'#d0dce8', gutter:'#e8eef4', text:'#1a2634', muted:'#557799', accent:'#1d7dd4', border:'#c0cdd8', ln:'#8aaac8' },
  { name:'Terminal',   bg:'#0d0d0d', surface:'#111111', bar:'#0a0a0a', gutter:'#080808', text:'#00ff41', muted:'#00a02a', accent:'#00ff41', border:'#003a10', ln:'#006622' },
  { name:'Oceano',     bg:'#0a1628', surface:'#0e1e38', bar:'#0b1930', gutter:'#081220', text:'#cce4ff', muted:'#5588bb', accent:'#38bdf8', border:'#1a2e48', ln:'#2a4a6a' },
  { name:'Róseo',      bg:'#2b1a1a', surface:'#3a2020', bar:'#4a2828', gutter:'#221414', text:'#f5d5d5', muted:'#aa6868', accent:'#ff6b6b', border:'#5a3030', ln:'#7a4040' },
];

function buildThemeGrid() {
  const grid = $('themeGrid');
  THEMES.forEach((t, i) => {
    const el = document.createElement('button');
    el.className = 'tchip';
    el.style.cssText = `background:${t.bg};color:${t.text}`;
    el.textContent = t.name;
    el.addEventListener('click', () => applyTheme(i));
    grid.appendChild(el);
  });
}

function applyTheme(i, keepColors) {
  const t = THEMES[i] || THEMES[0];
  setVar('--bg', t.bg);         setVar('--surface', t.surface);
  setVar('--bar', t.bar);       setVar('--gutter', t.gutter);
  setVar('--text', t.text);     setVar('--muted', t.muted);
  setVar('--accent', t.accent); setVar('--border', t.border);
  setVar('--ln-text', t.ln);
  settings.theme = THEMES.indexOf(t);
  if (!keepColors) settings.colors = null;
  saveJSON(SETTINGS_KEY, settings);
  Object.entries(settings.colors || {}).forEach(([v, val]) => setVar(v, val));

  const current = name => getComputedStyle(root).getPropertyValue(name).trim();
  $('cBg').value     = current('--bg');
  $('cText').value   = current('--text');
  $('cAccent').value = current('--accent');
  document.querySelectorAll('.tchip').forEach((c, j) => c.classList.toggle('on', j === settings.theme));
  syncWindowColor();
  updateMinimap();
}

// no app instalado, a barra da janela do Windows usa a cor do theme-color
function syncWindowColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bar').trim();
}

function setCustomColor(v, val) {
  setVar(v, val);
  saveSetting('colors', Object.assign({}, settings.colors, { [v]: val }));
  updateMinimap();
}

// ══════════════════════════════════════════════════
// NOTIFICATION
// ══════════════════════════════════════════════════
let notifTimer;
function notify(msg) {
  const el = $('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ══════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  const k = (e.key || '').toLowerCase();
  if (e.key === 'F11') { e.preventDefault(); toggleFocus(); return; }
  if (e.key === 'Escape' && $('settings').classList.contains('open')) { toggleSettings(false); return; }
  if (e.altKey && !ctrl && k === 'z') { e.preventDefault(); $('wrapTgl').click(); return; }
  if (!ctrl) return;

  if (k === 'f')                 { e.preventDefault(); toggleFind(true); }
  else if (k === 'h')            { e.preventDefault(); toggleFind(true, true); }
  else if (k === 's')            { e.preventDefault(); e.shiftKey ? saveAs() : saveFile(); }
  else if (k === 'o')            { e.preventDefault(); openFile(); }
  else if (k === 'n' || k === 't') { e.preventDefault(); newTab(); }
  else if (k === 'w')            { e.preventDefault(); if (activeTab) closeTab(activeTab.id); }
  else if (k === 'p' && e.shiftKey) { e.preventDefault(); togglePreview(); }
  else if (k === ',')            { e.preventDefault(); toggleSettings(); }
  else if (k === 'tab') {
    e.preventDefault();
    const idx  = tabs.indexOf(activeTab);
    const next = tabs[(idx + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
    if (next) switchTab(next.id);
  }
});

// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
function applySettings() {
  applyTheme(settings.theme, true);
  $('fontSel').value = settings.font;
  if ($('fontSel').value !== settings.font) settings.font = DEFAULT_SETTINGS.font;
  setVar('--font', settings.font);
  applyFontSize(settings.fs);
  applyLineHeight(settings.lh * 100);

  $('wrapTgl').checked = settings.wrap;
  document.body.classList.toggle('wrap-on', settings.wrap);
  $('spellTgl').checked = settings.spell;
  editor.spellcheck = settings.spell;
  $('lnTgl').checked = settings.lineNumbers;
  document.body.classList.toggle('no-line-numbers', !settings.lineNumbers);
  $('chipTgl').checked = linkChipsOn = settings.chips;
  $('sessionTgl').checked = settings.session;
  togglePreview(settings.minimap);
}

buildThemeGrid();
applySettings();
if (!restoreSession()) newTab();
const handlesReady = restoreHandles();
window.addEventListener('resize', updateMinimap);
// largura do editor muda com janela, modo foco, minimap e gutter → remede as linhas quebradas
if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleWrapMeasure).observe(editor);

// ══════════════════════════════════════════════════
// APP INSTALADO (PWA)
// ══════════════════════════════════════════════════
// arquivos abertos pelo Windows ("Abrir com" / duplo clique) chegam pela launchQueue
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async params => {
    await handlesReady;
    for (const h of params.files || []) {
      if (h.kind === 'file') await openFromFile(await h.getFile(), h);
    }
  });
}

if ('serviceWorker' in navigator && !TEST_MODE && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  $('installBtn').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('installBtn').hidden = true;
  notify('Bloco instalado! Agora defina-o como app padrão para .txt no Windows.');
});

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('installBtn').hidden = true;
}

// ponto de acesso para os testes (tests/) e depuração no console
window.BlocoApp = {
  get tabs() { return tabs; },
  get activeTab() { return activeTab; },
  get text() { return currentText; },
  get caret() { return caret; },
  get findMatches() { return findMatches; },
  get findIdx() { return findIdx; },
  get recentFiles() { return recentFiles; },
  settings, serializeEditor, getSelectionOffsets, setSelectionOffsets, setEditorText,
  persistSession, renderPendingChips, keys: { RECENT_KEY, SESSION_KEY, SETTINGS_KEY },
};
