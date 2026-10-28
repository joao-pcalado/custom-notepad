// ══════════════════════════════════════════════════
// UTILS — funções puras (sem estado do editor)
// Usadas pelo main.js e cobertas pelos testes em tests/.
// ══════════════════════════════════════════════════
(function (global) {
  'use strict';

  const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
  // pontuação que normalmente fecha a frase, não a URL ("veja https://x.com.")
  const URL_TRAILING_PUNCT = /[.,;:!?]+$/;

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function countWords(text) {
    const t = String(text).trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function formatWordCount(n) { return n + (n === 1 ? ' palavra' : ' palavras'); }

  function countLines(text) {
    let n = 1;
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
    return n;
  }

  // linha/coluna (base 1) de um offset dentro do texto
  function lineColAt(text, offset) {
    const before = text.slice(0, Math.max(0, offset));
    const lastNl = before.lastIndexOf('\n');
    return { line: countLines(before), col: before.length - lastNl };
  }

  // ── Busca ────────────────────────────────────────
  // "Palavra inteira" usa classes Unicode para funcionar com acentos (ex.: "ação").
  function buildSearchRegex(query, opts) {
    if (!query) return null;
    const o = opts || {};
    let pat = escRe(query);
    if (o.wholeWord) pat = `(?<![\\p{L}\\p{N}_])${pat}(?![\\p{L}\\p{N}_])`;
    return new RegExp(pat, o.caseSensitive ? 'gu' : 'giu');
  }

  function findAll(text, re) {
    if (!re) return [];
    return [...text.matchAll(re)]
      .filter(m => m[0].length > 0)
      .map(m => ({ index: m.index, length: m[0].length }));
  }

  // substituição literal: "$1" ou "$&" no texto de substituição não são interpretados
  function replaceAllLiteral(text, re, replacement) {
    if (!re) return text;
    return text.replace(re, () => replacement);
  }

  // ── Links ────────────────────────────────────────
  function findUrls(text) {
    const out = [];
    for (const m of String(text).matchAll(URL_RE)) {
      const url = m[0].replace(URL_TRAILING_PUNCT, '');
      if (url.length > 'https://'.length) out.push({ url, index: m.index });
    }
    return out;
  }

  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return String(url).slice(0, 20); }
  }

  function faviconUrl(url) {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
    catch { return null; }
  }

  // extrai og:title ou <title> de um HTML (DOMParser não executa scripts)
  function extractTitle(html, fallback) {
    if (html && typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
      const title = (og || doc.title || '').replace(/\s+/g, ' ').trim();
      if (title) return title.slice(0, 120);
    }
    return fallback;
  }

  // ── Arquivos ─────────────────────────────────────
  function ensureExtension(name) {
    const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Sem título';
    return /\.[^.\s]+$/.test(clean) ? clean : clean + '.txt';
  }

  const api = {
    URL_RE, escHtml, escRe, countWords, formatWordCount, countLines, lineColAt,
    buildSearchRegex, findAll, replaceAllLiteral,
    findUrls, domainOf, faviconUrl, extractTitle, ensureExtension,
  };

  global.BlocoUtils = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
