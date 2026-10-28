// Testes de integração: carregam o app real (../index.html?test) num iframe.
// O modo ?test usa chaves de armazenamento próprias e não acessa a rede.

const PREFIX = 'blocoTest:';
let A; // contexto do app carregado

function clearTestStorage() {
  Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
}

// carrega o app; `storage` semeia chaves (sem prefixo) antes do load
async function loadApp({ storage, keep } = {}) {
  const frame = document.getElementById('app');
  const navigate = src => new Promise(resolve => { frame.onload = resolve; frame.src = src; });

  // descarrega o app anterior primeiro: o beforeunload dele grava a sessão
  await navigate('about:blank');
  if (!keep) clearTestStorage();
  Object.entries(storage || {}).forEach(([k, v]) => localStorage.setItem(PREFIX + k, JSON.stringify(v)));
  await navigate('../index.html?test&t=' + Date.now());

  const w = frame.contentWindow;
  const d = w.document;
  w.confirm = () => true;
  w.prompt  = () => null;
  const editor = d.getElementById('editor');

  A = {
    w, d, editor,
    app: w.BlocoApp,
    $: id => d.getElementById(id),
    focus() { w.focus(); editor.focus(); },
    type(text) { this.focus(); d.execCommand('insertText', false, text); },
    key(key, opts = {}, target = editor) {
      const ev = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
      target.dispatchEvent(ev);
      return ev;
    },
    setText(text) { this.focus(); w.setEditorText(text); w.onEditorInput(); },
    tabNames() { return A.app.tabs.map(t => t.name); },
  };
  return A;
}

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

// ──────────────────────────────────────────────────
describe('app: modelo do editor (DOM ⇄ texto)', () => {
  beforeEach(() => loadApp());

  it('ida e volta texto → DOM → texto preserva o conteúdo, inclusive quebras finais', () => {
    const samples = ['', 'a', 'a\n', '\n', '\n\n', 'a\n\nb', 'linha 1\nlinha 2\n\n', '  indentado\n\tTab'];
    samples.forEach(s => {
      A.w.setEditorText(s);
      expect(A.app.serializeEditor().text).toBe(s);
    });
  });

  it('com chips ativos a URL continua no texto', () => {
    A.$('chipTgl').checked = true;
    A.w.toggleLinkChips();
    const s = 'veja https://example.com/x. fim\n';
    A.w.setEditorText(s);
    expect(A.editor.querySelectorAll('.link-chip').length).toBe(1);
    expect(A.app.serializeEditor().text).toBe(s);
  });

  it('entende o DOM gerado pelo Chrome ("\\n" sentinela no fim do texto)', () => {
    A.editor.textContent = 'abc\n\n';
    expect(A.app.serializeEditor().text).toBe('abc\n');
    A.editor.textContent = 'abc\n';
    expect(A.app.serializeEditor().text).toBe('abc');
  });

  it('entende linhas em <div> (estrutura comum de contenteditable)', () => {
    A.editor.innerHTML = '<div>a</div><div><br></div><div>b</div>';
    expect(A.app.serializeEditor().text).toBe('a\n\nb');
    A.editor.innerHTML = 'primeira<div>segunda</div>';
    expect(A.app.serializeEditor().text).toBe('primeira\nsegunda');
  });

  it('offsets de seleção fazem ida e volta em todas as posições', () => {
    const s = 'ab\ncd\n\nef\n';
    A.setText(s);
    for (let o = 0; o <= s.length; o++) {
      A.app.setSelectionOffsets(o);
      expect(A.app.getSelectionOffsets().start).toBe(o);
    }
    A.app.setSelectionOffsets(1, 7);
    const sel = A.app.getSelectionOffsets();
    expect([sel.start, sel.end]).toEqual([1, 7]);
  });

  it('elementos estranhos (HTML colado/arrastado) são convertidos em texto puro', () => {
    A.focus();
    A.editor.innerHTML = 'x<b>negrito</b><img src="data:,">';
    A.w.onEditorInput();
    expect(A.editor.querySelector('b, img')).toBe(null);
    expect(A.app.text).toBe('xnegrito');
  });
});

