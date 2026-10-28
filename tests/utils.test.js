// Testes unitários das funções puras (utils.js)
const Ut = window.BlocoUtils;

describe('utils: texto', () => {
  it('escHtml escapa caracteres especiais, incluindo aspas simples', () => {
    expect(Ut.escHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('escRe transforma a busca em literal', () => {
    const re = new RegExp(Ut.escRe('a.b*c(d)'));
    expect(re.test('a.b*c(d)')).toBe(true);
    expect(re.test('axbbc(d)')).toBe(false);
  });

  it('countWords ignora espaços e conta quebras de linha como separador', () => {
    expect(Ut.countWords('')).toBe(0);
    expect(Ut.countWords('   \n ')).toBe(0);
    expect(Ut.countWords('olá mundo\nnovo  dia')).toBe(4);
  });

  it('formatWordCount usa singular/plural', () => {
    expect(Ut.formatWordCount(0)).toBe('0 palavras');
    expect(Ut.formatWordCount(1)).toBe('1 palavra');
    expect(Ut.formatWordCount(2)).toBe('2 palavras');
  });

  it('countLines conta linhas lógicas (linha final vazia inclusa)', () => {
    expect(Ut.countLines('')).toBe(1);
    expect(Ut.countLines('a')).toBe(1);
    expect(Ut.countLines('a\nb\n')).toBe(3);
  });

  it('lineColAt calcula linha e coluna base 1', () => {
    expect(Ut.lineColAt('ab\ncd', 0)).toEqual({ line: 1, col: 1 });
    expect(Ut.lineColAt('ab\ncd', 2)).toEqual({ line: 1, col: 3 });
    expect(Ut.lineColAt('ab\ncd', 3)).toEqual({ line: 2, col: 1 });
    expect(Ut.lineColAt('ab\ncd', 5)).toEqual({ line: 2, col: 3 });
  });
});

describe('utils: busca e substituição', () => {
  it('buildSearchRegex devolve null para busca vazia', () => {
    expect(Ut.buildSearchRegex('')).toBe(null);
  });

  it('ignora maiúsculas por padrão e respeita caseSensitive', () => {
    expect(Ut.findAll('Casa casa CASA', Ut.buildSearchRegex('casa')).length).toBe(3);
    expect(Ut.findAll('Casa casa CASA', Ut.buildSearchRegex('casa', { caseSensitive: true })).length).toBe(1);
  });

  it('palavra inteira funciona com acentos', () => {
    const text = 'ação reação ação';
    expect(Ut.findAll(text, Ut.buildSearchRegex('ação')).length).toBe(3);
    const whole = Ut.findAll(text, Ut.buildSearchRegex('ação', { wholeWord: true }));
    expect(whole.map(m => m.index)).toEqual([0, 12]);
  });

  it('caracteres especiais são buscados literalmente', () => {
    expect(Ut.findAll('a.b axb', Ut.buildSearchRegex('a.b'))).toEqual([{ index: 0, length: 3 }]);
    expect(Ut.findAll('preço $10 (x)', Ut.buildSearchRegex('$10 (x)')).length).toBe(1);
  });

  it('replaceAllLiteral não interpreta $& nem $1', () => {
    const re = Ut.buildSearchRegex('gato');
    expect(Ut.replaceAllLiteral('gato e gato', re, '$&!')).toBe('$&! e $&!');
    expect(Ut.replaceAllLiteral('gato', re, '$1')).toBe('$1');
  });
});

describe('utils: links', () => {
  it('findUrls encontra várias URLs e remove pontuação final', () => {
    const found = Ut.findUrls('veja https://example.com/a. e http://x.org/b?q=1, ok');
    expect(found).toEqual([
      { url: 'https://example.com/a', index: 5 },
      { url: 'http://x.org/b?q=1', index: 30 },
    ]);
  });

  it('findUrls não inclui parênteses e ignora "https://" sozinho', () => {
    expect(Ut.findUrls('(https://x.com/a)').map(u => u.url)).toEqual(['https://x.com/a']);
    expect(Ut.findUrls('https:// nada')).toEqual([]);
  });

  it('domainOf remove www e tolera URL inválida', () => {
    expect(Ut.domainOf('https://www.github.com/x')).toBe('github.com');
    expect(Ut.domainOf('não é url')).toBe('não é url');
  });

  it('faviconUrl usa o hostname e devolve null para URL inválida', () => {
    expect(Ut.faviconUrl('https://a.com/x')).toContain('domain=a.com');
    expect(Ut.faviconUrl('???')).toBe(null);
  });

  it('extractTitle prefere og:title, decodifica entidades e usa fallback', () => {
    expect(Ut.extractTitle('<title>Título</title><meta property="og:title" content="OG &amp; cia">', 'fb')).toBe('OG & cia');
    expect(Ut.extractTitle('<title>  A &amp;\n B </title>', 'fb')).toBe('A & B');
    expect(Ut.extractTitle('<p>sem título</p>', 'fb')).toBe('fb');
    expect(Ut.extractTitle('', 'fb')).toBe('fb');
  });

  it('extractTitle não executa scripts do HTML', () => {
    Ut.extractTitle('<title>x</title><img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>', 'fb');
    expect(window.__pwned).toBe(undefined);
  });
});

describe('utils: arquivos', () => {
  it('ensureExtension adiciona .txt só quando falta extensão', () => {
    expect(Ut.ensureExtension('nota')).toBe('nota.txt');
    expect(Ut.ensureExtension('nota.md')).toBe('nota.md');
    expect(Ut.ensureExtension('v1.2 final')).toBe('v1.2 final.txt');
  });

  it('ensureExtension remove caracteres inválidos e trata vazio', () => {
    expect(Ut.ensureExtension('a/b:c*?')).toBe('a_b_c__.txt');
    expect(Ut.ensureExtension('   ')).toBe('Sem título.txt');
  });
});
