// Probes for the guided simulation path. Starts the mock server itself.
// Usage: cd tests && node guided.mjs [section...]   (sections: smoke state)
// UX regression suite (ux-audit/regression.mjs) – NODE_PATH is ignored by ESM imports, so link the deps once:
//   ln -sfn ../tests/node_modules ux-audit/node_modules   (ux-audit/* is gitignored)
//   cd tests && node mock-server.mjs &  then  cd ../ux-audit && node regression.mjs; kill the server by PID
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8797, BASE = `http://127.0.0.1:${PORT}`, MOCK = `${BASE}/mock`;
const APP = (q = '') => `${BASE}/rybex-ai-workshop.html?ai=${encodeURIComponent(MOCK)}${q}`;
const want = process.argv.slice(2);
const run = s => !want.length || want.includes(s);

const srv = spawn('node', [path.join(HERE, 'mock-server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => srv.stdout.once('data', r));
// Without this a failed browser launch leaves the mock server running and the command never returns.
const browser = await chromium.launch().catch(e => { srv.kill(); throw e; });
let pass = 0, fail = 0;
const ok = (id, cond, detail = '') => { if (cond) { pass++; console.log('  PASS', id); } else { fail++; console.log('  FAIL', id, detail); } };

async function fresh(hash = '#/home', q = '', vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
  await p.goto(APP(q) + hash);
  await p.waitForFunction(() => document.documentElement.classList.contains('app-ready'), null, { timeout: 8000 });
  return p;
}
// Runs fn in the page (it can reach the app's globals: S, team(), lab() ...), then persists and re-renders.
const seed = (p, fn) => p.evaluate(`(${fn})(); save(); render();`);

try {
  if (run('smoke')) { const p = await fresh();
    ok('smoke app ready, no errors', p.errs.length === 0, p.errs.join('|'));
    ok('smoke state readable', await p.evaluate(() => typeof team().name === 'string'));
    await p.close(); }
  if (run('state')) { const p = await fresh();
    const d = await p.evaluate(() => defaultTeam());
    ok('state v3 fields', ['goal','onboardedAt','seen','site','inbox','quizzes','challenges','risks','badges'].every(k => k in d) && 'decisions' in d.arch && Array.isArray(d.lab.vision.prompts));
    ok('state file version 3', await p.evaluate(() => FILE_VERSION) === 3);
    const m = await p.evaluate(() => { const old = { name: 'Stary', track: 'vision', log: [{ id: 'a', ts: '2026-11-01', track: 'vision', cfg: { x: 1 }, res: { primary: { v: .7, m: 'F1' } }, note: 'n' }], lab: { vision: { revealed: true, testViews: 2 } } }; return normTeam(old); });
    ok('state v2 file keeps log, reveal and views', m.log.length === 1 && m.lab.vision.revealed === true && m.lab.vision.testViews === 2 && m.goal === '' && m.site.newsRead === false);
    const junk = await p.evaluate(() => normTeam({ inbox: 'x', quizzes: 5, risks: [1], badges: { a: 1 }, site: null, goal: 7, arch: { decisions: 'no' }, inbox2: 1 }));
    ok('state junk values fall back to defaults', Array.isArray(junk.inbox) && junk.inbox.length === 0 && typeof junk.goal === 'string' && Array.isArray(junk.badges) && typeof junk.arch.decisions === 'object');
    const big = await p.evaluate(() => normTeam({ inbox: Array.from({ length: 50 }, (_, i) => ({ id: 'i' + i, ts: '', product: 0, cat: 'damage', text: 'x'.repeat(9000) })) }));
    ok('state inbox capped at 20 items and 2000 chars', big.inbox.length === 20 && big.inbox[0].text.length === 2000);
    ok('state base flag survives', await p.evaluate(() => normTeam({ log: [{ track: 'vision', base: true }] }).log[0].base) === true);
    await p.close(); }
} catch (e) { fail++; console.log('ERROR', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.kill();
process.exit(fail ? 1 : 0);