// ──────────────────────────────────────────────────
describe('app: digitação e barra de status', () => {
  beforeEach(() => loadApp());

  it('digitar atualiza palavras, caracteres, aba suja e título', () => {
    A.type('olá mundo');
    expect(A.$('sWords').textContent).toBe('2');
    expect(A.$('sChars').textContent).toBe('9');
    expect(A.$('wcTop').textContent).toBe('2 palavras');
    expect(A.app.activeTab.dirty).toBe(true);
    expect(A.d.title.startsWith('●')).toBe(true);
  });

  it('linha/coluna acompanham o cursor (antes ficava sempre em 1)', () => {
    A.type('abc');
    A.key('Enter');
    A.type('de');
    A.w.updateCursor();
    expect(A.$('sLine').textContent).toBe('2');
    expect(A.$('sCol').textContent).toBe('3');
  });

  it('Enter mantém a indentação da linha atual', () => {
    A.type('    item');
    A.key('Enter');
    A.type('x');
    expect(A.app.text).toBe('    item\n    x');
  });

  it('Tab insere 4 espaços e Shift+Tab remove', () => {
    A.type('a');
    A.app.setSelectionOffsets(0);
    A.key('Tab');
    expect(A.app.text).toBe('    a');
    A.key('Tab', { shiftKey: true });
    expect(A.app.text).toBe('a');
  });

  it('colar insere apenas texto puro e normaliza CRLF', () => {
    A.focus();
    const dt = new A.w.DataTransfer();
    dt.setData('text/html', '<b>negrito</b><img src="x">');
    dt.setData('text/plain', 'linha1\r\nlinha2');
    A.editor.dispatchEvent(new A.w.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    expect(A.app.text).toBe('linha1\nlinha2');
    expect(A.editor.querySelector('b, img')).toBe(null);
  });

  it('placeholder aparece só com o editor vazio', () => {
    expect(A.editor.classList.contains('is-empty')).toBe(true);
    A.type('x');
    expect(A.editor.classList.contains('is-empty')).toBe(false);
    A.d.execCommand('selectAll');
    A.d.execCommand('delete');
    expect(A.editor.classList.contains('is-empty')).toBe(true);
  });

  it('números de linha acompanham o texto e destacam a linha atual', () => {
    A.setText('1\n2\n3\n4');
    A.app.setSelectionOffsets(4);
    A.w.updateCursor();
    const lines = A.$('gutter').querySelectorAll('.gutter-line');
    expect(lines.length).toBe(4);
    expect(lines[2].classList.contains('current')).toBe(true);
  });

  it('minimap desenha sem erros (antes usava editor.value e quebrava)', () => {
    A.setText('# título\n// comentário\ntexto');
    expect(() => A.w.drawMinimap()).not.toThrow();
  });
});

// ──────────────────────────────────────────────────
describe('app: abas', () => {
  beforeEach(() => loadApp());

  it('cada aba guarda seu próprio conteúdo', () => {
    A.type('primeira');
    const t1 = A.app.activeTab;
    A.w.newTab();
    A.type('segunda');
    A.w.switchTab(t1.id);
    expect(A.app.text).toBe('primeira');
    A.w.switchTab(A.app.tabs[1].id);
    expect(A.app.text).toBe('segunda');
  });

  it('fechar aba não salva pede confirmação', () => {
    A.type('x');
    A.w.newTab();
    let asked = 0;
    A.w.confirm = () => { asked++; return false; };
    A.w.closeTab(A.app.tabs[0].id);
    expect(asked).toBe(1);
    expect(A.app.tabs.length).toBe(2);
    A.w.confirm = () => true;
    A.w.closeTab(A.app.tabs[0].id);
    expect(A.app.tabs.length).toBe(1);
  });

  it('fechar a última aba abre uma nova em branco', () => {
    A.w.closeTab(A.app.activeTab.id);
    expect(A.app.tabs.length).toBe(1);
    expect(A.app.text).toBe('');
  });

  it('moveTab reordena e renameTab renomeia', () => {
    A.w.newTab('B');
    A.w.newTab('C');
    const [a, , c] = A.app.tabs;
    A.w.moveTab(c.id, a.id);
    expect(A.tabNames()).toEqual(['C', 'Sem título', 'B']);
    A.w.prompt = () => 'Notas';
    A.w.renameTab(c.id);
    expect(A.app.tabs[0].name).toBe('Notas');
  });

  it('nome de aba é exibido como texto (sem injeção de HTML)', () => {
    A.w.newTab('<img src=x onerror="parent.__xss=1">');
    expect(A.$('tabbar').querySelector('img')).toBe(null);
    expect(window.__xss).toBe(undefined);
  });

  it('Ctrl+Tab alterna para a próxima aba', () => {
    A.w.newTab('B');
    const first = A.app.tabs[0];
    A.key('Tab', { ctrlKey: true }, A.d);
    expect(A.app.activeTab).toBe(first);
  });
});

// ──────────────────────────────────────────────────
describe('app: buscar e substituir', () => {
  beforeEach(async () => {
    await loadApp();
    A.setText('gato pato gato\nGATO');
  });

  it('Ctrl+F abre a busca e mostra a contagem', () => {
    A.key('f', { ctrlKey: true }, A.d);
    expect(A.$('findbar').classList.contains('show')).toBe(true);
    A.$('findInput').value = 'gato';
    A.w.doFind();
    expect(A.app.findMatches.length).toBe(3);
    expect(A.$('matchInfo').textContent).toContain('de 3');
  });

  it('sem resultado mostra "Nenhum resultado"', () => {
    A.w.toggleFind(true);
    A.$('findInput').value = 'cachorro';
    A.w.doFind();
    expect(A.$('matchInfo').textContent).toBe('Nenhum resultado');
    expect(A.$('findbar').classList.contains('no-match')).toBe(true);
  });

  it('navegação circula entre os resultados', () => {
    A.w.toggleFind(true);
    A.$('caseCk').checked = true;
    A.$('findInput').value = 'gato';
    A.app.setSelectionOffsets(0);
    A.w.updateCursor();
    A.w.doFind();
    expect(A.app.findIdx).toBe(0);
    A.w.nextMatch();
    expect(A.app.findIdx).toBe(1);
    A.w.nextMatch();
    expect(A.app.findIdx).toBe(0);
    A.w.prevMatch();
    expect(A.app.findIdx).toBe(1);
  });

  it('resultados são destacados com a Highlight API', () => {
    if (!A.w.CSS.highlights) return; // navegador sem suporte
    A.w.toggleFind(true);
    A.$('findInput').value = 'gato';
    A.w.doFind();
    const all = A.w.CSS.highlights.get('find-match');
    const cur = A.w.CSS.highlights.get('find-current');
    expect(all.size + cur.size).toBe(3);
    A.w.toggleFind(false);
    expect(A.w.CSS.highlights.has('find-match')).toBe(false);
  });

  it('substituir troca o resultado atual e avança, sem repetir no mesmo lugar', () => {
    A.setText('a a');
    A.w.toggleFind(true);
    A.$('findInput').value = 'a';
    A.$('replaceInput').value = 'aa';
    A.app.setSelectionOffsets(0);
    A.w.updateCursor();
    A.w.doFind();
    A.w.doReplace();
    expect(A.app.text).toBe('aa a');
    A.w.doReplace();
    expect(A.app.text).toBe('aa aa');
  });

  it('substituir tudo é literal ($&) e pode ser desfeito com Ctrl+Z', () => {
    A.w.toggleFind(true);
    A.$('findInput').value = 'gato';
    A.$('replaceInput').value = '$&!';
    A.w.doFind();
    A.w.doReplaceAll();
    expect(A.app.text).toBe('$&! pato $&!\n$&!');
    A.focus();
    A.d.execCommand('undo');
    expect(A.app.text).toBe('gato pato gato\nGATO');
  });

  it('palavra inteira respeita acentos', () => {
    A.setText('ação reação ação');
    A.w.toggleFind(true);
    A.$('wordCk').checked = true;
    A.$('findInput').value = 'ação';
    A.w.doFind();
    expect(A.app.findMatches.length).toBe(2);
  });
});

// ──────────────────────────────────────────────────
describe('app: arquivos', () => {
  beforeEach(() => loadApp());

  // handle falso da File System Access API
  const fakeHandle = (name, written) => ({
    name,
    kind: 'file',
    isSameEntry: async other => other && other.name === name,
    createWritable: async () => ({ write: async c => written.push(c), close: async () => {} }),
  });

  it('abrir arquivo reaproveita a aba em branco, normaliza CRLF e registra recente', async () => {
    await A.w.openFromFile(new A.w.File(['linha1\r\nlinha2'], 'notas.txt'));
    expect(A.tabNames()).toEqual(['notas.txt']);
    expect(A.app.text).toBe('linha1\nlinha2');
    expect(A.$('sEol').textContent).toBe('CRLF');
    expect(A.app.activeTab.dirty).toBe(false);
    expect(A.app.recentFiles[0].name).toBe('notas.txt');
  });

  it('Ctrl+Shift+S abre "Salvar como" (antes o atalho não funcionava)', async () => {
    const written = [];
    A.w.showSaveFilePicker = async () => fakeHandle('salvo.md', written);
    A.type('conteúdo');
    A.key('S', { ctrlKey: true, shiftKey: true }, A.d);
    await tick(50);
    expect(written).toEqual(['conteúdo']);
    expect(A.app.activeTab.name).toBe('salvo.md');
    expect(A.app.activeTab.dirty).toBe(false);
  });

  it('Ctrl+S grava de volta no mesmo arquivo, mantendo CRLF', async () => {
    const written = [];
    A.w.showSaveFilePicker = async () => { throw new Error('não deveria abrir o seletor'); };
    await A.w.openFromFile(new A.w.File(['a\r\nb'], 'win.txt'), fakeHandle('win.txt', written));
    A.app.setSelectionOffsets(3);
    A.type('!');
    A.key('s', { ctrlKey: true }, A.d);
    await tick(50);
    expect(written).toEqual(['a\r\nb!']);
    expect(A.app.activeTab.dirty).toBe(false);
  });

  it('sem File System Access API, salvar baixa o arquivo com extensão', async () => {
    A.w.showSaveFilePicker = undefined;
    const downloads = [];
    A.w.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
    A.type('texto');
    await A.w.saveFile();
    expect(downloads).toEqual(['Sem título.txt']);
    A.w.prompt = () => 'relatorio';
    await A.w.saveAs();
    expect(downloads[1]).toBe('relatorio.txt');
    expect(A.app.activeTab.name).toBe('relatorio.txt');
  });

  it('abrir de novo o mesmo arquivo recarrega a aba (se não houver edições)', async () => {
    const h = fakeHandle('a.txt', []);
    await A.w.openFromFile(new A.w.File(['v1'], 'a.txt'), h);
    await A.w.openFromFile(new A.w.File(['v2'], 'a.txt'), h);
    expect(A.tabNames()).toEqual(['a.txt']);
    expect(A.app.text).toBe('v2');
    A.app.setSelectionOffsets(2);
    A.type('!');
    await A.w.openFromFile(new A.w.File(['v3'], 'a.txt'), h);
    expect(A.app.text).toBe('v2!');
    expect(A.app.tabs.length).toBe(1);
  });

  it('cancelar o "Salvar como" não altera nada', async () => {
    A.w.showSaveFilePicker = async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; };
    A.type('x');
    expect(await A.w.saveAs()).toBe(false);
    expect(A.app.activeTab.dirty).toBe(true);
  });
});

