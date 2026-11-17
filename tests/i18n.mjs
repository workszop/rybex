// i18n: every T('polish') in js/ has an English entry in i18n/en.js, no entry is unused, and the dictionary is fetched only for English readers.
// Usage: cd tests && node i18n.mjs
import { chromium } from 'playwright';
import * as acorn from 'acorn';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

// ---- static: the keys used in js/ against the dictionary ----
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'i18n/en.js'), 'utf8'), sandbox);
const dict = sandbox.window.I18N_EN, used = new Set(), single = [];
const str = n => n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null;
function walk(n, f) {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'T' && n.arguments.length === 1) {
    const k = str(n.arguments[0]); if (k !== null) { used.add(k); single.push(f + ': ' + k.slice(0, 50)); }
  }
  for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(c => walk(c, f)); else if (v && typeof v.type === 'string') walk(v, f); }
}
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(x => x.endsWith('.js'))) walk(acorn.parse(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' }), f);
const missing = [...used].filter(k => !(k in dict)), unused = Object.keys(dict).filter(k => !used.has(k)), empty = Object.entries(dict).filter(([, v]) => typeof v !== 'string' || !v.trim());
ok('every T(\'polish\') has an English entry', missing.length === 0, missing.slice(0, 5).join(' | '));
ok('no unused English entries', unused.length === 0, unused.slice(0, 5).join(' | '));
ok('no empty English entries', empty.length === 0, JSON.stringify(empty.slice(0, 3)));
ok('the dictionary is not trivially small', Object.keys(dict).length > 1000, String(Object.keys(dict).length));

// ---- runtime: Polish readers never fetch it, English readers do ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => { const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => srv.listen(8836, '127.0.0.1', r));
const browser = await chromium.launch().catch(e => { srv.close(); throw e; });
const APP = '/rybex-ai-workshop.html?rooms=0';
async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } }), p = await ctx.newPage(), reqs = [], errs = [];
  p.on('request', r => reqs.push(new URL(r.url()).pathname)); p.on('pageerror', e => errs.push(e.message));
  if (init) await p.addInitScript(init);
  await p.goto('http://127.0.0.1:8836' + APP + '#/home');
  await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 15000 });
  return { p, ctx, reqs, errs };
}
try {
  { const { p, ctx, reqs, errs } = await open();
    ok('Polish reader: i18n/en.js is not fetched', !reqs.includes('/i18n/en.js') && await p.evaluate(() => !window.I18N_EN));
    ok('Polish reader: the page is in Polish', (await p.textContent('#nav')).includes('Opis projektu'));
    await p.click('#langSeg button[data-l=en]');
    await p.waitForFunction(() => S.lang === 'en' && document.querySelector('#nav').textContent.includes('Brief'), null, { timeout: 8000 }).catch(() => {});
    ok('switching to English fetches the dictionary and renders English', reqs.includes('/i18n/en.js') && (await p.textContent('#nav')).includes('Brief') && !(await p.textContent('#nav')).includes('Opis projektu'));
    await p.click('#langSeg button[data-l=pl]');
    ok('switching back to Polish works', (await p.textContent('#nav')).includes('Opis projektu'));
    ok('no page errors (switching)', errs.length === 0, errs.join(' | ')); await ctx.close(); }
  { const { p, ctx, reqs, errs } = await open();
    await p.evaluate(() => { const cur = readStore() || {}; localStorage.setItem(STORE_KEY, JSON.stringify({ ...cur, lang: 'en' })); });
    reqs.length = 0; await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 15000 });
    ok('English reader on reload: the dictionary is fetched before the first render, the page is English', reqs.includes('/i18n/en.js') && (await p.textContent('#nav')).includes('Brief'));
    ok('no page errors (English start)', errs.length === 0, errs.join(' | ')); await ctx.close(); }
  { const c2 = await browser.newContext(), q = await c2.newPage(); await q.goto('http://127.0.0.1:8836' + APP + '&i18n=all#/home'); await q.waitForFunction(() => document.documentElement.classList.contains('app-ready'));
    ok('?i18n=all loads the dictionary for everyone', await q.evaluate(() => !!window.I18N_EN && Object.keys(window.I18N_EN).length > 1000)); await c2.close(); }
} finally { await browser.close(); srv.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
