// ══════════════════════════════════════════════════
// Mini executor de testes — zero dependências, roda no navegador.
// API: describe / it / beforeEach / expect. Resultado final em window.__testResults.
// ══════════════════════════════════════════════════
(function () {
  'use strict';

  const suites = [];
  let current = null;

  window.describe = (name, fn) => {
    current = { name, tests: [], beforeEach: [] };
    suites.push(current);
    fn();
    current = null;
  };
  window.it = (name, fn) => current.tests.push({ name, fn });
  window.beforeEach = fn => current.beforeEach.push(fn);

  const fmt = v => {
    try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); }
    catch { return String(v); }
  };
  const deepEqual = (a, b) => fmt(a) === fmt(b);

  window.expect = actual => {
    const fail = msg => { throw new Error(msg); };
    const api = {
      toBe: exp => { if (!Object.is(actual, exp)) fail(`esperado ${fmt(exp)}, recebido ${fmt(actual)}`); },
      toEqual: exp => { if (!deepEqual(actual, exp)) fail(`esperado ${fmt(exp)}, recebido ${fmt(actual)}`); },
      toBeTruthy: () => { if (!actual) fail(`esperado valor verdadeiro, recebido ${fmt(actual)}`); },
      toBeFalsy: () => { if (actual) fail(`esperado valor falso, recebido ${fmt(actual)}`); },
      toContain: item => { if (!actual || !actual.includes(item)) fail(`${fmt(actual)} não contém ${fmt(item)}`); },
      toBeGreaterThan: n => { if (!(actual > n)) fail(`esperado > ${n}, recebido ${fmt(actual)}`); },
      toThrow: () => {
        let threw = false;
        try { actual(); } catch { threw = true; }
        if (!threw) fail('esperado que lançasse um erro');
      },
    };
    api.not = {
      toBe: exp => { if (Object.is(actual, exp)) fail(`não esperado ${fmt(exp)}`); },
      toEqual: exp => { if (deepEqual(actual, exp)) fail(`não esperado ${fmt(exp)}`); },
      toContain: item => { if (actual && actual.includes(item)) fail(`${fmt(actual)} não deveria conter ${fmt(item)}`); },
      toThrow: () => { try { actual(); } catch (e) { fail('não esperado erro: ' + e.message); } },
    };
    return api;
  };

  const TIMEOUT = 8000;
  const withTimeout = p => Promise.race([
    p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout (${TIMEOUT}ms)`)), TIMEOUT)),
  ]);

  window.runTests = async function () {
    const out = document.getElementById('results');
    const summary = document.getElementById('summary');
    const filter = new URLSearchParams(location.search).get('grep');
    const results = { passed: 0, failed: 0, failures: [], done: false };
    window.__testResults = results;
    const t0 = performance.now();

    for (const suite of suites) {
      const sec = document.createElement('section');
      const h = document.createElement('h2');
      h.textContent = suite.name;
      sec.appendChild(h);
      out.appendChild(sec);

      for (const test of suite.tests) {
        const full = `${suite.name} › ${test.name}`;
        if (filter && !full.toLowerCase().includes(filter.toLowerCase())) continue;
        const row = document.createElement('div');
        row.className = 'test';
        try {
          for (const fn of suite.beforeEach) await withTimeout(Promise.resolve(fn()));
          await withTimeout(Promise.resolve(test.fn()));
          results.passed++;
          row.classList.add('pass');
          row.textContent = '✓ ' + test.name;
        } catch (err) {
          results.failed++;
          results.failures.push({ test: full, error: err.message });
          row.classList.add('fail');
          row.textContent = '✗ ' + test.name;
          const pre = document.createElement('pre');
          pre.textContent = err.stack || err.message;
          row.appendChild(pre);
        }
        sec.appendChild(row);
        summary.textContent = `${results.passed} passaram, ${results.failed} falharam…`;
      }
    }

    results.done = true;
    results.ms = Math.round(performance.now() - t0);
    summary.textContent = `${results.passed} passaram, ${results.failed} falharam — ${results.ms} ms`;
    summary.className = results.failed ? 'fail' : 'pass';
    document.title = (results.failed ? '✗ ' : '✓ ') + 'Testes — Bloco';
    return results;
  };
})();