// ──────────────────────────────────────────────────
describe('app: recentes, sessão e preferências', () => {
  it('recentes reabrem a última versão guardada', async () => {
    await loadApp();
    await A.w.openFromFile(new A.w.File(['guardado'], 'r.txt'));
    A.w.closeTab(A.app.activeTab.id);
    A.w.openRecent(0);
    expect(A.app.activeTab.name).toBe('r.txt');
    expect(A.app.text).toBe('guardado');
  });

  it('nomes nos recentes não injetam HTML (antes ia num onclick inline)', async () => {
    await loadApp({ storage: { blocoCustomRecent: [{ name: `x');parent.__xss=1;('<img>`, content: 'c', at: 1 }] } });
    A.w.toggleRecent();
    expect(A.$('recentDrop').querySelector('img')).toBe(null);
    A.$('recentDrop').querySelector('.recent-item').click();
    expect(window.__xss).toBe(undefined);
    expect(A.app.text).toBe('c');
  });

  it('migra a lista de recentes do formato antigo (só nomes)', async () => {
    await loadApp({ storage: { blocoCustomRecent: ['antigo.txt'] } });
    expect(A.app.recentFiles).toEqual([{ name: 'antigo.txt', content: null, at: 0 }]);
  });

  it('abas são restauradas ao recarregar', async () => {
    await loadApp();
    A.type('um');
    A.w.newTab('dois.txt', 'conteúdo 2');
    A.app.persistSession();
    await loadApp({ keep: true });
    expect(A.tabNames()).toEqual(['Sem título', 'dois.txt']);
    expect(A.app.activeTab.name).toBe('dois.txt');
    expect(A.app.text).toBe('conteúdo 2');
    expect(A.app.tabs[0].content).toBe('um');
    expect(A.app.tabs[0].dirty).toBe(true);
  });

  it('após reabrir, Ctrl+S continua gravando no mesmo arquivo (handle no IndexedDB)', async () => {
    if (!navigator.storage?.getDirectory) return; // navegador sem OPFS
    await loadApp();
    // OPFS fornece um FileSystemFileHandle real, que pode ser guardado no IndexedDB
    const dir = await navigator.storage.getDirectory();
    const fh  = await dir.getFileHandle('bloco-teste.txt', { create: true });
    const w0  = await fh.createWritable(); await w0.write('original'); await w0.close();

    await A.w.openFromFile(await fh.getFile(), fh);
    A.app.persistSession();
    await tick(100);
    await loadApp({ keep: true });
    await tick(100);
    expect(A.app.activeTab.name).toBe('bloco-teste.txt');
    expect(!!A.app.activeTab.handle).toBe(true);
    A.app.setSelectionOffsets(A.app.text.length);
    A.type(' editado');
    expect(await A.w.saveFile()).toBe(true);
    expect(await (await fh.getFile()).text()).toBe('original editado');
    await dir.removeEntry('bloco-teste.txt');
  });

  it('desligar "Restaurar abas" apaga a sessão guardada', async () => {
    await loadApp();
    A.type('segredo');
    A.app.persistSession();
    A.$('sessionTgl').checked = false;
    A.w.toggleSession();
    expect(localStorage.getItem(PREFIX + 'blocoCustomSession')).toBe(null);
    await loadApp({ keep: true });
    expect(A.app.text).toBe('');
  });

  it('tema, fonte e minimap ficam salvos', async () => {
    await loadApp();
    A.w.applyTheme(4);
    A.w.applyFontSize(20);
    A.key('P', { ctrlKey: true, shiftKey: true }, A.d);
    expect(A.app.settings.minimap).toBe(false);
    await loadApp({ keep: true });
    const css = A.w.getComputedStyle(A.d.documentElement);
    expect(css.getPropertyValue('--fs').trim()).toBe('20px');
    expect(css.getPropertyValue('--bg').trim()).toBe('#f5f0e8');
    expect(A.d.querySelectorAll('.tchip')[4].classList.contains('on')).toBe(true);
    expect(A.$('minimap').style.display).toBe('none');
  });
});

// ──────────────────────────────────────────────────
describe('app instalável (PWA)', () => {
  it('manifest registra o app para abrir .txt e afins', async () => {
    const m = await (await fetch('../manifest.webmanifest')).json();
    const exts = Object.values(m.file_handlers[0].accept).flat();
    ['.txt', '.md', '.log', '.json', '.csv'].forEach(e => expect(exts).toContain(e));
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
  });

  it('ícones e service worker existem', async () => {
    const m = await (await fetch('../manifest.webmanifest')).json();
    for (const icon of m.icons) expect((await fetch('../' + icon.src)).ok).toBe(true);
    expect((await fetch('../sw.js')).ok).toBe(true);
  });

  it('o service worker guarda em cache todos os arquivos do app', async () => {
    const sw = await (await fetch('../sw.js')).text();
    const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
    for (const f of shell) expect((await fetch('../' + f)).ok).toBe(true);
  });
});

// ──────────────────────────────────────────────────
describe('app: chips de link', () => {
  beforeEach(async () => {
    await loadApp();
    A.$('chipTgl').checked = true;
    A.w.toggleLinkChips();
  });

  it('URL ainda sendo digitada continua texto; vira chip quando o cursor sai', () => {
    A.type('site https://example.com');
    A.app.renderPendingChips();
    expect(A.editor.querySelectorAll('.link-chip').length).toBe(0);
    A.type(' fim');
    A.app.renderPendingChips();
    expect(A.editor.querySelectorAll('.link-chip').length).toBe(1);
    expect(A.app.text).toBe('site https://example.com fim');
  });

  it('converter em chip não move o cursor para o fim', () => {
    A.setText('a https://example.com b\nfinal');
    A.app.setSelectionOffsets(2);
    A.w.updateCursor();
    A.w.rerenderEditor();
    expect(A.app.getSelectionOffsets().start).toBe(2);
  });

  it('copiar seleção com chip copia a URL como texto', () => {
    A.setText('ver https://example.com/x');
    A.focus();
    A.app.setSelectionOffsets(0, A.app.text.length);
    const dt = new A.w.DataTransfer();
    A.editor.dispatchEvent(new A.w.ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }));
    expect(dt.getData('text/plain')).toBe('ver https://example.com/x');
  });
});
